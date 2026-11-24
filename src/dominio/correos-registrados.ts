import { normalizarCorreo } from "./entrada";

/**
 * Los correos donde a cada persona le llegan comprobantes, de cualquier
 * proveedor. Dominio puro: lo que lee y escribe esta en
 * src/datos/correos-registrados.ts.
 *
 * «Ingresar un correo» en Luka no es entregar su contrasena: es registrarlo
 * y confirmar con un codigo que llega a ese correo que es tuyo. Desde ahi, lo
 * que ese correo le reenvia a tu direccion de Luka se lee; lo que llega
 * desde un correo sin confirmar, no (src/dominio/buzon.ts). El correo de
 * Google con que entras a Luka ya es tuyo: Google lo confirmo al entrar.
 */

/** Los mismos valores del enum ProveedorDeCorreo de Prisma. */
export const PROVEEDORES = ["GMAIL", "OUTLOOK", "ICLOUD", "YAHOO", "OTRO"] as const;
export type ProveedorDeCorreo = (typeof PROVEEDORES)[number];

/** Cuantos correos puede registrar cada persona, ademas del de Google. */
export const MAXIMO_DE_CORREOS = 5;

/**
 * El correo como se guarda: sin espacios, en minusculas y con un dominio de
 * verdad (con punto). null si no tiene forma de correo.
 */
export function limpiarCorreo(texto: string): string | null {
  const correo = normalizarCorreo(texto);
  if (correo === null) return null;
  const [local = "", dominio = ""] = correo.split("@");
  if (local.length > 64 || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(dominio)) return null;
  return correo;
}

export function dominioDe(correo: string): string {
  return correo.slice(correo.lastIndexOf("@") + 1);
}

/**
 * El proveedor por el dominio, si es uno de los publicos. null si es un
 * dominio propio (el del trabajo, uno personal): ahi lo dice su MX.
 */
export function proveedorPorDominio(dominio: string): ProveedorDeCorreo | null {
  const d = dominio.toLowerCase();
  if (/^(?:gmail|googlemail)\.com$/.test(d)) return "GMAIL";
  if (/^(?:outlook|hotmail|live|msn)\.[a-z.]+$/.test(d)) return "OUTLOOK";
  if (/^(?:icloud|me|mac)\.com$/.test(d)) return "ICLOUD";
  if (/^(?:yahoo|ymail|rocketmail)\.[a-z.]+$/.test(d)) return "YAHOO";
  return null;
}

/**
 * El proveedor de un dominio propio, por los servidores que reciben su
 * correo (sus registros MX): Google Workspace, Microsoft 365, iCloud con
 * dominio propio o Yahoo. Si no es ninguno, «otro».
 */
export function proveedorPorMx(servidores: readonly string[]): ProveedorDeCorreo {
  const es = (patron: RegExp) => servidores.some((s) => patron.test(s.toLowerCase().replace(/\.$/, "")));
  if (es(/(?:^|\.)(?:google|googlemail)\.com$/)) return "GMAIL";
  if (es(/(?:^|\.)outlook\.com$/)) return "OUTLOOK";
  if (es(/(?:^|\.)icloud\.com$/)) return "ICLOUD";
  if (es(/(?:^|\.)yahoodns\.net$/)) return "YAHOO";
  return "OTRO";
}

/** El proveedor de un correo: por su dominio y, si es propio, por su MX. */
export function proveedorDe(correo: string, servidoresMx: readonly string[] = []): ProveedorDeCorreo {
  return proveedorPorDominio(dominioDe(correo)) ?? proveedorPorMx(servidoresMx);
}

// ---------------------------------------------------------------------------
// El codigo
// ---------------------------------------------------------------------------

/**
 * El codigo que confirma un correo. Vale mas que el de borrar el hogar
 * porque un correo puede demorar en llegar, y aguanta los mismos intentos.
 */
export const CODIGO_DE_CORREO = {
  digitos: 6,
  minutosDeVigencia: 30,
  intentos: 5,
  segundosParaReenviar: 60,
} as const;

/** Lo que escribe la persona, como se compara: los 6 digitos, sin espacios ni guiones. */
export function limpiarCodigoDeCorreo(texto: string): string | null {
  const digitos = texto.replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${CODIGO_DE_CORREO.digitos}}$`).test(digitos) ? digitos : null;
}

/** Cuantos segundos faltan para poder pedir otro codigo. 0 si ya se puede. */
export function segundosParaOtroCodigo(pedidoEn: Date | null, ahora: Date): number {
  if (pedidoEn === null) return 0;
  const pasaron = (ahora.getTime() - pedidoEn.getTime()) / 1000;
  return Math.max(0, Math.ceil(CODIGO_DE_CORREO.segundosParaReenviar - pasaron));
}

/** Antes de comparar: que haya un codigo, que siga vigente y que le queden intentos. */
export function revisarCodigoDeCorreo(
  pendiente: { venceEn: Date | null; intentos: number; hayCodigo: boolean },
  ahora: Date,
): string | null {
  if (!pendiente.hayCodigo || pendiente.venceEn === null) return "Primero pide el código: llega a ese correo.";
  if (pendiente.venceEn.getTime() <= ahora.getTime()) return "El código venció. Pide uno nuevo.";
  if (pendiente.intentos >= CODIGO_DE_CORREO.intentos) return "Se acabaron los intentos con ese código. Pide uno nuevo.";
  return null;
}

/** Lo que se le dice cuando el codigo no es, segun los intentos que ya hizo. */
export function codigoDeCorreoEquivocado(intentosHechos: number): string {
  const quedan = CODIGO_DE_CORREO.intentos - intentosHechos;
  if (quedan <= 0) return "Ese código no es, y se acabaron los intentos. Pide uno nuevo.";
  return `Ese código no es. ${quedan === 1 ? "Te queda 1 intento" : `Te quedan ${quedan} intentos`}.`;
}

// ---------------------------------------------------------------------------
// Los pasos de cada proveedor
// ---------------------------------------------------------------------------

export type PasosDelProveedor = {
  nombre: string;
  /** Si deja reenviar solo, con una regla. Sin eso, se reenvia a mano. */
  reenviaSolo: boolean;
  pasos: readonly string[];
  /** Lo que conviene saber antes de empezar. */
  nota?: string;
};

/**
 * Como hacer, en cada proveedor, la regla que le reenvia a Luka solo los
 * correos de los bancos y las tiendas. Nunca todo el correo: Luka no
 * necesita ver nada mas, y no lo quiere ver.
 */
export const PASOS: Record<ProveedorDeCorreo, PasosDelProveedor> = {
  GMAIL: {
    nombre: "Gmail",
    reenviaSolo: true,
    pasos: [
      "En Gmail, en el computador: la rueda → Ver toda la configuración → Reenvío y correo POP/IMAP → Agregar una dirección de reenvío. Pega tu dirección de Luka.",
      "Gmail le manda un código a Luka para confirmar que esa dirección acepta tu correo. Cuando llegue, aparece aquí: escríbelo en Gmail y presiona Verificar.",
      "Ve a Filtros y direcciones bloqueadas → Crear un filtro nuevo. En «De», pega las direcciones de tus bancos y tiendas (las de abajo, con el botón Copiar), y presiona Crear filtro.",
      "Marca «Reenviarlo a» tu dirección de Luka y «Nunca enviarlo a spam», y crea el filtro.",
    ],
    nota: "No actives «Reenviar una copia del correo entrante»: eso le mandaría a Luka todo tu correo. Basta con el filtro.",
  },
  OUTLOOK: {
    nombre: "Outlook o Hotmail",
    reenviaSolo: true,
    pasos: [
      "En outlook.com: la rueda → Correo → Reglas → Agregar nueva regla.",
      "Condición: «De», con la dirección de tu banco o tienda. Puedes agregar varias.",
      "Acción: «Redirigir a» tu dirección de Luka. Redirigir, no reenviar: así el correo llega con el remitente del banco.",
    ],
    nota: "Outlook a veces pide confirmar tu cuenta antes de dejar reenviar. Si la regla no reenvía, reenvía a mano.",
  },
  ICLOUD: {
    nombre: "iCloud",
    reenviaSolo: true,
    pasos: [
      "En icloud.com/mail: la rueda → Reglas → Agregar una regla.",
      "«Si un mensaje es de» la dirección de tu banco o tienda.",
      "«Reenviar a» tu dirección de Luka. iCloud pide una regla por cada remitente.",
    ],
  },
  YAHOO: {
    nombre: "Yahoo",
    reenviaSolo: false,
    pasos: [
      "Yahoo cobra por el reenvío automático (Yahoo Mail Plus).",
      "Sin pagarlo, reenvía a mano los comprobantes que quieras anotar: Luka los lee igual.",
      "O pídele a tu banco que mande los avisos a otro correo tuyo que sí reenvíe solo.",
    ],
  },
  OTRO: {
    nombre: "Otro correo",
    reenviaSolo: true,
    pasos: [
      "Busca en la configuración de tu correo «Reglas» o «Filtros».",
      "Crea una regla para las direcciones de tus bancos y tiendas que reenvíe sus correos (o mejor, que los redirija) a tu dirección de Luka.",
      "Si es el correo del trabajo y la regla no reenvía, puede que tu empresa lo tenga bloqueado: reenvía a mano.",
    ],
  },
};

/** Lo mismo para todos: cualquier comprobante se puede reenviar a mano. */
export const REENVIO_A_MANO =
  "También puedes reenviar a mano cualquier comprobante a tu dirección de Luka, desde un correo confirmado y sin cambiarle nada.";
