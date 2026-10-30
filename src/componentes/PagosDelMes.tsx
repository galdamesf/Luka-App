import type { Balance, CuotaDelMes, DeudaPlana } from "@/dominio/balance";
import type { ResumenCuentas } from "@/dominio/cuentas";
import type { CategoriaPlana } from "@/dominio/resumen";
import type { AccionFormulario } from "@/dominio/formulario";
import { FilaCuenta } from "./FilaCuenta";
import { FilaCuotaPago } from "./FilaCuotaPago";
import { Icono } from "./Icono";
import { formatearCLP, nombreDelMes } from "./formato";
import { agruparPendientes } from "@/dominio/cuentas";
import { diasEnMesISO } from "@/lib/fecha";

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

function Grupo({
  titulo, tono, total, cantidad, plegado, children,
}: {
  titulo: string;
  tono: "peligro" | "alerta" | "neutro";
  total: number;
  cantidad: number;
  /** Se muestra cerrado, con su cantidad y total a la vista. */
  plegado?: boolean;
  children: React.ReactNode;
}) {
  if (cantidad === 0) return null;
  const color = tono === "peligro" ? "text-peligro" : tono === "alerta" ? "text-alerta" : "text-texto-tenue";
  const punto = tono === "peligro" ? "bg-peligro" : tono === "alerta" ? "bg-alerta" : "bg-texto-tenue";
  const encabezado = (
    <>
      <span aria-hidden="true" className={`size-2 rounded-full ${punto}`} />
      {titulo}
      <span className="font-normal normal-case tracking-normal text-texto-tenue">
        {cantidad} · {formatearCLP(total)}
      </span>
    </>
  );
  const clases = `cifra flex flex-wrap items-center gap-2 border-b border-borde px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] ${color}`;

  // Lo que no apura va plegado: con ocho cuentas programadas la lista se
  // hacia eterna y lo urgente quedaba enterrado. Se abre con un clic.
  if (plegado !== undefined) {
    return (
      <details className="group/grupo" open={!plegado}>
        <summary
          className={`${clases} min-h-11 cursor-pointer list-none transition-colors duration-150 hover:bg-superficie-tenue [&::-webkit-details-marker]:hidden`}
        >
          {encabezado}
          <span className="ml-auto flex items-center gap-1 font-normal normal-case tracking-normal text-texto-tenue">
            <span className="group-open/grupo:hidden">ver</span>
            <span className="hidden group-open/grupo:inline">ocultar</span>
            <span className="transition-transform duration-150 group-open/grupo:rotate-180">
              <Icono nombre="chevron-down" tamano={14} />
            </span>
          </span>
        </summary>
        <ul>{children}</ul>
      </details>
    );
  }

  return (
    <div>
      <h4 className={clases}>{encabezado}</h4>
      <ul>{children}</ul>
    </div>
  );
}

/**
 * Todo lo que hay que pagar este mes, ordenado por urgencia: vencidas, por
 * vencer esta semana y programadas. Lo ya pagado queda plegado al final.
 *
 * Mezcla cuentas y cuotas de deuda a proposito: a fin de mes lo que importa
 * es que falta por pagar, no de que tabla sale cada cosa. Las cuotas no
 * tienen dia de vencimiento, asi que van con las programadas.
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

  const grupos = agruparPendientes(resumen, diasEnMesISO(resumen.mes), hoy);
  const suma = (lista: readonly { monto: number }[]) => lista.reduce((s, c) => s + c.monto, 0);
  const totalProgramado =
    suma(grupos.programadas) + cuotasPendientes.reduce((s, x) => s + x.cuota.deuda.montoCuota, 0);
  const cantidadPagadas = pagadas.length + cuotasPagadas.length;

  return (
    <section
      aria-labelledby="titulo-pagos"
      className={`tarjeta-viva flex min-w-0 flex-col rounded-xl border border-borde bg-superficie shadow-sm ${
        vencidas.length > 0 ? "viva-peligro" : "viva-alerta"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg ${
              vencidas.length > 0 ? "bg-peligro/15 text-peligro" : "bg-alerta/15 text-alerta"
            }`}
          >
            <Icono nombre="receipt" tamano={20} />
          </span>
          <div className="min-w-0">
            {/* h3: vive dentro de la seccion 02 del dashboard, que ya tiene su h2. */}
            <h3 id="titulo-pagos" className="text-base font-bold">
              Pagos de <span className="capitalize">{nombreDelMes(resumen.mes).split(" ")[0]}</span>
            </h3>
            <p className="text-[13px] text-texto-tenue">
              {!hayAlgo
                ? "Sin cuentas ni cuotas este mes"
                : [
                    grupos.vencidas.length > 0 &&
                      `${grupos.vencidas.length} ${grupos.vencidas.length === 1 ? "vencida" : "vencidas"}`,
                    grupos.porVencer.length > 0 && `${grupos.porVencer.length} por vencer`,
                    grupos.programadas.length + cuotasPendientes.length > 0 &&
                      `${grupos.programadas.length + cuotasPendientes.length} ${
                        grupos.programadas.length + cuotasPendientes.length === 1 ? "programada" : "programadas"
                      }`,
                    cantidadPagadas > 0 &&
                      `${cantidadPagadas} ${cantidadPagadas === 1 ? "pagada" : "pagadas"}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
        </div>
        {hayAlgo && (
          <div className="text-right">
            <p className="text-xs text-texto-tenue">{totalPendiente > 0 ? "Falta pagar" : "Este mes"}</p>
            {totalPendiente > 0 ? (
              <p className="cifra text-xl font-bold tracking-tight">{formatearCLP(totalPendiente)}</p>
            ) : (
              <p className="text-base font-bold text-exito">todo pagado</p>
            )}
          </div>
        )}
      </div>

      {vencidas.length > 0 && (
        <p
          role="status"
          className="mx-5 mb-4 flex items-start gap-2 rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2.5 text-[13px] text-peligro"
        >
          <span className="mt-px shrink-0">
            <Icono nombre="alert" tamano={15} />
          </span>
          <span>
            {vencidas.length === 1
              ? `Tienes una cuenta vencida por ${formatearCLP(suma(grupos.vencidas))}.`
              : `Tienes ${vencidas.length} cuentas vencidas por ${formatearCLP(suma(grupos.vencidas))}.`}{" "}
            Págala{vencidas.length === 1 ? "" : "s"} hoy para evitar intereses y cobros por mora.
          </span>
        </p>
      )}

      {!hayAlgo ? (
        <p className="border-t border-borde px-5 py-8 text-center text-sm text-texto-tenue">
          No tienes cuentas ni cuotas en este mes.
        </p>
      ) : (
        <div className="border-t border-borde">
          {totalPendiente === 0 && (
            <p className="flex items-center gap-2 px-5 py-4 text-sm text-exito">
              <Icono nombre="check" tamano={16} />
              Estás al día: no queda nada por pagar este mes.
            </p>
          )}

          <Grupo titulo="Vencidas" tono="peligro" cantidad={grupos.vencidas.length} total={suma(grupos.vencidas)}>
            {grupos.vencidas.map((c) => fila(c, true))}
          </Grupo>

          <Grupo titulo="Por vencer · 7 días" tono="alerta" cantidad={grupos.porVencer.length} total={suma(grupos.porVencer)}>
            {grupos.porVencer.map((c) => fila(c, false))}
          </Grupo>

          <Grupo
            titulo="Programadas"
            tono="neutro"
            cantidad={grupos.programadas.length + cuotasPendientes.length}
            total={totalProgramado}
            plegado={grupos.vencidas.length + grupos.porVencer.length > 0}
          >
            {[...grupos.programadas.map((c) => fila(c, false)), ...cuotasPendientes.map(filaCuota)]}
          </Grupo>

          {cantidadPagadas > 0 && (
            <details className="group border-t border-borde">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 text-sm font-semibold text-texto-tenue transition-colors duration-150 hover:bg-exito/5 hover:text-texto [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <span className="text-exito">
                    <Icono nombre="check" tamano={15} />
                  </span>
                  Pagadas este mes · {cantidadPagadas}
                </span>
                <span className="flex items-center gap-2">
                  <span className="cifra font-normal">{formatearCLP(totalPagado)}</span>
                  <span className="transition-transform duration-150 group-open:rotate-180">
                    <Icono nombre="chevron-down" tamano={16} />
                  </span>
                </span>
              </summary>
              <ul className="border-t border-borde">
                {[...pagadas.map((c) => fila(c, false)), ...cuotasPagadas.map(filaCuota)]}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="mt-auto px-1 pb-1">{children}</div>
    </section>
  );
}
