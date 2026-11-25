import { formatearCLP } from "@/lib/dinero";
import type { ProveedorDeCorreo } from "./correos-registrados";
import type { ResultadoDeLlegada } from "./buzon";

/**
 * «Conectar tus correos»: el asistente que deja a una persona recibiendo sus
 * comprobantes en Luka en unos minutos y una sola vez, y el resumen diario
 * que le llega despues. Dominio puro: lo que lee y escribe la base esta en
 * src/datos/conectar.ts.
 *
 * Con Gmail son tres pasos:
 *
 *   1. Sus bancos, con un toque cada uno. Sus cuentas y tarjetas no se
 *      escriben: Luka las reconoce con los primeros avisos.
 *   2. En Gmail, la direccion de Luka para reenviar. Gmail le pide permiso a
 *      Luka, y Luka lo da sola (si no puede, el asistente muestra el enlace).
 *   3. En Gmail, el filtro que le pasa a Luka solo los avisos de esos bancos:
 *      se abre ya empezado, con los bancos escritos en «De».
 *
 * Con otro correo, los pasos 2 y 3 son una sola regla.
 *
 * Luka nunca entra al correo de nadie. Leerlo directo, o crear el filtro por
 * la persona, exige permisos de Google que piden una auditoria de seguridad
 * cada año: por eso los pasos se hacen a mano, con botones que abren la
 * pantalla exacta de Gmail y lo demas ya escrito.
 */

// ---------------------------------------------------------------------------
// En que paso va
// ---------------------------------------------------------------------------

export type PasoParaConectar = "bancos" | "reenvio" | "filtro" | "listo";

export type EstadoParaConectar = {
  /** Los bancos que marco. */
  bancos: readonly string[];
  /** Si ya tiene cuentas o tarjetas suyas en el hogar. */
  conCuentas: boolean;
  /** El enlace o el codigo con que Gmail pide permiso para reenviar, si Luka no pudo darlo. */
  codigoDeGmail: string | null;
  /** Si ya llego algo reenviado desde uno de sus correos: un comprobante, publicidad, la cartola. */
  yaLlegoAlgo: boolean;
};

/**
 * Donde retoma el asistente. Listo apenas llega algo reenviado: eso prueba
 * que el reenvio y el filtro funcionan. Si Gmail pidio permiso y Luka no
 * pudo darlo, en el paso del reenvio, para darlo. Con los bancos ya marcados
 * (o con cuentas suyas), en el paso siguiente; si no, en el primero.
 */
export function pasoParaConectar(estado: EstadoParaConectar, proveedor: ProveedorDeCorreo): PasoParaConectar {
  if (estado.yaLlegoAlgo) return "listo";
  if (proveedor === "GMAIL" && estado.codigoDeGmail !== null) return "reenvio";
  if (estado.bancos.length > 0 || estado.conCuentas) return proveedor === "GMAIL" ? "reenvio" : "filtro";
  return "bancos";
}

/**
 * Lo que llega reenviado de verdad desde un correo confirmado. La
 * confirmacion de Gmail no cuenta, pedida o ya aceptada (todavia no hay
 * filtro), ni lo que llego desde un correo sin confirmar o sin su firma.
 */
export function pruebaQueLlega(resultado: ResultadoDeLlegada): boolean {
  return (
    resultado !== "CONFIRMACION_DE_GMAIL" &&
    resultado !== "REENVIO_CONFIRMADO" &&
    resultado !== "SIN_CONFIRMAR" &&
    resultado !== "SIN_FIRMA"
  );
}

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------

/**
 * La pantalla de la configuracion de Gmail donde va cada paso, en la cuenta
 * de ese correo si la persona tiene varias abiertas. Se abre en el
 * computador: la app de Gmail del celular no tiene reenvios ni filtros.
 */
export function enlaceDeGmail(donde: "reenvio" | "filtros", correo: string): string {
  const seccion = donde === "reenvio" ? "fwdandpop" : "filters";
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(correo.trim().toLowerCase())}#settings/${seccion}`;
}

/**
 * En que va el permiso que pide Gmail para reenviarle a la direccion de
 * Luka: ya aceptado, o lo que falta para darlo (el enlace, o el codigo con
 * el Gmail de antes), y que correo lo pidio.
 */
export type PermisoDeGmail = { codigo: string | null; enlace: string | null; de: string | null; aceptado: boolean };

/**
 * Gmail con el filtro nuevo ya empezado: se abre «Crear filtro» con los
 * remitentes escritos en «De». Falta solo elegir «Reenviar a».
 */
export function enlaceParaCrearElFiltro(correo: string, remitentes: readonly string[]): string {
  const de = encodeURIComponent(remitentes.join(" OR ")).replace(/%20/g, "+");
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(correo.trim().toLowerCase())}#create-filter/from=${de}`;
}

/**
 * Lo que va en el campo «De» del filtro o de la regla. En Gmail, separados
 * por OR (asi toma cualquiera); en los demas, uno por linea, que es como los
 * piden de a uno.
 */
export function textoDelFiltro(remitentes: readonly string[], proveedor: ProveedorDeCorreo): string {
  return remitentes.join(proveedor === "GMAIL" ? " OR " : "\n");
}

// ---------------------------------------------------------------------------
// El resumen diario por correo
// ---------------------------------------------------------------------------

export type DatosDelResumen = {
  /** El primer nombre de quien lo recibe, si se sabe. */
  nombre: string | null;
  /** AAAA-MM-DD: el dia del que se cuenta lo gastado. */
  ayer: string;
  /** Lo que se anoto con fecha de ayer, en todo el hogar. */
  gastosDeAyer: readonly { descripcion: string; monto: number }[];
  /** Lo gastado en el mes de gastos hasta hoy. */
  totalDelMes: number;
  /** "noviembre". */
  nombreDelMes: string;
  /** Lo que espera en «Por revisar». */
  porRevisar: number;
  /** Las cuentas sin pagar que vencen hoy o mañana. */
  cuentasPorVencer: readonly { nombre: string; monto: number; venceHoy: boolean }[];
  /** La direccion de Luka, para el enlace. */
  url: string;
};

export type CorreoDelResumen = { asunto: string; texto: string; html: string };

/** Cuantos gastos de ayer se nombran uno por uno. */
const GASTOS_QUE_SE_NOMBRAN = 5;

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "el lunes 23", del 2026-11-23. */
function elDia(iso: string): string {
  const fecha = new Date(`${iso}T12:00:00Z`);
  return `el ${DIAS[fecha.getUTCDay()]} ${fecha.getUTCDate()}`;
}

function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cuantos(n: number, uno: string, varios: string): string {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * El correo del resumen diario, o null si no hay nada que contar: sin
 * gastos de ayer, nada por revisar y ninguna cuenta por vencer, no se manda
 * nada. Un correo que dice «nada nuevo» todos los dias termina sin leerse.
 */
export function armarResumenDiario(datos: DatosDelResumen): CorreoDelResumen | null {
  const { gastosDeAyer, porRevisar, cuentasPorVencer } = datos;
  if (gastosDeAyer.length === 0 && porRevisar === 0 && cuentasPorVencer.length === 0) return null;

  const totalDeAyer = gastosDeAyer.reduce((suma, gasto) => suma + gasto.monto, 0);
  const asunto = [
    gastosDeAyer.length > 0 ? `Ayer: ${formatearCLP(totalDeAyer)}` : null,
    porRevisar > 0 ? `${porRevisar} por revisar` : null,
    cuentasPorVencer.length > 0 ? cuantos(cuentasPorVencer.length, "cuenta por vencer", "cuentas por vencer") : null,
  ]
    .filter((parte): parte is string => parte !== null)
    .join(" · ");

  const ordenados = [...gastosDeAyer].sort((a, b) => b.monto - a.monto);
  const nombrados = ordenados.slice(0, GASTOS_QUE_SE_NOMBRAN);
  const otros = ordenados.length - nombrados.length;

  // El texto, en bloques: cada bloque es un parrafo, y sus lineas, una lista.
  const bloques: { titulo: string; lineas: string[] }[] = [];
  if (gastosDeAyer.length > 0) {
    bloques.push({
      titulo: `${conMayuscula(elDia(datos.ayer))} se anotaron ${formatearCLP(totalDeAyer)} en ${cuantos(gastosDeAyer.length, "gasto", "gastos")}:`,
      lineas: [
        ...nombrados.map((gasto) => `${gasto.descripcion}: ${formatearCLP(gasto.monto)}`),
        ...(otros > 0 ? [`y ${otros} más.`] : []),
      ],
    });
  }
  bloques.push({ titulo: `En ${datos.nombreDelMes} van ${formatearCLP(datos.totalDelMes)}.`, lineas: [] });
  if (porRevisar > 0) {
    bloques.push({
      titulo: `${porRevisar === 1 ? "Te espera 1 movimiento" : `Te esperan ${porRevisar} movimientos`} en «Por revisar»: no suman hasta que los confirmas.`,
      lineas: [],
    });
  }
  if (cuentasPorVencer.length > 0) {
    bloques.push({
      titulo: cuentasPorVencer.length === 1 ? "Una cuenta por vencer:" : "Cuentas por vencer:",
      lineas: cuentasPorVencer.map((cuenta) => `${cuenta.nombre}: ${formatearCLP(cuenta.monto)}, vence ${cuenta.venceHoy ? "hoy" : "mañana"}`),
    });
  }

  const saludo = datos.nombre ? `Hola, ${datos.nombre}:` : "Hola:";
  const pie = "Este resumen te llega cada mañana. Lo puedes apagar en Luka, en Hogar.";

  const texto = [
    saludo,
    "",
    ...bloques.flatMap((bloque) => [bloque.titulo, ...bloque.lineas.map((linea) => `  - ${linea}`), ""]),
    `Ver en Luka: ${datos.url}`,
    "",
    pie,
  ].join("\n");

  const P = 'style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#1f2933"';
  const html = [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif;max-width:520px">',
    `<p ${P}>${escapar(saludo)}</p>`,
    ...bloques.map((bloque) =>
      bloque.lineas.length === 0
        ? `<p ${P}>${escapar(bloque.titulo)}</p>`
        : `<p style="margin:0 0 4px;font-size:15px;line-height:1.5;color:#1f2933">${escapar(bloque.titulo)}</p>` +
          `<ul style="margin:0 0 12px;padding-left:20px;font-size:15px;line-height:1.5;color:#1f2933">${bloque.lineas
            .map((linea) => `<li>${escapar(linea)}</li>`)
            .join("")}</ul>`,
    ),
    `<p style="margin:20px 0"><a href="${escapar(datos.url)}" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#ff9f6b;color:#1f2933;font-weight:700;text-decoration:none">Ver en Luka</a></p>`,
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280">${escapar(pie)}</p>`,
    "</div>",
  ].join("");

  return { asunto, texto, html };
}
