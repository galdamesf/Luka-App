import type { TipoMovimiento } from "./comprobantes/tipos";
import type { MedioPago } from "./esquemas";
import { PLANTILLAS, calzaRemitente, type Plantilla } from "./plantillas";

/**
 * Los bancos, las billeteras y las tiendas que Luka conoce, y las reglas de
 * las cuentas y tarjetas del hogar: como se nombran, como se reconocen en un
 * comprobante y a cual va cada movimiento. Dominio puro: lo que lee y
 * escribe la base esta en src/datos/bancos.ts.
 *
 * De cada cuenta se guarda el banco, el tipo y los ultimos 4 digitos, nunca
 * el numero completo ni claves: Luka no entra al banco, el banco le habla a
 * Luka por correo.
 */

// ---------------------------------------------------------------------------
// Tipos de cuenta
// ---------------------------------------------------------------------------

/** Los mismos valores del enum TipoCuentaBancaria de Prisma, en el orden en que se ofrecen. */
export const TIPOS_DE_CUENTA = [
  "CUENTA_CORRIENTE",
  "CUENTA_VISTA",
  "CUENTA_AHORRO",
  "TARJETA_CREDITO",
  "TARJETA_DEBITO",
  "TARJETA_PREPAGO",
  /**
   * Una cuenta que Luka reconocio sola con un aviso que no dice si es
   * corriente, vista o de ahorro. No se ofrece al agregar una: quien la
   * conoce elige su tipo, y la cartola lo precisa.
   */
  "CUENTA",
] as const;

export type TipoCuentaBancaria = (typeof TIPOS_DE_CUENTA)[number];

/** Los que se ofrecen al agregar una cuenta a mano. */
export const TIPOS_QUE_SE_OFRECEN = TIPOS_DE_CUENTA.filter((tipo) => tipo !== "CUENTA");

export const NOMBRE_DEL_TIPO: Record<TipoCuentaBancaria, string> = {
  CUENTA_CORRIENTE: "Cuenta corriente",
  CUENTA_VISTA: "Cuenta vista o CuentaRUT",
  CUENTA_AHORRO: "Cuenta de ahorro",
  TARJETA_CREDITO: "Tarjeta de crédito",
  TARJETA_DEBITO: "Tarjeta de débito",
  TARJETA_PREPAGO: "Tarjeta de prepago",
  CUENTA: "Cuenta",
};

export function esTarjeta(tipo: TipoCuentaBancaria): boolean {
  return tipo === "TARJETA_CREDITO" || tipo === "TARJETA_DEBITO" || tipo === "TARJETA_PREPAGO";
}

/** "Cuenta sueldo · •••• 1234", o sin apodo, "Tarjeta de crédito •••• 4821". */
export function nombreDeLaCuenta(cuenta: { apodo: string | null; tipo: TipoCuentaBancaria; ultimos4: string }): string {
  const apodo = cuenta.apodo?.trim();
  return apodo ? `${apodo} · •••• ${cuenta.ultimos4}` : `${NOMBRE_DEL_TIPO[cuenta.tipo]} •••• ${cuenta.ultimos4}`;
}

/** Los ultimos 4 digitos tal como se escriben: sin espacios ni asteriscos. null si no son 4 numeros. */
export function limpiarUltimos4(texto: string): string | null {
  const digitos = texto.replace(/[\s*•·.-]/g, "");
  return /^\d{4}$/.test(digitos) ? digitos : null;
}

// ---------------------------------------------------------------------------
// El catalogo
// ---------------------------------------------------------------------------

export type BancoConocido = {
  /** Para la pantalla: "santander". */
  id: string;
  /** Como se guarda en la cuenta y como se muestra. */
  nombre: string;
  /** Como aparece en los comprobantes de otros bancos. */
  otrosNombres?: readonly string[];
  /** Una billetera o una tarjeta de prepago, no un banco. */
  billetera?: true;
  /**
   * Los dominios desde donde escribe. Van en el filtro del correo cuando
   * Luka todavia no tiene plantillas del banco (y por eso no conoce sus
   * remitentes exactos): asi sus avisos llegan igual y los lee la IA.
   */
  dominios: readonly string[];
};

/**
 * Los bancos y billeteras de Chile que se ofrecen al agregar una cuenta.
 * Cualquier otro se escribe a mano: el nombre es lo que se guarda.
 */
export const BANCOS: readonly BancoConocido[] = [
  { id: "santander", nombre: "Santander", otrosNombres: ["Banco Santander", "Santander Chile"], dominios: ["santander.cl"] },
  {
    id: "bancoestado",
    nombre: "BancoEstado",
    otrosNombres: ["Banco del Estado de Chile", "CuentaRUT"],
    dominios: ["bancoestado.cl"],
  },
  { id: "chile", nombre: "Banco de Chile", otrosNombres: ["Banco Edwards", "Banchile"], dominios: ["bancochile.cl", "bancoedwards.cl"] },
  { id: "bci", nombre: "BCI", otrosNombres: ["Banco de Crédito e Inversiones"], dominios: ["bci.cl"] },
  { id: "scotiabank", nombre: "Scotiabank", dominios: ["scotiabank.cl"] },
  { id: "itau", nombre: "Itaú", otrosNombres: ["Itaú Corpbanca"], dominios: ["itau.cl"] },
  { id: "falabella", nombre: "Banco Falabella", otrosNombres: ["CMR Falabella"], dominios: ["bancofalabella.cl"] },
  { id: "ripley", nombre: "Banco Ripley", dominios: ["bancoripley.cl"] },
  { id: "security", nombre: "Banco Security", dominios: ["bancosecurity.cl"] },
  { id: "consorcio", nombre: "Consorcio", otrosNombres: ["Banco Consorcio"], dominios: ["bancoconsorcio.cl"] },
  { id: "bice", nombre: "BICE", otrosNombres: ["Banco BICE"], dominios: ["bice.cl"] },
  { id: "internacional", nombre: "Banco Internacional", dominios: ["internacional.cl"] },
  { id: "coopeuch", nombre: "Coopeuch", dominios: ["coopeuch.cl"] },
  { id: "tenpo", nombre: "Tenpo", billetera: true, dominios: ["tenpo.cl"] },
  { id: "mach", nombre: "MACH", billetera: true, dominios: ["somosmach.com"] },
  { id: "mercadopago", nombre: "Mercado Pago", otrosNombres: ["MercadoPago"], billetera: true, dominios: ["mercadopago.cl", "mercadopago.com"] },
];

/** Las tiendas cuyos correos Luka ya sabe leer: sus boletas tambien conviene reenviarlas. */
export const TIENDAS: readonly { id: string; nombre: string }[] = [
  { id: "lider", nombre: "Líder" },
  { id: "bsale", nombre: "Bsale (boletas de muchas tiendas)" },
];

// ---------------------------------------------------------------------------
// El mismo banco con otro nombre
// ---------------------------------------------------------------------------

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

function mismoNombre(a: string, b: string): boolean {
  const x = nombreDelBanco(a);
  const y = nombreDelBanco(b);
  return x !== "" && y !== "" && (x.includes(y) || y.includes(x));
}

/**
 * El banco del catalogo que es ese nombre, o null si no es ninguno. Primero
 * el que se llama exactamente asi; si no, el primero que es el mismo con
 * otro nombre ("Banco de Crédito e Inversiones" es BCI).
 */
export function bancoConocido(nombre: string): BancoConocido | null {
  const buscado = nombre.trim();
  if (buscado === "") return null;
  const nombres = (banco: BancoConocido) => [banco.nombre, ...(banco.otrosNombres ?? [])];
  const exacto = BANCOS.find(
    (banco) => banco.id === buscado.toLowerCase() || nombres(banco).some((n) => sinTildes(n) === sinTildes(buscado)),
  );
  if (exacto) return exacto;
  return BANCOS.find((banco) => nombres(banco).some((n) => mismoNombre(n, buscado))) ?? null;
}

export function mismoBanco(a: string, b: string): boolean {
  if (mismoNombre(a, b)) return true;
  const x = bancoConocido(a);
  return x !== null && x.id === bancoConocido(b)?.id;
}

/** Como se agrupan las cuentas en la pantalla: el nombre del catalogo, o el escrito. */
export function nombreParaAgrupar(banco: string): string {
  return bancoConocido(banco)?.nombre ?? banco.trim();
}

// ---------------------------------------------------------------------------
// De quien es un comprobante
// ---------------------------------------------------------------------------

/** "santander/transferencia-enviada" -> "santander". */
function deQuienEsLaPlantilla(id: string): string {
  return id.split("/")[0] ?? id;
}

/**
 * Los remitentes de los comprobantes de un banco o una tienda que Luka ya
 * sabe leer, sacados de sus plantillas. Van tambien los de la cartola (se
 * lee en la seccion D), pero no los de publicidad ni los avisos de seguridad:
 * reenviarlos no sirve de nada. "@lider.cl" queda como "lider.cl", que es
 * como se escribe en la regla de reenvio.
 */
export function remitentesConocidos(id: string, plantillas: readonly Plantilla[] = PLANTILLAS): string[] {
  const remitentes = plantillas
    .filter((plantilla) => deQuienEsLaPlantilla(plantilla.id) === id)
    .filter((plantilla) => !("descartar" in plantilla) || plantilla.descartar === "es-cartola")
    .flatMap((plantilla) => plantilla.remitentes)
    .map((remitente) => remitente.replace(/^@/, "").toLowerCase());
  return [...new Set(remitentes)];
}

/**
 * El banco de un comprobante, como se llama en el catalogo, o null si no se
 * sabe (una boleta de una tienda no es de ningun banco). Por la plantilla
 * que lo leyo; si no, por su remitente; si no, por la fuente que escribio la
 * IA ("Comprobante de BCI").
 */
export function bancoDelComprobante(
  comprobante: { plantilla: string | null; remitente: string | null; fuente: string | null },
  plantillas: readonly Plantilla[] = PLANTILLAS,
): string | null {
  const porId = (id: string) => BANCOS.find((banco) => banco.id === id)?.nombre ?? null;

  if (comprobante.plantilla !== null) return porId(deQuienEsLaPlantilla(comprobante.plantilla));

  if (comprobante.remitente !== null) {
    const plantilla = plantillas.find((p) => calzaRemitente(comprobante.remitente!, p.remitentes));
    if (plantilla) return porId(deQuienEsLaPlantilla(plantilla.id));
  }

  if (comprobante.fuente !== null) {
    const fuente = ` ${sinTildes(comprobante.fuente).replace(/[^\p{L}\p{N}]+/gu, " ")} `;
    for (const banco of BANCOS) {
      for (const nombre of [banco.nombre, ...(banco.otrosNombres ?? [])]) {
        if (fuente.includes(` ${sinTildes(nombre).replace(/[^\p{L}\p{N}]+/gu, " ")} `)) return banco.nombre;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// A que cuenta va cada movimiento
// ---------------------------------------------------------------------------

/** Una cuenta o tarjeta del hogar, como la necesita la eleccion. */
export type CuentaParaElegir = {
  id: string;
  banco: string;
  tipo: TipoCuentaBancaria;
  ultimos4: string;
  miembroId: string | null;
};

const CUENTAS: readonly TipoCuentaBancaria[] = ["CUENTA_CORRIENTE", "CUENTA_VISTA", "CUENTA_AHORRO", "CUENTA"];

/**
 * Si el movimiento pudo salir (o entrar) por esa cuenta: una compra con
 * credito sale de la tarjeta de credito; una transferencia, de una cuenta o
 * de una billetera; el pago de la tarjeta, de una cuenta.
 */
function sirve(cuenta: TipoCuentaBancaria, movimiento: { tipo: TipoMovimiento; medioPago: MedioPago | null }): boolean {
  if (movimiento.medioPago === "CREDITO") return cuenta === "TARJETA_CREDITO";
  switch (movimiento.tipo) {
    case "COMPRA":
    case "BOLETA":
      return movimiento.medioPago === "DEBITO" ? cuenta !== "TARJETA_CREDITO" : true;
    case "PAGO_TARJETA":
      return CUENTAS.includes(cuenta);
    default:
      return CUENTAS.includes(cuenta) || cuenta === "TARJETA_PREPAGO";
  }
}

/**
 * La cuenta o tarjeta del hogar de la que es el movimiento, o null si no se
 * sabe con seguridad: tienen que calzar los ultimos 4 digitos y, si se sabe,
 * el banco. Una boleta de tienda no dice el banco: ahi tiene que calzar
 * tambien el tipo (los 4 digitos de una tarjeta de credito no son los de una
 * cuenta). Si quedan dos, gana la de quien lo reenvio; si siguen dos, no se
 * elige ninguna: es mejor no decir que decir la equivocada.
 */
export function cuentaDelMovimiento(
  movimiento: { tipo: TipoMovimiento; medioPago: MedioPago | null; ultimos4: string | null },
  banco: string | null,
  cuentas: readonly CuentaParaElegir[],
  miembroId: string | null,
): string | null {
  if (movimiento.ultimos4 === null) return null;
  let candidatas = cuentas.filter(
    (cuenta) => cuenta.ultimos4 === movimiento.ultimos4 && (banco === null || mismoBanco(cuenta.banco, banco)),
  );
  if (banco === null || candidatas.length > 1) {
    candidatas = candidatas.filter((cuenta) => sirve(cuenta.tipo, movimiento));
  }
  if (candidatas.length > 1 && miembroId !== null) {
    const suyas = candidatas.filter((cuenta) => cuenta.miembroId === miembroId);
    if (suyas.length > 0) candidatas = suyas;
  }
  return candidatas.length === 1 ? candidatas[0]!.id : null;
}

// ---------------------------------------------------------------------------
// Las cuentas que Luka reconoce sola
// ---------------------------------------------------------------------------

export type CuentaAprendida = { banco: string; tipo: TipoCuentaBancaria; ultimos4: string };

/**
 * La cuenta o tarjeta que deja ver un comprobante y que el hogar todavia no
 * tiene: el banco que lo mando y los ultimos 4 digitos que trae. Asi nadie
 * tiene que escribirlas: con el primer aviso, la cuenta queda en «Tus bancos
 * y tarjetas», como de quien lo reenvio.
 *
 * Solo si no hay dudas: lo leyo una plantilla (la IA puede equivocarse en un
 * digito), es de un banco conocido, y sus 4 digitos son de una cuenta de ese
 * mismo banco (BancoEstado le avisa a quien recibe una transferencia, y la
 * cuenta de esa persona puede ser de cualquier banco). Si el hogar ya tiene
 * una de ese banco con esos 4 digitos, aunque sea de otro tipo, no se aprende
 * nada.
 *
 * El tipo sale de lo que paso: una compra con credito es de una tarjeta de
 * credito, y una compra con debito, de una tarjeta de debito. Lo demas
 * (transferencias, pagos, abonos, giros) sale de una cuenta sin saber si es
 * corriente, vista o de ahorro: queda «Cuenta», y la cartola la precisa.
 */
export function cuentaQueSeAprende(
  lectura: { via: "plantilla" | "ia"; plantilla?: string; tipo: TipoMovimiento; medioPago?: MedioPago; ultimos4?: string },
  banco: string | null,
  cuentas: readonly { banco: string; ultimos4: string }[],
  plantillas: readonly Plantilla[] = PLANTILLAS,
): CuentaAprendida | null {
  if (lectura.via !== "plantilla" || banco === null || lectura.ultimos4 === undefined) return null;
  const ultimos4 = limpiarUltimos4(lectura.ultimos4);
  if (ultimos4 === null) return null;
  const plantilla = plantillas.find((p) => p.id === lectura.plantilla);
  if (!plantilla || "descartar" in plantilla || plantilla.cuentaDeOtroBanco) return null;
  if (cuentas.some((cuenta) => cuenta.ultimos4 === ultimos4 && mismoBanco(cuenta.banco, banco))) return null;

  const tipo: TipoCuentaBancaria =
    lectura.medioPago === "CREDITO"
      ? "TARJETA_CREDITO"
      : (lectura.tipo === "COMPRA" || lectura.tipo === "BOLETA") && lectura.medioPago === "DEBITO"
        ? "TARJETA_DEBITO"
        : "CUENTA";
  return { banco: nombreParaAgrupar(banco), tipo, ultimos4 };
}

// ---------------------------------------------------------------------------
// La regla de reenvio
// ---------------------------------------------------------------------------

/** Si un remitente de la regla ("bci.cl" o "avisos@bci.cl") ya toma esa direccion. */
function cubre(enLaRegla: string, direccion: string): boolean {
  return direccion === enLaRegla || direccion.endsWith(`@${enLaRegla}`) || direccion.endsWith(`.${enLaRegla}`);
}

/**
 * Desde donde escribe un banco del catalogo: sus remitentes exactos si Luka
 * ya tiene sus plantillas; si no, sus dominios, para que sus avisos lleguen
 * igual y los lea la IA.
 */
export function remitentesDelBanco(banco: BancoConocido): string[] {
  const conocidos = remitentesConocidos(banco.id);
  return conocidos.length > 0 ? conocidos : [...banco.dominios];
}

/**
 * Los remitentes que conviene poner en la regla de reenvio: los de los
 * bancos del hogar (los que Luka ya conoce mas los que fueron llegando) y
 * los de las tiendas que Luka sabe leer. Sin repetidos, en ese orden.
 */
export function remitentesParaLaRegla(
  bancos: readonly string[],
  aprendidos: readonly { banco: string; remitente: string }[],
): string[] {
  const lista: string[] = [];
  for (const banco of bancos) {
    const conocido = bancoConocido(banco);
    if (conocido) lista.push(...remitentesDelBanco(conocido));
    for (const aprendido of aprendidos.filter((a) => mismoBanco(a.banco, banco))) {
      const remitente = aprendido.remitente.toLowerCase();
      if (!lista.some((r) => cubre(r, remitente))) lista.push(remitente);
    }
  }
  for (const tienda of TIENDAS) lista.push(...remitentesConocidos(tienda.id));
  return [...new Set(lista)];
}

// ---------------------------------------------------------------------------
// Lo que se muestra de cada banco
// ---------------------------------------------------------------------------

export type CuentaBancariaDelHogar = CuentaParaElegir & { apodo: string | null };

export type BancoDelHogar = {
  /** Como se llama en el catalogo, o como lo escribieron. */
  banco: string;
  /** Si Luka ya sabe leer sus comprobantes sin IA. */
  conPlantillas: boolean;
  cuentas: CuentaBancariaDelHogar[];
  /** El ultimo comprobante que llego de ese banco, si llego alguno. */
  ultimo: { fecha: string; fuente: string } | null;
  /** Los remitentes de ese banco: los que Luka conoce y los que fueron llegando. */
  remitentes: string[];
};

/**
 * Los bancos del hogar, cada uno con sus cuentas, el ultimo comprobante que
 * llego y sus remitentes. Los bancos van en el orden en que se agregaron sus
 * cuentas, y despues los que alguien marco y todavia no tienen ninguna; los
 * comprobantes, cada uno con el banco ya resuelto.
 */
export function bancosDelHogar(
  cuentas: readonly CuentaBancariaDelHogar[],
  llegados: readonly { banco: string; fecha: string; fuente: string; remitente: string | null }[],
  marcados: readonly string[] = [],
): BancoDelHogar[] {
  const grupos: BancoDelHogar[] = [];
  const grupoDe = (banco: string): BancoDelHogar => {
    const nombre = nombreParaAgrupar(banco);
    let grupo = grupos.find((g) => mismoBanco(g.banco, nombre));
    if (!grupo) {
      const conocido = bancoConocido(nombre);
      grupo = {
        banco: nombre,
        conPlantillas: conocido !== null && remitentesConocidos(conocido.id).length > 0,
        cuentas: [],
        ultimo: null,
        remitentes: conocido ? remitentesDelBanco(conocido) : [],
      };
      grupos.push(grupo);
    }
    return grupo;
  };
  for (const cuenta of cuentas) grupoDe(cuenta.banco).cuentas.push(cuenta);
  // Los que alguien marco al conectar su correo, aunque todavia no llegue nada.
  for (const banco of marcados) grupoDe(banco);

  for (const llegado of llegados) {
    const grupo = grupos.find((g) => mismoBanco(g.banco, llegado.banco));
    if (!grupo) continue;
    if (grupo.ultimo === null || llegado.fecha > grupo.ultimo.fecha) {
      grupo.ultimo = { fecha: llegado.fecha, fuente: llegado.fuente };
    }
    const remitente = llegado.remitente?.toLowerCase();
    if (remitente && !grupo.remitentes.some((r) => cubre(r, remitente))) {
      grupo.remitentes.push(remitente);
    }
  }
  return grupos;
}
