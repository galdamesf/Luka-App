import { Onda } from "./Onda";

/**
 * «Lo que siempre preguntan»: el acordeon sobre la banda durazno.
 *
 * Cada pregunta es un <details> nativo: abre y cierra sin una linea de
 * JavaScript, el teclado y los lectores de pantalla lo entienden solos, y si
 * el dia de manana hay que animarlo, se anima encima. El signo de la derecha
 * gira de + a × con el estado del propio details.
 */

const PREGUNTAS = [
  {
    p: "¿Dónde quedan mis datos?",
    r: "En tu computador, en una base de datos local. No hay nube ni servidor con tus gastos.",
  },
  {
    p: "¿Tengo que crear otra contraseña?",
    r: "No. Entras con tu cuenta de Google, y solo los correos autorizados pueden entrar.",
  },
  {
    p: "¿Qué pasa si pago una cuenta?",
    r: "La marcas como pagada y Luka crea el gasto solo, en su categoría, y lo descuenta de lo que te queda.",
  },
  {
    p: "¿Y las cuotas de mis deudas?",
    r: "Se calculan aparte, desde la deuda: cada mes sabe qué cuota toca, sin que la anotes.",
  },
  {
    p: "¿Puedo saber de dónde salió un monto?",
    r: "Sí. Las dos líneas de gasto del balance se abren y muestran cada gasto, con su boleta al lado.",
  },
  {
    p: "¿Cuántas categorías hay?",
    r: "Diecisiete, cada una con su color y su ícono. A cualquiera le puedes poner techo.",
  },
];

export function Preguntas() {
  return (
    <section
      aria-labelledby="preguntas-tit"
      className="con-onda relative bg-durazno pt-[clamp(36px,5.5vw,72px)] text-durazno-texto"
    >
      <div className="mx-auto w-full max-w-[1080px] px-[clamp(20px,4vw,56px)] pb-8">
        <p className="text-xs font-extrabold tracking-[0.14em] text-durazno-realce uppercase">
          Preguntas
        </p>
        <h2
          id="preguntas-tit"
          className="font-marca mt-2 text-[clamp(1.7rem,3.4vw,2.4rem)] leading-none font-extrabold tracking-[-0.03em]"
        >
          Lo que siempre preguntan
        </h2>

        <div className="mt-6 border-t border-durazno-texto/15">
          {PREGUNTAS.map(({ p, r }) => (
            <details key={p} className="pregunta group border-b border-durazno-texto/15">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--durazno-realce) sm:text-base">
                {p}
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-[1.5px] border-durazno-texto/30 text-base leading-none transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[62ch] pb-5 text-[15px] leading-relaxed text-durazno-tenue">
                {r}
              </p>
            </details>
          ))}
        </div>
      </div>
      <Onda color="pie" curva={6} />
    </section>
  );
}
