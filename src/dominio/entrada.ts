/**
 * Que pasa cuando alguien entra con Google: logica pura, sin base de datos.
 *
 * Los datos de la plata son de un hogar. Al entrar, cada persona cae en uno:
 *
 *  1. Si su correo ya es miembro de un hogar (o tiene una invitacion
 *     pendiente), entra a ese hogar.
 *  2. Si «Mi hogar» (el hogar inicial, el de los datos de antes de los
 *     hogares) todavia existe y no tiene dueno, y su correo es el primero de
 *     CORREOS_AUTORIZADOS, entra como su dueno. Pasa una sola vez: despues, a
 *     «Mi hogar» se entra solo con invitacion, igual que a cualquier hogar.
 *     Asi, a quien sacaron del hogar no vuelve a entrar solo por estar en el
 *     .env. Y si su dueno lo borro, la lista no lo revive.
 *  3. Si la puerta esta abierta, se le crea un hogar nuevo, vacio, con las
 *     categorias de partida, y queda como su dueno.
 *  4. Si no, no entra.
 */

/** El rol en un hogar. Es el mismo enum que RolMiembro en schema.prisma. */
export type Rol = "DUENO" | "MIEMBRO";

export type ReglasDeEntrada = {
  /** Los correos de CORREOS_AUTORIZADOS, normalizados, en su orden. Solo cuenta el primero. */
  listaDeAntes: readonly string[];
  /** Si cualquiera con Google puede entrar y tener su propio hogar. */
  puertaAbierta: boolean;
};

export type DecisionDeEntrada =
  | { tipo: "miembro" }
  | { tipo: "dueno-del-hogar-inicial" }
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
  hogarInicialLibre,
  listaDeAntes,
  puertaAbierta,
}: ReglasDeEntrada & {
  /** Ya normalizado (normalizarCorreo). */
  correo: string | null;
  /** Si el correo ya esta en la tabla de miembros, haya entrado o no. */
  yaEsMiembro: boolean;
  /** Si «Mi hogar» existe y todavia no tiene dueno. Si no, la lista ya no abre nada. */
  hogarInicialLibre: boolean;
}): DecisionDeEntrada {
  if (correo === null) return { tipo: "rechazada" };
  if (yaEsMiembro) return { tipo: "miembro" };
  if (hogarInicialLibre && listaDeAntes[0] === correo) return { tipo: "dueno-del-hogar-inicial" };
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
