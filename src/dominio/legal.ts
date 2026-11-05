import { CODIGO_DE_BORRADO } from "./hogar";
import { DOS_PASOS } from "./dos-pasos";
import { ACHICAR_DESDE, TAMANO_MAXIMO_BOLETA } from "./tamano-boleta";
import { HORAS_MAXIMAS, MINUTOS_SIN_USO } from "@/lib/sesion";

/**
 * La politica de privacidad y los terminos de uso de Luka, separados de las
 * paginas (src/app/privacidad, src/app/terminos) para revisarlos y probarlos
 * sin tocar el diseno.
 *
 * Las cifras (minutos de la sesion, tope de las boletas, vigencia del codigo)
 * salen del codigo que las aplica: si cambian alla, cambian aca. Lo que dice
 * cada seccion esta revisado contra la app tal como es hoy.
 */

/** Quien responde por Luka y donde escribirle. */
export const RESPONSABLE = {
  nombre: "Fernando Vilches",
  correo: "luka.support.app@gmail.com",
} as const;

/** La fecha de la ultima version de los dos documentos. */
export const ACTUALIZADO = "5 de noviembre de 2026";

export type BloqueLegal =
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; items: readonly string[] };

export type SeccionLegal = { id: string; titulo: string; bloques: readonly BloqueLegal[] };

export type DocumentoLegal = {
  titulo: string;
  /** Lo que va bajo el titulo: de que se trata, en dos lineas. */
  resumen: string;
  secciones: readonly SeccionLegal[];
};

const p = (texto: string): BloqueLegal => ({ tipo: "parrafo", texto });
const lista = (...items: string[]): BloqueLegal => ({ tipo: "lista", items });

/** "4 MB", con un espacio que no se parte: el numero y la unidad van juntos. */
const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)}\u00a0MB`;

export const PRIVACIDAD: DocumentoLegal = {
  titulo: "Política de privacidad",
  resumen:
    "Qué datos guarda Luka, para qué, dónde, quién los ve y cómo borrarlos. Corta y en simple: si algo no se entiende, escríbeme.",
  secciones: [
    {
      id: "responsable",
      titulo: "Quién responde por tus datos",
      bloques: [
        p(
          `Luka es un proyecto personal de ${RESPONSABLE.nombre}, en Chile. Yo soy el responsable de los datos que guardas en Luka. Para cualquier consulta o solicitud sobre ellos, escríbeme a ${RESPONSABLE.correo}.`,
        ),
      ],
    },
    {
      id: "que-datos",
      titulo: "Qué datos guarda Luka",
      bloques: [
        lista(
          "De tu cuenta de Google: tu correo y tu nombre. Google también entrega tu foto de perfil y si tu correo está verificado; Luka usa lo segundo para dejarte entrar y no guarda la foto.",
          "Lo que anotas: tus gastos (fecha, monto, descripción, categoría y medio de pago), tus cuentas, deudas y cuotas, presupuestos, ahorros, tu sueldo (cada persona del hogar anota el suyo), el día en que empieza tu mes y el nombre de tu hogar.",
          `Las boletas que subes: fotos o PDF de hasta ${mb(TAMANO_MAXIMO_BOLETA)}. Una foto de más de ${mb(ACHICAR_DESDE)} se achica en tu navegador antes de subir, y al hacerlo pierde sus datos ocultos, como la ubicación donde se sacó.`,
          "Tu hogar: quiénes están, quién es el dueño, a qué correos se invitó y quién anotó cada gasto.",
          "Para borrar un hogar: un código temporal que se manda al correo del dueño. Luka guarda solo una huella cifrada del código, nunca el código, y la borra al usarlo o con el hogar.",
          "Para la verificación en dos pasos: si elegiste activarla y cuándo. Si la activas, además la clave de la app de autenticación de tu celular, guardada cifrada; una huella de cada código de respaldo, nunca el código; cuándo la configuraste, los intentos fallidos y qué sesiones ya pusieron el código. Luka no pide ni guarda tu número de teléfono.",
          "Datos técnicos de cada visita (dirección IP, navegador, hora), que registra el servicio donde funciona Luka para operar y protegerlo.",
        ),
      ],
    },
    {
      id: "para-que",
      titulo: "Para qué se usan",
      bloques: [
        p(
          "Solo para que Luka funcione: mostrarte tu mes, hacer las cuentas, armar tus informes, saber quién está en tu hogar y mandarte el código cuando quieras borrarlo.",
        ),
        p(
          "Tus datos no se usan para publicidad, no se venden, no se comparten con nadie para sus propios fines y no se usan para armar perfiles tuyos.",
        ),
      ],
    },
    {
      id: "quien-los-ve",
      titulo: "Quién los ve",
      bloques: [
        lista(
          "Las personas de tu hogar, con su sesión iniciada. Todos los del hogar ven y anotan lo mismo, incluido el sueldo de cada uno, así que invita solo a quien confíes.",
          "Nadie de otro hogar: cada hogar está separado, y en cada visita Luka revisa que sigas en el tuyo.",
          "Los servicios donde funciona Luka (los de la sección siguiente), que guardan los datos por encargo y no los usan para nada más.",
          "Yo, como responsable, puedo acceder a la base de datos solo para mantener Luka, para responder algo que tú me pidas o si una ley me obliga.",
        ),
      ],
    },
    {
      id: "donde",
      titulo: "Dónde se guardan",
      bloques: [
        p("Luka funciona sobre estos servicios, que pueden tener tus datos en servidores fuera de Chile (en Brasil y en Estados Unidos):"),
        lista(
          "Vercel: donde corre Luka y donde se guardan las boletas, en un almacenamiento privado, sin enlaces públicos.",
          "Neon: la base de datos con lo que anotas, en servidores de Amazon Web Services en São Paulo, Brasil.",
          "Google: el ingreso con tu cuenta de Google y el envío del correo con el código para borrar un hogar.",
        ),
      ],
    },
    {
      id: "google",
      titulo: "Los datos de tu cuenta de Google",
      bloques: [
        p(
          "Luka usa el ingreso con Google solo para saber quién eres. Pide únicamente tu nombre, tu correo y tu foto de perfil (los permisos «openid», «email» y «profile»). No entra a tu Gmail, a tu Drive ni a nada más de tu cuenta.",
        ),
        p("Esos datos no se comparten con nadie, no se usan para publicidad y no se transfieren a terceros."),
      ],
    },
    {
      id: "cookies",
      titulo: "Cookies",
      bloques: [
        p(
          "Luka usa solo las cookies necesarias para la sesión: una cookie cifrada con tu sesión y otras que se usan solo durante el ingreso con Google, para protegerlo. Además, tu navegador recuerda si elegiste el tema claro u oscuro. No hay cookies de publicidad ni de analítica.",
        ),
      ],
    },
    {
      id: "cuanto-tiempo",
      titulo: "Cuánto tiempo se guardan",
      bloques: [
        lista(
          "Mientras tu hogar exista.",
          "Si sales de un hogar, o el dueño te saca, se borra tu lugar en él, con tu verificación en dos pasos. Lo que anotaste se queda en el hogar, sin tu nombre. Tu sueldo sigue sumando, sin tu nombre, en los meses en que estuviste, y deja de sumar desde el mes siguiente.",
          "Si el dueño borra el hogar, se borra todo lo que tiene, incluidas las boletas. Los respaldos automáticos de los servicios de la sección anterior pueden conservar una copia por un tiempo corto, hasta que se borran solos.",
          "Los datos técnicos de las visitas, el tiempo que los conserve el servicio donde corre Luka.",
        ),
      ],
    },
    {
      id: "seguridad",
      titulo: "Cómo se protegen",
      bloques: [
        lista(
          "Todo viaja cifrado (HTTPS).",
          "Cada hogar está separado, y en cada visita se revisa que sigas siendo parte del tuyo.",
          `La verificación en dos pasos es opcional: cada persona elige si la activa. Con ella, entrar son dos pasos: Google y un código de ${DOS_PASOS.digitos} dígitos de la app de autenticación de tu celular. Tras ${DOS_PASOS.intentos} códigos equivocados seguidos, se bloquea por ${DOS_PASOS.minutosDeBloqueo} minutos.`,
          `La sesión se cierra sola tras ${MINUTOS_SIN_USO} minutos sin uso, a las ${HORAS_MAXIMAS} horas como máximo y cada vez que Luka se actualiza.`,
          "Las boletas se guardan en un almacenamiento privado y solo se muestran a quien está en ese hogar.",
          `Borrar un hogar exige un código que llega al correo del dueño y que vence en ${CODIGO_DE_BORRADO.minutosDeVigencia} minutos.`,
        ),
        p(
          "Ningún sistema es infalible. Si llego a saber de un problema que afecte tus datos, te voy a avisar y a contar qué se hizo.",
        ),
      ],
    },
    {
      id: "derechos",
      titulo: "Tus derechos",
      bloques: [
        p(
          "Según la ley chilena de protección de datos personales (la Ley N° 19.628, modificada por la Ley N° 21.719), puedes pedir acceso a tus datos, corregirlos, borrarlos, oponerte a su uso, llevártelos o pedir que se bloqueen.",
        ),
        p(
          `Buena parte lo puedes hacer tú mismo en Luka: borrar lo que anotaste (y volver a anotarlo bien), salir de tu hogar o borrarlo. Para lo demás, escríbeme a ${RESPONSABLE.correo} y te respondo dentro de los plazos que fija la ley. Si no quedas conforme, puedes reclamar ante la autoridad que corresponda.`,
        ),
      ],
    },
    {
      id: "menores",
      titulo: "Menores de edad",
      bloques: [p("Luka está pensada para personas mayores de 18 años.")],
    },
    {
      id: "cambios",
      titulo: "Cambios a esta política",
      bloques: [
        p(
          "Si esta política cambia, la fecha de arriba lo dice. Si el cambio es importante, también lo voy a avisar dentro de Luka.",
        ),
      ],
    },
  ],
};

export const TERMINOS: DocumentoLegal = {
  titulo: "Términos de uso",
  resumen: "Las reglas para usar Luka, en simple. Al entrar con tu cuenta de Google, las aceptas.",
  secciones: [
    {
      id: "que-es",
      titulo: "Qué es Luka",
      bloques: [
        p(
          "Luka es una herramienta para anotar y ordenar los gastos del hogar. No es asesoría financiera, contable ni tributaria: sus cálculos (lo que te queda, lo que puedes ahorrar, el Health Score) son estimaciones hechas con lo que tú anotas, y las decisiones son tuyas.",
        ),
      ],
    },
    {
      id: "cuenta",
      titulo: "Tu cuenta",
      bloques: [
        lista(
          "Entras con tu propia cuenta de Google. No compartas tu sesión: si usas un computador compartido, sal de Luka al terminar.",
          "Cada correo está en un solo hogar. La primera vez que entras sin una invitación, Luka te arma uno propio.",
        ),
      ],
    },
    {
      id: "hogar",
      titulo: "Tu hogar",
      bloques: [
        lista(
          "Todos los del hogar ven y anotan lo mismo, incluido el sueldo de cada uno. Cada persona cambia solo el suyo. Invita solo a personas en quienes confíes.",
          "El dueño invita y saca miembros, le cambia el nombre al hogar, elige el día en que empieza el mes y puede pasarle el hogar a otro miembro.",
          "El dueño puede borrar el hogar solo si nadie más ha entrado, y con un código que le llega al correo. Borrarlo no se puede deshacer.",
        ),
      ],
    },
    {
      id: "uso",
      titulo: "Uso aceptable",
      bloques: [
        p("Luka es para uso personal y de tu hogar. No está permitido:"),
        lista(
          "intentar entrar a hogares que no son tuyos o saltarse las protecciones de Luka;",
          "subir archivos con virus, contenido ilegal o datos de otras personas sin su permiso;",
          "usar Luka de forma automatizada o abusiva, de un modo que afecte el servicio para los demás.",
        ),
        p("Si alguien no respeta estas reglas, se le puede quitar el acceso."),
      ],
    },
    {
      id: "datos",
      titulo: "Tus datos",
      bloques: [
        p(
          "Lo que anotas y subes es tuyo, y eres responsable de que sea tuyo o de tu hogar. Cómo se guarda y se protege está en la política de privacidad.",
        ),
      ],
    },
    {
      id: "servicio",
      titulo: "Un servicio gratuito, tal como es",
      bloques: [
        lista(
          "Luka es gratuita y se ofrece tal como es. Puede tener errores o quedar sin servicio por ratos; se hace lo posible para que no pase.",
          `Hay límites razonables, como ${mb(TAMANO_MAXIMO_BOLETA)} por boleta.`,
          "Guarda los originales de las boletas que sean importantes para ti (garantías, trámites): Luka no reemplaza a tus respaldos.",
        ),
      ],
    },
    {
      id: "responsabilidad",
      titulo: "Responsabilidad",
      bloques: [
        p(
          "En la medida en que la ley lo permite, no respondo por pérdidas o daños indirectos que vengan de usar Luka, de que no esté disponible o de decisiones tomadas con sus cálculos.",
        ),
      ],
    },
    {
      id: "cambios",
      titulo: "Cambios y término",
      bloques: [
        p(
          "Estos términos pueden cambiar; la fecha de arriba dice cuándo fue la última vez, y los cambios importantes se avisan dentro de Luka. Si algún día Luka deja de funcionar, lo voy a avisar con tiempo para que puedas guardar lo que necesites, por ejemplo tus informes en PDF.",
        ),
      ],
    },
    {
      id: "ley",
      titulo: "Ley aplicable y contacto",
      bloques: [
        p(`Estos términos se rigen por las leyes de Chile. Para cualquier duda, escríbeme a ${RESPONSABLE.correo}.`),
      ],
    },
  ],
};

/** Las rutas de los dos documentos: son publicas, con o sin sesion. */
export const RUTAS_LEGALES = { privacidad: "/privacidad", terminos: "/terminos" } as const;
