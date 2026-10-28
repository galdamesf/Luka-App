import { detalleDeCategoria, type ResumenPresupuestos } from "@/dominio/presupuestos";
import type { GastoPlano } from "@/dominio/resumen";
import type { AccionFormulario } from "@/dominio/formulario";
import type { CategoriaPlana } from "@/dominio/resumen";
import { FilaPresupuesto } from "./FilaPresupuesto";
import { Icono } from "./Icono";
import { formatearCLP, listaLegible, nombreDelMes } from "./formato";

type Props = {
  resumen: ResumenPresupuestos;
  /** Los gastos del mes, para el desglose de cada categoria. */
  gastos: readonly GastoPlano[];
  diasDelMes: number;
  accionEditar: AccionFormulario;
  alEliminar: (datos: FormData) => void;
  /** El formulario para agregar, que es componente de cliente. */
  children?: React.ReactNode;
};

/**
 * Un aviso de los de arriba. Se borra solo si no hay a quien avisarle.
 *
 * `role="status"` y no `role="alert"`: esto tambien esta presente al cargar
 * la pagina, y un alert interrumpe al lector de pantalla en medio de otra
 * cosa. Lo que cambia entre un aviso y otro es el texto, no solo el color.
 */
function Aviso({
  categorias, tono, children,
}: {
  categorias: readonly CategoriaPlana[];
  tono: "peligro" | "alerta";
  children: (nombres: string) => React.ReactNode;
}) {
  if (categorias.length === 0) return null;

  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-md bg-superficie-tenue px-3 py-2 text-xs ${
        tono === "peligro" ? "text-peligro" : "text-alerta"
      }`}
    >
      <span className="mt-px shrink-0">
        <Icono nombre="alert" tamano={14} />
      </span>
      <span>{children(listaLegible(categorias.map((c) => c.nombre)))}</span>
    </p>
  );
}

/**
 * Presupuestos del mes: cuanto te pusiste de techo por categoria y cuanto
 * llevas gastado contra ese techo.
 *
 * Se definen mes a mes. Un mes nuevo arranca sin presupuestos.
 */
export function Presupuestos({
  resumen, gastos, diasDelMes, accionEditar, alEliminar, children,
}: Props) {
  const { lineas, totalPresupuestado, totalGastado, totalRestante, alertas } = resumen;

  return (
    <section
      aria-labelledby="titulo-presupuestos"
      className="rounded-lg border border-borde bg-superficie"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 p-4 pb-3">
        <h2 id="titulo-presupuestos" className="text-sm font-semibold">
          Presupuestos de <span className="capitalize">{nombreDelMes(resumen.mes)}</span>
        </h2>

        {lineas.length > 0 && (
          <p className="text-xs text-texto-tenue">
            {totalRestante < 0 ? (
              <>
                te pasaste por{" "}
                <span className="cifra font-medium text-peligro">
                  {formatearCLP(Math.abs(totalRestante))}
                </span>
              </>
            ) : (
              <>
                te quedan{" "}
                <span className="cifra font-medium text-texto">
                  {formatearCLP(totalRestante)}
                </span>{" "}
                de {formatearCLP(totalPresupuestado)}
              </>
            )}
          </p>
        )}
      </div>

      {/* Los tres avisos, de lo mas grave a lo menos. Van por separado
          porque no se arreglan igual: de "te pasaste" ya no se vuelve, de
          "llegando al limite" si. */}
      <div className="mx-4 mb-3 space-y-1.5 empty:hidden">
        <Aviso categorias={alertas.excedidas} tono="peligro">
          {(nombres) => <>Te pasaste del presupuesto en {nombres}.</>}
        </Aviso>

        <Aviso categorias={alertas.enElTope} tono="peligro">
          {(nombres) => <>Llegaste al 100% en {nombres}: ahí ya no te queda nada.</>}
        </Aviso>

        <Aviso categorias={alertas.cerca} tono="alerta">
          {(nombres) => <>Estás llegando al límite en {nombres}.</>}
        </Aviso>
      </div>

      {lineas.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-texto-tenue">
          No tienes presupuestos este mes. Ponle un techo a una categoría y acá vas a ver
          cuánto te queda.
        </p>
      ) : (
        <ul className="border-t border-borde px-4">
          {lineas.map((linea) => (
            <FilaPresupuesto
              key={linea.presupuesto.id}
              linea={linea}
              detalle={detalleDeCategoria(
                gastos,
                linea.presupuesto.categoria.id,
                resumen.mes,
                diasDelMes,
              )}
              accionEditar={accionEditar}
              alEliminar={alEliminar}
            />
          ))}
        </ul>
      )}

      {lineas.length > 0 && (
        <p className="px-4 pt-3 pb-1 text-xs text-texto-tenue">
          Llevas <span className="cifra">{formatearCLP(totalGastado)}</span> gastados de{" "}
          <span className="cifra">{formatearCLP(totalPresupuestado)}</span> presupuestados.
        </p>
      )}

      {children}
    </section>
  );
}
