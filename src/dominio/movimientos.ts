import { sumarMeses } from "@/lib/fecha";
import { diasEntre, periodoDeFecha } from "@/lib/periodo";
import type { LecturaLeida, Moneda, TipoMovimiento } from "./comprobantes/tipos";
import { CUOTAS_MAXIMAS, type MedioPago } from "./esquemas";

/**
 * Las reglas de los movimientos: que se hace con lo que leyo el lector de
 * comprobantes. Funciones puras, sin Prisma: lo que lee y escribe esta en
 * src/datos/movimientos.ts.
 *
 * Lo delicado no es leer, es no inflar el mes. Por eso:
 *
 *   - Un ingreso, un traspaso entre cuentas del hogar, el pago de la tarjeta
 *     y un giro no son gastos: quedan fuera, con el motivo a la vista.
 *   - La boleta de la tienda y el aviso del banco de la misma compra se
 *     juntan en un solo movimiento.
 *   - Si ya hay un gasto con el mismo monto dos dias antes o despues, Luka
 *     pregunta si es el mismo antes de crear otro.
 *   - Una compra en cuotas se propone como deuda: en Luka una cuota no es un
 *     gasto (el balance las descuenta por su lado).
 *   - Si calza con una cuenta o una cuota que falta pagar, se propone
 *     marcarla pagada, que es lo que crea su gasto.
 *
 * Nada se confirma solo: todo lo que puede ser un gasto espera en la
 * bandeja «Por revisar» hasta que alguien del hogar lo confirma.
 */

export type EstadoMovimiento = "POR_REVISAR" | "CONFIRMADO" | "DESCARTADO" | "IGNORADO" | "JUNTADO";
export type SentidoMovimiento = "GASTO" | "INGRESO" | "NINGUNO";
export type DestinoMovimiento = "GASTO_NUEVO" | "GASTO_EXISTENTE" | "PAGO_DE_CUENTA" | "PAGO_DE_CUOTA" | "DEUDA";
export type TipoCuentaBancaria =
  | "CUENTA_CORRIENTE"
  | "CUENTA_VISTA"
  | "CUENTA_AHORRO"
  | "TARJETA_CREDITO"
  | "TARJETA_DEBITO";

const SENTIDO: Record<LecturaLeida["sentido"], SentidoMovimiento> = {
  gasto: "GASTO",
  ingreso: "INGRESO",
  ninguno: "NINGUNO",
};

// ---------------------------------------------------------------------------
// De la lectura al movimiento
// ---------------------------------------------------------------------------

/** Una cuenta o tarjeta del hogar, como la necesitan las reglas. */
export type CuentaDelHogar = { banco: string; tipo: TipoCuentaBancaria; ultimos4: string };

/** Las columnas de un Movimiento nuevo, sin el hogar, la huella ni la fecha de llegada. */
export type DatosDeMovimiento = {
  estado: "POR_REVISAR" | "IGNORADO";
  tipo: TipoMovimiento;
  sentido: SentidoMovimiento;
  monto: number;
  moneda: Moneda;
  /** AAAA-MM-DD */
  fecha: string;
  comercio: string;
  fuente: string;
  plantilla: string | null;
  confianza: number | null;
  medioPago: MedioPago | null;
  ultimos4: string | null;
  cuotas: number | null;
  contraparteNombre: string | null;
  contraparteBanco: string | null;
  contraparteUltimos4: string | null;
  sinDetalle: boolean;
  reenviadoAMano: boolean;
};

const CUATRO_DIGITOS = /^\d{4}$/;

function cuatroDigitos(valor: string | undefined): string | null {
  return valor !== undefined && CUATRO_DIGITOS.test(valor) ? valor : null;
}

function recortar(valor: string | undefined, largo: number): string | null {
  const limpio = valor?.trim();
  return limpio === undefined || limpio === "" ? null : limpio.slice(0, largo);
}

/** Sin tildes ni mayusculas. */
function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const PALABRAS_DEL_BANCO = new Set(["banco", "de", "del", "la", "chile", "sa", "s", "a"]);

/**
 * "BANCO SANTANDER-CHILE" y "Santander" son el mismo; "BancoEstado" y "Banco
 * del Estado de Chile", tambien. Si no queda nada (el "Banco de Chile"), el
 * nombre entero es lo que lo distingue.
 */
function nombreDelBanco(banco: string): string {
  const palabras = sinTildes(banco)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((palabra) => palabra !== "");
  const distintivo = palabras
    .map((palabra) => (palabra.length > 5 && palabra.startsWith("banco") ? palabra.slice(5) : palabra))
    .filter((palabra) => !PALABRAS_DEL_BANCO.has(palabra))
    .join(" ");
  return distintivo !== "" ? distintivo : palabras.join(" ");
}

export function mismoBanco(a: string, b: string): boolean {
  const x = nombreDelBanco(a);
  const y = nombreDelBanco(b);
  return x !== "" && y !== "" && (x.includes(y) || y.includes(x));
}

/**
 * La cuenta del hogar a la que fue (o de la que vino) la plata, si es una:
 * mismos 4 digitos y, si los dos dicen el banco, el mismo banco. Con el banco
 * distinto no se toma por propia: dos cuentas de bancos distintos pueden
 * terminar igual, y es mejor preguntar que esconder un gasto.
 */
export function cuentaPropiaDe(
  contraparte: { ultimos4: string | null; banco: string | null },
  cuentas: readonly CuentaDelHogar[],
): CuentaDelHogar | null {
  if (contraparte.ultimos4 === null) return null;
  return (
    cuentas.find(
      (cuenta) =>
        cuenta.ultimos4 === contraparte.ultimos4 &&
        (contraparte.banco === null || mismoBanco(contraparte.banco, cuenta.banco)),
    ) ?? null
  );
}

/**
 * Lo que se guarda de una lectura, ya con las reglas que no dependen de lo
 * que habia antes: si es un traspaso o el pago de la tarjeta (por las
 * cuentas del hogar), y si va a la bandeja o queda fuera.
 */
export function deLectura(lectura: LecturaLeida, cuentasDelHogar: readonly CuentaDelHogar[]): DatosDeMovimiento {
  if (!Number.isSafeInteger(lectura.monto) || lectura.monto <= 0) {
    throw new Error(`Monto invalido en la lectura: ${lectura.monto}.`);
  }

  const contraparteUltimos4 = cuatroDigitos(lectura.contraparte?.ultimos4);
  const contraparteBanco = recortar(lectura.contraparte?.banco, 60);
  let tipo = lectura.tipo;

  // Una transferencia a una cuenta del hogar no es un gasto: es la misma
  // plata en otro bolsillo. Si la cuenta es la tarjeta de credito, es su pago.
  if (tipo === "TRANSFERENCIA" || tipo === "ABONO") {
    const propia = cuentaPropiaDe({ ultimos4: contraparteUltimos4, banco: contraparteBanco }, cuentasDelHogar);
    if (propia !== null) tipo = propia.tipo === "TARJETA_CREDITO" && tipo === "TRANSFERENCIA" ? "PAGO_TARJETA" : "TRASPASO_PROPIO";
  }

  const sentido = SENTIDO[lectura.sentido];
  const cuotas =
    lectura.cuotas !== undefined && Number.isInteger(lectura.cuotas) && lectura.cuotas >= 2 && lectura.cuotas <= CUOTAS_MAXIMAS
      ? lectura.cuotas
      : null;
  const confianza =
    lectura.confianza === undefined || !Number.isFinite(lectura.confianza)
      ? null
      : Math.min(1, Math.max(0, lectura.confianza));

  const datos: DatosDeMovimiento = {
    estado: "POR_REVISAR",
    tipo,
    sentido,
    monto: lectura.monto,
    moneda: lectura.moneda,
    fecha: lectura.fecha,
    comercio: recortar(lectura.comercio, 120) ?? "Sin nombre",
    fuente: recortar(lectura.fuente, 80) ?? "Comprobante",
    plantilla: lectura.via === "plantilla" ? recortar(lectura.plantilla, 60) ?? "plantilla" : null,
    confianza: lectura.via === "ia" ? confianza : null,
    medioPago: lectura.medioPago ?? null,
    ultimos4: cuatroDigitos(lectura.ultimos4),
    cuotas,
    contraparteNombre: recortar(lectura.contraparte?.nombre, 120),
    contraparteBanco,
    contraparteUltimos4,
    sinDetalle: lectura.sinDetalle === true,
    reenviadoAMano: lectura.reenviadoAMano === true,
  };
  return { ...datos, estado: motivoParaDejarFuera(datos) === null ? "POR_REVISAR" : "IGNORADO" };
}

// ---------------------------------------------------------------------------
// Lo que queda fuera
// ---------------------------------------------------------------------------

export type MotivoParaDejarFuera = "ingreso" | "traspaso" | "pago-tarjeta" | "giro" | "sin-movimiento";

/**
 * Por que un movimiento no es un gasto, o null si puede serlo. Sale del tipo
 * y del sentido, asi que no se guarda: si alguien lo anota igual y despues
 * se arrepiente, el motivo sigue ahi.
 */
export function motivoParaDejarFuera(movimiento: { tipo: TipoMovimiento; sentido: SentidoMovimiento }): MotivoParaDejarFuera | null {
  if (movimiento.tipo === "TRASPASO_PROPIO") return "traspaso";
  if (movimiento.tipo === "PAGO_TARJETA") return "pago-tarjeta";
  if (movimiento.tipo === "GIRO") return "giro";
  if (movimiento.sentido === "INGRESO") return "ingreso";
  if (movimiento.sentido === "NINGUNO") return "sin-movimiento";
  return null;
}

export const TEXTO_DEL_MOTIVO: Record<MotivoParaDejarFuera, string> = {
  ingreso: "Es plata que entró, no un gasto.",
  traspaso: "La plata se movió entre cuentas del hogar: no es un gasto.",
  "pago-tarjeta": "Es el pago de la tarjeta: cada compra con crédito ya cuenta por su lado.",
  giro: "Lo sacaste del cajero: lo que gastes en efectivo se anota cuando lo gastas.",
  "sin-movimiento": "No movió plata.",
};

/**
 * Lo que Luka dejo fuera y se puede anotar igual: lo que salio de tu cuenta.
 * Un ingreso no: en Luka un gasto siempre es plata que sale.
 */
export function puedeAnotarseIgual(movimiento: { tipo: TipoMovimiento; sentido: SentidoMovimiento }): boolean {
  const motivo = motivoParaDejarFuera(movimiento);
  return movimiento.sentido === "GASTO" && (motivo === "traspaso" || motivo === "pago-tarjeta" || motivo === "giro");
}

// ---------------------------------------------------------------------------
// La misma compra, de dos lados
// ---------------------------------------------------------------------------

/** Lo que miran las reglas para juntar dos movimientos. */
export type MovimientoParaJuntar = {
  estado: EstadoMovimiento;
  tipo: TipoMovimiento;
  sentido: SentidoMovimiento;
  monto: number;
  moneda: Moneda;
  fecha: string;
  ultimos4: string | null;
  sinDetalle: boolean;
};

export type CandidatoParaJuntar = MovimientoParaJuntar & {
  id: string;
  /** Si ya tiene uno juntado: cada movimiento se junta con uno solo. */
  tieneJuntado: boolean;
};

/** Los avisos del banco pueden llegar fechados el dia siguiente al de la boleta. */
export const DIAS_PARA_JUNTAR = 1;

const ESTADOS_QUE_JUNTAN: readonly EstadoMovimiento[] = ["POR_REVISAR", "CONFIRMADO", "IGNORADO"];

function esAvisoDeCuenta(movimiento: Pick<MovimientoParaJuntar, "tipo" | "sinDetalle">): boolean {
  return movimiento.sinDetalle || movimiento.tipo === "COMPRA" || movimiento.tipo === "CARGO";
}

/**
 * Si dos movimientos son la misma compra vista de dos lados: mismo monto y
 * moneda, para el mismo lado, a lo mas un dia de distancia, y una pareja que
 * tenga sentido:
 *
 *   - un aviso sin detalle (el cargo o el abono de Consorcio) con el
 *     comprobante que si lo tiene, o
 *   - la boleta de la tienda con el aviso de compra o de cargo del banco,
 *     de la misma tarjeta si los dos la dicen.
 *
 * Con un aviso sin detalle los 4 digitos no se comparan: el aviso trae los
 * de la cuenta y la boleta los de la tarjeta de debito, que son otros.
 *
 * Dos transferencias iguales el mismo dia no se juntan: pueden ser dos pagos
 * de verdad (a dos personas, por lo mismo).
 */
export function sonLaMismaCompra(a: MovimientoParaJuntar, b: MovimientoParaJuntar): boolean {
  if (a.sentido !== b.sentido || a.sentido === "NINGUNO") return false;
  if (a.moneda !== b.moneda || a.monto !== b.monto) return false;
  if (Math.abs(diasEntre(a.fecha, b.fecha)) > DIAS_PARA_JUNTAR) return false;
  if (a.sinDetalle !== b.sinDetalle) return true;
  if (a.sinDetalle && b.sinDetalle) return false;
  if (a.ultimos4 !== null && b.ultimos4 !== null && a.ultimos4 !== b.ultimos4) return false;
  return (
    (a.tipo === "BOLETA" && b.tipo !== "BOLETA" && esAvisoDeCuenta(b)) ||
    (b.tipo === "BOLETA" && a.tipo !== "BOLETA" && esAvisoDeCuenta(a))
  );
}

/** De dos movimientos que son la misma compra, el que dice mas: el que no es un aviso sin detalle, y si no la boleta. */
function diceMas(a: MovimientoParaJuntar, b: MovimientoParaJuntar): "a" | "b" {
  if (a.sinDetalle !== b.sinDetalle) return a.sinDetalle ? "b" : "a";
  if (a.tipo === "BOLETA" && b.tipo !== "BOLETA") return "a";
  if (b.tipo === "BOLETA" && a.tipo !== "BOLETA") return "b";
  return "a";
}

export type Pareja = {
  candidato: CandidatoParaJuntar;
  /**
   * Cual queda a la vista. El otro pasa a JUNTADO. Si el que ya estaba se
   * confirmo, manda el: lo que alguien ya decidio no se deshace solo.
   */
  principal: "nuevo" | "candidato";
};

/**
 * La pareja de un movimiento que acaba de llegar, entre los que ya estaban,
 * o null. De varios posibles, el de fecha mas cercana. Lo descartado no
 * cuenta: si alguien descarto el aviso esperando el comprobante, el
 * comprobante tiene que aparecer.
 */
export function elegirPareja(nuevo: MovimientoParaJuntar, candidatos: readonly CandidatoParaJuntar[]): Pareja | null {
  const posibles = candidatos
    .filter((c) => ESTADOS_QUE_JUNTAN.includes(c.estado) && !c.tieneJuntado && sonLaMismaCompra(nuevo, c))
    .sort(
      (x, y) =>
        Math.abs(diasEntre(nuevo.fecha, x.fecha)) - Math.abs(diasEntre(nuevo.fecha, y.fecha)) ||
        (x.id < y.id ? -1 : x.id > y.id ? 1 : 0),
    );
  const candidato = posibles[0];
  if (candidato === undefined) return null;
  if (candidato.estado === "CONFIRMADO") return { candidato, principal: "candidato" };
  return { candidato, principal: diceMas(nuevo, candidato) === "a" ? "nuevo" : "candidato" };
}

// ---------------------------------------------------------------------------
// El comercio y sus reglas
// ---------------------------------------------------------------------------

type Palabra = { original: string; normal: string };

/** Lo que sobra en un nombre de comercio: la razon social y los pedazos de una direccion web. */
const SOBRANTES = new Set(["spa", "ltda", "limitada", "eirl", "cia", "sa", "www", "com", "cl", "http", "https"]);

/** Las que unen palabras: no deciden de que comercio se trata. */
const DE_UNION = new Set(["de", "del", "la", "las", "el", "los", "y", "e"]);

/**
 * Las que no dicen que comercio es: el tipo de empresa o quien cobro por
 * ella. «Comercial Los Aromos» no es «Comercial Tres Montes», y Mercado Pago
 * cobra por miles de tiendas.
 */
const GENERICAS = new Set([
  "comercial", "comercializadora", "inversiones", "sociedad", "servicio", "servicios", "inmobiliaria",
  "distribuidora", "importadora", "exportadora", "empresa", "empresas", "tienda", "tiendas", "constructora",
  "transportes", "centro", "clinica", "grupo", "corporacion", "fundacion", "agricola", "industrial",
  "compania", "compra", "pago", "pagos", "mercado", "merpago", "mercadopago", "paypal", "dlocal", "flow",
  "webpay", "transbank", "sumup", "getnet", "khipu", "pos",
]);

function palabrasDe(texto: string): Palabra[] {
  return texto
    .split(/[^\p{L}\p{N}]+/u)
    .map((original) => ({ original, normal: sinTildes(original) }))
    .filter(({ normal }) => normal.length > 1 && !/^\d+$/.test(normal) && !SOBRANTES.has(normal));
}

export type ClaveDeComercio = {
  /** Lo que se compara: "lider", "comercial los aromos". */
  clave: string;
  /** Lo que se muestra: "Líder", "Comercial Los Aromos". */
  etiqueta: string;
};

/** Hasta cuantas palabras se guardan del nombre de una persona. */
const PALABRAS_DE_UNA_PERSONA = 6;

const TIPOS_CON_REGLA: readonly TipoMovimiento[] = ["COMPRA", "BOLETA", "PAGO", "TRANSFERENCIA", "CARGO"];

/**
 * Como se reconoce un comercio en las reglas, o null si no se puede (un
 * aviso sin detalle dice "Cargo en cuenta", que no es ningun comercio).
 *
 * De una tienda basta la primera palabra que la distingue: "LIDER EXPRESS
 * LAS CONDES" es Líder, "COPEC Av. Matta" es Copec. De una transferencia va
 * el nombre completo de la persona: dos Juan no son el mismo.
 */
export function claveDeComercio(comercio: string, tipo: TipoMovimiento, sinDetalle: boolean): ClaveDeComercio | null {
  if (sinDetalle || !TIPOS_CON_REGLA.includes(tipo)) return null;
  const palabras = palabrasDe(comercio);
  if (palabras.length === 0) return null;

  let tomadas: Palabra[];
  if (tipo === "TRANSFERENCIA") {
    tomadas = palabras.slice(0, PALABRAS_DE_UNA_PERSONA);
  } else {
    const hasta = palabras.findIndex(({ normal }) => !GENERICAS.has(normal) && !DE_UNION.has(normal));
    tomadas = hasta === -1 ? palabras : palabras.slice(0, hasta + 1);
  }
  // Una regla no termina en "de" ni en "los": se cortan del final.
  while (tomadas.length > 1 && DE_UNION.has(tomadas[tomadas.length - 1]!.normal)) tomadas = tomadas.slice(0, -1);

  return {
    clave: tomadas.map((p) => p.normal).join(" ").slice(0, 120),
    etiqueta: tomadas.map((p) => p.original).join(" ").slice(0, 120),
  };
}

/** Si un comercio empieza con las palabras de la clave: "LIDER EXPRESS" calza con "lider". */
export function calzaConClave(comercio: string, clave: string): boolean {
  const deLaClave = clave.split(" ").filter((p) => p !== "");
  if (deLaClave.length === 0) return false;
  const palabras = palabrasDe(comercio).map((p) => p.normal);
  return deLaClave.every((palabra, i) => palabras[i] === palabra);
}

export type ReglaPlana = { clave: string; etiqueta: string; categoriaId: string };

/** Un gasto de antes, para sugerir la categoria y para preguntar si es el mismo. */
export type GastoParaComparar = {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  categoriaId: string;
  /** Si es el pago de una cuenta o de una cuota, de cual: "Luz", "Crédito de consumo". */
  pagoDe: { tipo: "cuenta" | "cuota"; nombre: string } | null;
  /** Las fuentes de los comprobantes que ya se confirmaron como este gasto. */
  fuentes: readonly string[];
};

export type SugerenciaDeCategoria = {
  categoriaId: string;
  /** "regla" si la puso alguien del hogar; "historial" si es la del ultimo gasto igual. */
  porque: "regla" | "historial";
  /** La regla o el gasto de donde salio: "Líder". */
  de: string;
};

/**
 * La categoria que se propone: la de la regla del comercio, y si no hay, la
 * del ultimo gasto que empieza igual. Solo categorias activas: una
 * desactivada ya no se ofrece en ningun formulario.
 */
export function sugerirCategoria(
  movimiento: { comercio: string; tipo: TipoMovimiento; sinDetalle: boolean },
  reglas: readonly ReglaPlana[],
  historial: readonly GastoParaComparar[],
  categoriasActivas: ReadonlySet<string>,
): SugerenciaDeCategoria | null {
  const clave = claveDeComercio(movimiento.comercio, movimiento.tipo, movimiento.sinDetalle);
  if (clave === null) return null;

  // La regla mas especifica gana: "lider express" antes que "lider".
  const regla = reglas
    .filter((r) => categoriasActivas.has(r.categoriaId) && calzaConClave(movimiento.comercio, r.clave))
    .sort((a, b) => b.clave.split(" ").length - a.clave.split(" ").length)[0];
  if (regla !== undefined) return { categoriaId: regla.categoriaId, porque: "regla", de: regla.etiqueta };

  // Del mas reciente al mas antiguo; los pagos de cuotas no cuentan, su
  // categoria es la de las deudas.
  const anterior = [...historial]
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
    .find(
      (g) =>
        g.pagoDe?.tipo !== "cuota" && categoriasActivas.has(g.categoriaId) && calzaConClave(g.descripcion, clave.clave),
    );
  return anterior === undefined ? null : { categoriaId: anterior.categoriaId, porque: "historial", de: anterior.descripcion };
}

// ---------------------------------------------------------------------------
// Lo que ya estaba anotado
// ---------------------------------------------------------------------------

/** Cuantos dias antes o despues se busca un gasto con el mismo monto. */
export const DIAS_PARA_PREGUNTAR = 2;

/**
 * Un gasto ya anotado que puede ser este mismo: mismo monto, a lo mas dos
 * dias de distancia. No cuenta uno que vino de un comprobante de la misma
 * fuente: si el mismo banco avisa dos compras iguales, son dos compras.
 */
export function buscarGastoParecido(
  movimiento: { monto: number; moneda: Moneda; fecha: string; sentido: SentidoMovimiento; fuente: string },
  gastos: readonly GastoParaComparar[],
): GastoParaComparar | null {
  if (movimiento.moneda !== "CLP" || movimiento.sentido !== "GASTO") return null;
  return (
    gastos
      .filter(
        (g) =>
          g.monto === movimiento.monto &&
          Math.abs(diasEntre(movimiento.fecha, g.fecha)) <= DIAS_PARA_PREGUNTAR &&
          !g.fuentes.includes(movimiento.fuente),
      )
      .sort(
        (a, b) =>
          Math.abs(diasEntre(movimiento.fecha, a.fecha)) - Math.abs(diasEntre(movimiento.fecha, b.fecha)) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      )[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// Lo que falta pagar
// ---------------------------------------------------------------------------

export type CuentaPendiente = { id: string; nombre: string; monto: number; mes: string };
export type CuotaPendiente = { deudaId: string; nombre: string; mes: string; numero: number; de: number; monto: number };

export type PagoPendiente = { tipo: "cuenta"; cuenta: CuentaPendiente } | { tipo: "cuota"; cuota: CuotaPendiente };

const TIPOS_QUE_PAGAN: readonly TipoMovimiento[] = ["PAGO", "TRANSFERENCIA", "CARGO", "COMPRA"];

/** Las palabras que distinguen un nombre: sin las de union ni las genericas. */
function distintivas(texto: string): Set<string> {
  return new Set(
    palabrasDe(texto)
      .map((p) => p.normal)
      .filter((p) => p.length >= 3 && !DE_UNION.has(p) && !GENERICAS.has(p) && p !== "cuenta" && p !== "cuota"),
  );
}

function compartenPalabra(a: string, b: string): boolean {
  const deA = distintivas(a);
  return [...distintivas(b)].some((p) => deA.has(p));
}

/**
 * La cuenta o la cuota que este movimiento parece pagar, si es una sola:
 * la del mismo monto exacto o la que comparte una palabra con el comercio
 * ("Enel" y "ENEL DISTRIBUCION"). Si hay varias, la que cumple las dos. Si
 * aun asi queda mas de una, ninguna: elegir mal pagaria la cuenta
 * equivocada.
 */
export function buscarPagoPendiente(
  movimiento: { monto: number; moneda: Moneda; sentido: SentidoMovimiento; tipo: TipoMovimiento; comercio: string },
  cuentas: readonly CuentaPendiente[],
  cuotas: readonly CuotaPendiente[],
): PagoPendiente | null {
  if (movimiento.moneda !== "CLP" || movimiento.sentido !== "GASTO" || !TIPOS_QUE_PAGAN.includes(movimiento.tipo)) {
    return null;
  }
  const opciones: { pago: PagoPendiente; monto: boolean; nombre: boolean }[] = [
    ...cuentas.map((cuenta) => ({ pago: { tipo: "cuenta" as const, cuenta }, monto: cuenta.monto, nombre: cuenta.nombre })),
    ...cuotas.map((cuota) => ({ pago: { tipo: "cuota" as const, cuota }, monto: cuota.monto, nombre: cuota.nombre })),
  ]
    .map((o) => ({ pago: o.pago, monto: o.monto === movimiento.monto, nombre: compartenPalabra(o.nombre, movimiento.comercio) }))
    .filter((o) => o.monto || o.nombre);

  if (opciones.length === 1) return opciones[0]!.pago;
  const conLasDos = opciones.filter((o) => o.monto && o.nombre);
  return conLasDos.length === 1 ? conLasDos[0]!.pago : null;
}

// ---------------------------------------------------------------------------
// Compras en cuotas
// ---------------------------------------------------------------------------

export type PropuestaDeDeuda = {
  nombre: string;
  cuotas: number;
  /** Lo que se paga cada mes, redondeado al peso. */
  montoCuota: number;
  /** El mes de la primera cuota: el que sigue al de la compra. */
  primeraCuota: string;
};

/**
 * La deuda que se propone para una compra en cuotas. La primera cuota llega
 * en el estado de cuenta del mes siguiente, y el mes es el de gastos del
 * hogar (con dia de inicio 27, una compra del 28 de noviembre es de
 * diciembre y su primera cuota, de enero).
 */
export function propuestaDeDeuda(
  movimiento: { comercio: string; monto: number; cuotas: number; fecha: string },
  diaInicioMes = 1,
): PropuestaDeDeuda {
  return {
    nombre: movimiento.comercio.slice(0, 80),
    cuotas: movimiento.cuotas,
    montoCuota: Math.round(movimiento.monto / movimiento.cuotas),
    primeraCuota: sumarMeses(periodoDeFecha(movimiento.fecha, diaInicioMes).mes, 1),
  };
}

// ---------------------------------------------------------------------------
// La revision de cada movimiento de la bandeja
// ---------------------------------------------------------------------------

/** Lo que se le propone hacer a quien revisa. */
export type Propuesta =
  | { como: "gasto" }
  | { como: "mismo-gasto"; gasto: GastoParaComparar }
  | { como: "pago-de-cuenta"; cuenta: CuentaPendiente }
  | { como: "pago-de-cuota"; cuota: CuotaPendiente }
  | { como: "deuda"; deuda: PropuestaDeDeuda };

export type AvisoDeRevision =
  /** Lo leyo la IA: los datos hay que mirarlos. */
  | "ia"
  /** En dolares: el monto en pesos lo dice el estado de cuenta. */
  | "dolares"
  /** Llego reenviado a mano. */
  | "reenviado-a-mano"
  /** Un aviso que no dice con quien. */
  | "sin-detalle"
  /** Luka lo habia dejado fuera y alguien lo volvio a la bandeja. */
  | "estaba-fuera";

export type Revision = {
  propuesta: Propuesta;
  /** La categoria que se propone, tambien para cuando no se acepta la propuesta. */
  categoria: SugerenciaDeCategoria | null;
  /** Para crear una regla al confirmar. null si este movimiento no puede tener regla. */
  clave: ClaveDeComercio | null;
  /** Si va con «Confirmar las listas»: un gasto sin preguntas, con su categoria. */
  lista: boolean;
  avisos: AvisoDeRevision[];
};

/** Lo que mira la revision de un movimiento por revisar. */
export type MovimientoPorRevisar = {
  tipo: TipoMovimiento;
  sentido: SentidoMovimiento;
  monto: number;
  moneda: Moneda;
  fecha: string;
  comercio: string;
  fuente: string;
  plantilla: string | null;
  cuotas: number | null;
  sinDetalle: boolean;
  reenviadoAMano: boolean;
};

/** Lo que falta pagar en un mes. */
export type PendientesDelMes = { cuentas: readonly CuentaPendiente[]; cuotas: readonly CuotaPendiente[] };

export type ContextoDeRevision = {
  reglas: readonly ReglaPlana[];
  /** Los gastos de los ultimos meses: para la categoria y para preguntar si es el mismo. */
  gastos: readonly GastoParaComparar[];
  categoriasActivas: ReadonlySet<string>;
  /**
   * Lo que falta pagar, primero en el mes del movimiento y despues en el
   * anterior: si en su mes no calza nada, puede ser una cuenta pagada tarde.
   */
  pendientes: readonly PendientesDelMes[];
  diaInicioMes: number;
};

/**
 * Que se le propone a quien revisa, en este orden:
 *
 *   1. Una compra en cuotas, como deuda.
 *   2. Si ya hay un gasto igual, preguntar si es el mismo: es lo que mas
 *      infla el mes si se pasa por alto.
 *   3. Si calza con una cuenta o una cuota que falta pagar, pagarla: la de
 *      su mes, o si no la del anterior.
 *   4. Si no, anotarlo como gasto.
 */
export function revisar(movimiento: MovimientoPorRevisar, contexto: ContextoDeRevision): Revision {
  const categoria = sugerirCategoria(movimiento, contexto.reglas, contexto.gastos, contexto.categoriasActivas);
  const clave = claveDeComercio(movimiento.comercio, movimiento.tipo, movimiento.sinDetalle);

  const avisos: AvisoDeRevision[] = [];
  if (movimiento.plantilla === null) avisos.push("ia");
  if (movimiento.moneda === "USD") avisos.push("dolares");
  if (movimiento.reenviadoAMano) avisos.push("reenviado-a-mano");
  if (movimiento.sinDetalle) avisos.push("sin-detalle");
  if (motivoParaDejarFuera(movimiento) !== null) avisos.push("estaba-fuera");

  let propuesta: Propuesta = { como: "gasto" };
  const parecido = buscarGastoParecido(movimiento, contexto.gastos);
  const pago =
    contexto.pendientes.map((delMes) => buscarPagoPendiente(movimiento, delMes.cuentas, delMes.cuotas)).find((p) => p !== null) ??
    null;

  if (movimiento.cuotas !== null && movimiento.moneda === "CLP" && movimiento.sentido === "GASTO") {
    propuesta = {
      como: "deuda",
      deuda: propuestaDeDeuda({ ...movimiento, cuotas: movimiento.cuotas }, contexto.diaInicioMes),
    };
  } else if (parecido !== null) {
    propuesta = { como: "mismo-gasto", gasto: parecido };
  } else if (pago !== null) {
    propuesta = pago.tipo === "cuenta" ? { como: "pago-de-cuenta", cuenta: pago.cuenta } : { como: "pago-de-cuota", cuota: pago.cuota };
  }

  // Reenviado a mano no quita lo de «lista»: lo reenvio alguien del hogar y
  // lo esta viendo. Lo que pide mirar los datos (la IA, los dolares, un aviso
  // sin detalle, algo que Luka habia dejado fuera) si.
  const lista =
    propuesta.como === "gasto" && categoria !== null && avisos.every((aviso) => aviso === "reenviado-a-mano");
  return { propuesta, categoria, clave, lista, avisos };
}
