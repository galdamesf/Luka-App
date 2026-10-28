import type { ErroresPorCampo } from "./esquemas";

/**
 * Estado que devuelven las Server Actions, pensado para useActionState.
 *
 * Vive aca y no junto a las acciones porque un archivo marcado "use server"
 * solo puede exportar funciones async: exportar una constante o un tipo desde
 * ahi rompe el build de Next. Ademas, el componente del formulario es de
 * cliente, y asi no arrastra el modulo de servidor al bundle.
 *
 * `errores` viene por campo para poder mostrarlos al lado del input, que es
 * donde la gente los lee, y no en un bloque arriba del formulario.
 */
export type EstadoFormulario = {
  ok: boolean;
  mensaje: string | null;
  errores: ErroresPorCampo;
};

export const ESTADO_INICIAL: EstadoFormulario = {
  ok: false,
  mensaje: null,
  errores: {},
};

/** Firma de una accion usada con useActionState. */
export type AccionFormulario = (
  estado: EstadoFormulario,
  datos: FormData,
) => Promise<EstadoFormulario>;
