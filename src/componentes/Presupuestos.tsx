import { detalleDeCategoria, type ResumenPresupuestos } from "@/dominio/presupuestos";
import type { GastoPlano } from "@/dominio/resumen";
import type { AccionFormulario } from "@/dominio/formulario";
import type { CategoriaPlana } from "@/dominio/resumen";
import { ListaPresupuestos } from "./ListaPresupuestos";
import { Icono } from "./Icono";
import { formatearCLP, listaLegible, nombreDelMes } from "./formato";

type Props = {
  resumen: ResumenPresupuestos;
  /** Los gastos del mes, para el desglose de cada categoria. */
  gastos: readonly GastoPlano[];
  diasDelMes: number;
  accionEditar: AccionFormulario;
  alEliminar: (datos: FormData) => void;
  /** Lo que falta pagar en cuentas, por id de categoria. */
  comprometidoPorCategoria?: Readonly<Record<string, number>>;
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
  resumen, gastos, diasDelMes, accionEditar, alEliminar, comprometidoPorCategoria = {}, children,
}: Props) {
  const { lineas, totalPresupuestado, totalGastado, totalRestante, alertas } = resumen;

  return (
    <section
      aria-labelledby="titulo-presupuestos"
      className="tarjeta-viva rounded-xl border border-borde bg-superficie shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 p-5 pb-3">
        {/* h3: vive dentro de la seccion 05 del dashboard, que ya tiene su h2. */}
        <h3 id="titulo-presupuestos" className="text-base font-bold">
          Presupuestos de <span className="capitalize">{nombreDelMes(resumen.mes)}</span>
        </h3>

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
      <div className="mx-5 mb-3 space-y-1.5 empty:hidden">
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
        <ListaPresupuestos
          items={lineas.map((linea) => ({
            linea,
            detalle: detalleDeCategoria(gastos, linea.presupuesto.categoria.id, resumen.mes, diasDelMes),
            comprometido: comprometidoPorCategoria[linea.presupuesto.categoria.id] ?? 0,
          }))}
          accionEditar={accionEditar}
          alEliminar={alEliminar}
        />
      )}

      {lineas.length > 0 && (
        <p className="px-5 pt-3 pb-1 text-xs text-texto-tenue">
          Llevas <span className="cifra">{formatearCLP(totalGastado)}</span> gastados de{" "}
          <span className="cifra">{formatearCLP(totalPresupuestado)}</span> presupuestados.
        </p>
      )}

      {children}
    </section>
  );
}
