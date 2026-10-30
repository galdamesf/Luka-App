import { COLOR_SECCION, ORDEN_SECCIONES } from "./secciones-panel";

/**
 * El indice de las seis secciones, debajo del encabezado. Son enlaces con #,
 * no botones: funcionan sin JavaScript y el navegador ya sabe hacer scroll.
 * En celular se desliza de lado en vez de partirse en varias lineas.
 */
export function IndiceSecciones() {
  return (
    <nav aria-label="Secciones del panel" className="no-imprimir -mx-4 overflow-x-auto px-4 pb-1">
      <ol className="flex gap-2 whitespace-nowrap">
        {ORDEN_SECCIONES.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className={`tarjeta-viva ${COLOR_SECCION[s.color].viva} inline-flex min-h-11 items-center gap-2 rounded-full border border-borde bg-superficie px-4 text-sm font-semibold text-texto`}
            >
              <span aria-hidden="true" className={`size-2.5 rounded-full ${COLOR_SECCION[s.color].punto}`} />
              <span className="cifra text-xs text-texto-tenue">{s.numero}</span>
              {s.etiqueta}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
