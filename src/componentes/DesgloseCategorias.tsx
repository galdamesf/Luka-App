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

/**
 * Gasto del mes por categoria, en lista con barra.
 *
 * Al pasar el mouse (o al llegar con el teclado) cada fila despliega el
 * detalle de esa categoria: cuantos gastos, promedio, los mas caros y como
 * viene contra el mes pasado.
 *
 * La tarjeta se muestra con CSS, no con JavaScript: el componente sigue
 * siendo de servidor y no manda nada de mas al navegador. Se usa `invisible`
 * ademas de `opacity-0` a proposito, porque algo solo transparente igual lo
 * lee un lector de pantalla, y ahi la informacion se repetiria siempre.
 *
 * La fila lleva tabIndex para que el detalle tambien salga con el teclado y
 * al tocarla en el telefono, donde no existe el hover.
 */
export function DesgloseCategorias({ resumen, detalles }: Props) {
  const { porCategoria } = resumen;

  return (
    <section
      aria-labelledby="titulo-categorias"
      className="tarjeta-viva rounded-xl border border-borde bg-superficie p-5 shadow-sm"
    >
      <h3 id="titulo-categorias" className="text-base font-bold">
        Por categoría
      </h3>

      {porCategoria.length === 0 ? (
        <p className="py-8 text-center text-sm text-texto-tenue">
          Sin gastos este mes.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {porCategoria.map((linea) => {
            const detalle = detalles?.[linea.categoria.id];

            return (
              <li
                key={linea.categoria.id}
                className="fila-viva group relative -mx-2 rounded-md px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foco"
                tabIndex={detalle === undefined ? undefined : 0}
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0" style={{ color: linea.categoria.color }}>
                      <Icono nombre={linea.categoria.icono} />
                    </span>
                    <span className="truncate">{linea.categoria.nombre}</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap">
                    <span className="cifra font-medium">{formatearCLP(linea.total)}</span>
                    <span className="ml-2 text-xs text-texto-tenue">
                      {porcentajeLegible(linea.porcentaje)}
                    </span>
                  </span>
                </div>

                {/* La barra es decorativa: la cifra y el porcentaje ya estan
                    arriba en texto, asi que no depende solo del color. */}
                <div
                  className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-superficie-tenue"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(linea.porcentaje, 1.5)}%`,
                      backgroundColor: linea.categoria.color,
                    }}
                  />
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
          })}
        </ul>
      )}
    </section>
  );
}
