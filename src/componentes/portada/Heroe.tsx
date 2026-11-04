import { entrarConGoogle } from "@/app/acciones/entrar";
import { Icono } from "@/componentes/Icono";
import { LogoGoogle } from "./LogoGoogle";
import { ANCLA_QUE_HACEMOS } from "./enlaces";

/**
 * El heroe: el titular corto con «tu dinero» en una etiqueta durazno (con el
 * mismo canto de los botones), la bajada que
 * dice las tres cosas que Luka hace distinto y las dos salidas.
 *
 * «Entrar con Google» entra de una (el mismo ingreso de /ingresar), por eso
 * es un formulario y no un enlace. Abajo, lo que tranquiliza: sin contrasena
 * nueva, cada hogar ve solo lo suyo y la sesion se cierra sola.
 */
export function Heroe() {
  return (
    <section
      aria-labelledby="portada-titular"
      className="mx-auto max-w-4xl px-5 pt-10 pb-12 text-center @3xl:pt-20 @3xl:pb-16"
    >
      <h1
        id="portada-titular"
        data-paralaje="0.35"
        data-paralaje-min="-140"
        className="text-[clamp(2.5rem,7.4cqi,4.5rem)] leading-[1.04] font-black tracking-[-0.03em] text-balance text-texto"
      >
        Sigue el rastro de <span className="etiqueta-luka">tu dinero</span>.
      </h1>
      <p data-paralaje="0.22" data-paralaje-min="-100" className="mx-auto mt-6 max-w-3xl text-[clamp(1.1rem,2.5cqi,1.6rem)] leading-snug font-semibold text-balance text-texto-tenue">
        Un mes que parte el día que te pagan, cada gasto con su boleta y un
        presupuesto por categoría que te avisa antes de pasarte.
      </p>

      <div data-paralaje="0.12" data-paralaje-min="-70" className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <form action={entrarConGoogle}>
          {/* El mismo boton que «Entrar» en el navbar, a la altura del heroe. */}
          <button type="submit" className="boton-luka boton-luka-grande cursor-pointer">
            <span className="grid size-9 place-items-center rounded-[9px] bg-white">
              <LogoGoogle className="size-5" />
            </span>
            Entrar con Google
          </button>
        </form>
        <a
          href={`#${ANCLA_QUE_HACEMOS}`}
          className="inline-flex h-14 cursor-pointer items-center rounded-full border-2 border-borde px-7 text-[1.05rem] font-bold text-texto transition-colors duration-200 hover:border-titulo"
        >
          ¿Qué hacemos?
        </a>
      </div>

      <p data-paralaje="0.06" data-paralaje-min="-50" className="mt-6 flex flex-col items-center justify-center gap-x-2.5 gap-y-1 text-sm text-texto-suave @md:flex-row @md:flex-wrap">
        <span>Sin contraseña nueva</span>
        <span aria-hidden="true" className="hidden @md:inline">
          ·
        </span>
        <span>Solo tu hogar ve tus datos</span>
        <span aria-hidden="true" className="hidden @md:inline">
          ·
        </span>
        <span className="inline-flex items-center gap-1.5 font-bold text-texto-tenue">
          <Icono nombre="lock" tamano={16} />
          <span className="marcado">La sesión se cierra sola</span>
        </span>
      </p>
    </section>
  );
}
