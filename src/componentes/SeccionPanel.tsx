import { COLOR_SECCION, SECCIONES_PANEL, type ClaveSeccion } from "./secciones-panel";
import { Icono } from "./Icono";

type Props = {
  seccion: ClaveSeccion;
  /** Lo que va a la derecha del titulo: filtros, selectores. */
  acciones?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Una seccion numerada del dashboard: numero y nombre corto, titulo y una
 * linea que dice para que sirve. Todas iguales a proposito: el orden se lee
 * en la forma antes que en el texto.
 *
 * scroll-mt deja la seccion debajo del navbar, que es sticky, cuando se
 * llega por un enlace con #.
 */
export function SeccionPanel({ seccion, acciones, children }: Props) {
  const { id, numero, etiqueta, titulo, bajada, color, icono } = SECCIONES_PANEL[seccion];
  const estilo = COLOR_SECCION[color];
  const idTitulo = `titulo-seccion-${id}`;
  return (
    // La clase viva-* deja el color de la seccion en --viva: las tarjetas de
    // adentro se encienden de ese color al pasar el mouse.
    <section id={id} aria-labelledby={idTitulo} className={`scroll-mt-28 ${estilo.viva}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${estilo.ficha}`}>
            <Icono nombre={icono} tamano={22} />
          </span>
          <div className="space-y-0.5">
            <p className="cifra text-xs uppercase tracking-[0.08em] text-texto-tenue">
              {numero} · {etiqueta}
            </p>
            <h2 id={idTitulo} className="text-lg font-bold tracking-tight sm:text-xl">
              {titulo}
            </h2>
            <p className="text-sm text-texto-tenue">{bajada}</p>
          </div>
        </div>
        {acciones}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
