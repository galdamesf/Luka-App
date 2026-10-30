import { listarGastosDelMes } from "@/datos/gastos";
import { listarCategoriasActivas } from "@/datos/categorias";
import { sueldoDelMes } from "@/datos/sueldos";
import { listarDeudas } from "@/datos/deudas";
import { listarCuentasDelMes, regenerarMensuales } from "@/datos/cuentas";
import { esPagoDeCuota, resumirMes } from "@/dominio/resumen";
import { detallesPorCategoria } from "@/dominio/detalle-categoria";
import { armarPresupuestos } from "@/dominio/presupuestos";
import { listarPagosDelMes } from "@/datos/deudas";
import { listarPresupuestosDelMes } from "@/datos/presupuestos";
import { listarAhorrosHasta } from "@/datos/ahorros";
import { historialDeAhorro, totalAhorrado } from "@/dominio/ahorros";
import { calcularLoQueQueda } from "@/dominio/lo-que-queda";
import { calcularBalance } from "@/dominio/balance";
import { resumirCuentas } from "@/dominio/cuentas";
import { armarResumenPanel } from "@/dominio/panel";
import { calcularSalud, META_AHORRO, puntajeDeSalud } from "@/dominio/salud";
import { proyectarCierre, ritmoSemanal } from "@/dominio/semanas";
import { esquemaMes } from "@/dominio/esquemas";
import { diasEnMesISO, hoyISO, mesActual, sumarMeses } from "@/lib/fecha";
import { accionCrearGasto, accionEliminarGasto } from "./acciones/gastos";
import { accionCrearAhorro, accionEliminarAhorro } from "./acciones/ahorros";
import {
  accionActualizarDeuda,
  accionCrearDeuda,
  accionDefinirSueldo,
  accionDesactivarDeuda,
  accionMarcarCuotaPagada,
  accionPagarCuota,
  accionRevertirCuota,
} from "./acciones/finanzas";
import {
  accionAdjuntarBoletaAGasto,
  accionCrearCuenta,
  accionEliminarCuenta,
  accionActualizarCuenta,
  accionMarcarPagada,
  accionPagarCuenta,
  accionRevertirPago,
} from "./acciones/cuentas";
import {
  accionActualizarPresupuesto,
  accionCrearPresupuesto,
  accionEliminarPresupuesto,
} from "./acciones/presupuestos";
import { SecuenciaBalance } from "@/componentes/SecuenciaBalance";
import { ListaDeudas } from "@/componentes/ListaDeudas";
import { CuotasPagadas } from "@/componentes/CuotasPagadas";
import { Presupuestos } from "@/componentes/Presupuestos";
import { FormularioPresupuesto } from "@/componentes/FormularioPresupuesto";
import { FormularioSueldo } from "@/componentes/FormularioSueldo";
import { FormularioDeuda } from "@/componentes/FormularioDeuda";
import { TarjetasResumen } from "@/componentes/TarjetasResumen";
import { DesgloseCategorias } from "@/componentes/DesgloseCategorias";
import { MovimientosDelMes } from "@/componentes/MovimientosDelMes";
import { IndiceSecciones } from "@/componentes/IndiceSecciones";
import { SaludFinanciera } from "@/componentes/SaludFinanciera";
import { RitmoSemanal } from "@/componentes/RitmoSemanal";
import { RegistrarGastoEmergente } from "@/componentes/RegistrarGastoEmergente";
import { SelectorMes } from "@/componentes/SelectorMes";
import { FormularioGasto } from "@/componentes/FormularioGasto";
import { PagosDelMes } from "@/componentes/PagosDelMes";
import { FormularioCuenta } from "@/componentes/FormularioCuenta";
import { nombreDelMes } from "@/componentes/formato";
import { SeccionPanel } from "@/componentes/SeccionPanel";
import { KpisDelMes } from "@/componentes/KpisDelMes";
import { BarraDelMes } from "@/componentes/BarraDelMes";
import { LoQueQueda } from "@/componentes/LoQueQueda";
import { Ahorros } from "@/componentes/Ahorros";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ mes?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const parametros = await searchParams;

  // Un ?mes= invalido no es motivo para mostrar un error: se cae al mes actual.
  const elegido = esquemaMes.safeParse(parametros.mes);
  const mes = elegido.success ? elegido.data : mesActual();

  // Antes de leer: crear las cuentas mensuales que falten en este mes. Es
  // idempotente (indice unico por nombre y mes), asi que recargar no duplica.
  await regenerarMensuales(mes);

  const mesAnterior = sumarMeses(mes, -1);

  const [
    gastos, gastosAnterior, pagos, presupuestos, categorias, sueldo, deudas, cuentas,
    sueldoAnterior, pagosAnterior, cuentasAnterior, presupuestosAnterior, ahorros,
  ] = await Promise.all([
    listarGastosDelMes(mes),
    // Para el detalle al pasar el mouse por una categoria, la variacion del
    // total y el Health Score del mes anterior.
    listarGastosDelMes(mesAnterior),
    listarPagosDelMes(mes),
    listarPresupuestosDelMes(mes),
    listarCategoriasActivas(),
    sueldoDelMes(mes),
    listarDeudas(),
    listarCuentasDelMes(mes),
    // Lo del mes anterior, solo para comparar el Health Score.
    sueldoDelMes(mesAnterior),
    listarPagosDelMes(mesAnterior),
    listarCuentasDelMes(mesAnterior),
    listarPresupuestosDelMes(mesAnterior),
    // Hasta este mes: de ahi salen los del mes, el total y el historial.
    listarAhorrosHasta(mes),
  ]);

  const hoy = hoyISO();
  const resumen = resumirMes(gastos, mes);
  const detalles = detallesPorCategoria(gastos, gastosAnterior);
  const resumenPresupuestos = armarPresupuestos(presupuestos, gastos, mes);

  // Para el selector del formulario: las categorias que aun no tienen techo.
  const conPresupuesto = new Set(presupuestos.map((p) => p.categoria.id));
  const sinPresupuesto = categorias.filter((c) => !conPresupuesto.has(c.id));
  const balance = calcularBalance({ mes, sueldo, resumen, deudas, pagos });
  const resumenCuentas = resumirCuentas(cuentas, mes, diasEnMesISO(mes), hoy);

  // Si se mira un mes pasado, el formulario propone su dia 1 en vez de hoy.
  const fechaInicial = mes === mesActual() ? hoy : `${mes}-01`;

  // Las cuatro cifras y la barra del sueldo. Junta lo que ya calcularon el
  // resumen, el balance y las cuentas: no vuelve a sumar gastos por su lado.
  const panel = armarResumenPanel({
    mes,
    hoy,
    diasDelMes: diasEnMesISO(mes),
    balance,
    resumen,
    cuentas: resumenCuentas,
    gastosMesAnterior: gastosAnterior,
  });

  // El Health Score, y el del mes anterior para la variacion. Sin gastos en
  // el mes anterior no hay con que comparar: un mes vacio sacaria 100 y haria
  // ver cualquier mes real como una caida.
  const salud = calcularSalud({
    panel,
    presupuestos: resumenPresupuestos,
    cuotasDelMes: balance.cuotasComprometidas,
  });
  const puntajeAnterior = (() => {
    if (gastosAnterior.length === 0) return null;
    const diasAnterior = diasEnMesISO(mesAnterior);
    const resumenAnterior = resumirMes(gastosAnterior, mesAnterior);
    const balanceAnterior = calcularBalance({
      mes: mesAnterior,
      sueldo: sueldoAnterior,
      resumen: resumenAnterior,
      deudas,
      pagos: pagosAnterior,
    });
    return puntajeDeSalud({
      panel: armarResumenPanel({
        mes: mesAnterior,
        hoy,
        diasDelMes: diasAnterior,
        balance: balanceAnterior,
        resumen: resumenAnterior,
        cuentas: resumirCuentas(cuentasAnterior, mesAnterior, diasAnterior, hoy),
        gastosMesAnterior: [],
      }),
      presupuestos: armarPresupuestos(presupuestosAnterior, gastosAnterior, mesAnterior),
      cuotasDelMes: balanceAnterior.cuotasComprometidas,
    });
  })();

  // El mes en bloques de 7 dias, y como cerraria si sigues igual.
  const ritmo = ritmoSemanal(gastos, mes, hoy);
  const proyeccion = proyectarCierre(
    panel.gastado,
    panel.porPagar,
    panel.barra.diasRestantes,
    ritmo,
    panel.barra.diaDeHoy !== null,
  );

  // Lo que falta pagar en cuentas, por categoria: va rayado en cada presupuesto.
  const comprometidoPorCategoria: Record<string, number> = {};
  for (const c of resumenCuentas.pendientes) {
    comprometidoPorCategoria[c.categoria.id] = (comprometidoPorCategoria[c.categoria.id] ?? 0) + c.monto;
  }

  // Lo que te quedaria: el sueldo menos todo lo que ya tiene destino, ahorro
  // incluido. Usa las mismas cifras que el resumen, asi no se contradicen.
  const ahorrosDelMes = ahorros.filter((a) => a.mes === mes);
  const estadoDelMes = mes === hoy.slice(0, 7) ? "en-curso" : mes < hoy.slice(0, 7) ? "cerrado" : "futuro";
  const queda = calcularLoQueQueda({
    sueldo: panel.sinSueldo ? null : panel.sueldo,
    gastos: resumen.total,
    cuotasPagadas: panel.cuotasPagadas,
    cuentasPorPagar: { total: resumenCuentas.totalPendiente, cantidad: resumenCuentas.pendientes.length },
    cuotasPorPagar: {
      total: balance.cuotasPorPagar,
      cantidad: balance.cuotasDelMes.filter((c) => !c.pagada).length,
    },
    presupuestos: resumenPresupuestos,
    comprometidoPorCategoria,
    ahorros: ahorrosDelMes,
    diasRestantes: panel.barra.diasRestantes,
    estado: estadoDelMes,
  });

  // Para la vista previa del formulario: como va cada presupuesto.
  const techos = resumenPresupuestos.lineas.map((l) => ({
    categoriaId: l.presupuesto.categoria.id,
    gastado: l.gastado,
    monto: l.presupuesto.monto,
  }));

  const { diaDeHoy, diasRestantes } = panel.barra;
  const avisoCuentas =
    panel.cuentasVencidas > 0
      ? ` Tienes ${panel.cuentasVencidas} ${
          panel.cuentasVencidas === 1 ? "cuenta vencida" : "cuentas vencidas"
        } que conviene resolver hoy.`
      : panel.porVencer > 0
        ? ` Tienes ${panel.porVencer} por vencer esta semana.`
        : "";
  const fraseDelMes =
    diaDeHoy !== null
      ? `Quedan ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"} para cerrar el mes, contando hoy.${avisoCuentas}`
      : mes < mesActual()
        ? "Mes cerrado: así terminó."
        : "Mes que viene: aquí ves lo que ya está programado.";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="capitalize">{nombreDelMes(mes)}</span>
          </h1>
          <p className="max-w-[62ch] text-sm text-texto-tenue">{fraseDelMes}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SelectorMes mes={mes} />
          {/* Abre el popup para registrar un gasto sin bajar hasta la seccion 02. */}
          <RegistrarGastoEmergente
            categorias={categorias}
            fechaInicial={fechaInicial}
            accion={accionCrearGasto}
            presupuestos={techos}
          />
        </div>
      </header>

      <div className="mt-6">
        <IndiceSecciones />
      </div>

      <main className="mt-8 space-y-14">
        {/* 01 · Lo que te quedaria, con la cuenta completa, y al lado los
            ahorros: dos tarjetas en la misma seccion. */}
        <SeccionPanel seccion="queda">
          <div className="grid items-stretch gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <LoQueQueda queda={queda} mes={mes} estado={estadoDelMes} diasRestantes={panel.barra.diasRestantes} />
            </div>
            <div className="lg:col-span-2">
              <Ahorros
                mes={mes}
                delMes={ahorrosDelMes}
                acumulado={totalAhorrado(ahorros, mes)}
                historial={historialDeAhorro(ahorros, mes)}
                meta={panel.sinSueldo ? null : Math.round((panel.sueldo * META_AHORRO) / 100)}
                metaPct={META_AHORRO}
                accion={accionCrearAhorro}
                alEliminar={accionEliminarAhorro}
              />
            </div>
          </div>
        </SeccionPanel>

        {/* 02 · Las cuatro cifras, la barra del sueldo y la secuencia del
            balance, que es el detalle de esas cifras. */}
        <SeccionPanel seccion="resumen">
          <KpisDelMes panel={panel} mes={mes} />
          <BarraDelMes panel={panel} mes={mes} />
          <div className="grid items-start gap-4 lg:grid-cols-5">
            <div id="balance" className="scroll-mt-28 lg:col-span-3">
              <SecuenciaBalance balance={balance} gastos={gastos}>
                <FormularioSueldo mes={mes} sueldoActual={sueldo} accion={accionDefinirSueldo} />
              </SecuenciaBalance>
            </div>
            <div className="lg:col-span-2">
              <DesgloseCategorias resumen={resumen} detalles={detalles} />
            </div>
          </div>
        </SeccionPanel>

        {/* 03 · Lo que se hace todos los dias: anotar un gasto y pagar. Las
            cuentas y cuotas van juntas, porque a fin de mes lo que importa es
            que falta, no de que tabla sale. */}
        <SeccionPanel seccion="registro">
          <div className="grid items-start gap-4 lg:grid-cols-5">
            <div id="registrar" className="scroll-mt-28 lg:col-span-2">
              <FormularioGasto
                categorias={categorias}
                fechaInicial={fechaInicial}
                accion={accionCrearGasto}
                presupuestos={techos}
              />
            </div>
            <div id="pagos" className="scroll-mt-28 lg:col-span-3">
              <PagosDelMes
                resumen={resumenCuentas}
                balance={balance}
                deudas={deudas}
                hoy={hoy}
                categorias={categorias}
                accionPagarCuenta={accionPagarCuenta}
                accionEditarCuenta={accionActualizarCuenta}
                alMarcarCuentaPagada={accionMarcarPagada}
                alEliminarCuenta={accionEliminarCuenta}
                alRevertirCuenta={accionRevertirPago}
                alMarcarCuotaPagada={accionMarcarCuotaPagada}
                alRevertirCuota={accionRevertirCuota}
              >
                <FormularioCuenta mes={mes} categorias={categorias} accion={accionCrearCuenta} />
              </PagosDelMes>
            </div>
          </div>
        </SeccionPanel>

        {/* 04 · El Health Score y las deudas que lo mueven. */}
        <SeccionPanel seccion="salud">
          <div className="grid items-start gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <SaludFinanciera salud={salud} mes={mes} anterior={puntajeAnterior} />
            </div>
            <div id="deudas" className="scroll-mt-28 lg:col-span-2">
              <ListaDeudas
                deudas={deudas}
                balance={balance}
                hoy={hoy}
                accionPagarCuota={accionPagarCuota}
                alMarcarPagada={accionMarcarCuotaPagada}
                accionEditar={accionActualizarDeuda}
                alDesactivar={accionDesactivarDeuda}
                alRevertirCuota={accionRevertirCuota}
              >
                <FormularioDeuda mes={mes} accion={accionCrearDeuda} />
              </ListaDeudas>
            </div>
          </div>
        </SeccionPanel>

        {/* 05 · El mes en bloques de 7 dias, y el reparto entre esencial y
            discrecional. */}
        <SeccionPanel seccion="semanas">
          <RitmoSemanal
            ritmo={ritmo}
            proyeccion={proyeccion}
            proyeccionPctSueldo={
              proyeccion === null || panel.sinSueldo || panel.sueldo <= 0
                ? null
                : (proyeccion / panel.sueldo) * 100
            }
          />
          <TarjetasResumen resumen={resumen} />
        </SeccionPanel>

        {/* 06 · Los presupuestos de siempre: cada uno se despliega con sus
            gastos por semana y sus boletas. Ahora con lo comprometido rayado
            y un filtro por estado. */}
        <SeccionPanel seccion="presupuestos">
          <Presupuestos
            resumen={resumenPresupuestos}
            gastos={gastos}
            diasDelMes={diasEnMesISO(mes)}
            accionEditar={accionActualizarPresupuesto}
            alEliminar={accionEliminarPresupuesto}
            comprometidoPorCategoria={comprometidoPorCategoria}
          >
            <FormularioPresupuesto
              mes={mes}
              disponibles={sinPresupuesto}
              sugeridas={resumenPresupuestos.sinPresupuesto}
              accion={accionCrearPresupuesto}
            />
          </Presupuestos>
        </SeccionPanel>

        {/* 07 · La tabla de gastos con sus boletas, ahora con buscador. Los
            pagos de cuota NO van en ella: el balance ya los descuenta como
            cuotas, y mezclarlos aqui los restaria dos veces. Van aparte. */}
        <SeccionPanel seccion="movimientos">
          <MovimientosDelMes
            gastos={gastos.filter((g) => !esPagoDeCuota(g))}
            categorias={categorias}
            alEliminar={accionEliminarGasto}
            accionBoleta={accionAdjuntarBoletaAGasto}
          />
          <CuotasPagadas cuotas={resumen.cuotasPagadas} total={resumen.totalCuotas} />
        </SeccionPanel>
      </main>
    </div>
  );
}
