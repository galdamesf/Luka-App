import type { NivelSemana } from "@/dominio/semanas";

/**
 * El color de cada semana sale de su ritmo discrecional contra el del mes
 * (nivelDeSemana): verde si fue tranquila, azul si fue normal, ambar si se
 * paso y rojo si se paso harto. La parte llena de la barra es lo
 * discrecional; la suave, lo esencial. Clases enteras: Tailwind solo genera
 * las que ve escritas completas.
 */
export const NIVEL: Record<
  NivelSemana | "sin",
  { nombre: string; lleno: string; suave: string; texto: string; pildora: string; viva: string }
> = {
  bajo: {
    nombre: "Bajo",
    lleno: "bg-exito-fuerte",
    suave: "bg-exito-fuerte/35",
    texto: "text-exito",
    pildora: "border-exito/40 bg-exito/10 text-exito",
    viva: "viva-exito",
  },
  normal: {
    nombre: "Normal",
    lleno: "bg-avance",
    suave: "bg-avance/35",
    texto: "text-avance",
    pildora: "border-avance/40 bg-avance/10 text-avance",
    viva: "viva-avance",
  },
  alto: {
    nombre: "Alto",
    lleno: "bg-alerta",
    suave: "bg-alerta/35",
    texto: "text-alerta",
    pildora: "border-alerta/40 bg-alerta/10 text-alerta",
    viva: "viva-alerta",
  },
  "muy-alto": {
    nombre: "Muy alto",
    lleno: "bg-peligro",
    suave: "bg-peligro/35",
    texto: "text-peligro",
    pildora: "border-peligro/40 bg-peligro/10 text-peligro",
    viva: "viva-peligro",
  },
  sin: {
    nombre: "Sin dato",
    lleno: "bg-texto-tenue/60",
    suave: "bg-texto-tenue/25",
    texto: "text-texto-tenue",
    pildora: "border-borde bg-superficie-tenue text-texto-tenue",
    viva: "viva-accion",
  },
};

export const NIVELES_LEYENDA: NivelSemana[] = ["bajo", "normal", "alto", "muy-alto"];
