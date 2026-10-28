import type { Comparacion, LineaMedioPago, LineaSemana } from "@/dominio/informe";
import type { GastoPlano, ResumenMensual } from "@/dominio/resumen";
import { ETIQUETA_MEDIO_PAGO } from "@/dominio/esquemas";
import { Icono } from "./Icono";
import { fechaCorta, formatearCLP, nombreDelMes, porcentajeLegible } from "./formato";

const TARJETA = "rounded-lg border border-borde bg-superficie p-4";
const TITULO = "text-sm font-semibold";

/** Variacion con signo y color. Null cuando no hay con que comparar. */
function Variacion({ valor, invertirColor }: { valor: number | null; invertirColor?: boolean }) {
  if (valor === null) {
    return <span className="text-xs text-texto-tenue">sin comparación</span>;
  }
  const subio = valor > 0;
  // En gastos, subir es malo: por eso rojo cuando sube y verde cuando baja.
  const malo = invertirColor === true ? !subio : subio;
  const color = Math.abs(valor) < 0.5 ? "text-texto-tenue" : malo ? "text-peligro" : "text-exito";

  return (
    <span className={`cifra text-xs font-medium tabular-nums ${color}`}>
      {subio ? "+" : ""}
      {valor.toFixed(0)}%
    </span>
  );
}

export function TarjetaComparacion({ comparacion }: { comparacion: Comparacion }) {
  const { totalActual, totalAnterior, diferencia, variacion, lineas, hayAnterior, mesAnterior } =
    comparacion;

  return (
    <section aria-labelledby="t-comparacion" className={TARJETA}>
      <h2 id="t-comparacion" className={TITULO}>
        Comparado con <span className="capitalize">{nombreDelMes(mesAnterior)}</span>
      </h2>

      {!hayAnterior ? (
        <p className="py-6 text-center text-sm text-texto-tenue">
          No hay gastos registrados en {nombreDelMes(mesAnterior)} para comparar.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-borde pb-3">
            <span className="cifra text-2xl font-semibold tabular-nums">
              {diferencia >= 0 ? "+" : "−"}
              {formatearCLP(Math.abs(diferencia))}
            </span>
            <Variacion valor={variacion} />
            <span className="text-xs text-texto-tenue">
              {formatearCLP(totalAnterior)} → {formatearCLP(totalActual)}
            </span>
          </div>

          <ul className="mt-3 space-y-2">
            {lineas.slice(0, 8).map((linea) => (
              <li
                key={linea.categoria.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Icono nombre={linea.categoria.icono} className="shrink-0" />
                  <span className="truncate">{linea.categoria.nombre}</span>
                  {linea.nueva && (
                    <span className="shrink-0 rounded bg-superficie-tenue px-1.5 py-0.5 text-xs text-texto-tenue">
                      nueva
                    </span>
                  )}
                  {linea.desaparecida && (
                    <span className="shrink-0 rounded bg-superficie-tenue px-1.5 py-0.5 text-xs text-texto-tenue">
                      no hubo
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-baseline gap-2 whitespace-nowrap">
                  <span className="cifra text-xs text-texto-tenue tabular-nums">
                    {formatearCLP(linea.anterior)} → {formatearCLP(linea.actual)}
                  </span>
                  <span
                    className={`cifra text-sm font-medium tabular-nums ${
                      linea.diferencia > 0
                        ? "text-peligro"
                        : linea.diferencia < 0
                          ? "text-exito"
                          : "text-texto-tenue"
                    }`}
                  >
                    {linea.diferencia >= 0 ? "+" : "−"}
                    {formatearCLP(Math.abs(linea.diferencia))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function TablaCategoriasDetalle({ resumen }: { resumen: ResumenMensual }) {
  return (
    <section aria-labelledby="t-categorias" className="rounded-lg border border-borde bg-superficie">
      <h2 id="t-categorias" className={`border-b border-borde p-4 ${TITULO}`}>
        Detalle por categoría
      </h2>

      {resumen.porCategoria.length === 0 ? (
        <p className="py-10 text-center text-sm text-texto-tenue">Sin gastos este mes.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
                <th scope="col" className="px-4 py-2 font-medium">Categoría</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Gastos</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Promedio</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Total</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {resumen.porCategoria.map((linea) => (
                <tr key={linea.categoria.id} className="border-b border-borde last:border-0">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: linea.categoria.color }}
                      />
                      <Icono nombre={linea.categoria.icono} tamano={14} />
                      {linea.categoria.nombre}
                      {linea.categoria.esencial && (
                        <span className="text-xs text-texto-tenue">esencial</span>
                      )}
                    </span>
                  </td>
                  <td className="cifra px-4 py-2 text-right tabular-nums text-texto-tenue">
                    {linea.cantidad}
                  </td>
                  <td className="cifra px-4 py-2 text-right tabular-nums text-texto-tenue">
                    {formatearCLP(Math.round(linea.total / linea.cantidad))}
                  </td>
                  <td className="cifra px-4 py-2 text-right font-medium tabular-nums">
                    {formatearCLP(linea.total)}
                  </td>
                  <td className="cifra px-4 py-2 text-right tabular-nums text-texto-tenue">
                    {porcentajeLegible(linea.porcentaje)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-borde font-medium">
                <td className="px-4 py-2">Total</td>
                <td className="cifra px-4 py-2 text-right tabular-nums">{resumen.cantidad}</td>
                <td className="px-4 py-2" />
                <td className="cifra px-4 py-2 text-right tabular-nums">
                  {formatearCLP(resumen.total)}
                </td>
                <td className="cifra px-4 py-2 text-right tabular-nums">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export function GraficoSemanas({ semanas }: { semanas: readonly LineaSemana[] }) {
  const mayor = Math.max(...semanas.map((s) => s.total), 1);

  return (
    <section aria-labelledby="t-semanas" className={TARJETA}>
      <h2 id="t-semanas" className={TITULO}>En qué parte del mes</h2>

      <ul className="mt-4 space-y-2.5">
        {semanas.map((semana) => (
          <li key={semana.semana}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-texto-tenue">
                días <span className="cifra">{semana.desde}</span> a{" "}
                <span className="cifra">{semana.hasta}</span>
              </span>
              <span className="cifra tabular-nums">
                {formatearCLP(semana.total)}
                {semana.cantidad > 0 && (
                  <span className="ml-2 text-texto-tenue">
                    {semana.cantidad} {semana.cantidad === 1 ? "gasto" : "gastos"}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-superficie-tenue" aria-hidden="true">
              <div
                className="h-full rounded-full bg-exito-fuerte"
                style={{ width: `${(semana.total / mayor) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TablaMedios({ medios }: { medios: readonly LineaMedioPago[] }) {
  return (
    <section aria-labelledby="t-medios" className={TARJETA}>
      <h2 id="t-medios" className={TITULO}>Con qué pagaste</h2>

      {medios.length === 0 ? (
        <p className="py-6 text-center text-sm text-texto-tenue">Sin gastos este mes.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {medios.map((linea) => (
            <li key={linea.medio}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{ETIQUETA_MEDIO_PAGO[linea.medio]}</span>
                <span className="whitespace-nowrap">
                  <span className="cifra font-medium tabular-nums">
                    {formatearCLP(linea.total)}
                  </span>
                  <span className="ml-2 text-xs text-texto-tenue">
                    {porcentajeLegible(linea.porcentaje)}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-superficie-tenue" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primario"
                  style={{ width: `${Math.max(linea.porcentaje, 1.5)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function MayoresGastos({ gastos }: { gastos: readonly GastoPlano[] }) {
  return (
    <section aria-labelledby="t-mayores" className={TARJETA}>
      <h2 id="t-mayores" className={TITULO}>Dónde se fue la plata</h2>

      {gastos.length === 0 ? (
        <p className="py-6 text-center text-sm text-texto-tenue">Sin gastos este mes.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {gastos.map((gasto, indice) => (
            <li key={gasto.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="cifra shrink-0 text-xs text-texto-tenue">{indice + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate">{gasto.descripcion}</span>
                  <span className="block text-xs text-texto-tenue">
                    {fechaCorta(gasto.fecha)} · {gasto.categoria.nombre}
                  </span>
                </span>
              </span>
              <span className="cifra shrink-0 whitespace-nowrap font-medium tabular-nums">
                {formatearCLP(gasto.monto)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
