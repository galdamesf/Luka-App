import type { Metadata } from "next";
import Link from "next/link";
import { Icono } from "@/componentes/Icono";
import { hogarActual } from "@/lib/hogar-actual";
import { COLOR_SECCION, SECCIONES_PANEL } from "@/componentes/secciones-panel";
import { TextoGuia } from "@/componentes/guia/TextoGuia";
import { ImagenDeGuia } from "@/componentes/guia/ImagenDeGuia";
import { GUIA, PREGUNTAS, PRIMEROS_PASOS, type BloqueGuia, type SeccionGuia } from "@/componentes/guia/contenido";

export const metadata: Metadata = {
  title: "¿Cómo usar? · Luka",
  description: "Para qué sirve cada sección de Luka, qué hacer y cómo hacerlo.",
};

/** Lo que va arriba del titulo de cada seccion de la guia. */
function etiquetaDe(seccion: SeccionGuia): string {
  if (seccion.seccionPanel !== undefined) {
    const { numero, etiqueta } = SECCIONES_PANEL[seccion.seccionPanel];
    return `Sección ${numero} · ${etiqueta}`;
  }
  return seccion.ubicacion ?? "Antes de empezar";
}

function fichaDe(seccion: SeccionGuia): string {
  if (seccion.seccionPanel === undefined) return COLOR_SECCION.accion.ficha;
  return COLOR_SECCION[SECCIONES_PANEL[seccion.seccionPanel].color].ficha;
}

function Bloque({ bloque }: { bloque: BloqueGuia }) {
  return (
    <article className="space-y-4">
      <h3 className="text-lg font-bold tracking-tight">{bloque.titulo}</h3>

      {bloque.texto.map((parrafo) => (
        <p key={parrafo} className="max-w-[70ch] text-[15px] leading-relaxed text-texto-tenue">
          <TextoGuia texto={parrafo} />
        </p>
      ))}

      {bloque.terminos !== undefined && (
        <dl className="max-w-[70ch] divide-y divide-borde rounded-xl border border-borde bg-superficie">
          {bloque.terminos.map((t) => (
            <div key={t.termino} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
              <dt className="text-sm font-semibold">
                <TextoGuia texto={t.termino} />
              </dt>
              <dd className="text-sm leading-relaxed text-texto-tenue">
                <TextoGuia texto={t.definicion} />
              </dd>
            </div>
          ))}
        </dl>
      )}

      {bloque.pasos !== undefined && (
        <div className="max-w-[70ch] rounded-xl border border-borde bg-superficie p-4">
          <p className="cifra text-xs uppercase tracking-[0.08em] text-texto-tenue">Cómo hacerlo</p>
          <ol className="mt-3 space-y-2.5">
            {bloque.pasos.map((paso, i) => (
              <li key={paso} className="flex gap-3 text-sm leading-relaxed">
                <span
                  aria-hidden="true"
                  className="cifra mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accion/15 text-xs font-bold text-accion-tinta"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 text-texto-tenue">
                  <TextoGuia texto={paso} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {bloque.imagen !== undefined && <ImagenDeGuia imagen={bloque.imagen} />}

      {bloque.consejo !== undefined && (
        <p className="flex max-w-[70ch] gap-2.5 rounded-xl border border-alerta/40 bg-alerta/10 p-3.5 text-sm leading-relaxed">
          <span className="mt-0.5 shrink-0 text-alerta">
            <Icono nombre="lightbulb" tamano={16} />
          </span>
          <span>
            <span className="font-semibold">Consejo: </span>
            <TextoGuia texto={bloque.consejo} />
          </span>
        </p>
      )}
    </article>
  );
}

function Seccion({ seccion }: { seccion: SeccionGuia }) {
  const idTitulo = `guia-${seccion.id}`;
  return (
    <section id={seccion.id} aria-labelledby={idTitulo} className="scroll-mt-28 space-y-8">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${fichaDe(seccion)}`}>
            <Icono nombre={seccion.icono} tamano={22} />
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="cifra text-xs uppercase tracking-[0.08em] text-texto-tenue">{etiquetaDe(seccion)}</p>
            <h2 id={idTitulo} className="text-xl font-bold tracking-tight sm:text-2xl">
              {seccion.titulo}
            </h2>
          </div>
        </div>

        <div className="max-w-[70ch] rounded-xl border border-accion/30 bg-accion/10 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-accion-tinta">Para qué sirve</p>
          <p className="mt-1.5 text-[15px] leading-relaxed">
            <TextoGuia texto={seccion.paraQueSirve} />
          </p>
        </div>
      </div>

      {seccion.bloques.map((bloque) => (
        <Bloque key={bloque.titulo} bloque={bloque} />
      ))}

      <Link
        href={seccion.enlace}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-borde px-3.5 text-sm font-semibold text-texto transition-colors duration-150 hover:border-acento hover:bg-superficie"
      >
        {seccion.textoEnlace ?? "Ir a esta sección del panel"}
        <Icono nombre="arrow-right" tamano={15} />
      </Link>
    </section>
  );
}

/**
 * La guia de uso: para que sirve cada seccion, que hacer y como hacerlo, con
 * capturas del panel (con datos de ejemplo). El contenido vive en
 * componentes/guia/contenido.ts; aca solo se le da forma.
 */
export default async function ComoUsar() {
  // Cada visita revisa contra la base que la persona siga en el hogar con
  // que entro. Si no, la sesion se cierra aqui mismo.
  await hogarActual();
  const indice = [
    ...GUIA.map((s) => ({ id: s.id, titulo: s.titulo })),
    { id: "preguntas", titulo: "Preguntas frecuentes" },
  ];

  return (
    <main
      className="mx-auto w-full max-w-6xl pt-6 pb-10 sm:pt-10"
      style={{
        paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <header className="max-w-3xl space-y-3">
        <p className="cifra text-xs uppercase tracking-[0.08em] text-texto-tenue">Guía de uso</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">¿Cómo usar Luka?</h1>
        <p className="text-base leading-relaxed text-texto-tenue">
          Luka te ayuda a saber, en todo momento, cuánto de tu sueldo ya se fue, cuánto falta pagar y cuánto te
          queda para gastar o ahorrar. Aquí está cada parte del panel: para qué sirve, qué hacer y cómo hacerlo.
          Las imágenes son del panel con datos de ejemplo, no con los tuyos.
        </p>
      </header>

      {/* Lo minimo para arrancar, en orden. */}
      <section
        aria-labelledby="titulo-primeros-pasos"
        className="mt-8 rounded-2xl border border-borde bg-superficie p-5 shadow-sm sm:p-6"
      >
        <h2 id="titulo-primeros-pasos" className="text-lg font-bold tracking-tight">
          Para empezar, en este orden
        </h2>
        <p className="mt-1 text-sm text-texto-tenue">
          Se hace una sola vez. Después basta con anotar tus gastos y marcar lo que pagas.
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRIMEROS_PASOS.map((paso, i) => (
            <li key={paso.titulo} className="flex gap-3 rounded-xl border border-borde bg-superficie-tenue p-4">
              <span
                aria-hidden="true"
                className="cifra inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-acento text-sm font-bold text-acento-tinta"
              >
                {i + 1}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-bold">{paso.titulo}</p>
                <p className="text-[13px] leading-relaxed text-texto-tenue">
                  <TextoGuia texto={paso.texto} />
                </p>
                <a href={paso.destino} className="inline-block text-[13px] font-semibold enlace-luka">
                  Ver cómo
                </a>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* En celular el indice va arriba y se desliza de lado; en pantallas
          anchas, a la izquierda y fijo mientras se baja. */}
      <nav aria-label="Contenido de la guía" className="mt-8 -mx-4 overflow-x-auto px-4 pb-1 lg:hidden">
        <ul className="flex w-max gap-2">
          {indice.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-10 items-center whitespace-nowrap rounded-full border border-borde bg-superficie px-3.5 text-[13px] font-semibold text-texto-tenue hover:text-texto"
              >
                {s.titulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Contenido de la guía" className="hidden lg:block">
          <div className="sticky top-28 space-y-1">
            <p className="cifra mb-2 text-xs uppercase tracking-[0.08em] text-texto-tenue">En esta guía</p>
            {indice.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-md px-2.5 py-1.5 text-sm text-texto-tenue transition-colors duration-150 hover:bg-superficie hover:text-texto"
              >
                {s.titulo}
              </a>
            ))}
          </div>
        </nav>

        <div className="min-w-0 space-y-16">
          {GUIA.map((seccion) => (
            <Seccion key={seccion.id} seccion={seccion} />
          ))}

          <section id="preguntas" aria-labelledby="guia-preguntas" className="scroll-mt-28 space-y-4">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${COLOR_SECCION.accion.ficha}`}>
                <Icono nombre="circle-help" tamano={22} />
              </span>
              <h2 id="guia-preguntas" className="self-center text-xl font-bold tracking-tight sm:text-2xl">
                Preguntas frecuentes
              </h2>
            </div>
            {/* Cada pregunta en su tarjeta, como las del resto de la app. La
                abierta se nota: borde de color y fondo tenido de acento. */}
            <div className="max-w-[70ch] space-y-3">
              {PREGUNTAS.map((p) => (
                <details
                  key={p.pregunta}
                  className="tarjeta-pregunta group rounded-2xl border border-borde bg-superficie px-5 py-4 shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    {/* En un span: suelto, cada pedazo del texto seria un hijo
                        del flex y quedarian separados. */}
                    <span className="min-w-0">
                      <TextoGuia texto={p.pregunta} />
                    </span>
                    <span className="mt-0.5 shrink-0 text-texto-tenue transition-transform duration-150 group-open:rotate-180 group-open:text-texto">
                      <Icono nombre="chevron-down" tamano={15} />
                    </span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-texto-tenue">
                    <TextoGuia texto={p.respuesta} />
                  </p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
