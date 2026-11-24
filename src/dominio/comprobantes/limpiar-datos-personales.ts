/**
 * Antes de mandarle un correo a la IA se borran los datos personales: RUT,
 * numeros de cuenta y de tarjeta, correos, telefonos, enlaces, direcciones y
 * nombres. De las cuentas y tarjetas quedan los ultimos 4 digitos, que es lo
 * unico que Luka guarda de ellas. Los montos y las fechas se quedan: son lo
 * que la IA tiene que leer.
 */

export type OpcionesDeLimpieza = {
  /**
   * Nombres y apellidos de la gente del hogar. Se borran donde aparezcan,
   * con o sin tildes y en cualquier orden ("ROJAS SOTO CAMILA").
   */
  nombres?: readonly string[];
};

export const OCULTO = {
  nombre: "[nombre]",
  rut: "[RUT]",
  correo: "[correo]",
  telefono: "[teléfono]",
  enlace: "[enlace]",
  direccion: "[dirección]",
} as const;

const ENLACE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const CORREO = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const RUT_CON_ETIQUETA = /\b(R\.?U\.?[TN]\.?(?:\s*N[º°o.]*)?\s*:?\s*)\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/gi;
const RUT_CON_PUNTOS = /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/g;
const RUT_SIN_PUNTOS = /\b\d{7,8}-[\dkK]\b/g;
/** ************0583, *******4521, XXXX-XXXX-XXXX-1234 */
const ENMASCARADO = /(?:[*xX•·]{3,}[\s-]?){1,4}(\d{4})(?!\d)/g;
const CELULAR = /(?:\+56[\s-]?9|(?<!\d)9)[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g;
const FIJO = /\+56[\s-]?\(?2\)?[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g;
/** Siete digitos o mas, con guiones o espacios sueltos: cuentas, tarjetas, numeros de orden. */
const NUMERO_LARGO = /(?<![\d.,])\d(?:[ -]?\d){6,}(?!\d|[.,]\d)/g;
const FECHA_CON_GUIONES = /^(?:\d{1,2}[ -]\d{1,2}[ -](?:\d{4}|\d{2})|\d{4}-\d{1,2}-\d{1,2})$/;
const ANTES_DE_UN_MONTO = /(?:\$|CLP|USD|US\$)\s*$/i;

const ETIQUETA_DE_NOMBRE =
  /^((?:nombre(?!\s+(?:del?\s+)?(?:comercio|local|tienda|establecimiento|fantas[ií]a|producto|servicio|plan)\b)(?:\s+(?:del?\s+)?(?:destinatario|titular|beneficiario|remitente|cliente))?|titular(?:\s+(?:de\s+la\s+)?cuenta(?:\s+(?:de\s+)?(?:origen|destino))?)?|destinatario|beneficiario|remitente|¿?\s*qui[eé]n\s+recibe\s*\??))(?:\s*[:|]\s*|\s+(?=\S)|$)(.*)$/i;
/** "Para: Pedro Munoz". Solo con los dos puntos: "Para consultas..." no es una etiqueta. */
const ETIQUETA_DE_DESTINO = /^(para|a)\s*:\s*\S/i;
const ETIQUETA_DE_DIRECCION =
  /^((?:direcci[oó]n(?:\s+de\s+(?:despacho|entrega|facturaci[oó]n))?|domicilio|despacho a domicilio))(?:\s*[:|]\s*|\s+(?=\S)|$)(.*)$/i;

/** Para armar patrones que no distinguen mayusculas sin la bandera "i". */
function sinMayusculas(palabra: string): string {
  return [...palabra]
    .map((letra) => (/\p{L}/u.test(letra) ? `[${letra.toLowerCase()}${letra.toUpperCase()}]` : letra))
    .join("");
}

/**
 * Solo saludos de verdad. "Don" o "Señor" sueltos no, porque tambien son
 * nombres de negocios ("Don Pollo"): solo cuentan despues de un saludo.
 */
const SALUDOS = ["estimadas", "estimados", "estimada", "estimado", "queridas", "queridos", "querida", "querido", "hola"];
const TITULOS = ["señorita", "señora", "señor", "srta", "sra", "sr", "doña", "don"];

/**
 * "Estimado(a) Sr(a). Camila rojas", "Hola, Camila", "Estimado: ROJAS SOTO
 * CAMILA". Sin la bandera "i" a proposito: con ella \p{Lu} tambien calza
 * minusculas, y "Hola, gracias por tu compra" perderia el "gracias".
 */
const SALUDO = new RegExp(
  String.raw`(?<!\p{L})((?:${SALUDOS.map(sinMayusculas).join("|")})(?!\p{L})(?:\s*\((?:a|o|as|os)\))?\.?` +
    String.raw`(?:\s+(?:${TITULOS.map(sinMayusculas).join("|")})(?!\p{L})(?:\s*\((?:a|o)\))?\.?)?\s*[:,]?\s*)` +
    String.raw`(\p{Lu}[\p{L}'’.-]*(?:[ \t]+\p{L}[\p{L}'’.-]*){0,5})`,
  "gu",
);

const VARIANTES: Record<string, string> = { a: "aáàäâ", e: "eéèëê", i: "iíìïî", o: "oóòöô", u: "uúùüû", n: "nñ", c: "cç" };

/** Un nombre que calza con o sin tildes y con cualquier mayuscula. */
function patronDeNombre(palabra: string): RegExp {
  const base = palabra.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const patron = [...base]
    .map((letra) => {
      const variantes = VARIANTES[letra];
      if (variantes) return `[${variantes}${variantes.toUpperCase()}]`;
      if (/\p{L}/u.test(letra)) return `[${letra}${letra.toUpperCase()}]`;
      return letra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp(String.raw`(?<![\p{L}\p{N}])${patron}(?![\p{L}\p{N}])`, "gu");
}

function ocultarEtiquetas(texto: string): string {
  const salida: string[] = [];
  let pendiente: string | null = null;

  for (const linea of texto.split("\n")) {
    const limpia = linea.replace(/^[|\s]+/, "");
    if (limpia === "") {
      salida.push(linea);
      continue;
    }

    const destino = ETIQUETA_DE_DESTINO.exec(limpia);
    if (destino) {
      pendiente = null;
      salida.push(`${destino[1]}: ${OCULTO.nombre}`);
      continue;
    }

    const nombre = ETIQUETA_DE_NOMBRE.exec(limpia);
    const direccion = nombre ? null : ETIQUETA_DE_DIRECCION.exec(limpia);
    const etiqueta = nombre ?? direccion;

    if (etiqueta) {
      const oculto = nombre ? OCULTO.nombre : OCULTO.direccion;
      const valor = etiqueta[2]!.replace(/[|\s]+$/, "");
      if (valor === "" || valor.startsWith("[")) {
        // La etiqueta sola en su linea: el valor viene en la siguiente.
        pendiente = valor === "" ? oculto : null;
        salida.push(linea);
      } else {
        pendiente = null;
        salida.push(`${etiqueta[1]}: ${oculto}`);
      }
      continue;
    }

    if (pendiente && limpia.length <= 80 && !limpia.endsWith(":")) {
      salida.push(pendiente);
    } else {
      salida.push(linea);
    }
    pendiente = null;
  }
  return salida.join("\n");
}

/** Borra los datos personales de un texto, dejando montos y fechas. */
export function limpiarDatosPersonales(texto: string, opciones: OpcionesDeLimpieza = {}): string {
  let limpio = texto
    .replace(ENLACE, OCULTO.enlace)
    .replace(CORREO, OCULTO.correo)
    .replace(RUT_CON_ETIQUETA, `$1${OCULTO.rut}`)
    .replace(RUT_CON_PUNTOS, OCULTO.rut)
    .replace(RUT_SIN_PUNTOS, OCULTO.rut)
    .replace(ENMASCARADO, "••••$1")
    .replace(CELULAR, OCULTO.telefono)
    .replace(FIJO, OCULTO.telefono)
    .replace(NUMERO_LARGO, (numero: string, posicion: number, todo: string) => {
      if (FECHA_CON_GUIONES.test(numero)) return numero;
      if (ANTES_DE_UN_MONTO.test(todo.slice(Math.max(0, posicion - 6), posicion))) return numero;
      return `••••${numero.replace(/\D/g, "").slice(-4)}`;
    });

  limpio = ocultarEtiquetas(limpio).replace(SALUDO, `$1${OCULTO.nombre}`);

  const palabras = new Set(
    (opciones.nombres ?? []).flatMap((nombre) => nombre.split(/[\s,]+/)).filter((palabra) => palabra.length >= 3),
  );
  for (const palabra of palabras) limpio = limpio.replace(patronDeNombre(palabra), OCULTO.nombre);

  return limpio;
}
