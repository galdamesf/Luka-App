import type { GastoPlano } from "@/dominio/resumen";
import { ETIQUETA_MEDIO_PAGO } from "@/dominio/esquemas";
import { Icono } from "./Icono";
import { VisorBoleta } from "./VisorBoleta";
import { AdjuntarBoleta } from "./AdjuntarBoleta";
import { ConfirmarEliminar } from "./ConfirmarEliminar";
import type { AccionFormulario } from "@/dominio/formulario";
import { fechaCorta, formatearCLP } from "./formato";

type Props = {
  gastos: readonly GastoPlano[];
  /** Server Action de borrado. Se omite en el render de prueba. */
  alEliminar?: (datos: FormData) => void;
  /** Accion para adjuntar la foto de la boleta. */
  accionBoleta?: AccionFormulario;
  /** Lo que va entre el titulo y la lista: buscador y filtros. */
  herramientas?: React.ReactNode;
  /** Que decir cuando no hay nada que mostrar. */
  mensajeVacio?: string;
  /** h2 suelta (el informe) o h3 dentro de una seccion (el dashboard). */
  nivelTitulo?: "h2" | "h3";
  /** Lo que va al final de la tarjeta: el boton de "Ver todos". */
  pie?: React.ReactNode;
};

/**
 * En escritorio es una tabla; en celular, tarjetas.
 *
 * Se renderiza dos veces a proposito. La alternativa era una tabla con scroll
 * horizontal, y ahi el monto —lo que uno viene a mirar— queda fuera de
 * pantalla. Como la version oculta usa `display:none`, tampoco la anuncia el
 * lector de pantalla, asi que no se escucha duplicado.
 */

function PuntoCategoria({ gasto }: { gasto: GastoPlano }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: gasto.categoria.color }}
      />
      <span className="shrink-0" style={{ color: gasto.categoria.color }}>
        <Icono nombre={gasto.categoria.icono} tamano={14} />
      </span>
      <span className="truncate text-texto-tenue">{gasto.categoria.nombre}</span>
    </span>
  );
}

/** Lo que conviene saber antes de borrar un pago: lo que se deshace con el. */
function avisoAlBorrar(gasto: GastoPlano): string | null {
  if (gasto.cuota !== null) {
    return `Es el pago de la cuota de ${gasto.cuota.deudaNombre}: la cuota vuelve a quedar pendiente en Pagos del mes.`;
  }
  if (gasto.cuenta != null) {
    return `Es el pago de la cuenta «${gasto.cuenta.nombre}»: la cuenta vuelve a quedar pendiente en Pagos del mes.`;
  }
  return null;
}

function BotonEliminar({
  gasto,
  alEliminar,
  compacto,
}: {
  gasto: GastoPlano;
  alEliminar?: (datos: FormData) => void;
  compacto?: boolean;
}) {
  // Sin accion no se dibuja. Un <form> sin action se envia a la URL actual:
  // no borraria nada, pero ofrecer un boton que no hace lo que dice es peor
  // que no ofrecerlo. En el informe la tabla es de solo lectura.
  if (alEliminar === undefined) return null;

  return (
    <ConfirmarEliminar
      id={gasto.id}
      accion={alEliminar}
      compacto={compacto}
      queEs={
        <>
          «{gasto.descripcion}» por <span className="cifra">{formatearCLP(gasto.monto)}</span>
        </>
      }
      etiqueta={`Eliminar ${gasto.descripcion} por ${formatearCLP(gasto.monto)}`}
      aviso={avisoAlBorrar(gasto)}
    />
  );
}

/**
 * Marca los gastos que son el pago de una cuota de deuda. Borrar uno de esos
 * deja la cuota pendiente otra vez, y conviene que se note antes de hacerlo.
 */
function MarcaCuota({ gasto }: { gasto: GastoPlano }) {
  if (gasto.cuota === null) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded bg-superficie-tenue px-1.5 py-0.5 text-[11px] font-medium text-texto-tenue">
      <Icono nombre="credit-card" tamano={11} />
      cuota de deuda
    </span>
  );
}

/** Enlace a la boleta, o el boton para adjuntarla si todavia no tiene. */
function Boleta({
  gasto,
  accionBoleta,
}: {
  gasto: GastoPlano;
  accionBoleta?: AccionFormulario;
}) {
  if (gasto.boletaArchivo !== null) {
    return <VisorBoleta archivo={gasto.boletaArchivo} descripcion={gasto.descripcion} />;
  }
  if (accionBoleta === undefined) return null;
  return (
    <AdjuntarBoleta
      gastoId={gasto.id}
      descripcion={gasto.descripcion}
      accion={accionBoleta}
    />
  );
}

export function TablaGastos({
  gastos, alEliminar, accionBoleta, herramientas,
  mensajeVacio = "Todavía no hay gastos registrados en este mes.",
  nivelTitulo = "h2",
  pie,
}: Props) {
  const Titulo = nivelTitulo;
  return (
    <section
      aria-labelledby="titulo-gastos"
      className="tarjeta-viva overflow-hidden rounded-xl border border-borde bg-superficie shadow-sm"
    >
      <Titulo id="titulo-gastos" className="border-b border-borde p-5 text-base font-bold">
        Gastos del mes
      </Titulo>

      {herramientas}

      {gastos.length === 0 ? (
        <p className="py-12 text-center text-sm text-texto-tenue">{mensajeVacio}</p>
      ) : (
        <>
          {/* --- Celular: una tarjeta por gasto, sin scroll lateral --- */}
          <ul id="lista-gastos" className="sm:hidden">
            {gastos.map((gasto) => (
              <li
                key={gasto.id}
                className="fila-viva flex items-start gap-3 border-b border-borde px-4 py-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{gasto.descripcion}</p>
                  <p className="cifra mt-0.5 text-xs text-texto-tenue">
                    {fechaCorta(gasto.fecha)} · {ETIQUETA_MEDIO_PAGO[gasto.medioPago]}
                  </p>
                  {gasto.cuota !== null && (
                    <div className="mt-1">
                      <MarcaCuota gasto={gasto} />
                    </div>
                  )}
                  {/* div y no p: Boleta puede renderizar un <details> con un
                      <form> dentro, y HTML no admite bloques dentro de un
                      parrafo. El navegador cerraba el <p> solo y la
                      hidratacion fallaba. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <PuntoCategoria gasto={gasto} />
                    <Boleta gasto={gasto} accionBoleta={accionBoleta} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="cifra text-sm font-semibold tabular-nums">
                    {formatearCLP(gasto.monto)}
                  </span>
                  <BotonEliminar gasto={gasto} alEliminar={alEliminar} />
                </div>
              </li>
            ))}
          </ul>

          {/* --- Escritorio: tabla --- */}
          <table id="tabla-gastos" className="hidden w-full text-sm sm:table">
            <caption className="sr-only">
              Gastos del mes, del más reciente al más antiguo
            </caption>
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-tenue">
                <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                <th scope="col" className="px-4 py-2 font-medium">Descripción</th>
                <th scope="col" className="px-4 py-2 font-medium">Categoría</th>
                <th scope="col" className="px-4 py-2 font-medium">Boleta</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Monto</th>
                {alEliminar !== undefined && (
                  <th scope="col" className="px-4 py-2">
                    <span className="sr-only">Acciones</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {gastos.map((gasto) => (
                <tr
                  key={gasto.id}
                  className="fila-viva border-b border-borde last:border-0"
                >
                  <td className="cifra whitespace-nowrap px-4 py-2.5 text-texto-tenue">
                    {fechaCorta(gasto.fecha)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block">{gasto.descripcion}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-texto-tenue">
                      {ETIQUETA_MEDIO_PAGO[gasto.medioPago]}
                      <MarcaCuota gasto={gasto} />
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <PuntoCategoria gasto={gasto} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Boleta gasto={gasto} accionBoleta={accionBoleta} />
                  </td>
                  <td className="cifra whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">
                    {formatearCLP(gasto.monto)}
                  </td>
                  {alEliminar !== undefined && (
                    <td className="px-4 py-2.5 text-right">
                      <BotonEliminar gasto={gasto} alEliminar={alEliminar} compacto />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {pie}
    </section>
  );
}
