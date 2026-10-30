/**
 * Las seis secciones del dashboard, en orden. El indice de arriba y los
 * encabezados de cada seccion salen de aca, asi no se desordenan entre si.
 */
export const SECCIONES_PANEL = {
  resumen: {
    id: "resumen",
    numero: "01",
    etiqueta: "Resumen",
    color: "accion",
    icono: "trending-up",
    titulo: "Resumen del mes",
    bajada: "Lo que entró, lo que salió y lo que te queda antes de cerrar el mes.",
  },
  registro: {
    id: "registro",
    numero: "02",
    etiqueta: "Registro y pagos",
    color: "acento",
    icono: "receipt",
    titulo: "Lo que tienes que hacer hoy",
    bajada: "Anota un gasto con su boleta o marca una cuenta como pagada: el resto del panel se actualiza solo.",
  },
  salud: {
    id: "salud",
    numero: "03",
    etiqueta: "Salud financiera",
    color: "exito",
    icono: "heart-pulse",
    titulo: "Cómo está tu mes, en un número",
    bajada: "El Health Score junta cinco señales del mes. Al lado, tus deudas en cuotas.",
  },
  semanas: {
    id: "semanas",
    numero: "04",
    etiqueta: "Ritmo semanal",
    color: "avance",
    icono: "activity",
    titulo: "Tus gastos, semana a semana",
    bajada: "Bloques de siete días desde el 1. Elige uno para ver su detalle.",
  },
  presupuestos: {
    id: "presupuestos",
    numero: "05",
    etiqueta: "Presupuestos",
    color: "alerta",
    icono: "wallet",
    titulo: "Presupuesto por categoría",
    bajada: "Cuánto llevas contra el máximo que te pusiste. Abre una categoría para ver sus gastos.",
  },
  movimientos: {
    id: "movimientos",
    numero: "06",
    etiqueta: "Movimientos",
    color: "accion",
    icono: "table",
    titulo: "Movimientos del mes",
    bajada: "Cada gasto con su boleta. Busca o filtra por categoría.",
  },
} as const;

export type ClaveSeccion = keyof typeof SECCIONES_PANEL;
export type ColorSeccion = (typeof SECCIONES_PANEL)[ClaveSeccion]["color"];

/**
 * El color de cada seccion: la ficha del encabezado, el punto del indice y el
 * brillo de las tarjetas al pasar el mouse. Clases enteras, porque Tailwind
 * solo genera las que ve escritas completas.
 */
export const COLOR_SECCION: Record<ColorSeccion, { ficha: string; punto: string; viva: string }> = {
  accion: { ficha: "bg-accion/15 text-accion-tinta", punto: "bg-accion", viva: "viva-accion" },
  acento: { ficha: "bg-acento text-acento-tinta", punto: "bg-acento", viva: "viva-acento" },
  exito: { ficha: "bg-exito/15 text-exito", punto: "bg-exito-fuerte", viva: "viva-exito" },
  avance: { ficha: "bg-avance/15 text-avance", punto: "bg-avance", viva: "viva-avance" },
  alerta: { ficha: "bg-alerta/15 text-alerta", punto: "bg-alerta", viva: "viva-alerta" },
};
export const ORDEN_SECCIONES = Object.values(SECCIONES_PANEL);
