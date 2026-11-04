import { entrarConGoogle } from "@/app/acciones/entrar";
import { Icono } from "@/componentes/Icono";
import { Luka } from "@/componentes/Luka";
import { LogoGoogle } from "./LogoGoogle";
import { Onda } from "./Onda";
import { TrazoCirculo } from "./TrazoCirculo";
import { Sticker } from "./Stickers";

/**
 * El cierre: la banda durazno (clara en los dos temas) con los stickers en
 * los margenes, el titular y la ultima invitacion a entrar.
 *
 * Luka, quieto y mirando a la izquierda como en el logo, va arriba a la
 * derecha de «Una», con la lupa sobre la palabra: la revisa sin taparla. Sus
 * medidas van en em, asi crece y se achica con el titular. El aire que necesita
 * lo pone el margen de arriba del titular.
 *
 * El boton es el mismo «Entrar con Google» del heroe.
 *
 * Los stickers y el titular se mueven con el parallax a distinta velocidad
 * (Paralaje.tsx); Luka va dentro del titular, asi que nunca se separa de
 * «Una». Abajo, la onda por la que sube el pie.
 */
export function Cierre() {
  return (
    <section
      aria-labelledby="portada-cierre"
      className="con-onda relative isolate overflow-hidden bg-durazno text-durazno-texto"
    >
      {/* Pocos stickers en celular, todos en pantallas anchas, siempre en los margenes:
          ninguno toca un texto entre 390 y 1440 px (medido, no a ojo). */}
      <Sticker
        nombre="calendario"
        paralaje={0.3}
        giro={-12}
        className="absolute top-[9%] left-[4%] size-12 @3xl:size-16"
      />
      <Sticker
        nombre="moneda"
        paralaje={0.45}
        giro={10}
        className="absolute top-[8%] right-[5%] size-11 @3xl:size-14"
      />
      <Sticker
        nombre="boleta"
        paralaje={0.15}
        giro={-8}
        className="absolute top-[46%] left-[8%] hidden size-16 @3xl:block"
      />
      <Sticker
        nombre="casa"
        paralaje={0.35}
        giro={6}
        className="absolute top-[10%] left-[15%] hidden size-14 @6xl:block"
      />
      <Sticker
        nombre="gota"
        paralaje={0.25}
        giro={-6}
        className="absolute top-[44%] right-[9%] hidden size-14 @3xl:block"
      />
      <Sticker
        nombre="auto"
        paralaje={0.5}
        giro={-10}
        className="absolute top-[12%] right-[15%] hidden size-16 @6xl:block"
      />
      <Sticker
        nombre="ampolleta"
        paralaje={0.2}
        giro={12}
        className="absolute bottom-[12%] left-[13%] hidden size-14 @6xl:block"
      />
      <Sticker
        nombre="tarjeta"
        paralaje={0.4}
        giro={8}
        className="absolute right-[14%] bottom-[14%] hidden size-14 @6xl:block"
      />
      <Sticker
        nombre="carro"
        paralaje={0.12}
        giro={-4}
        className="absolute bottom-[7%] left-[4%] hidden size-14 @3xl:block"
      />
      <Sticker
        nombre="huellas"
        paralaje={0.3}
        giro={-20}
        className="absolute right-[5%] bottom-[7%] size-12 @3xl:size-14"
      />

      <div
        data-paralaje="0.1"
        data-paralaje-min="-40"
        data-paralaje-max="40"
        className="relative mx-auto flex max-w-2xl flex-col items-center px-5 pt-16 pb-24 text-center @3xl:pt-20 @3xl:pb-28"
      >
        <h2
          id="portada-cierre"
          className="mt-16 text-[clamp(1.8rem,4.6cqi,2.7rem)] leading-[1.12] font-black tracking-[-0.02em] text-balance @3xl:mt-20"
        >
          <span className="relative inline-block">
            Una
            <Luka
              pose="lupa"
              className="pointer-events-none absolute bottom-[calc(100%+0.02em)] left-[0.43em] w-[2.7em] max-w-none @3xl:w-[3.5em]"
            />
          </span>{" "}
          libreta que suma sola, para tener tu mes{" "}
          <span className="palabra-circulada">
            claro
            <TrazoCirculo />
          </span>
          .
        </h2>
        <form action={entrarConGoogle} className="mt-8">
          <button
            type="submit"
            className="boton-luka boton-luka-grande cursor-pointer"
          >
            <span className="grid size-9 place-items-center rounded-[9px] bg-white">
              <LogoGoogle className="size-5" />
            </span>
            Entrar con Google
          </button>
        </form>
        <p className="mt-5 flex flex-col items-center justify-center gap-x-2.5 gap-y-1 text-sm text-durazno-tenue @md:flex-row @md:flex-wrap">
          <span>Con tu cuenta de Google</span>
          <span aria-hidden="true" className="hidden @md:inline">
            ·
          </span>
          <span>Cada hogar ve solo lo suyo</span>
          <span aria-hidden="true" className="hidden @md:inline">
            ·
          </span>
          <span className="inline-flex items-center gap-1.5 font-bold text-durazno-texto">
            <Icono nombre="lock" tamano={16} />
            Sesión que se cierra sola
          </span>
        </p>
      </div>

      {/* La onda del pie: la banda azul sube por la curva, como en la portada de antes. */}
      <Onda color="pie" curva={6} />
    </section>
  );
}
