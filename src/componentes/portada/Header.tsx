import Link from "next/link";
import { Onda } from "./Onda";
import { EscenaPaseo } from "./EscenaPaseo";

/**
 * El header de la portada: la primera pantalla de Luka para quien no entra aun.
 *
 * Decisiones que conviene conocer:
 *
 * - La banda va en --durazno, que es clara en los DOS temas. Por eso su texto
 *   usa --durazno-texto y --durazno-tenue, que tampoco cambian con el tema: si
 *   siguieran al tema, de noche quedaria texto claro sobre fondo claro.
 * - El titular descansa sobre el CIELO del paisaje, a la izquierda, donde el
 *   dibujo solo tiene bandas lisas. El macizo vive a la derecha. Esa reparticion
 *   esta hecha en el dibujo, no aqui: por eso el texto no necesita ninguna caja
 *   ni sombra para leerse.
 * - Los botones son los de la tienda Vitalia: canto de 4 px que se hunde a 2 px
 *   al apretar, mayusculas con letra espaciada. El principal va en el acento de
 *   marca; el segundo es SOLIDO en durazno y no un fantasma translucido, porque
 *   sobre el paisaje un fantasma desaparecia.
 * - En telefono el titular va arriba y la escena debajo (orden del flujo, no del
 *   DOM): a ese ancho el dibujo se recorta al centro y no queda cielo libre
 *   donde poner el texto.
 * - El ALTO MINIMO del header no es decoracion: el dibujo se ancla abajo, asi
 *   que un header mas bajo sube el horizonte y los cerros terminan debajo del
 *   parrafo, que deja de leerse. Con 60vw el horizonte queda bajo el texto y
 *   encima solo hay cielo. Medido, no a ojo.
 * - La seccion termina en una onda rellena con --fondo, el color de lo que viene
 *   abajo. El aire que esa curva necesita lo pone `.con-onda`.
 */
export function Header() {
  return (
    <header className="con-onda relative isolate flex flex-col overflow-clip bg-durazno text-durazno-texto sm:min-h-[clamp(560px,60vw,900px)]">
      <div className="relative z-10 order-1 mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* La barra de la portada no es el navbar de la app: quien llega aqui
            todavia no tiene sesion, asi que solo lleva la marca y la entrada. */}
        <div className="flex items-center justify-between gap-4 py-4">
          <p className="font-marca text-xl leading-none font-extrabold tracking-[-0.03em] sm:text-2xl">
            Luka
          </p>
          <Link href="/ingresar" className="btn-luka btn-luka-acento h-11 px-5 text-[0.8rem]">
            Iniciar sesión
          </Link>
        </div>

        <div className="max-w-[40rem] pt-2 pb-6 sm:pt-6 lg:pb-10">
          <p className="text-xs font-extrabold tracking-[0.14em] text-durazno-realce uppercase">
            Control de gastos del mes
          </p>
          <h1 className="font-marca mt-3 text-[clamp(2.5rem,6vw,4.7rem)] leading-[0.94] font-extrabold tracking-[-0.035em] text-balance">
            Sigue el rastro de{" "}
            <em className="font-acento font-normal tracking-[-0.01em] text-durazno-realce not-italic italic">
              tu plata.
            </em>
          </h1>
          <p className="mt-4 max-w-[44ch] text-base leading-relaxed text-durazno-tenue sm:text-lg">
            Anotas un gasto con su boleta y Luka hace el resto: lo manda a su
            categoría, avisa cuando te acercas al techo y te dice cuánto te
            queda del mes.
          </p>
          <p className="mt-3 text-sm text-durazno-tenue">
            Con tu cuenta de Google. Todo se queda en tu computador.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/ingresar" className="btn-luka btn-luka-acento">
              Iniciar sesión
            </Link>
            <a href="#como-funciona" className="btn-luka btn-luka-durazno">
              Cómo funciona
            </a>
          </div>
        </div>
      </div>

      {/* El alto de esta caja define donde queda el horizonte: el paisaje se
          ancla a sus bordes y Luka pisa sobre la senda del dibujo. */}
      <EscenaPaseo className="order-2 h-[112vw] w-full sm:absolute sm:inset-0 sm:order-none sm:h-full" />

      <Onda color="fondo" curva={2} />
    </header>
  );
}
