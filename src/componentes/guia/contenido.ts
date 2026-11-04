import type { NombreIcono } from "../iconos";
import type { ClaveSeccion } from "../secciones-panel";

/**
 * El texto de la guia "¿Como usar?", separado de la pagina para que se pueda
 * revisar (y probar) sin tocar el diseno.
 *
 * En los textos, lo que va entre «comillas» es el nombre de algo que se ve
 * en la pantalla (un boton, un titulo): la pagina lo resalta.
 *
 * Las imagenes son capturas del panel con datos de ejemplo, no con los tuyos.
 * Viven en public/guia, en dos versiones (-claro y -oscuro), y se muestra la
 * del tema que tengas puesto. Si cambia una seccion del panel, conviene
 * volver a sacar su captura.
 */

/** Ancho y alto de cada captura, para reservar su espacio antes de que cargue. */
export const IMAGENES_GUIA = {
  "ahorros": [659, 1284],
  "balance": [999, 579],
  "barra-sueldo": [1200, 282],
  "categorias": [659, 422],
  "confirmar-eliminar": [648, 369],
  "cuenta-completa": [999, 1284],
  "deudas": [659, 840],
  "dia-inicio": [720, 648],
  "encabezado": [1200, 241],
  "kpis": [1200, 216],
  "movimientos": [1200, 814],
  "pagos": [999, 1142],
  "presupuestos": [1200, 804],
  "registrar-formulario": [659, 702],
  "registrar-gasto": [816, 684],
  "reporte-semanal": [1200, 1000],
  "resumen-semanas": [1200, 132],
  "ritmo-semanal": [1200, 658],
  "salud": [999, 1116],
  "tu-plata": [1200, 334],
} as const satisfies Record<string, readonly [number, number]>;

export type NombreImagen = keyof typeof IMAGENES_GUIA;

export type ImagenGuia = {
  archivo: NombreImagen;
  /** Lo que muestra, para quien no la ve. */
  alt: string;
  /** La linea que va debajo. */
  pie: string;
};

/** Una cosa que se ve en la pantalla y que significa. */
export type Termino = { termino: string; definicion: string };

export type BloqueGuia = {
  titulo: string;
  /** Parrafos. */
  texto: readonly string[];
  /** Lo que hay en la pantalla, explicado parte por parte. */
  terminos?: readonly Termino[];
  /** Como hacerlo, en orden. */
  pasos?: readonly string[];
  imagen?: ImagenGuia;
  consejo?: string;
};

export type SeccionGuia = {
  /** Ancla dentro de la guia. */
  id: string;
  /** Si es una seccion del panel: de ahi salen el numero, el color y el icono. */
  seccionPanel?: ClaveSeccion;
  titulo: string;
  icono: NombreIcono;
  /** Donde esta en la app, para el boton "Ir a esta seccion". */
  enlace: string;
  /** Lo que va arriba del titulo, si no es una seccion del panel. Sin esto: «Antes de empezar». */
  ubicacion?: string;
  /** El texto del boton que lleva a la seccion. Sin esto: «Ir a esta sección del panel». */
  textoEnlace?: string;
  paraQueSirve: string;
  bloques: readonly BloqueGuia[];
};

export const PRIMEROS_PASOS: readonly { titulo: string; texto: string; destino: string }[] = [
  {
    titulo: "Elige el día en que empieza tu mes",
    texto: "Si te pagan el 27, tu mes va del 27 al 26. Arriba del panel, en el botón «Mes desde el día…».",
    destino: "#antes-de-empezar",
  },
  {
    titulo: "Define tu sueldo",
    texto: "En la sección 01, dentro del balance, con «Definir mi sueldo». Sin sueldo no hay de dónde restar.",
    destino: "#resumen",
  },
  {
    titulo: "Agrega tus cuentas fijas",
    texto: "Luz, agua, dividendo, internet… en «Pagos del mes», con «Agregar una cuenta». Marca «Se repite todos los meses».",
    destino: "#registro",
  },
  {
    titulo: "Agrega tus deudas en cuotas",
    texto: "Créditos y compras en cuotas, en la sección 04, con «Agregar una deuda».",
    destino: "#salud",
  },
  {
    titulo: "Ponle techo a tus categorías",
    texto: "Supermercado, bencina, café… en la sección 06, con «Agregar un presupuesto».",
    destino: "#presupuestos",
  },
  {
    titulo: "Anota cada gasto y marca lo que pagas",
    texto: "Con «Registrar gasto» apenas gastes, y con «Pagado» cuando pagues una cuenta o una cuota. El resto se calcula solo.",
    destino: "#registro",
  },
];

export const GUIA: readonly SeccionGuia[] = [
  {
    id: "antes-de-empezar",
    titulo: "Arriba del panel: tu mes y cómo moverte",
    icono: "calendar",
    enlace: "/",
    paraQueSirve:
      "Lo primero que ves al entrar: qué mes estás mirando, cuántos días le quedan, y los botones para cambiar de mes, ajustar el día en que empieza y anotar un gasto desde cualquier parte.",
    bloques: [
      {
        titulo: "El encabezado",
        texto: [
          "Arriba está el nombre del mes y sus fechas exactas (por ejemplo, «Noviembre 2026 · 27 oct – 26 nov»). Debajo, una frase te dice cuántos días quedan para cerrar el mes y si hay algo urgente, como una cuenta vencida.",
          "Más abajo está el índice: una fila de botones numerados del 01 al 07. Cada uno te lleva directo a esa sección del panel. En el celular se desliza hacia el lado.",
        ],
        terminos: [
          { termino: "‹ ›", definicion: "Las flechas al lado del nombre del mes te llevan al mes anterior o al siguiente. Cada mes tiene su propia dirección, así que el botón «atrás» del navegador también funciona." },
          { termino: "«Mes desde el día…»", definicion: "Abre el ajuste del día en que empieza tu mes. Se explica en el bloque de abajo." },
          { termino: "«Registrar gasto»", definicion: "Abre el formulario para anotar un gasto en una ventana, sin tener que bajar hasta la sección 03." },
          { termino: "Sol o luna", definicion: "Arriba a la derecha cambias entre tema claro y oscuro. Las imágenes de esta guía también cambian." },
        ],
        imagen: {
          archivo: "encabezado",
          alt: "El encabezado del panel con el mes, sus fechas, las flechas para cambiar de mes, los botones «Mes desde el día 27» y «Registrar gasto», y el índice de secciones.",
          pie: "El mes que estás mirando, sus fechas, los botones principales y el índice de secciones.",
        },
      },
      {
        titulo: "El día en que empieza tu mes",
        texto: [
          "Luka no tiene por qué usar el mes del calendario. Si tu sueldo llega el 27, lo natural es que tu mes vaya del 27 al 26 del mes siguiente: así los gastos que haces con ese sueldo quedan todos juntos.",
          "El nombre del mes sigue una regla fija. Si tu mes empieza el día 16 o después, lleva el nombre del mes en que termina: del 27 de octubre al 26 de noviembre es «Noviembre», porque es el sueldo con que pagas noviembre. Si empieza entre el 1 y el 15, lleva el nombre del mes en que empieza.",
          "El cambio vale para todos los meses, también los anteriores: cada gasto se cuenta en el mes que le toca según su fecha.",
          "Lo elige el dueño del hogar, para todos. Los demás ven el día elegido, pero no lo cambian.",
        ],
        pasos: [
          "Toca «Mes desde el día…» (o «Mes calendario», si nunca lo cambiaste).",
          "Elige el día en la lista, del 1 al 31.",
          "Revisa la vista previa: te muestra en qué mes estás hoy y sus fechas, y cuál viene después.",
          "Toca «Guardar». El panel vuelve al mes que corresponde a hoy.",
        ],
        imagen: {
          archivo: "dia-inicio",
          alt: "La ventana para elegir el día de inicio del mes, con el día 27 elegido y la vista previa de las fechas.",
          pie: "Eliges el día y ves al tiro cómo quedan tus meses antes de guardar.",
        },
        consejo:
          "Los meses que no tienen ese día empiezan en su último día. Si eliges el 31, en febrero tu mes empieza el 28 (o el 29).",
      },
      {
        titulo: "Anotar un gasto desde cualquier parte",
        texto: [
          "El botón «Registrar gasto» abre el mismo formulario de la sección 03 en una ventana. Al guardar, se cierra solo y aparece el aviso «Gasto registrado». Con «Esc» o la X la cierras sin guardar.",
        ],
        imagen: {
          archivo: "registrar-gasto",
          alt: "La ventana «Registrar nuevo gasto» con los campos de fecha, monto, descripción, categoría, medio de pago y foto de la boleta.",
          pie: "La ventana de «Registrar gasto»: el mismo formulario de la sección 03.",
        },
      },
    ],
  },
  {
    id: "resumen",
    seccionPanel: "resumen",
    titulo: "Resumen del mes",
    icono: "trending-up",
    enlace: "/#resumen",
    paraQueSirve:
      "La foto del mes de un vistazo: cuánto entró, cuánto salió, cuánto queda y cuánto falta pagar. Es lo primero que conviene mirar cada vez que entras.",
    bloques: [
      {
        titulo: "Las cuatro cifras de arriba",
        texto: ["Son el resumen del resumen. Las cuatro cuadran entre sí y con el balance de más abajo."],
        terminos: [
          { termino: "Sueldo del mes", definicion: "Lo que entra este mes. Sale del sueldo que definiste en el balance." },
          { termino: "Total gastado", definicion: "Todo lo que ya salió este mes: tus gastos, las cuentas que marcaste pagadas y las cuotas pagadas. Abajo te compara con el mes anterior en la misma cantidad de días (en rojo si subió, en verde si bajó) y te dice qué parte de tu sueldo llevas." },
          { termino: "Disponible", definicion: "El sueldo menos lo gastado. Debajo, «Tras pagar lo pendiente», es lo que te quedaría si hoy pagaras todas las cuentas y cuotas que faltan." },
          { termino: "Por pagar", definicion: "Lo que falta pagar en cuentas y cuotas este mes. Te avisa cuántas están vencidas y cuántas vencen pronto. Cuando no queda nada, dice «Todo pagado este mes»." },
        ],
        imagen: {
          archivo: "kpis",
          alt: "Las cuatro tarjetas del resumen: Sueldo del mes, Total gastado, Disponible y Por pagar.",
          pie: "Sueldo, gastado, disponible y por pagar: el mes en cuatro números.",
        },
      },
      {
        titulo: "La barra «Tu sueldo de…»",
        texto: [
          "Muestra tu sueldo como una barra que se va llenando. La parte sólida es lo que ya gastaste, la rayada es lo que falta pagar en cuentas y cuotas, y lo vacío es lo que te queda libre.",
          "El color depende de qué parte del sueldo llevas: verde hasta el 50%, ámbar del 50% al 80% y rojo desde el 80%. Lo vacío muestra esos tramos tenues, y arriba están marcados el 50% y el 80%, para que veas cuánto te falta para el siguiente color.",
          "La raya vertical es el día de hoy. Si lo gastado termina antes que la raya, vas gastando más lento que el paso del mes: bien. Si la pasa, vas más rápido.",
        ],
        terminos: [
          { termino: "Etiqueta de arriba a la derecha", definicion: "«Vas bien» en verde; «Atención» en ámbar desde el 50% comprometido; «Cuidado» en rojo desde el 80%; «No alcanza» si lo gastado más lo pendiente supera tu sueldo." },
          { termino: "Libre para gastar", definicion: "El sueldo menos lo gastado y lo que falta pagar, y cuánto es por día en los días que quedan." },
          { termino: "Ritmo del mes", definicion: "Compara la parte del sueldo que llevas con la parte del mes que ya pasó. «3 pts sobre el ritmo» quiere decir que llevas 3 puntos más de sueldo que de mes." },
        ],
        imagen: {
          archivo: "barra-sueldo",
          alt: "La barra del sueldo con lo gastado en verde, lo por pagar rayado en verde y ámbar, la raya de hoy y las marcas del 50% y el 80%.",
          pie: "Sólido es lo gastado, rayado lo que falta pagar y vacío lo libre. El color depende del tramo.",
        },
      },
      {
        titulo: "El balance y tu sueldo",
        texto: [
          "El balance es la cuenta del mes de arriba abajo: el sueldo, menos los gastos en lo esencial, menos las cuotas de deudas, menos los gastos en lo demás. Abajo queda «Te queda» (o «Te pasaste por», si es negativo).",
          "Aquí también defines tu sueldo. El sueldo rige desde un mes en adelante: si en marzo te suben el sueldo, defines el nuevo «desde marzo» y los meses anteriores conservan el que tenían.",
        ],
        pasos: [
          "En el balance, toca «Definir mi sueldo» (o «Cambiar el sueldo», si ya lo tienes).",
          "En «Rige desde», elige el mes desde el que vale.",
          "En «Monto mensual», escribe tu sueldo líquido, solo números (por ejemplo, 1500000).",
          "Guarda. Todas las cifras del panel se recalculan.",
        ],
        imagen: {
          archivo: "balance",
          alt: "El balance con el sueldo, los gastos en lo esencial, las cuotas de deudas, los gastos en lo demás y lo que te queda.",
          pie: "Del sueldo se restan lo esencial, las cuotas y lo demás. Abajo, lo que te queda.",
        },
        consejo:
          "Qué es esencial lo decide la categoría: arriendo, supermercado o luz son esenciales; café o restaurantes no. Por eso conviene elegir bien la categoría de cada gasto.",
      },
      {
        titulo: "Por categoría",
        texto: [
          "En qué se fue la plata este mes, de la categoría más grande a la más chica. Se ven las 5 mayores, cada una con su monto y qué parte del total es. El resto queda agrupado en «Otras N categorías», con su total: tócala para verlas todas.",
          "Si pasas el mouse por una categoría (o la tocas en el celular), aparece su detalle: cuántos gastos tiene, el promedio, en cuántos días gastaste, los gastos más grandes y si va más arriba o más abajo que el mes pasado.",
        ],
        imagen: {
          archivo: "categorias",
          alt: "La tarjeta «Por categoría» con las cinco categorías mayores, su barra, monto y porcentaje, y la fila «Otras 3 categorías».",
          pie: "Las 5 categorías más grandes y el resto agrupado.",
        },
      },
    ],
  },
  {
    id: "queda",
    seccionPanel: "queda",
    titulo: "Lo que te queda y lo que ahorras",
    icono: "piggy-bank",
    enlace: "/#queda",
    paraQueSirve:
      "Responde dos preguntas: cuánta plata tienes para el resto del mes después de pagar todo lo que debes, y cuánto puedes ahorrar. Se actualiza solo con cada gasto, pago o cuenta nueva.",
    bloques: [
      {
        titulo: "«Tu plata de…»: las tres cifras",
        texto: [
          "Se leen como una resta: lo libre para el mes, menos lo que tienes reservado para tus presupuestos, es lo que puedes ahorrar.",
        ],
        terminos: [
          { termino: "Libre para el mes", definicion: "Tu sueldo menos lo que ya pagaste y lo que falta pagar en cuentas y cuotas. Es la plata que tienes para vivir el resto del mes." },
          { termino: "Para tus presupuestos", definicion: "Lo que todavía falta gastar en las categorías con presupuesto (súper, bencina…). Ya tiene destino." },
          { termino: "Puedes ahorrar", definicion: "Lo que queda después de lo anterior. La barra de abajo lo compara con tu meta de ahorro (el 20% del sueldo): te dice si te alcanza para cumplirla, o cuánto te faltaría aunque ahorres todo." },
          { termino: "Margen por día", definicion: "Si no apartas nada, cuánto tienes por día para imprevistos en los días que quedan." },
        ],
        imagen: {
          archivo: "tu-plata",
          alt: "El recuadro «Tu plata de noviembre» con Libre para el mes, Para tus presupuestos y Puedes ahorrar, y la barra de la meta de ahorro.",
          pie: "Libre para el mes − presupuestos = lo que puedes ahorrar.",
        },
        consejo:
          "Un gasto imprevisto baja estas cifras. Pagar una cuenta que ya estaba en la lista no las cambia (salvo que pagues otro monto), porque ya estaba descontada.",
      },
      {
        titulo: "La cuenta completa",
        texto: [
          "Es el detalle de las cifras de arriba, línea por línea: el sueldo, lo pagado, las cuentas por pagar, las cuotas por pagar, el subtotal «= Libre después de pagar todo», lo que queda de tus presupuestos, tu ahorro del mes y, al final, «Te quedaría».",
          "La barra de colores muestra lo mismo: cada color se come un pedazo del sueldo y lo gris es lo libre.",
        ],
        pasos: [
          "En «Pagos realizados», toca «Ver detalle» para separar lo pagado en tres: cuentas y cuotas pagadas (lo previsto), gastos dentro de presupuesto y gastos fuera de presupuesto. Esto último son los imprevistos, y te muestra los tres más grandes.",
          "En «Presupuesto por gastar», toca «Ver por categoría» para ver cuánto le queda a cada presupuesto.",
          "Toca el nombre de una línea (por ejemplo, «Cuentas por pagar») para ir a esa sección del panel.",
        ],
        imagen: {
          archivo: "cuenta-completa",
          alt: "La cuenta completa del mes con el detalle de los pagos realizados abierto.",
          pie: "«Ver detalle» separa lo pagado y te muestra los imprevistos más grandes.",
        },
      },
      {
        titulo: "Ahorros",
        texto: [
          "Aquí anotas la plata que apartas. Cada ahorro se descuenta de lo que te queda en el mes y se suma a tu total ahorrado.",
          "Arriba ves cuánto llevas este mes y tu total acumulado; al medio, tu meta (el 20% del sueldo) y cuánto te falta; abajo, los aportes del mes y los últimos 6 meses.",
        ],
        pasos: [
          "En «Cuánto apartas», escribe el monto (solo números).",
          "En «Para qué», escribe para qué es, si quieres (fondo de emergencia, vacaciones…).",
          "Toca «Agregar ahorro de…». Aparece en la lista del mes.",
          "Para borrar un aporte, toca el tacho a su lado.",
        ],
        imagen: {
          archivo: "ahorros",
          alt: "La tarjeta Ahorros con lo ahorrado en el mes, el total, la meta del 20%, el formulario para apartar y el gráfico de los últimos 6 meses.",
          pie: "Anotas cuánto apartas y para qué; Luka lleva la cuenta y la compara con tu meta.",
        },
      },
    ],
  },
  {
    id: "registro",
    seccionPanel: "registro",
    titulo: "Registro y pagos",
    icono: "receipt",
    enlace: "/#registro",
    paraQueSirve:
      "Lo que haces en el día a día: anotar cada gasto y marcar como pagadas tus cuentas y cuotas. Todo el resto del panel se calcula a partir de lo que anotas aquí.",
    bloques: [
      {
        titulo: "Registrar un gasto",
        texto: [
          "Anota cada gasto apenas lo hagas: así nada se te olvida y las cifras están siempre al día.",
          "Si la categoría tiene presupuesto, al escribir el monto te avisa cómo queda ese presupuesto con este gasto (por ejemplo, si te pasarías).",
        ],
        pasos: [
          "«Fecha»: viene con la de hoy; cámbiala si el gasto fue otro día.",
          "«Monto»: solo números, sin puntos ni signo peso (por ejemplo, 45990).",
          "«Descripción»: qué compraste y dónde (por ejemplo, «Supermercado Lider»).",
          "«Categoría»: decide si el gasto es esencial o no, y a qué presupuesto se suma.",
          "«Medio de pago»: débito, crédito, transferencia, efectivo u otro.",
          "«Foto de la boleta» (opcional): elige la foto o el PDF. En el celular puedes abrir la cámara directo.",
          "Toca «Agregar gasto». Aparece en Movimientos y se suma a todo el panel.",
        ],
        imagen: {
          archivo: "registrar-formulario",
          alt: "El formulario «Registrar nuevo gasto» con fecha, monto, descripción, categoría, medio de pago y foto de la boleta.",
          pie: "El formulario de gasto. La foto de la boleta es opcional.",
        },
        consejo:
          "Puedes subir una foto (JPG, PNG, WEBP o HEIC) o un PDF de hasta 4 MB. Si la foto pesa más, Luka la achica sola antes de subirla. Las boletas se guardan en un almacenamiento privado y solo las ven las personas de tu hogar.",
      },
      {
        titulo: "Pagos del mes: tus cuentas y cuotas",
        texto: [
          "Es la lista de todo lo que tienes que pagar este mes, ordenada por urgencia. Arriba a la derecha, «Falta pagar» suma lo pendiente.",
          "Las cuentas se agrupan en «Vencidas» (en rojo, ya pasó su fecha), «Por vencer · 7 días» y «Programadas» (más adelante; tócala para verlas). Al final, «Pagadas este mes». Las cuotas de tus deudas también aparecen aquí, con el ícono de tarjeta y su número de cuota.",
        ],
        terminos: [
          { termino: "«Pagado»", definicion: "Márcala pagada de un toque, con la fecha de hoy y el monto esperado. Se crea el gasto solo." },
          { termino: "Calendario", definicion: "Pagar con boleta, otra fecha u otro monto (la luz nunca llega igual). Abre un formulario con esos tres campos." },
          { termino: "Lápiz", definicion: "Editar la cuenta mientras está pendiente: nombre, monto, día de vencimiento, categoría, nota, si se repite, y la foto de la boleta." },
          { termino: "Tacho", definicion: "Eliminar la cuenta." },
          { termino: "«Pendiente»", definicion: "En una cuenta o cuota ya pagada, deshace el pago: borra el gasto y vuelve a la lista de pendientes." },
          { termino: "«adjuntar» / «boleta»", definicion: "En una pagada sin foto aparece «adjuntar» para subirla; si ya tiene, «boleta» la muestra." },
          { termino: "Flechas en círculo", definicion: "La cuenta se repite todos los meses." },
        ],
        imagen: {
          archivo: "pagos",
          alt: "La lista «Pagos de Noviembre» con cuentas vencidas, por vencer, programadas y pagadas, y cuotas de deudas.",
          pie: "Vencidas, por vencer, programadas y pagadas. Cada fila con sus botones.",
        },
      },
      {
        titulo: "Agregar una cuenta",
        texto: [
          "Una cuenta es un pago que todavía no ocurre: luz, agua, internet, dividendo, el gimnasio. Al marcarla pagada se convierte en gasto.",
          "Si la marcas como «Se repite todos los meses», Luka la copia sola al mes siguiente apenas lo abres, pendiente y con el monto del mes anterior. Así no tienes que volver a anotarla.",
        ],
        pasos: [
          "Al final de «Pagos del mes», toca «Agregar una cuenta».",
          "Escribe el nombre y el monto esperado.",
          "Elige el día del mes en que vence (opcional) y la categoría.",
          "Marca «Se repite todos los meses» si es fija.",
          "Si ya tienes la boleta, adjúntala. Guarda.",
        ],
        consejo:
          "Con un mes que empieza el 27, una cuenta que vence el 30 vence el 30 del mes en que empieza tu mes (por ejemplo, el 30 de octubre en tu mes de noviembre). Por eso cada cuenta muestra su fecha exacta.",
      },
    ],
  },
  {
    id: "salud",
    seccionPanel: "salud",
    titulo: "Salud financiera y deudas",
    icono: "heart-pulse",
    enlace: "/#salud",
    paraQueSirve:
      "Un número del 0 al 100 que resume cómo va tu mes, con lo que lo sube, lo que lo baja y qué hacer para mejorarlo. Al lado, tus deudas en cuotas.",
    bloques: [
      {
        titulo: "El Health Score",
        texto: [
          "El anillo muestra tu puntaje del mes y lo compara con el mes anterior. A la derecha, «Lo que suma» y «Lo que resta», con los puntos de cada factor. Abajo, una sola recomendación: la que más subiría tu puntaje, con un botón para ir a resolverla.",
        ],
        terminos: [
          { termino: "Tasa de ahorro (30 pts)", definicion: "Qué parte del sueldo te queda si pagas todo lo pendiente. La meta es el 20%." },
          { termino: "Presupuestos dentro del límite (25 pts)", definicion: "Cuántos de tus presupuestos van dentro de su techo." },
          { termino: "Cuentas al día (20 pts)", definicion: "Cada cuenta vencida resta 10 puntos." },
          { termino: "Carga de deuda (15 pts)", definicion: "Qué parte del sueldo se va en cuotas. Bajo el 25% es sano; desde el 40% ya no suma nada." },
          { termino: "Ritmo de gasto (10 pts)", definicion: "Si vas gastando más rápido que el paso del mes." },
        ],
        imagen: {
          archivo: "salud",
          alt: "El Health Score con el anillo, los factores que suman y restan, y la recomendación.",
          pie: "El puntaje, sus cinco factores y la recomendación que más lo subiría.",
        },
      },
      {
        titulo: "Deudas en cuotas",
        texto: [
          "Cada deuda muestra su cuota de este mes, en qué cuota vas, cuándo termina y cuánto te falta pagar, con una barra de avance. Arriba, «queda por pagar» suma todas tus deudas.",
          "Una deuda no se borra al terminar: con el tacho la marcas como terminada y sale de los cálculos, pero queda su historia.",
        ],
        pasos: [
          "Para agregar una: toca «Agregar una deuda», escribe el nombre, el monto por cuota, el total de cuotas y el mes de la primera cuota. Guarda.",
          "Para pagar la cuota del mes: toca «Pagado» (hoy y el monto pactado), o «con boleta, otra fecha o monto» para elegir la fecha, el monto real y adjuntar la boleta.",
          "Si ya estaba pagada y no tiene foto, toca «adjuntar» al lado de «pagada el…».",
          "Para corregir el nombre o el monto, usa el lápiz. El mes de la primera cuota y el total no se pueden cambiar si ya hay cuotas pagadas.",
        ],
        imagen: {
          archivo: "deudas",
          alt: "La tarjeta «Deudas en cuotas» con tres deudas, sus barras de avance y los botones para pagar.",
          pie: "Cada deuda con su cuota del mes, su avance y lo que falta.",
        },
        consejo: "La cuota pagada también aparece en «Pagos del mes» y en «Movimientos», marcada como «cuota de deuda».",
      },
    ],
  },
  {
    id: "semanas",
    seccionPanel: "semanas",
    titulo: "Tus gastos, semana a semana",
    icono: "activity",
    enlace: "/#semanas",
    paraQueSirve:
      "Muestra el mes en bloques de 7 días, desde que empieza tu mes, para que veas en qué semana se te fue la mano y cómo vas a cerrar si sigues al mismo ritmo.",
    bloques: [
      {
        titulo: "Ritmo semanal",
        texto: [
          "Cada barra es una semana; su color dice cómo fue tu gasto discrecional por día contra tu promedio del mes. Toca una barra (o su pestaña) para ver el detalle de esa semana: cuánto gastaste, el promedio por día, cómo va contra la semana anterior y en qué categorías se fue.",
          "«Solo discrecional» saca de las barras lo esencial. Sirve porque el arriendo hace que su semana siempre sea la más alta y aplasta a las demás, y lo que quieres ver es si estás gastando de más en lo que sí puedes controlar.",
          "La proyección te dice cuánto gastarías al cierre si sigues a este ritmo, y qué parte de tu sueldo sería.",
        ],
        imagen: {
          archivo: "ritmo-semanal",
          alt: "El ritmo semanal con las barras de cada semana y el detalle de la semana elegida.",
          pie: "Elige una semana para ver su detalle.",
        },
      },
      {
        titulo: "Total, esenciales, discrecionales y promedio",
        texto: [
          "Cuatro cifras del mes: el total gastado, cuánto fue en lo esencial (lo que no puedes dejar de pagar), cuánto en lo discrecional (lo que podrías recortar) y tu promedio por día.",
        ],
        imagen: {
          archivo: "resumen-semanas",
          alt: "Las cuatro tarjetas: total del mes, esenciales, discrecionales y promedio diario.",
          pie: "El mes partido en esencial y discrecional.",
        },
      },
    ],
  },
  {
    id: "presupuestos",
    seccionPanel: "presupuestos",
    titulo: "Presupuestos",
    icono: "wallet",
    enlace: "/#presupuestos",
    paraQueSirve:
      "Le pones un techo a cada categoría (por ejemplo, $200.000 al mes en supermercado) y Luka te dice cuánto llevas, cuánto te queda y te avisa antes de pasarte.",
    bloques: [
      {
        titulo: "Cómo se lee",
        texto: [
          "Cada presupuesto muestra lo gastado contra su techo («$84.300 / $120.000»), una barra y cuánto te queda. La barra es verde mientras vas bien, ámbar desde el 80% y roja al llegar al 100%. La parte rayada son cuentas pendientes de esa categoría: todavía no las pagas, pero ya tienen destino.",
          "Arriba aparecen los avisos: en qué categorías te pasaste, cuáles llegaron al 100% y cuáles están llegando al límite.",
          "Se ven los 5 más usados. Abajo, «Ver todas» muestra el resto. Los filtros «Todas», «Agotadas», «Al límite» y «Sanas» muestran solo los de ese estado.",
          "Los presupuestos son por mes: cada mes defines los suyos.",
        ],
        pasos: [
          "Toca «Agregar un presupuesto». Te sugiere primero las categorías en que ya gastaste y no tienen presupuesto.",
          "Elige la categoría, escribe el techo del mes y guarda.",
          "Toca un presupuesto para desplegarlo: verás sus gastos semana a semana y sus boletas.",
          "Con el lápiz cambias el techo; con el tacho lo eliminas.",
        ],
        imagen: {
          archivo: "presupuestos",
          alt: "La lista de presupuestos con avisos, filtros por estado, barras y el botón «Ver todas».",
          pie: "Avisos arriba, filtros, los 5 más usados y «Ver todas».",
        },
      },
    ],
  },
  {
    id: "movimientos",
    seccionPanel: "movimientos",
    titulo: "Movimientos del mes",
    icono: "table",
    enlace: "/#movimientos",
    paraQueSirve:
      "La lista de todo lo que salió este mes, del más reciente al más antiguo: tus gastos, los pagos de cuentas y los pagos de cuotas, cada uno con su boleta.",
    bloques: [
      {
        titulo: "Buscar, filtrar y ver las boletas",
        texto: [
          "Arriba puedes buscar por descripción, categoría o medio de pago (no importan las tildes: «cafe» encuentra «Café») y filtrar por una categoría. Al lado ves cuántos movimientos coinciden y cuánto suman.",
          "Se ven los 10 más recientes; abajo, «Ver todos» muestra el resto. El buscador y el filtro buscan en todos, no solo en los que se ven.",
          "En la columna «Boleta», «boleta» abre la foto en la misma página y «adjuntar» te deja subirla si no la tiene. Los pagos de cuotas llevan la marca «cuota de deuda».",
          "Si en tu hogar entró más de una persona, cada movimiento dice quién lo anotó, por ejemplo «anotó Ana».",
        ],
        imagen: {
          archivo: "movimientos",
          alt: "La tabla de movimientos con el buscador, el filtro por categoría y las columnas de fecha, descripción, categoría, boleta y monto.",
          pie: "Busca, filtra y abre la boleta de cada gasto.",
        },
      },
      {
        titulo: "Eliminar un movimiento",
        texto: [
          "Con el tacho de la derecha. Antes de borrar te pregunta, porque se elimina por completo y no se puede deshacer. «Cancelar» está marcado de entrada, así que un Enter sin querer no borra nada.",
          "Si lo que borras es el pago de una cuenta o de una cuota, te avisa que esa cuenta o cuota vuelve a quedar pendiente en «Pagos del mes».",
        ],
        imagen: {
          archivo: "confirmar-eliminar",
          alt: "La ventana «¿Eliminar…?» con el aviso de que la cuota vuelve a quedar pendiente y los botones Cancelar y Sí, eliminar.",
          pie: "Siempre pregunta antes de borrar.",
        },
        consejo: "Los gastos no se editan: si anotaste mal uno, bórralo y vuelve a anotarlo.",
      },
    ],
  },
  {
    id: "informes",
    titulo: "Informes",
    icono: "file-text",
    enlace: "/informes",
    ubicacion: "En la barra de arriba",
    textoEnlace: "Ir a Informes",
    paraQueSirve:
      "Para mirar el mes con calma, comparar con meses anteriores o guardar un registro. Está en «Informes», en la barra de arriba.",
    bloques: [
      {
        titulo: "Informe del mes",
        texto: [
          "Junta todo el mes en una página: los totales, cómo vienen tus gastos en los últimos meses, los gastos más grandes, la comparación con el mes anterior, cada categoría en detalle, los medios de pago, las semanas, las cuentas y la tabla completa de gastos.",
          "Con «Imprimir o guardar PDF» lo imprimes o lo guardas como PDF desde el navegador. Con las flechas cambias de mes, igual que en el panel.",
        ],
      },
      {
        titulo: "Reporte semanal",
        texto: [
          "Desde el informe, «Reporte semanal» abre una semana del mes con cada gasto: el total, el promedio por día, qué parte del mes fue, lo esencial y lo discrecional, la comparación con la semana anterior, lo más destacado y el detalle por categoría, por medio de pago y día por día.",
          "Las pestañas de arriba cambian de semana. «Descargar PDF» baja ese reporte listo para guardar o enviar.",
        ],
        imagen: {
          archivo: "reporte-semanal",
          alt: "El reporte semanal con las pestañas de semanas, el botón «Descargar PDF», las cifras de la semana y la tabla por categoría.",
          pie: "Una semana en detalle, con su PDF.",
        },
      },
    ],
  },
  {
    id: "hogar",
    titulo: "Tu hogar: con quién compartes Luka",
    icono: "users",
    enlace: "/hogar",
    ubicacion: "En la barra de arriba",
    textoEnlace: "Ir a Hogar",
    paraQueSirve:
      "Luka lleva las cuentas de un hogar, no de una persona. En «Hogar», en la barra de arriba, ves quiénes están, invitas a alguien de tu casa y decides quién lo administra.",
    bloques: [
      {
        titulo: "Quiénes están",
        texto: [
          "Todos los del hogar ven y anotan lo mismo: los gastos, las cuentas, el sueldo, las deudas y los presupuestos. Nadie de otro hogar ve nada del tuyo.",
          "La lista parte con el dueño, sigue con los que ya entraron y termina con las invitaciones que todavía nadie acepta.",
        ],
        terminos: [
          { termino: "«Dueño»", definicion: "Quien administra el hogar: invita, saca miembros, le cambia el nombre con «Cambiar nombre» y elige el día en que empieza el mes. Hay uno solo." },
          { termino: "«Tú»", definicion: "Marca tu propia fila." },
          { termino: "«Invitación pendiente»", definicion: "Un correo invitado que todavía no entra a Luka. El dueño la puede cancelar con «Cancelar invitación»." },
        ],
      },
      {
        titulo: "Invitar a alguien",
        texto: [
          "Solo el dueño invita. No se manda ningún correo: la invitación espera a que esa persona entre a Luka con su cuenta de Google.",
        ],
        pasos: [
          "En «Invitar a alguien», escribe su correo de Google.",
          "Toca «Invitar». Aparece en la lista como «Invitación pendiente».",
          "Avísale que entre a Luka con ese mismo correo.",
          "Al entrar, queda en tu hogar, con todo a la vista.",
        ],
        consejo:
          "Cada correo puede estar en un solo hogar. Invita a la persona antes de que entre por primera vez: si entra antes, Luka le arma su propio hogar.",
      },
      {
        titulo: "Pasar el hogar, sacar a alguien o salir",
        texto: [
          "Con «Pasarle el hogar», el dueño deja a otro miembro como dueño y él queda como miembro. Con «Sacar del hogar» saca a alguien; lo que esa persona anotó se queda en el hogar.",
          "Un miembro se va cuando quiera con «Salir del hogar»: su sesión se cierra y, para volver, lo tienen que invitar de nuevo. El dueño, antes de salir, tiene que pasarle el hogar a alguien.",
        ],
      },
      {
        titulo: "Borrar el hogar",
        texto: [
          "Si eres el dueño y nadie más ha entrado a tu hogar, en lugar de «Salir del hogar» ves «Borrar este hogar». Sirve, por ejemplo, si armaste tu hogar y después te quieren invitar a otro.",
          "Se borra todo lo que tiene: gastos, cuentas, deudas, presupuestos, ahorros y boletas, y no se puede deshacer. Por eso no basta con tener Luka abierto: hay que confirmar con un código que llega a tu correo.",
        ],
        pasos: [
          "En «Borrar este hogar», toca «Borrar el hogar».",
          "Toca «Enviar código». Te llega un correo de Luka con un código de 6 números.",
          "Escríbelo en «Código del correo» y toca «Sí, borrar todo». Tienes 10 minutos y 5 intentos; si se te pasan, pide otro.",
          "Tu sesión se cierra y el hogar ya no existe.",
        ],
        consejo:
          "Después de borrarlo, espera la invitación antes de volver a entrar: si entras antes, Luka te arma un hogar nuevo.",
      },
    ],
  },
];

export const PREGUNTAS: readonly { pregunta: string; respuesta: string }[] = [
  {
    pregunta: "¿Por qué mi mes dice «Noviembre» si todavía es octubre?",
    respuesta:
      "Porque tu mes empieza el día de tu sueldo. Si empieza el día 16 o después, lleva el nombre del mes en que termina: del 27 de octubre al 26 de noviembre es «Noviembre», el sueldo con que pagas noviembre.",
  },
  {
    pregunta: "¿Qué diferencia hay entre «Libre para el mes» y «Puedes ahorrar»?",
    respuesta:
      "«Libre para el mes» es lo que te queda después de pagar todas tus cuentas y cuotas. «Puedes ahorrar» es lo que sobra después de, además, gastar lo que queda de tus presupuestos.",
  },
  {
    pregunta: "¿Qué pasa si borro el pago de una cuenta o de una cuota?",
    respuesta:
      "La cuenta o la cuota vuelve a quedar pendiente y su monto vuelve a «por pagar». Lo mismo pasa si tocas «Pendiente» en una pagada.",
  },
  {
    pregunta: "¿Qué es esencial y qué es discrecional?",
    respuesta:
      "Lo decide la categoría. Esencial es lo que no puedes dejar de pagar (arriendo, supermercado, luz); discrecional, lo que podrías recortar (café, salidas, regalos).",
  },
  {
    pregunta: "¿Tengo que anotar las cuentas cada mes?",
    respuesta:
      "No, si las marcas como «Se repite todos los meses»: Luka las copia solas al mes siguiente, pendientes y con el monto del mes anterior. Las que no se repiten, sí.",
  },
  {
    pregunta: "Anoté mal un gasto, ¿cómo lo corrijo?",
    respuesta:
      "Los gastos no se editan: bórralo en «Movimientos del mes» y vuelve a anotarlo. Las cuentas pendientes sí se editan, con el lápiz.",
  },
  {
    pregunta: "¿Dónde quedan las fotos de las boletas?",
    respuesta:
      "En un almacenamiento privado, con una carpeta para cada hogar. Solo se ven desde Luka, con la sesión iniciada y siendo parte de ese hogar: no tienen un enlace público.",
  },
  {
    pregunta: "¿Puedo usar Luka con alguien de mi casa?",
    respuesta:
      "Sí. El dueño del hogar invita su correo de Google en «Hogar». Cuando esa persona entra a Luka con ese correo, ve y anota lo mismo que tú.",
  },
  {
    pregunta: "Me quieren invitar a un hogar, pero ya tengo el mío. ¿Qué hago?",
    respuesta:
      "Cada correo está en un solo hogar, así que no te pueden invitar mientras tengas el tuyo. Si nadie más ha entrado a tu hogar, bórralo en «Hogar» con «Borrar el hogar» (se borra todo lo que tiene). Después te invitan y entras con el mismo correo.",
  },
];
