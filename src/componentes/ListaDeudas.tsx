import type { Balance, DeudaPlana } from "@/dominio/balance";
import { saldoDesde } from "@/dominio/balance";
import type { AccionFormulario } from "@/dominio/formulario";
import { FilaDeuda } from "./FilaDeuda";
import { formatearCLP } from "./formato";

type Props = {
  deudas: readonly DeudaPlana[];
  balance: Balance;
  /** Dia de hoy, para proponerlo como fecha de pago. */
  hoy: string;
  accionPagarCuota: AccionFormulario;
  accionEditar: AccionFormulario;
  alMarcarPagada: AccionFormulario;
  alDesactivar?: (datos: FormData) => void;
  alRevertirCuota: AccionFormulario;
  /** El formulario de deuda, que es componente de cliente. */
  children?: React.ReactNode;
};

export function ListaDeudas({
  deudas, balance, hoy, accionPagarCuota, accionEditar, alMarcarPagada, alDesactivar,
  alRevertirCuota, children,
}: Props) {
  const activas = deudas.filter((d) => d.activa);
  const deudaTotal = activas.reduce((suma, d) => suma + saldoDesde(d, balance.mes), 0);

  // Las cuotas vienen del balance y no de cuotaEnMes: el balance es el unico
  // que sabe cuales estan pagadas, porque es el que ve los pagos registrados.
  const cuotaPorDeuda = new Map(balance.cuotasDelMes.map((c) => [c.deuda.id, c]));
  return (
    <section
      aria-labelledby="titulo-deudas"
      className="tarjeta-viva viva-avance rounded-xl border border-borde bg-superficie p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {/* h3: vive dentro de la seccion 03 del dashboard, que ya tiene su h2. */}
        <h3 id="titulo-deudas" className="text-base font-bold">Deudas en cuotas</h3>
        {activas.length > 0 && (
          <p className="text-xs text-texto-tenue">
            queda por pagar{" "}
            <span className="cifra font-medium text-texto">{formatearCLP(deudaTotal)}</span>
          </p>
        )}
      </div>

      {activas.length === 0 ? (
        <p className="py-6 text-center text-sm text-texto-tenue">
          No tienes deudas registradas.
        </p>
      ) : (
        <ul className="mt-2">
          {activas.map((deuda) => (
            <FilaDeuda
              key={deuda.id}
              deuda={deuda}
              cuota={cuotaPorDeuda.get(deuda.id) ?? null}
              mes={balance.mes}
              hoy={hoy}
              accionPagar={accionPagarCuota}
              accionEditar={accionEditar}
              alMarcarPagada={alMarcarPagada}
              alDesactivar={alDesactivar}
              alRevertir={alRevertirCuota}
            />
          ))}
        </ul>
      )}

      {children}
    </section>
  );
}
