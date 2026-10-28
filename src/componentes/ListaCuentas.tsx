import type { ResumenCuentas } from "@/dominio/cuentas";
import type { CategoriaPlana } from "@/dominio/resumen";
import type { AccionFormulario } from "@/dominio/formulario";
import { Icono } from "./Icono";
import { FilaCuenta } from "./FilaCuenta";
import { formatearCLP, nombreDelMes } from "./formato";

type Props = {
  resumen: ResumenCuentas;
  hoy: string;
  categorias: readonly CategoriaPlana[];
  accionPagar: AccionFormulario;
  accionEditar: AccionFormulario;
  alMarcarPagada: AccionFormulario;
  alEliminar: (datos: FormData) => void;
  alRevertir: AccionFormulario;
  /** El formulario para agregar, que es componente de cliente. */
  children?: React.ReactNode;
};

export function ListaCuentas({
  resumen, hoy, categorias, accionPagar, accionEditar, alMarcarPagada, alEliminar,
  alRevertir, children,
}: Props) {
  const { pendientes, pagadas, vencidas, totalPendiente, totalPagado } = resumen;
  const vencidasPorId = new Set(vencidas.map((c) => c.id));
  const hayAlgo = pendientes.length > 0 || pagadas.length > 0;

  return (
    <section
      aria-labelledby="titulo-cuentas"
      className="rounded-lg border border-borde bg-superficie"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-3">
        <h2 id="titulo-cuentas" className="text-sm font-semibold">
          Cuentas de <span className="capitalize">{nombreDelMes(resumen.mes)}</span>
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
        <p
          role="status"
          className="mx-4 mb-3 flex items-center gap-2 rounded-md bg-superficie-tenue px-3 py-2 text-xs text-peligro"
        >
          <Icono nombre="alert" tamano={14} />
          <span>
            {vencidas.length === 1
              ? "Hay una cuenta vencida sin pagar."
              : `Hay ${vencidas.length} cuentas vencidas sin pagar.`}
          </span>
        </p>
      )}

      {!hayAlgo ? (
        <p className="px-4 py-8 text-center text-sm text-texto-tenue">
          No tienes cuentas registradas en este mes.
        </p>
      ) : (
        <>
          {/* Dos secciones con encabezado propio: lo que falta y lo que ya
              salio. Antes solo las pagadas tenian titulo y la lista de arriba
              se leia como "todas las cuentas". */}
          {pendientes.length > 0 && (
            <p className="flex flex-wrap items-baseline justify-between gap-2 border-t border-borde px-4 pt-3 pb-1 text-xs font-medium tracking-wide text-texto-tenue uppercase">
              <span>Por pagar</span>
              <span className="cifra normal-case">{formatearCLP(totalPendiente)}</span>
            </p>
          )}

          <ul className={pendientes.length > 0 ? "" : "border-t border-borde"}>
            {pendientes.map((cuenta) => (
              <FilaCuenta
                key={cuenta.id}
                cuenta={cuenta}
                vencida={vencidasPorId.has(cuenta.id)}
                hoy={hoy}
                categorias={categorias}
                accionEditar={accionEditar}
                alMarcarPagada={alMarcarPagada}
                accionPagar={accionPagar}
                alEliminar={alEliminar}
                alRevertir={alRevertir}
              />
            ))}
          </ul>

          {pagadas.length > 0 && (
            <>
              <p className="flex flex-wrap items-baseline justify-between gap-2 border-t border-borde px-4 pt-3 pb-1 text-xs font-medium tracking-wide text-texto-tenue uppercase">
                <span>Pagadas</span>
                <span className="cifra normal-case">{formatearCLP(totalPagado)}</span>
              </p>
              <ul>
                {pagadas.map((cuenta) => (
                  <FilaCuenta
                    key={cuenta.id}
                    cuenta={cuenta}
                    vencida={false}
                    hoy={hoy}
                    categorias={categorias}
                    accionEditar={accionEditar}
                    alMarcarPagada={alMarcarPagada}
                    accionPagar={accionPagar}
                    alEliminar={alEliminar}
                    alRevertir={alRevertir}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {children}
    </section>
  );
}
