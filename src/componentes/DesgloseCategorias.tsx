import type { ResumenMensual } from "@/dominio/resumen";
import type { DetalleCategoria } from "@/dominio/detalle-categoria";
import { Icono } from "./Icono";
import { fechaCorta, formatearCLP, porcentajeLegible } from "./formato";

type Props = {
  resumen: ResumenMensual;
  /** Detalle por id de categoria. Sin esto, las filas no muestran tarjeta. */
  detalles?: Record<string, DetalleCategoria>;
};

/** "+12%" / "−8%" / "—" cuando no hay con que comparar. */
function variacionLegible(variacion: number | null): string {
  if (variacion === null) return "—";
  const signo = variacion > 0 ? "+" : variacion < 0 ? "−" : "";
  return `${signo}${Math.abs(variacion) < 10 ? Math.abs(variacion).toFixed(1) : Math.round(Math.abs(variacion))}%`;
}

/** Cuantas categorias se ven siempre; el resto va en "Otras N categorias". */
export const CATEGORIAS_VISIBLES = 5;

type Linea = ResumenMensual["porCategoria"][number];

/**
 * Una categoria en una sola linea: nombre, barra, monto y porcentaje. Las
 * columnas tienen ancho fijo para que barras y montos queden alineados entre
 * filas. En celular la barra baja a una segunda linea, delgada, para que el
 * nombre no quede cortado.
 *
 * Al pasar el mouse (o al llegar con el teclado) despliega el detalle de la
 * categoria: cuantos gastos, promedio, los mas caros y como viene contra el
 * mes pasado. Se muestra con CSS, no con JavaScript: el componente sigue
 * siendo de servidor. Se usa `invisible` ademas de `opacity-0` a proposito,
 * porque algo solo transparente igual lo lee un lector de pantalla.
 */
function FilaCategoria({ linea, mayor, detalle }: { linea: Linea; mayor: number; detalle?: DetalleCategoria }) {
  // La barra se mide contra la categoria mas grande, no contra el total: en
  // una barra corta, un 4% del total seria un punto. El porcentaje real va
  // en texto al lado.
  const ancho = mayor > 0 ? (linea.total / mayor) * 100 : 0;
  return (
    <li
      className="fila-viva group relative -mx-2 rounded-md px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foco"
      tabIndex={detalle === undefined ? undefined : 0}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_6rem_2.25rem] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_4.5rem_6rem_2.25rem]">
        <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
          <span className="shrink-0" style={{ color: linea.categoria.color }}>
            <Icono nombre={linea.categoria.icono} tamano={16} />
          </span>
          <span className="truncate">{linea.categoria.nombre}</span>
        </span>

        {/* La barra es decorativa: la cifra y el porcentaje ya estan en
            texto, asi que no depende solo del color. */}
        <span
          aria-hidden="true"
          className="col-span-3 row-start-2 h-1 overflow-hidden rounded-full riel sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:h-1.5"
        >
          <span
            className="block h-full rounded-full"
            style={{ width: `${Math.max(ancho, 3)}%`, backgroundColor: linea.categoria.color }}
          />
        </span>

        <span className="cifra col-start-2 row-start-1 text-right font-medium tabular-nums sm:col-start-3">
          {formatearCLP(linea.total)}
        </span>
        <span className="col-start-3 row-start-1 text-right text-xs text-texto-tenue tabular-nums sm:col-start-4">
          {porcentajeLegible(linea.porcentaje)}
        </span>
      </div>

          {detalle !== undefined && (
            <div
              className="invisible absolute top-full left-0 z-20 mt-1.5 w-[min(20rem,calc(100vw-3rem))] rounded-md border border-borde bg-superficie p-3 opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              role="tooltip"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: linea.categoria.color }}
                />
                <p className="min-w-0 truncate text-xs font-semibold">
                  {linea.categoria.nombre}
                </p>
              </div>

              <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-texto-tenue">Gastos</dt>
                  <dd className="cifra tabular-nums">{detalle.cantidad}</dd>
                </div>

                <div className="flex justify-between gap-2">
                  <dt className="text-texto-tenue">Promedio</dt>
                  <dd className="cifra tabular-nums">
                    {formatearCLP(Math.round(detalle.promedio))}
                  </dd>
                </div>

                <div className="flex justify-between gap-2">
                  <dt className="text-texto-tenue">Días</dt>
                  <dd className="cifra tabular-nums">{detalle.diasConGasto}</dd>
                </div>

                <div className="flex justify-between gap-2">
                  <dt className="text-texto-tenue">Mes pasado</dt>
                  <dd
                    className={`cifra tabular-nums ${
                      detalle.nueva
                        ? "text-texto-tenue"
                        : detalle.diferencia > 0
                          ? "text-peligro"
                          : detalle.diferencia < 0
                            ? "text-exito"
                            : ""
                    }`}
                  >
                    {detalle.nueva ? "nueva" : variacionLegible(detalle.variacion)}
                  </dd>
                </div>
              </dl>

              {!detalle.nueva && (
                <p className="mt-2 text-xs text-texto-tenue">
                  {detalle.diferencia === 0
                    ? "Igual que el mes pasado."
                    : `${detalle.diferencia > 0 ? "Son" : "Es"} ${formatearCLP(
                        Math.abs(detalle.diferencia),
                      )} ${detalle.diferencia > 0 ? "más" : "menos"} que el mes pasado.`}
                </p>
              )}

              {detalle.mayores.length > 0 && (
                <>
                  <p className="mt-2.5 text-xs font-medium">
                    {detalle.mayores.length === 1 ? "El gasto" : "Los más grandes"}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {detalle.mayores.map((gasto) => (
                      <li
                        key={gasto.id}
                        className="flex items-baseline justify-between gap-3 text-xs"
                      >
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="cifra shrink-0 text-texto-tenue">
                            {fechaCorta(gasto.fecha)}
                          </span>
                          <span className="truncate">{gasto.descripcion}</span>
                        </span>
                        <span className="cifra shrink-0 tabular-nums">
                          {formatearCLP(gasto.monto)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {detalle.cantidad > detalle.mayores.length && (
                    <p className="mt-1.5 text-xs text-texto-tenue">
                      y {detalle.cantidad - detalle.mayores.length}{" "}
                      {detalle.cantidad - detalle.mayores.length === 1 ? "más" : "más"}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
    </li>
  );
}

/**
 * Gasto del mes por categoria.
 *
 * Con muchas categorias la lista se hacia eterna: se ven las 5 mas grandes y
 * el resto queda en "Otras N categorias", con su total, que se despliega con
 * un <details> nativo (sin JavaScript). Si sobraria una sola categoria, se
 * muestran todas: agrupar una no ahorra nada.
 */
export function DesgloseCategorias({ resumen, detalles }: Props) {
  const { porCategoria } = resumen;
  const agrupar = porCategoria.length > CATEGORIAS_VISIBLES + 1;
  const visibles = agrupar ? porCategoria.slice(0, CATEGORIAS_VISIBLES) : porCategoria;
  const otras = agrupar ? porCategoria.slice(CATEGORIAS_VISIBLES) : [];
  const totalOtras = otras.reduce((suma, l) => suma + l.total, 0);
  const porcentajeOtras = otras.reduce((suma, l) => suma + l.porcentaje, 0);
  const mayor = porCategoria.reduce((max, l) => Math.max(max, l.total), 0);

  return (
    <section
      aria-labelledby="titulo-categorias"
      className="tarjeta-viva rounded-xl border border-borde bg-superficie p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="titulo-categorias" className="text-base font-bold">
          Por categoría
        </h3>
        {porCategoria.length > 0 && (
          <span className="text-xs text-texto-tenue">
            {porCategoria.length} {porCategoria.length === 1 ? "categoría" : "categorías"}
          </span>
        )}
      </div>

      {porCategoria.length === 0 ? (
        <p className="py-8 text-center text-sm text-texto-tenue">
          Sin gastos este mes.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-0.5">
            {visibles.map((linea) => (
              <FilaCategoria key={linea.categoria.id} linea={linea} mayor={mayor} detalle={detalles?.[linea.categoria.id]} />
            ))}
          </ul>

          {otras.length > 0 && (
            <details className="group/otras mt-0.5">
              {/* Las mismas columnas que las filas, para que el total quede
                  alineado con los montos de arriba. */}
              <summary className="fila-viva -mx-2 grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_6rem_2.25rem] items-center gap-x-3 rounded-md px-2 py-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_4.5rem_6rem_2.25rem] [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-2 sm:col-span-2">
                  <span
                    aria-hidden="true"
                    className="hidden size-4 shrink-0 items-center justify-center rounded-full border border-texto-tenue text-[11px] leading-none text-texto-tenue sm:flex"
                  >
                    +
                  </span>
                  <span className="truncate text-texto-tenue">Otras {otras.length} categorías</span>
                  <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold enlace-luka">
                    <span className="hidden sm:inline sm:group-open/otras:hidden">ver</span>
                    <span className="hidden sm:group-open/otras:inline">ocultar</span>
                    <span className="transition-transform duration-150 group-open/otras:rotate-180">
                      <Icono nombre="chevron-down" tamano={13} />
                    </span>
                  </span>
                </span>
                <span className="cifra col-start-2 text-right font-medium tabular-nums sm:col-start-3">
                  {formatearCLP(totalOtras)}
                </span>
                <span className="col-start-3 text-right text-xs text-texto-tenue tabular-nums sm:col-start-4">
                  {porcentajeLegible(porcentajeOtras)}
                </span>
              </summary>

              <ul className="mt-0.5 space-y-0.5 border-l-2 border-borde pl-2">
                {otras.map((linea) => (
                  <FilaCategoria key={linea.categoria.id} linea={linea} mayor={mayor} detalle={detalles?.[linea.categoria.id]} />
                ))}
              </ul>
            </details>
          )}

        </>
      )}
    </section>
  );
}
