import Link from "next/link";
import { Luka } from "@/componentes/Luka";
import { Onda } from "./Onda";
import { Paisaje } from "./Paisaje";

/**
 * El header de la portada: la primera pantalla de Luka para quien todavia no
 * entra.
 *
 * Decisiones que conviene conocer:
 *
 * - La banda va en --durazno, que es clara en los DOS temas. Por eso su texto
 *   usa --durazno-texto y --durazno-tenue, que tampoco cambian con el tema:
 *   si siguieran al tema, de noche quedaria texto claro sobre fondo claro.
 * - El boton va en --acento con el texto en --acento-tinta. El acento es el
 *   color de marca nuevo; antes esto usaba el ocre de --alerta, o sea el
 *   mismo color con que Luka avisa que te pasaste del presupuesto.
 * - La palabra destacada va en --durazno-realce y no en el acento: el acento
 *   es un relleno claro y como letra sobre la banda no se lee.
 * - El paisaje ocupa SOLO la franja del perro y no toda la seccion: su linea
 *   de suelo cae justo donde pisan las patas, y debajo queda el titular
 *   sobre la banda limpia. Puesto detras de todo, el suelo cruzaba el boton.
 * - La seccion termina en una onda rellena con --fondo, el color de lo que
 *   viene abajo. El aire que esa curva necesita lo pone `.con-onda`: esta
 *   seccion no escribe su propio padding de abajo.
 *
 * Luka ya trae su animacion de olfateo desde globals.css (.luka-olfato,
 * .luka-oreja, .luka-cola, .luka-ojo). Aqui solo se le suma el avance del
 * paseo, y solo al grande del header.
 */
export function Header() {
  return (
    <header className="con-onda relative isolate overflow-clip bg-durazno pt-0 text-durazno-texto">
      {/* La barra de la portada no es el navbar de la app: quien llega aqui
          todavia no tiene sesion, asi que solo lleva la marca y la entrada. */}
      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <p
          className="text-xl leading-none font-extrabold tracking-tight sm:text-2xl"
          style={{ fontFamily: "var(--font-marca)" }}
        >
          Luka
        </p>
        <Link
          href="/ingresar"
          className="inline-flex h-11 cursor-pointer items-center rounded-full bg-acento px-5 text-sm font-semibold text-acento-tinta transition-colors hover:bg-acento-fuerte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--durazno-realce)"
        >
          Iniciar sesión
        </Link>
      </div>

      {/* La franja del paseo. El alto de esta caja define donde queda el
          horizonte: el paisaje se ancla a su borde de abajo y Luka se para
          sobre ese mismo borde. */}
      <div className="relative mt-2 h-[clamp(11rem,26vw,20rem)]">
        <Paisaje className="h-full" />
        <Luka
          pose="rastreando"
          descripcion={null}
          className="luka-pasea absolute bottom-[1.5%] left-1/2 h-[clamp(9rem,21vw,16.5rem)] w-auto -translate-x-1/2"
        />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl justify-items-center px-4 pt-7 pb-2 text-center sm:px-6">
        <h1
          className="max-w-[15ch] text-[clamp(2.25rem,6.2vw,4.5rem)] leading-[0.95] font-extrabold tracking-[-0.035em] text-balance"
          style={{ fontFamily: "var(--font-marca)" }}
        >
          Sigue el rastro de{" "}
          <span className="text-durazno-realce">tu plata</span>
        </h1>

        <Link
          href="/ingresar"
          className="mt-8 inline-flex h-12 cursor-pointer items-center rounded-full bg-acento px-7 text-base font-semibold text-acento-tinta transition-colors hover:bg-acento-fuerte focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--durazno-realce)"
        >
          Iniciar sesión
        </Link>

        <p className="mt-4 text-sm text-durazno-tenue">
          Con tu cuenta de Google. Todo se queda en tu computador.
        </p>
      </div>

      <Onda color="fondo" curva={2} />
    </header>
  );
}
