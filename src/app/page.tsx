import { listarGastosDelMes } from "@/datos/gastos";
import { listarCategoriasActivas } from "@/datos/categorias";
import { sueldoDelMes, sueldosDelMes } from "@/datos/sueldos";
import { mostrarAportes } from "@/dominio/sueldos";
import { listarDeudas } from "@/datos/deudas";
import { listarCuentasDelMes, regenerarMensuales } from "@/datos/cuentas";
import { resumirMes } from "@/dominio/resumen";
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
import { hoyISO } from "@/lib/fecha";
import { enPeriodo, periodoDe, periodoDeFecha, periodoVecino } from "@/lib/periodo";
import { leerAjustes } from "@/datos/ajustes";
import { sinAutor } from "@/dominio/resumen";
import { hogarActual } from "@/lib/hogar-actual";
import { accionCrearGasto, accionEliminarGasto } from "./acciones/gastos";
import { accionCrearAhorro, accionEliminarAhorro } from "./acciones/ahorros";
import { accionDefinirDiaInicio } from "./acciones/ajustes";
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
import { Presupuestos } from "@/componentes/Presupuestos";
import { FormularioPresupuesto } from "@/componentes/FormularioPresupuesto";
import { FormularioSueldo } from "@/componentes/FormularioSueldo";
import { FormularioDeuda } from "@/componentes/FormularioDeuda";
import { TarjetasResumen } from "@/componentes/TarjetasResumen";
import { DesgloseCategorias } from "@/componentes/DesgloseCategorias";
import { MovimientosDelMes } from "@/componentes/MovimientosDelMes";
import { CifrasQueda } from "@/componentes/CifrasQueda";
import { IndiceSecciones } from "@/componentes/IndiceSecciones";
import { SaludFinanciera } from "@/componentes/SaludFinanciera";
import { RitmoSemanal } from "@/componentes/RitmoSemanal";
import { RegistrarGastoEmergente } from "@/componentes/RegistrarGastoEmergente";
import { SelectorMes } from "@/componentes/SelectorMes";
import { FormularioGasto } from "@/componentes/FormularioGasto";
import { PagosDelMes } from "@/componentes/PagosDelMes";
import { FormularioCuenta } from "@/componentes/FormularioCuenta";
import { nombreDelMes, rangoCorto } from "@/componentes/formato";
import { AjusteDiaInicio } from "@/componentes/AjusteDiaInicio";
import { SeccionPanel } from "@/componentes/SeccionPanel";
import { KpisDelMes } from "@/componentes/KpisDelMes";
import { BarraDelMes } from "@/componentes/BarraDelMes";
import { LoQueQueda } from "@/componentes/LoQueQueda";
import { Ahorros } from "@/componentes/Ahorros";
import { Bienvenida, type ResumenBienvenida } from "@/componentes/Bienvenida";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ mes?: string; bienvenida?: string }>;
};

export default async function Home({ searchParams }: Props) {
  // Cada visita revisa contra la base que la persona siga en el hogar con
  // que entro (si no, la sesion se cierra aqui mismo), y de ese hogar, y de
  // ningun otro, se lee todo lo que sigue.
  const { hogarId, miembroId, rol } = await hogarActual();
  const parametros = await searchParams;

  // El mes de gastos empieza el dia que eligio la persona (el de su pago).
  // Con dia 27, el 2 de noviembre es noviembre: del 27 oct al 26 nov.
  const { diaInicioMes } = await leerAjustes(hogarId);
  const hoy = hoyISO();

  // Un ?mes= invalido no es motivo para mostrar un error: se cae al mes actual.
  const elegido = esquemaMes.safeParse(parametros.mes);
  const mes = elegido.success ? elegido.data : periodoDeFecha(hoy, diaInicioMes).mes;
  const periodo = periodoDe(mes, diaInicioMes);
  const periodoAnterior = periodoVecino(periodo, -1);

  // Antes de leer: crear las cuentas mensuales que falten en este mes. Es
  // idempotente (indice unico por hogar, nombre y mes), asi que recargar no
  // duplica.
  await regenerarMensuales(hogarId, mes);

  const mesAnterior = periodoAnterior.mes;

  const [
    gastos, gastosAnterior, pagos, presupuestos, categorias, sueldos, deudas, cuentas,
    sueldoAnterior, pagosAnterior, cuentasAnterior, presupuestosAnterior, ahorros,
  ] = await Promise.all([
    listarGastosDelMes(hogarId, periodo),
    // Para el detalle al pasar el mouse por una categoria, la variacion del
    // total y el Health Score del mes anterior.
    listarGastosDelMes(hogarId, periodoAnterior),
    listarPagosDelMes(hogarId, mes),
    listarPresupuestosDelMes(hogarId, mes),
    listarCategoriasActivas(hogarId),
    // El de cada miembro y la suma: el hogar vive con lo de todos.
    sueldosDelMes(hogarId, mes, miembroId),
    listarDeudas(hogarId),
    listarCuentasDelMes(hogarId, mes),
    // Lo del mes anterior, solo para comparar el Health Score.
    sueldoDelMes(hogarId, mesAnterior),
    listarPagosDelMes(hogarId, mesAnterior),
    listarCuentasDelMes(hogarId, mesAnterior),
    listarPresupuestosDelMes(hogarId, mesAnterior),
    // Hasta este mes: de ahi salen los del mes, el total y el historial.
    listarAhorrosHasta(hogarId, mes),
  ]);

  // Quien anoto cada gasto se muestra solo si en el hogar hay mas de una
  // persona: con una sola, cada fila diria lo mismo. Los sueldos ya traen
  // una fila por cada uno que entro.
  const gastosConAutor = sueldos.aportes.length > 1 ? gastos : sinAutor(gastos);
  const sueldo = sueldos.total;
  const miSueldo = sueldos.porMiembro.get(miembroId) ?? null;

  const resumen = resumirMes(gastos, periodo);
  const detalles = detallesPorCategoria(gastos, gastosAnterior);
  const resumenPresupuestos = armarPresupuestos(presupuestos, gastos, periodo);

  // Para el selector del formulario: las categorias que aun no tienen techo.
  const conPresupuesto = new Set(presupuestos.map((p) => p.categoria.id));
  const sinPresupuesto = categorias.filter((c) => !conPresupuesto.has(c.id));
  const balance = calcularBalance({ mes, sueldo, resumen, deudas, pagos });
  const resumenCuentas = resumirCuentas(cuentas, periodo, hoy);

  // Si se mira otro mes, el formulario propone su primer dia en vez de hoy.
  const fechaInicial = enPeriodo(hoy, periodo) ? hoy : periodo.desde;

  // Las cuatro cifras y la barra del sueldo. Junta lo que ya calcularon el
  // resumen, el balance y las cuentas: no vuelve a sumar gastos por su lado.
  const panel = armarResumenPanel({
    mes: periodo,
    hoy,
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
    const resumenAnterior = resumirMes(gastosAnterior, periodoAnterior);
    const balanceAnterior = calcularBalance({
      mes: mesAnterior,
      sueldo: sueldoAnterior,
      resumen: resumenAnterior,
      deudas,
      pagos: pagosAnterior,
    });
    return puntajeDeSalud({
      panel: armarResumenPanel({
        mes: periodoAnterior,
        hoy,
        balance: balanceAnterior,
        resumen: resumenAnterior,
        cuentas: resumirCuentas(cuentasAnterior, periodoAnterior, hoy),
        gastosMesAnterior: [],
      }),
      presupuestos: armarPresupuestos(presupuestosAnterior, gastosAnterior, periodoAnterior),
      cuotasDelMes: balanceAnterior.cuotasComprometidas,
    });
  })();

  // El mes en bloques de 7 dias, y como cerraria si sigues igual.
  const ritmo = ritmoSemanal(gastos, periodo, hoy);
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
  const estadoDelMes = enPeriodo(hoy, periodo) ? "en-curso" : hoy > periodo.hasta ? "cerrado" : "futuro";
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
    metaAhorro: panel.sinSueldo ? null : Math.round((panel.sueldo * META_AHORRO) / 100),
    gastosDelMes: gastos,
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
      : hoy > periodo.hasta
        ? "Mes cerrado: así terminó."
        : "Mes que viene: aquí ves lo que ya está programado.";

  // El saludo, solo al volver del ingreso con Google: la pantalla de ingreso
  // redirige a "/?bienvenida=1". Usa las mismas cifras del panel.
  let bienvenida: ResumenBienvenida | null = null;
  if (parametros.bienvenida === "1") {
    const sesion = await auth();
    const nombre = sesion?.user?.name?.trim().split(/\s+/)[0] ?? "";
    bienvenida = {
      nombre: nombre === "" ? null : nombre,
      mes: nombreDelMes(mes).split(" ")[0] ?? nombreDelMes(mes),
      rango: diaInicioMes === 1 ? null : rangoCorto(periodo.desde, periodo.hasta),
      diasRestantes,
      sinSueldo: panel.sinSueldo,
      libre: queda.libre,
      porPagar: panel.porPagar,
      cuentasVencidas: panel.cuentasVencidas,
      montoVencido: panel.montoVencido,
      puntaje: salud.puntaje,
    };
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      {bienvenida !== null && <Bienvenida resumen={bienvenida} />}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            <span className="capitalize">{nombreDelMes(mes)}</span>
            {diaInicioMes !== 1 && (
              <span className="cifra ml-3 align-middle text-sm font-semibold text-texto-tenue">
                {rangoCorto(periodo.desde, periodo.hasta)}
              </span>
            )}
          </h1>
          <p className="max-w-[62ch] text-sm text-texto-tenue">{fraseDelMes}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SelectorMes
            mes={mes}
            rango={diaInicioMes === 1 ? undefined : rangoCorto(periodo.desde, periodo.hasta)}
          />
          <AjusteDiaInicio
            diaInicio={diaInicioMes}
            hoy={hoy}
            accion={accionDefinirDiaInicio}
            puedeCambiar={rol === "DUENO"}
          />
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
        {/* 01 · Las cuatro cifras, la barra del sueldo y la secuencia del
            balance, que es el detalle de esas cifras. */}
        <SeccionPanel seccion="resumen">
          <KpisDelMes panel={panel} mes={mes} />
          <BarraDelMes panel={panel} mes={mes} />
          <div className="grid items-start gap-4 lg:grid-cols-5">
            <div id="balance" className="scroll-mt-28 lg:col-span-3">
              <SecuenciaBalance
                balance={balance}
                gastos={gastos}
                periodo={periodo}
                aportes={mostrarAportes(sueldos.aportes, sueldos.deQuienesSalieron) ? sueldos.aportes : undefined}
                deQuienesSalieron={sueldos.deQuienesSalieron}
              >
                <FormularioSueldo
                  mes={mes}
                  sueldoActual={miSueldo}
                  compartido={sueldos.aportes.length > 1}
                  accion={accionDefinirSueldo}
                />
              </SecuenciaBalance>
            </div>
            <div className="lg:col-span-2">
              <DesgloseCategorias resumen={resumen} detalles={detalles} />
            </div>
          </div>
        </SeccionPanel>

        {/* 02 · Arriba, a todo lo ancho, las tres cifras que importan: lo
            libre para el mes, lo de los presupuestos y lo que puedes ahorrar.
            Debajo la cuenta completa y, al lado, los ahorros. */}
        <SeccionPanel seccion="queda">
          <CifrasQueda
            queda={queda}
            mes={mes}
            estado={estadoDelMes}
            diasRestantes={panel.barra.diasRestantes}
            metaPct={META_AHORRO}
          />
          <div className="grid items-stretch gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <LoQueQueda queda={queda} mes={mes} estado={estadoDelMes} />
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
                accionPagarCuota={accionPagarCuota}
                alMarcarCuotaPagada={accionMarcarCuotaPagada}
                alRevertirCuota={accionRevertirCuota}
                accionBoleta={accionAdjuntarBoletaAGasto}
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
                accionBoleta={accionAdjuntarBoletaAGasto}
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
            periodo={periodo}
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

        {/* 07 · La tabla de gastos con sus boletas, con buscador. Incluye los
            pagos de cuota, marcados como tales: aqui solo se listan y se
            suman para mostrar, no alimentan el balance, que las descuenta
            por su lado. Por eso no se restan dos veces. */}
        <SeccionPanel seccion="movimientos">
          <MovimientosDelMes
            gastos={gastosConAutor}
            categorias={categorias}
            alEliminar={accionEliminarGasto}
            accionBoleta={accionAdjuntarBoletaAGasto}
          />
        </SeccionPanel>
      </main>
    </div>
  );
}
