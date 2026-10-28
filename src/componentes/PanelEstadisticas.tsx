import { SERIES_FLUJO } from "@/dominio/categorias-base";
import type { EstadisticasHistoricas } from "@/dominio/estadisticas";
import { Icono } from "./Icono";
import { formatearCLP, nombreDelMes, nombreDelMesCorto } from "./formato";

type Props = { estadisticas: EstadisticasHistoricas };

/** "+12%" / "-8%". `null` cuando no se pudo calcular. */
function porcentajeFirmado(valor: number | null): string {
  if (valor === null) return "—";
  const signo = valor > 0 ? "+" : valor < 0 ? "−" : "";
  return `${signo}${Math.abs(valor).toFixed(valor !== 0 && Math.abs(valor) < 10 ? 1 : 0)}%`;
}

/** Traduce el R2 a algo que signifique algo leyendolo. */
function confianza(ajuste: number): string {
  if (ajuste >= 0.7) return "patrón claro";
  if (ajuste >= 0.35) return "patrón parcial";
  return "muy irregular";
}

/** Traduce la correlacion a una frase, que es lo unico que sirve aqui. */
function leerCorrelacion(r: number): string {
  const f = Math.abs(r);
  if (f < 0.3) return "gastas parecido gane lo que gane";
  if (r > 0) return f > 0.7 ? "gastas más cuando ganas más" : "tiendes a gastar más cuando ganas más";
  return f > 0.7 ? "gastas menos cuando ganas más" : "tiendes a gastar menos cuando ganas más";
}

function Dato({
  etiqueta,
  valor,
  detalle,
  tono,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  tono?: "exito" | "peligro";
}) {
  const color = tono === "exito" ? "text-exito" : tono === "peligro" ? "text-peligro" : "";

  return (
    <div className="rounded-md border border-borde bg-superficie-tenue p-3">
      <dt className="text-xs text-texto-tenue">{etiqueta}</dt>
      <dd className={`cifra mt-1 text-base leading-tight font-semibold tabular-nums ${color}`}>
        {valor}
      </dd>
      {detalle !== undefined && (
        <dd className="mt-0.5 text-xs text-texto-tenue">{detalle}</dd>
      )}
    </div>
  );
}

/**
 * El detalle estadistico del periodo.
 *
 * Cada cifra que aparece aqui esta tambien en la tabla del final, que es lo
 * que hace que el grafico no sea la unica via a los datos.
 *
 * Donde una formula no se puede calcular (un mes solo, un mes sin ingreso) se
 * muestra una raya, no un 0 ni un NaN: no es lo mismo "cero" que "no se sabe".
 */
export function PanelEstadisticas({ estadisticas: e }: Props) {
  const { meses, gastos, ingresos, ahorro, tendenciaGastos, correlacion } = e;
  const unMes = meses.length === 1;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Dato
          etiqueta="Ingresos del período"
          valor={formatearCLP(ingresos.total)}
          detalle={`${formatearCLP(Math.round(ingresos.promedio))} por mes`}
        />
        <Dato
          etiqueta="Gastos del período"
          valor={formatearCLP(gastos.total)}
          detalle={`${formatearCLP(Math.round(gastos.promedio))} por mes`}
        />
        <Dato
          etiqueta={ahorro.total < 0 ? "Déficit acumulado" : "Ahorro acumulado"}
          valor={formatearCLP(Math.abs(ahorro.total))}
          detalle={
            ahorro.tasaPromedio === null
              ? "sin ingresos cargados"
              : `${(ahorro.tasaPromedio * 100).toFixed(0)}% de lo que entra`
          }
          tono={ahorro.total < 0 ? "peligro" : "exito"}
        />
        <Dato
          etiqueta="Meses en déficit"
          valor={`${ahorro.mesesEnDeficit} de ${meses.length}`}
          detalle={
            ahorro.peorMes !== null && ahorro.peorMes.valor < 0
              ? `peor: ${nombreDelMesCorto(ahorro.peorMes.mes)}`
              : "ningún mes en rojo"
          }
          tono={ahorro.mesesEnDeficit > 0 ? "peligro" : "exito"}
        />
      </dl>

      <div className="grid gap-2 sm:grid-cols-2">
        {/* Tendencia */}
        <section className="rounded-md border border-borde p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold">
            <Icono
              nombre={
                tendenciaGastos === null || tendenciaGastos.pendiente === 0
                  ? "activity"
                  : tendenciaGastos.pendiente > 0
                    ? "trending-up"
                    : "trending-down"
              }
              tamano={14}
            />
            Tendencia de los gastos
          </h3>

          {tendenciaGastos === null ? (
            <p className="mt-2 text-sm text-texto-tenue">
              Con un mes no se puede ver tendencia. Vuelve el próximo.
            </p>
          ) : (
            <p className="mt-2 text-sm">
              {tendenciaGastos.pendiente > 0 ? "Vas subiendo " : "Vas bajando "}
              <strong className="cifra font-semibold tabular-nums">
                {formatearCLP(Math.round(Math.abs(tendenciaGastos.pendiente)))}
              </strong>{" "}
              por mes
              <span className="text-texto-tenue">
                {" "}
                ({confianza(tendenciaGastos.ajuste)}, R²{" "}
                {tendenciaGastos.ajuste.toFixed(2)})
              </span>
              .
            </p>
          )}
        </section>

        {/* Relacion entre las dos series */}
        <section className="rounded-md border border-borde p-3">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold">
            <Icono nombre="activity" tamano={14} />
            Gastos frente a ingresos
          </h3>

          {correlacion === null ? (
            <p className="mt-2 text-sm text-texto-tenue">
              {unMes
                ? "Hace falta más de un mes para comparar."
                : "Tu sueldo no ha cambiado en el período, así que no hay nada que correlacionar."}
            </p>
          ) : (
            <p className="mt-2 text-sm">
              {leerCorrelacion(correlacion)}
              <span className="text-texto-tenue"> (r {correlacion.toFixed(2)})</span>.
            </p>
          )}
        </section>
      </div>

      {/* Detalle por serie */}
      <div className="grid gap-2 sm:grid-cols-2">
        {([
          [SERIES_FLUJO.gastos, gastos],
          [SERIES_FLUJO.ingresos, ingresos],
        ] as const).map(([serie, resumen]) => (
          <section key={serie.nombre} className="rounded-md border border-borde p-3">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold">
              <span
                aria-hidden="true"
                className="h-0.5 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: serie.color }}
              />
              {serie.nombre}
            </h3>

            <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs min-[420px]:grid-cols-2">
              <div className="flex justify-between gap-2">
                <dt className="text-texto-tenue">Promedio</dt>
                <dd className="cifra tabular-nums">
                  {formatearCLP(Math.round(resumen.promedio))}
                </dd>
              </div>

              <div className="flex justify-between gap-2">
                <dt className="text-texto-tenue">Mediana</dt>
                <dd className="cifra tabular-nums">
                  {formatearCLP(Math.round(resumen.mediana))}
                </dd>
              </div>

              <div className="flex justify-between gap-2">
                <dt className="text-texto-tenue">Mes más alto</dt>
                <dd className="cifra tabular-nums">
                  {formatearCLP(resumen.maximo.valor)}
                </dd>
              </div>

              <div className="flex justify-between gap-2">
                <dt className="text-texto-tenue">Mes más bajo</dt>
                <dd className="cifra tabular-nums">
                  {formatearCLP(resumen.minimo.valor)}
                </dd>
              </div>

              <div className="flex justify-between gap-2">
                <dt className="text-texto-tenue">Variación último mes</dt>
                <dd className="cifra tabular-nums">
                  {porcentajeFirmado(resumen.variacionPorcentaje)}
                </dd>
              </div>

              <div className="flex justify-between gap-2">
                <dt className="text-texto-tenue">Cuánto varía</dt>
                <dd className="cifra tabular-nums">
                  {resumen.desviacion === null
                    ? "—"
                    : `± ${formatearCLP(Math.round(resumen.desviacion))}`}
                </dd>
              </div>
            </dl>

            <p className="mt-2 text-xs text-texto-tenue">
              Más alto en {nombreDelMes(resumen.maximo.mes)}, más bajo en{" "}
              {nombreDelMes(resumen.minimo.mes)}.
            </p>
          </section>
        ))}
      </div>

      {/* La tabla: el mismo dato del grafico, sin depender de mirar colores. */}
      <details className="rounded-md border border-borde">
        <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-xs font-semibold">
          <Icono nombre="table" tamano={14} />
          Ver los números mes por mes
        </summary>

        <div className="overflow-x-auto border-t border-borde">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Ingresos, gastos y diferencia de cada mes del período
            </caption>
            <thead>
              <tr className="border-b border-borde text-xs text-texto-tenue">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  Mes
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Ingresos
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Gastos
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Diferencia
                </th>
              </tr>
            </thead>
            <tbody>
              {meses.map((p) => {
                const diferencia = p.ingresos - p.gastos;

                return (
                  <tr key={p.mes} className="border-b border-borde last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      {nombreDelMes(p.mes)}
                    </th>
                    <td className="cifra px-3 py-2 text-right tabular-nums">
                      {formatearCLP(p.ingresos)}
                    </td>
                    <td className="cifra px-3 py-2 text-right tabular-nums">
                      {formatearCLP(p.gastos)}
                    </td>
                    <td
                      className={`cifra px-3 py-2 text-right font-medium tabular-nums ${
                        diferencia < 0 ? "text-peligro" : "text-exito"
                      }`}
                    >
                      {diferencia < 0 ? "−" : ""}
                      {formatearCLP(Math.abs(diferencia))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
