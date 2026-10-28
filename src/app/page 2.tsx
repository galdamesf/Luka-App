import { listarGastosDelMes } from "@/datos/gastos";
import { listarCategoriasActivas } from "@/datos/categorias";
import { sueldoDelMes } from "@/datos/sueldos";
import { listarDeudas } from "@/datos/deudas";
import { listarCuentasDelMes, regenerarMensuales } from "@/datos/cuentas";
import { resumirMes } from "@/dominio/resumen";
import { detallesPorCategoria } from "@/dominio/detalle-categoria";
import { listarPagosDelMes } from "@/datos/deudas";
import { calcularBalance } from "@/dominio/balance";
import { resumirCuentas } from "@/dominio/cuentas";
import { esquemaMes } from "@/dominio/esquemas";
import { diasEnMesISO, hoyISO, mesActual, sumarMeses } from "@/lib/fecha";
import { accionCrearGasto, accionEliminarGasto } from "./acciones/gastos";
import {
  accionActualizarDeuda,
  accionCrearDeuda,
  accionDefinirSueldo,
  accionDesactivarDeuda,
  accionPagarCuota,
  accionRevertirCuota,
} from "./acciones/finanzas";
import {
  accionAdjuntarBoletaAGasto,
  accionCrearCuenta,
  accionEliminarCuenta,
  accionActualizarCuenta,
  accionPagarCuenta,
  accionRevertirPago,
} from "./acciones/cuentas";
import { SecuenciaBalance } from "@/componentes/SecuenciaBalance";
import { ListaDeudas } from "@/componentes/ListaDeudas";
import { CuotasPagadas } from "@/componentes/CuotasPagadas";
import { FormularioSueldo } from "@/componentes/FormularioSueldo";
import { FormularioDeuda } from "@/componentes/FormularioDeuda";
import { TarjetasResumen } from "@/componentes/TarjetasResumen";
import { DesgloseCategorias } from "@/componentes/DesgloseCategorias";
import { TablaGastos } from "@/componentes/TablaGastos";
import { SelectorMes } from "@/componentes/SelectorMes";
import { FormularioGasto } from "@/componentes/FormularioGasto";
import { ListaCuentas } from "@/componentes/ListaCuentas";
import { FormularioCuenta } from "@/componentes/FormularioCuenta";
import { nombreDelMes } from "@/componentes/formato";

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

  const [gastos, gastosAnterior, pagos, categorias, sueldo, deudas, cuentas] = await Promise.all([
    listarGastosDelMes(mes),
    // Solo para el detalle al pasar el mouse por una categoria.
    listarGastosDelMes(sumarMeses(mes, -1)),
    listarPagosDelMes(mes),
    listarCategoriasActivas(),
    sueldoDelMes(mes),
    listarDeudas(),
    listarCuentasDelMes(mes),
  ]);

  const hoy = hoyISO();
  const resumen = resumirMes(gastos, mes);
  const detalles = detallesPorCategoria(gastos, gastosAnterior);
  const balance = calcularBalance({ mes, sueldo, resumen, deudas, pagos });
  const resumenCuentas = resumirCuentas(cuentas, mes, diasEnMesISO(mes), hoy);

  // Si se mira un mes pasado, el formulario propone su dia 1 en vez de hoy.
  const fechaInicial = mes === mesActual() ? hoy : `${mes}-01`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          <span className="capitalize">{nombreDelMes(mes)}</span>
        </h1>
        <SelectorMes mes={mes} />
      </header>

      <main className="mt-6 space-y-4">
        {/* Primero la secuencia: entra el sueldo, salen los basicos y las
            cuotas, queda el disponible. */}
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <SecuenciaBalance balance={balance}>
              <FormularioSueldo
                mes={mes}
                sueldoActual={sueldo}
                accion={accionDefinirSueldo}
              />
            </SecuenciaBalance>
          </div>
          <div className="lg:col-span-2">
            <ListaDeudas
              deudas={deudas}
              balance={balance}
              hoy={hoy}
              accionPagarCuota={accionPagarCuota}
              accionEditar={accionActualizarDeuda}
              alDesactivar={accionDesactivarDeuda}
              alRevertirCuota={accionRevertirCuota}
            >
              <FormularioDeuda mes={mes} accion={accionCrearDeuda} />
            </ListaDeudas>
          </div>
        </div>

        {/* Las cuentas por pagar: lo que viene, antes de lo que ya salio. */}
        <ListaCuentas
          resumen={resumenCuentas}
          hoy={hoy}
          categorias={categorias}
          accionPagar={accionPagarCuenta}
          accionEditar={accionActualizarCuenta}
          alEliminar={accionEliminarCuenta}
          alRevertir={accionRevertirPago}
        >
          <FormularioCuenta mes={mes} categorias={categorias} accion={accionCrearCuenta} />
        </ListaCuentas>

        <TarjetasResumen resumen={resumen} />

        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <DesgloseCategorias resumen={resumen} detalles={detalles} />
          </div>
          <div className="lg:col-span-2">
            <FormularioGasto
              categorias={categorias}
              fechaInicial={fechaInicial}
              accion={accionCrearGasto}
            />
          </div>
        </div>

        {/* Los pagos de cuota NO van en esta tabla: el balance ya los
            descuenta como cuotas, y mezclarlos aqui los restaria dos veces.
            Van en su propia seccion, justo abajo. */}
        <TablaGastos
          gastos={gastos.filter((g) => g.cuota === null)}
          alEliminar={accionEliminarGasto}
          accionBoleta={accionAdjuntarBoletaAGasto}
        />

        <CuotasPagadas cuotas={resumen.cuotasPagadas} total={resumen.totalCuotas} />
      </main>
    </div>
  );
}
