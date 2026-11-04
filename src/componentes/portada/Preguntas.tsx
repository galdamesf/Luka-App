import { HORAS_MAXIMAS, MINUTOS_SIN_USO } from "@/lib/sesion";
import { ANCLA_PREGUNTAS } from "./enlaces";
import { Onda } from "./Onda";

/**
 * Las preguntas, en cajas. Cada respuesta esta revisada contra la app
 * (auth.ts, lib/sesion.ts, acciones/cuentas.ts, acciones/finanzas.ts y
 * lib/periodo.ts).
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
    r: "En tu computador, en una base de datos local. No hay una nube con tus gastos.",
  },
  {
    p: "¿Tengo que crear otra contraseña?",
    r: "No. Entras con tu cuenta de Google, y solo pueden entrar los correos autorizados.",
  },
  {
    p: "¿La sesión queda abierta?",
    // Los plazos salen de lib/sesion.ts: si cambian alla, cambian aca.
    r: `No. Se cierra sola tras ${MINUTOS_SIN_USO} minutos sin uso, a las ${HORAS_MAXIMAS} horas como máximo y cada vez que reinicias Luka.`,
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
        <h2
          id="portada-preguntas"
          data-paralaje="0.2"
          data-paralaje-min="-60"
          data-paralaje-max="60"
          className="text-center text-[clamp(1.9rem,4.4cqi,2.4rem)] font-black tracking-[-0.02em] text-texto"
        >
          Preguntas
        </h2>
        <div data-paralaje="0.08" data-paralaje-min="-50" data-paralaje-max="50" className="mt-8 flex flex-col gap-4">
          {PREGUNTAS.map(({ p, r }, i) => (
            <details
              key={p}
              name="preguntas-portada"
              open={i === 0}
              className="pregunta group overflow-hidden rounded-[6px] border border-borde bg-superficie"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-[1.05rem] font-bold text-titulo">
                {p}
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center text-2xl leading-none font-normal transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="px-5 pb-5 leading-relaxed text-texto-tenue">{r}</p>
            </details>
          ))}
        </div>
      </section>
      <Onda color="durazno" curva={3} />
    </div>
  );
}
