/**
 * Que pasa cuando alguien entra con Google: logica pura, sin base de datos.
 *
 * Los datos de la plata son de un hogar. Al entrar, cada persona cae en uno:
 *
 *  1. Si su correo ya es miembro de un hogar (o tiene una invitacion
 *     pendiente), entra a ese hogar.
 *  2. Si su correo esta en la lista de antes de los hogares
 *     (CORREOS_AUTORIZADOS), entra al hogar inicial, el de los datos que ya
 *     existian. El primer correo de la lista es su dueno; los demas, miembros.
 *  3. Si la puerta esta abierta, se le crea un hogar nuevo, vacio, con las
 *     categorias de partida, y queda como su dueno.
 *  4. Si no, no entra.
 */

/** El rol en un hogar. Es el mismo enum que RolMiembro en schema.prisma. */
export type Rol = "DUENO" | "MIEMBRO";

export type ReglasDeEntrada = {
  /** Los correos de antes de los hogares, ya normalizados, en su orden. */
  listaDeAntes: readonly string[];
  /** Si cualquiera con Google puede entrar y tener su propio hogar. */
  puertaAbierta: boolean;
};

export type DecisionDeEntrada =
  | { tipo: "miembro" }
  | { tipo: "hogar-inicial"; rol: Rol }
  | { tipo: "hogar-nuevo" }
  | { tipo: "rechazada" };

/** Lo que se guarda: un correo con forma de correo. Sin eso, nada que buscar. */
const FORMA_DE_CORREO = /^[^\s@]+@[^\s@]+$/;

/**
 * El correo como lo guarda la base: sin espacios y en minusculas (la base lo
 * exige con un CHECK). null si no hay correo o no tiene forma de correo.
 */
export function normalizarCorreo(correo: string | null | undefined): string | null {
  const limpio = (correo ?? "").trim().toLowerCase();
  if (limpio.length === 0 || limpio.length > 254) return null;
  return FORMA_DE_CORREO.test(limpio) ? limpio : null;
}

/** El nombre que entrega Google, recortado a lo que cabe. null si viene vacio. */
export function limpiarNombre(nombre: string | null | undefined): string | null {
  const limpio = (nombre ?? "").trim().replace(/\s+/g, " ");
  return limpio.length === 0 ? null : limpio.slice(0, 120);
}

export function decidirEntrada({
  correo,
  yaEsMiembro,
  listaDeAntes,
  puertaAbierta,
}: ReglasDeEntrada & {
  /** Ya normalizado (normalizarCorreo). */
  correo: string | null;
  /** Si el correo ya esta en la tabla de miembros, haya entrado o no. */
  yaEsMiembro: boolean;
}): DecisionDeEntrada {
  if (correo === null) return { tipo: "rechazada" };
  if (yaEsMiembro) return { tipo: "miembro" };

  const posicion = listaDeAntes.indexOf(correo);
  if (posicion !== -1) {
    return { tipo: "hogar-inicial", rol: posicion === 0 ? "DUENO" : "MIEMBRO" };
  }

  return puertaAbierta ? { tipo: "hogar-nuevo" } : { tipo: "rechazada" };
}

/**
 * El nombre de un hogar recien creado: «Hogar de Ana», con el primer nombre
 * de la persona. Sin nombre, «Mi hogar». El dueno lo puede cambiar despues.
 */
export function nombreDeHogarNuevo(nombrePersona: string | null): string {
  const primero = (nombrePersona ?? "").trim().split(/\s+/)[0] ?? "";
  if (primero === "") return "Mi hogar";
  return `Hogar de ${primero}`.slice(0, 60);
}
