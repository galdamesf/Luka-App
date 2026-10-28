import type { Balance, CuotaDelMes, DeudaPlana } from "@/dominio/balance";
import type { ResumenCuentas } from "@/dominio/cuentas";
import type { CategoriaPlana } from "@/dominio/resumen";
import type { AccionFormulario } from "@/dominio/formulario";
import { FilaCuenta } from "./FilaCuenta";
import { FilaCuotaPago } from "./FilaCuotaPago";
import { Icono } from "./Icono";
import { formatearCLP, nombreDelMes } from "./formato";

type Props = {
  resumen: ResumenCuentas;
  balance: Balance;
  deudas: readonly DeudaPlana[];
  hoy: string;
  categorias: readonly CategoriaPlana[];
  accionPagarCuenta: AccionFormulario;
  accionEditarCuenta: AccionFormulario;
  alMarcarCuentaPagada: AccionFormulario;
  alEliminarCuenta: (datos: FormData) => void;
  alRevertirCuenta: AccionFormulario;
  alMarcarCuotaPagada: AccionFormulario;
  alRevertirCuota: AccionFormulario;
  /** El formulario para agregar una cuenta, que es de cliente. */
  children?: React.ReactNode;
};

function Columna({
  titulo, total, vacio, children,
}: {
  titulo: string;
  total: number;
  vacio: string;
  children: React.ReactNode;
}) {
  const hayAlgo = Array.isArray(children) ? children.flat().length > 0 : Boolean(children);

  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline justify-between gap-2 border-b border-borde px-4 py-2 text-xs font-medium tracking-wide text-texto-tenue uppercase">
        <span>{titulo}</span>
        <span className="cifra normal-case">{formatearCLP(total)}</span>
      </p>

      {hayAlgo ? (
        <ul>{children}</ul>
      ) : (
        <p className="px-4 py-6 text-center text-xs text-texto-tenue">{vacio}</p>
      )}
    </div>
  );
}

/**
 * Todo lo que hay que pagar este mes, en dos columnas: lo pendiente y lo
 * pagado.
 *
 * Mezcla cuentas y cuotas de deuda a proposito: a fin de mes lo que importa
 * es que falta por pagar, no de que tabla sale cada cosa. Los botones mueven
 * cada item de una columna a la otra.
 *
 * La seccion de Deudas sigue existiendo para administrar las deudas en si
 * (agregar, editar, ver el avance); aqui solo se pagan sus cuotas.
 */
export function PagosDelMes({
  resumen, balance, deudas, hoy, categorias,
  accionPagarCuenta, accionEditarCuenta, alMarcarCuentaPagada, alEliminarCuenta,
  alRevertirCuenta, alMarcarCuotaPagada, alRevertirCuota, children,
}: Props) {
  const { pendientes, pagadas, vencidas } = resumen;
  const vencidasPorId = new Set(vencidas.map((c) => c.id));

  const porDeuda = new Map(deudas.map((d) => [d.id, d]));
  const cuotas = balance.cuotasDelMes
    .map((cuota) => ({ cuota, deuda: porDeuda.get(cuota.deuda.id) ?? cuota.deuda }))
    .filter((x): x is { cuota: CuotaDelMes; deuda: DeudaPlana } => x.deuda !== undefined);

  const cuotasPendientes = cuotas.filter((x) => !x.cuota.pagada);
  const cuotasPagadas = cuotas.filter((x) => x.cuota.pagada);

  const totalPendiente = resumen.totalPendiente + balance.cuotasPorPagar;
  const totalPagado = resumen.totalPagado + balance.cuotas;

  const hayAlgo =
    pendientes.length + pagadas.length + cuotas.length > 0;

  const fila = (cuenta: (typeof pendientes)[number], vencida: boolean) => (
    <FilaCuenta
      key={cuenta.id}
      cuenta={cuenta}
      vencida={vencida}
      hoy={hoy}
      categorias={categorias}
      accionPagar={accionPagarCuenta}
      accionEditar={accionEditarCuenta}
      alMarcarPagada={alMarcarCuentaPagada}
      alEliminar={alEliminarCuenta}
      alRevertir={alRevertirCuenta}
    />
  );

  const filaCuota = ({ cuota, deuda }: { cuota: CuotaDelMes; deuda: DeudaPlana }) => (
    <FilaCuotaPago
      key={`cuota-${deuda.id}`}
      deuda={deuda}
      cuota={cuota}
      mes={resumen.mes}
      hoy={hoy}
      alMarcarPagada={alMarcarCuotaPagada}
      alRevertir={alRevertirCuota}
    />
  );

  return (
    <section
      aria-labelledby="titulo-pagos"
      className="rounded-lg border border-borde bg-superficie"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-3">
        <h2 id="titulo-pagos" className="text-sm font-semibold">
          Pagos de <span className="capitalize">{nombreDelMes(resumen.mes)}</span>
        </h2>
        {hayAlgo && (
          <p className="text-xs text-texto-tenue">
            {totalPendiente > 0 ? (
              <>
                falta pagar{" "}
                <span className="cifra font-medium text-texto">
                  {formatearCLP(totalPendiente)}
                </span>
              </>
            ) : (
              <span className="text-exito">todo pagado</span>
            )}
          </p>
        )}
      </div>

      {vencidas.length > 0 && (
        <p className="mx-4 mb-3 flex items-center gap-2 rounded-md bg-superficie-tenue px-3 py-2 text-xs text-peligro">
          <Icono nombre="alert" tamano={14} />
          <span>
            {vencidas.length === 1
              ? "Hay una cuenta vencida sin pagar."
              : `Hay ${vencidas.length} cuentas vencidas sin pagar.`}
          </span>
        </p>
      )}

      {!hayAlgo ? (
        <p className="border-t border-borde px-4 py-8 text-center text-sm text-texto-tenue">
          No tienes cuentas ni cuotas en este mes.
        </p>
      ) : (
        <div className="grid border-t border-borde lg:grid-cols-2 lg:divide-x lg:divide-borde">
          <Columna
            titulo="Pendientes"
            total={totalPendiente}
            vacio="No queda nada por pagar este mes."
          >
            {[
              ...pendientes.map((c) => fila(c, vencidasPorId.has(c.id))),
              ...cuotasPendientes.map(filaCuota),
            ]}
          </Columna>

          <Columna
            titulo="Pagadas"
            total={totalPagado}
            vacio="Todavía no pagas nada este mes."
          >
            {[...pagadas.map((c) => fila(c, false)), ...cuotasPagadas.map(filaCuota)]}
          </Columna>
        </div>
      )}

      {children}
    </section>
  );
}
