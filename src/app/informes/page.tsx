import { listarGastosDelMes } from "@/datos/gastos";
import { sueldoDelMes } from "@/datos/sueldos";
import { listarDeudas } from "@/datos/deudas";
import { listarCuentasDelMes } from "@/datos/cuentas";
import { serieHistorica } from "@/datos/historico";
import { armarInforme } from "@/dominio/informe";
import { calcularBalance } from "@/dominio/balance";
import { resumirCuentas } from "@/dominio/cuentas";
import { analizarHistorico } from "@/dominio/estadisticas";
import { esquemaMes } from "@/dominio/esquemas";
import { diasEnMesISO, hoyISO, mesActual, sumarMeses } from "@/lib/fecha";
import { SelectorMes } from "@/componentes/SelectorMes";
import { BotonImprimir } from "@/componentes/BotonImprimir";
import { SecuenciaBalance } from "@/componentes/SecuenciaBalance";
import { TarjetasResumen } from "@/componentes/TarjetasResumen";
import { TablaGastos } from "@/componentes/TablaGastos";
import { GraficoAreas } from "@/componentes/GraficoAreas";
import { PanelEstadisticas } from "@/componentes/PanelEstadisticas";
import {
  GraficoSemanas,
  MayoresGastos,
  TablaCategoriasDetalle,
  TablaMedios,
  TarjetaComparacion,
} from "@/componentes/PiezasInforme";
import { formatearCLP, nombreDelMes } from "@/componentes/formato";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ mes?: string }> };

export default async function Informes({ searchParams }: Props) {
  const parametros = await searchParams;
  const elegido = esquemaMes.safeParse(parametros.mes);
  const mes = elegido.success ? elegido.data : mesActual();
  const anterior = sumarMeses(mes, -1);

  const [gastos, gastosAnterior, sueldo, deudas, cuentas, serie] = await Promise.all([
    listarGastosDelMes(mes),
    listarGastosDelMes(anterior),
    sueldoDelMes(mes),
    listarDeudas(),
    listarCuentasDelMes(mes),
    // Doce meses hasta el elegido: suficiente para ver estacionalidad sin
    // que el eje se llene de etiquetas.
    serieHistorica(mes, 12),
  ]);

  const informe = armarInforme(gastos, gastosAnterior, mes);
  const balance = calcularBalance({ mes, sueldo, resumen: informe.resumen, deudas });
  const resumenCuentas = resumirCuentas(cuentas, mes, diasEnMesISO(mes), hoyISO());
  const estadisticas = analizarHistorico(serie);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Informe de <span className="capitalize">{nombreDelMes(mes)}</span>
          </h1>
          <p className="mt-1 text-sm text-texto-tenue">
            {informe.resumen.cantidad}{" "}
            {informe.resumen.cantidad === 1 ? "gasto registrado" : "gastos registrados"}
            {informe.resumen.cantidad > 0 && (
              <>
                {" "}· {formatearCLP(informe.resumen.total)} en total
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="no-imprimir">
            <SelectorMes mes={mes} />
          </div>
          <BotonImprimir />
        </div>
      </header>

      <main className="mt-6 space-y-4">
        <TarjetasResumen resumen={informe.resumen} />

        {/* Gastos contra ingresos: el grafico y su detalle estadistico. */}
        {estadisticas !== null && (
          <section
            aria-labelledby="t-flujo"
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="t-flujo" className="text-sm font-semibold">
                Gastos frente a ingresos
              </h2>
              <p className="text-xs text-texto-tenue">
                {serie.length} {serie.length === 1 ? "mes" : "meses"} hasta{" "}
                <span className="capitalize">{nombreDelMes(mes)}</span>
              </p>
            </div>

            <div className="mt-3">
              <GraficoAreas serie={serie} />
            </div>

            <div className="mt-5">
              <PanelEstadisticas estadisticas={estadisticas} />
            </div>
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <SecuenciaBalance balance={balance} gastos={gastos} />
          </div>
          <div className="lg:col-span-2">
            <MayoresGastos gastos={informe.mayores} />
          </div>
        </div>

        <TarjetaComparacion comparacion={informe.comparacion} />

        <TablaCategoriasDetalle resumen={informe.resumen} />

        <div className="grid gap-4 lg:grid-cols-2">
          <TablaMedios medios={informe.medios} />
          <GraficoSemanas semanas={informe.semanas} />
        </div>

        {/* Cuentas del mes: cuanto quedo pendiente al cerrar. */}
        {(resumenCuentas.pendientes.length > 0 || resumenCuentas.pagadas.length > 0) && (
          <section
            aria-labelledby="t-cuentas-informe"
            className="rounded-lg border border-borde bg-superficie p-4"
          >
            <h2 id="t-cuentas-informe" className="text-sm font-semibold">
              Cuentas del mes
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-texto-tenue">Pagadas</dt>
                <dd className="cifra mt-1 text-lg font-semibold tabular-nums">
                  {formatearCLP(resumenCuentas.totalPagado)}
                </dd>
                <dd className="text-xs text-texto-tenue">
                  {resumenCuentas.pagadas.length}{" "}
                  {resumenCuentas.pagadas.length === 1 ? "cuenta" : "cuentas"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-texto-tenue">Pendientes</dt>
                <dd
                  className={`cifra mt-1 text-lg font-semibold tabular-nums ${
                    resumenCuentas.totalPendiente > 0 ? "text-alerta" : ""
                  }`}
                >
                  {formatearCLP(resumenCuentas.totalPendiente)}
                </dd>
                <dd className="text-xs text-texto-tenue">
                  {resumenCuentas.pendientes.length}{" "}
                  {resumenCuentas.pendientes.length === 1 ? "cuenta" : "cuentas"}
                </dd>
              </div>
              {resumenCuentas.vencidas.length > 0 && (
                <div>
                  <dt className="text-xs text-texto-tenue">Vencidas sin pagar</dt>
                  <dd className="cifra mt-1 text-lg font-semibold tabular-nums text-peligro">
                    {resumenCuentas.vencidas.length}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <TablaGastos gastos={gastos} />
      </main>
    </div>
  );
}
