import { HORAS_MAXIMAS, MINUTOS_SIN_USO } from "@/lib/sesion";
import { RESPONSABLE } from "@/dominio/legal";
import { ANCLA_PREGUNTAS } from "./enlaces";
import { CabeceraDeSeccion } from "./CabeceraDeSeccion";
import { Onda } from "./Onda";
import { TrazoCirculo } from "./TrazoCirculo";

/**
 * Las preguntas, en tarjetas como las de mas arriba (esquinas redondeadas y
 * el canto de color abajo). La que esta abierta se nota: borde de color y un
 * fondo tenido de acento. Cada respuesta esta revisada contra la app
 * (auth.ts, lib/autorizados.ts, dominio/hogar.ts, lib/sesion.ts,
 * acciones/cuentas.ts, acciones/finanzas.ts y lib/periodo.ts).
 *
 * Cada pregunta es un <details> nativo: abre y cierra sin JavaScript, y el
 * teclado y los lectores de pantalla lo entienden solos. Comparten `name`,
 * asi que al abrir una se cierra la que estaba abierta. La primera parte
 * abierta. El + gira a × con el estado del propio details.
 *
 * La seccion termina en una onda por la que sube la banda durazno del
 * cierre. Por eso va dentro de un bloque a todo el ancho (la seccion misma es
 * angosta) y su aire de abajo es mas corto: el resto lo pone `.con-onda`.
 */
export const PREGUNTAS = [
  {
    p: "¿Dónde quedan mis datos?",
    r: "En una base de datos privada, con cada hogar por separado: tus gastos y boletas solo los ven las personas de tu hogar. No se venden ni se comparten.",
  },
  {
    p: "¿Tengo que crear otra contraseña?",
    r: "No. Entras con tu cuenta de Google. La primera vez, Luka te arma tu propio hogar, vacío y solo para ti.",
  },
  {
    p: "¿Puedo llevar las cuentas con alguien de mi casa?",
    r: "Sí. En «Hogar» invitas su correo de Google y anotan juntos en el mismo mes. Cada gasto dice quién lo anotó, y cada hogar ve solo lo suyo.",
  },
  {
    p: "¿La sesión queda abierta?",
    // Los plazos salen de lib/sesion.ts: si cambian alla, cambian aca.
    r: `No. Se cierra sola tras ${MINUTOS_SIN_USO} minutos sin uso, a las ${HORAS_MAXIMAS} horas como máximo y cada vez que Luka se actualiza.`,
  },
  {
    p: "¿Qué pasa cuando pago una cuenta?",
    r: "La marcas como pagada y Luka crea el gasto solo, en su categoría, y lo descuenta de lo que te queda.",
  },
  {
    p: "¿Y las cuotas de mis deudas?",
    r: "Salen de la deuda: cada mes sabe qué cuota toca, y al pagarla se anota sola como gasto.",
  },
  {
    p: "¿Puedo cambiar el día en que empieza mi mes?",
    r: "Sí, cualquier día del 1 al 31. El mes se arma desde ahí y lleva el nombre que le corresponde.",
  },
] as const;

export function Preguntas() {
  return (
    <div className="con-onda relative">
      <section
        id={ANCLA_PREGUNTAS}
        aria-labelledby="portada-preguntas"
        className="mx-auto max-w-3xl scroll-mt-24 px-5 pb-12 @3xl:pb-16"
      >
        {/* La misma cabecera de los paneles: el titular con su palabra en
            durazno, subrayada a mano, y a quien escribir si la duda no esta. */}
        <CabeceraDeSeccion
          id="portada-preguntas"
          debajo={
            <p className="mx-auto max-w-[46ch] leading-relaxed text-texto-tenue">
              Respuestas cortas sobre cómo funciona Luka. ¿Te quedó otra duda? Escríbenos a{" "}
              <a href={`mailto:${RESPONSABLE.correo}`} className="font-semibold [overflow-wrap:anywhere] enlace-luka">
                {RESPONSABLE.correo}
              </a>
              .
            </p>
          }
        >
          Lo que más nos{" "}
          <span className="palabra-subrayada text-anotacion">
            preguntan
            <TrazoCirculo forma="subrayado" />
          </span>
        </CabeceraDeSeccion>
        <div data-paralaje="0.08" data-paralaje-min="-50" data-paralaje-max="50" className="mt-8 flex flex-col gap-5">
          {PREGUNTAS.map(({ p, r }, i) => (
            <details
              key={p}
              name="preguntas-portada"
              open={i === 0}
              className="pregunta tarjeta-pregunta group overflow-hidden rounded-3xl border border-borde bg-superficie shadow-[0_3px_0_var(--acento-canto)]"
            >
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-left text-[1.05rem] font-bold text-titulo @3xl:px-8">
                {p}
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full text-2xl leading-none font-normal transition-[transform,background-color] duration-200 group-open:rotate-45 group-open:bg-acento group-open:text-acento-tinta"
                >
                  +
                </span>
              </summary>
              <p className="px-6 pb-6 leading-relaxed text-texto-tenue @3xl:px-8">{r}</p>
            </details>
          ))}
        </div>
      </section>
      <Onda color="durazno" curva={3} />
    </div>
  );
}
