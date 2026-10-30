import { ETIQUETA_MEDIO_PAGO } from "@/dominio/esquemas";
import type { ReporteSemanal } from "@/dominio/reporte-semanal";
import { Icono } from "./Icono";
import { VisorBoleta } from "./VisorBoleta";
import { FichaTono } from "./FichaTono";
import { NIVEL } from "./niveles-semana";
import { fechaLarga, formatearCLP, nombreDelMes, porcentajeLegible } from "./formato";
import { COMO_SE_LEE, comparacionConAnterior } from "./textos-reporte";

const UN_DECIMAL = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const TH = "px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-texto-tenue";
const TARJETA = "rounded-xl border border-borde bg-superficie shadow-sm";

function TituloSeccion({ id, children, nota }: { id: string; children: React.ReactNode; nota?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="flex items-center gap-2 text-base font-bold">
        <span aria-hidden="true" className="h-4 w-1 rounded-full bg-accion" />
        {children}
      </h2>
      {nota && <p className="text-xs text-texto-tenue">{nota}</p>}
    </div>
  );
}

/**
 * El reporte de una semana en pantalla. Dice exactamente lo mismo que el PDF
 * (los dos salen de armarReporteSemanal y de textos-reporte), pero con los
 * colores del tema y las boletas a un clic.
 */
export function ReporteSemanalVista({ reporte }: { reporte: ReporteSemanal }) {
  const [nombreMes] = nombreDelMes(reporte.mes).split(" ");
  const nivel = reporte.nivel === null ? null : NIVEL[reporte.nivel.nivel];
  const parte = (monto: number) => (reporte.total === 0 ? "0%" : porcentajeLegible((monto / reporte.total) * 100));
  const principal = reporte.categorias[0];
  const maximoDia = Math.max(0, ...reporte.dias.map((d) => d.total));
  const hayAnterior = reporte.anterior !== null;
  const diasConGastos = reporte.dias.filter((d) => d.gastos.length > 0);
  // El numero de cada gasto, corrido en toda la semana: igual en la tabla, en
  // la lista del celular y en el PDF.
  const numeros = new Map(diasConGastos.flatMap((d) => d.gastos).map((g, i) => [g.id, i + 1]));

  return (
    <div className="space-y-8">
      {/* --- Las cuatro cifras --- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={`tarjeta-viva viva-violeta flex min-w-0 items-start gap-3 p-4 ${TARJETA}`}>
          <FichaTono tono="violeta" icono="receipt" />
          <div className="min-w-0">
            <p className="text-xs text-texto-tenue">Total de la semana</p>
            <p className="cifra mt-1 text-xl font-bold tracking-tight">{formatearCLP(reporte.total)}</p>
            <p className="mt-0.5 text-xs text-texto-tenue">
              {reporte.cantidad === 0
                ? "Sin gastos registrados"
                : `${plural(reporte.cantidad, "gasto", "gastos")} · ${reporte.conBoleta} con boleta`}
            </p>
          </div>
        </div>
        <div className={`tarjeta-viva viva-cielo flex min-w-0 items-start gap-3 p-4 ${TARJETA}`}>
          <FichaTono tono="cielo" icono="clock" />
          <div className="min-w-0">
            <p className="text-xs text-texto-tenue">Promedio diario</p>
            <p className="cifra mt-1 text-xl font-bold tracking-tight">
              {reporte.promedioDiario === null ? "—" : formatearCLP(reporte.promedioDiario)}
            </p>
            <p className="mt-0.5 text-xs text-texto-tenue">
              {reporte.diasTranscurridos === 0
                ? "La semana no empieza"
                : `Sobre ${plural(reporte.diasTranscurridos, "día", "días")}${reporte.estado === "en-curso" ? " que van" : ""}`}
            </p>
          </div>
        </div>
        <div className={`tarjeta-viva viva-esmeralda flex min-w-0 items-start gap-3 p-4 ${TARJETA}`}>
          <FichaTono tono="esmeralda" icono="calendar" />
          <div className="min-w-0">
            <p className="text-xs text-texto-tenue">Parte del mes</p>
            <p className="cifra mt-1 text-xl font-bold tracking-tight">
              {reporte.porcentajeDelMes === null ? "—" : porcentajeLegible(reporte.porcentajeDelMes)}
            </p>
            <p className="mt-0.5 text-xs text-texto-tenue">
              De {formatearCLP(reporte.totalDelMes)} en {nombreMes}
            </p>
          </div>
        </div>
        <div className={`tarjeta-viva ${nivel?.viva ?? "viva-accion"} flex min-w-0 items-start gap-3 p-4 ${TARJETA}`}>
          <span
            aria-hidden="true"
            className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg border ${nivel?.pildora ?? "border-borde bg-superficie-tenue text-texto-tenue"}`}
          >
            <Icono nombre="activity" tamano={18} />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-texto-tenue">Ritmo discrecional</p>
            <p className={`mt-1 text-xl font-bold tracking-tight ${nivel?.texto ?? "text-texto-tenue"}`}>
              {nivel?.nombre ?? "Sin dato"}
            </p>
            <p className="mt-0.5 text-xs text-texto-tenue">
              {reporte.nivel === null
                ? "Aún no hay con qué medirlo"
                : `${UN_DECIMAL.format(reporte.nivel.veces)}× tu promedio diario del mes`}
            </p>
          </div>
        </div>
      </div>

      {/* --- Esencial contra discrecional, y contra la semana anterior --- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="t-tipo" className={`p-5 ${TARJETA}`}>
          <h2 id="t-tipo" className="text-sm font-bold">
            Esencial y discrecional
          </h2>
          <div aria-hidden="true" className="mt-3 flex h-3 overflow-hidden rounded-full bg-superficie-tenue">
            {reporte.total > 0 && (
              <>
                <span className="bg-tono-cielo" style={{ width: `${(reporte.esenciales / reporte.total) * 100}%` }} />
                <span className="bg-tono-fucsia" style={{ width: `${(reporte.discrecionales / reporte.total) * 100}%` }} />
              </>
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-texto-tenue">
                <span aria-hidden="true" className="size-2.5 rounded-sm bg-tono-cielo" />
                Esencial
              </dt>
              <dd className="cifra mt-0.5 font-bold">
                {formatearCLP(reporte.esenciales)} <span className="font-normal text-texto-tenue">· {parte(reporte.esenciales)}</span>
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-texto-tenue">
                <span aria-hidden="true" className="size-2.5 rounded-sm bg-tono-fucsia" />
                Discrecional
              </dt>
              <dd className="cifra mt-0.5 font-bold">
                {formatearCLP(reporte.discrecionales)}{" "}
                <span className="font-normal text-texto-tenue">· {parte(reporte.discrecionales)}</span>
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="t-anterior" className={`p-5 ${TARJETA}`}>
          <h2 id="t-anterior" className="text-sm font-bold">
            Contra la semana anterior
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {comparacionConAnterior(reporte).map((linea) => (
              <li
                key={linea.texto}
                className={`flex items-start gap-2 ${
                  linea.tono === "sube" ? "font-semibold text-peligro" : linea.tono === "baja" ? "font-semibold text-exito" : "text-texto-tenue"
                }`}
              >
                {linea.tono !== "neutro" && (
                  <span className="mt-0.5 shrink-0">
                    <Icono nombre={linea.tono === "sube" ? "trending-up" : "trending-down"} tamano={16} />
                  </span>
                )}
                {linea.texto}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* --- Lo mas destacado --- */}
      {reporte.cantidad > 0 && (
        <section aria-labelledby="t-destacado">
          <TituloSeccion id="t-destacado">Lo más destacado</TituloSeccion>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                nombre: "Mayor gasto",
                valor: reporte.mayorGasto?.descripcion ?? "—",
                nota: reporte.mayorGasto
                  ? `${formatearCLP(reporte.mayorGasto.monto)} · ${reporte.mayorGasto.categoria.nombre} · ${fechaLarga(reporte.mayorGasto.fecha)}`
                  : "",
              },
              {
                nombre: "Día con más gasto",
                valor: reporte.diaMasAlto ? capitalizar(fechaLarga(reporte.diaMasAlto.fecha)) : "—",
                nota: reporte.diaMasAlto ? formatearCLP(reporte.diaMasAlto.total) : "",
              },
              {
                nombre: "Categoría principal",
                valor: principal?.categoria.nombre ?? "—",
                nota: principal ? `${formatearCLP(principal.total)} · ${porcentajeLegible(principal.porcentaje)} de la semana` : "",
              },
              {
                nombre: "Boletas adjuntas",
                valor: `${reporte.conBoleta} de ${reporte.cantidad}`,
                nota:
                  reporte.cantidad === reporte.conBoleta
                    ? "Todos los gastos tienen boleta"
                    : `${plural(reporte.cantidad - reporte.conBoleta, "gasto", "gastos")} sin boleta`,
              },
            ].map((d) => (
              <div key={d.nombre} className={`tarjeta-viva min-w-0 p-4 ${TARJETA}`}>
                <dt className="text-xs text-texto-tenue">{d.nombre}</dt>
                <dd className="mt-1 truncate text-[15px] font-bold" title={d.valor}>
                  {d.valor}
                </dd>
                <dd className="mt-0.5 text-xs text-texto-tenue">{d.nota}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* --- Por categoria --- */}
      {reporte.categorias.length > 0 && (
        <section aria-labelledby="t-categorias">
          <TituloSeccion
            id="t-categorias"
            nota={hayAnterior ? `"Semana ${reporte.semana - 1}" es lo que sumó cada categoría la semana anterior.` : undefined}
          >
            Por categoría
          </TituloSeccion>
          <div className={`overflow-x-auto ${TARJETA}`}>
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">Gasto de la semana por categoría</caption>
              <thead className="border-b border-borde bg-superficie-tenue">
                <tr>
                  <th scope="col" className={`${TH} text-left`}>Categoría</th>
                  <th scope="col" className={`${TH} text-left`}>Tipo</th>
                  <th scope="col" className={`${TH} text-right`}>Gastos</th>
                  <th scope="col" className={`${TH} text-right`}>Monto</th>
                  <th scope="col" className={`${TH} text-right`}>% semana</th>
                  {hayAnterior && (
                    <>
                      <th scope="col" className={`${TH} text-right`}>Semana {reporte.semana - 1}</th>
                      <th scope="col" className={`${TH} text-right`}>Diferencia</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {reporte.categorias.map((c) => {
                  const diferencia = c.total - (c.anterior ?? 0);
                  return (
                    <tr key={c.categoria.id} className="fila-viva border-b border-borde last:border-b-0">
                      <th scope="row" className="px-3 py-2.5 text-left font-medium">
                        <span className="flex items-center gap-2">
                          <span className="shrink-0" style={{ color: c.categoria.color }}>
                            <Icono nombre={c.categoria.icono} tamano={16} />
                          </span>
                          {c.categoria.nombre}
                        </span>
                      </th>
                      <td className="px-3 py-2.5 text-texto-tenue">{c.categoria.esencial ? "Esencial" : "Discrecional"}</td>
                      <td className="cifra px-3 py-2.5 text-right">{c.cantidad}</td>
                      <td className="cifra px-3 py-2.5 text-right font-bold">{formatearCLP(c.total)}</td>
                      <td className="cifra px-3 py-2.5 text-right text-texto-tenue">{porcentajeLegible(c.porcentaje)}</td>
                      {hayAnterior && (
                        <>
                          <td className="cifra px-3 py-2.5 text-right text-texto-tenue">{formatearCLP(c.anterior ?? 0)}</td>
                          <td
                            className={`cifra px-3 py-2.5 text-right font-semibold ${
                              diferencia > 0 ? "text-peligro" : diferencia < 0 ? "text-exito" : "text-texto-tenue"
                            }`}
                          >
                            {diferencia === 0 ? "=" : `${diferencia > 0 ? "+" : "−"}${formatearCLP(Math.abs(diferencia))}`}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-borde bg-superficie-tenue font-bold">
                <tr>
                  <th scope="row" className="px-3 py-2.5 text-left">Total</th>
                  <td />
                  <td className="cifra px-3 py-2.5 text-right">{reporte.cantidad}</td>
                  <td className="cifra px-3 py-2.5 text-right">{formatearCLP(reporte.total)}</td>
                  <td className="cifra px-3 py-2.5 text-right">100%</td>
                  {hayAnterior && (
                    <>
                      <td className="cifra px-3 py-2.5 text-right">
                        {formatearCLP(reporte.categorias.reduce((suma, c) => suma + (c.anterior ?? 0), 0))}
                      </td>
                      <td />
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* --- Medios de pago y dia por dia --- */}
      <div className="grid items-start gap-4 lg:grid-cols-5">
        {reporte.medios.length > 0 && (
          <section aria-labelledby="t-medios" className="lg:col-span-2">
            <TituloSeccion id="t-medios">Por medio de pago</TituloSeccion>
            <ul className={`divide-y divide-borde ${TARJETA}`}>
              {reporte.medios.map((m) => (
                <li key={m.medio} className="fila-viva grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3">
                  <span className="text-sm font-medium">
                    {m.nombre} <span className="text-xs font-normal text-texto-tenue">· {plural(m.cantidad, "gasto", "gastos")}</span>
                  </span>
                  <span className="cifra text-sm font-bold">{formatearCLP(m.total)}</span>
                  <span aria-hidden="true" className="col-span-2 block h-1.5 overflow-hidden rounded-full bg-superficie-tenue">
                    <span className="block h-full rounded-full bg-tono-violeta" style={{ width: `${m.porcentaje}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="t-dias" className={reporte.medios.length > 0 ? "lg:col-span-3" : "lg:col-span-5"}>
          <TituloSeccion id="t-dias">Día por día</TituloSeccion>
          <ul className={`divide-y divide-borde ${TARJETA}`}>
            {reporte.dias.map((d) => (
              <li
                key={d.fecha}
                className={`fila-viva grid grid-cols-[9.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm ${
                  d.transcurrido ? "" : "text-texto-tenue"
                }`}
              >
                <span className="font-medium">{capitalizar(fechaLarga(d.fecha))}</span>
                <span aria-hidden="true" className="block h-2 overflow-hidden rounded-full bg-superficie-tenue">
                  {d.total > 0 && (
                    <span className="block h-full rounded-full bg-accion" style={{ width: `${(d.total / maximoDia) * 100}%` }} />
                  )}
                </span>
                <span className="cifra text-right">
                  {d.transcurrido ? (
                    <>
                      <span className={d.total > 0 ? "font-bold" : "text-texto-tenue"}>{formatearCLP(d.total)}</span>
                      <span className="ml-2 text-xs text-texto-tenue">{plural(d.gastos.length, "gasto", "gastos")}</span>
                    </>
                  ) : (
                    "Por venir"
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* --- Cada gasto --- */}
      <section aria-labelledby="t-detalle">
        <TituloSeccion id="t-detalle" nota={reporte.cantidad > 0 ? `${plural(reporte.cantidad, "gasto", "gastos")} · ${formatearCLP(reporte.total)}` : undefined}>
          Detalle de gastos
        </TituloSeccion>
        {reporte.cantidad === 0 ? (
          <p className={`p-5 text-sm text-texto-tenue ${TARJETA}`}>
            {reporte.estado === "por-venir" ? "La semana todavía no empieza." : "No hay gastos registrados en esta semana."}
          </p>
        ) : (
          <>
          {/* En el celular, una tarjeta por dia: la tabla de seis columnas no cabe. */}
          <div className="space-y-4 sm:hidden">
            {diasConGastos.map((d) => (
              <div key={d.fecha} className={`overflow-hidden ${TARJETA}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 bg-accion/5 px-4 py-2.5">
                  <span className="font-bold text-accion-tinta">{capitalizar(fechaLarga(d.fecha))}</span>
                  <span className="cifra text-xs text-texto-tenue">
                    {plural(d.gastos.length, "gasto", "gastos")} · {formatearCLP(d.total)}
                  </span>
                </div>
                <ul className="divide-y divide-borde">
                  {d.gastos.map((g) => (
                    <li key={g.id} className="fila-viva px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">
                            <span className="cifra mr-1.5 text-xs text-texto-tenue">{numeros.get(g.id)}.</span>
                            {g.descripcion}
                          </p>
                          {g.notas && <p className="mt-0.5 text-xs italic text-texto-tenue">{g.notas}</p>}
                        </div>
                        <span className="cifra shrink-0 font-bold">{formatearCLP(g.monto)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-texto-tenue">
                        <span className="flex items-center gap-1.5">
                          <span style={{ color: g.categoria.color }}>
                            <Icono nombre={g.categoria.icono} tamano={14} />
                          </span>
                          {g.categoria.nombre}
                        </span>
                        <span>{ETIQUETA_MEDIO_PAGO[g.medioPago]}</span>
                        {g.boletaArchivo ? (
                          <div>
                            <VisorBoleta archivo={g.boletaArchivo} descripcion={g.descripcion} />
                          </div>
                        ) : (
                          <span>Sin boleta</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className={`flex items-center justify-between bg-superficie-tenue px-4 py-3 text-sm font-bold ${TARJETA}`}>
              <span>
                Total · {plural(reporte.cantidad, "gasto", "gastos")}
                <span className="ml-2 text-xs font-normal text-texto-tenue">{reporte.conBoleta} con boleta</span>
              </span>
              <span className="cifra">{formatearCLP(reporte.total)}</span>
            </div>
          </div>

          <div className={`hidden overflow-x-auto sm:block ${TARJETA}`}>
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">Cada gasto de la semana, agrupado por día</caption>
              <thead className="border-b border-borde bg-superficie-tenue">
                <tr>
                  <th scope="col" className={`${TH} w-10 text-right`}>#</th>
                  <th scope="col" className={`${TH} text-left`}>Descripción</th>
                  <th scope="col" className={`${TH} text-left`}>Categoría</th>
                  <th scope="col" className={`${TH} text-left`}>Medio</th>
                  <th scope="col" className={`${TH} text-left`}>Boleta</th>
                  <th scope="col" className={`${TH} text-right`}>Monto</th>
                </tr>
              </thead>
              {diasConGastos.map((d) => (
                  <tbody key={d.fecha} className="border-b border-borde last:border-b-0">
                    <tr className="bg-accion/5">
                      <th scope="colgroup" colSpan={6} className="px-3 py-2 text-left">
                        <span className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-bold text-accion-tinta">{capitalizar(fechaLarga(d.fecha))}</span>
                          <span className="cifra text-xs font-normal text-texto-tenue">
                            {plural(d.gastos.length, "gasto", "gastos")} · {formatearCLP(d.total)}
                          </span>
                        </span>
                      </th>
                    </tr>
                    {d.gastos.map((g) => {
                      return (
                        <tr key={g.id} className="fila-viva border-t border-borde align-top">
                          <td className="cifra px-3 py-2.5 text-right text-xs text-texto-tenue">{numeros.get(g.id)}</td>
                          <td className="px-3 py-2.5">
                            <span className="block font-medium">{g.descripcion}</span>
                            {g.notas && <span className="mt-0.5 block text-xs italic text-texto-tenue">{g.notas}</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2">
                              <span className="shrink-0" style={{ color: g.categoria.color }}>
                                <Icono nombre={g.categoria.icono} tamano={15} />
                              </span>
                              {g.categoria.nombre}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-texto-tenue">{ETIQUETA_MEDIO_PAGO[g.medioPago]}</td>
                          <td className="px-3 py-1.5">
                            {g.boletaArchivo ? (
                              <VisorBoleta archivo={g.boletaArchivo} descripcion={g.descripcion} />
                            ) : (
                              <span className="text-xs text-texto-tenue">Sin boleta</span>
                            )}
                          </td>
                          <td className="cifra px-3 py-2.5 text-right font-bold">{formatearCLP(g.monto)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              <tfoot className="border-t border-borde bg-superficie-tenue font-bold">
                <tr>
                  <td />
                  <th scope="row" className="px-3 py-2.5 text-left">
                    Total · {plural(reporte.cantidad, "gasto", "gastos")}
                  </th>
                  <td colSpan={2} />
                  <td className="px-3 py-2.5 text-xs font-normal text-texto-tenue">
                    {reporte.conBoleta} de {reporte.cantidad} con boleta
                  </td>
                  <td className="cifra px-3 py-2.5 text-right">{formatearCLP(reporte.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          </>
        )}
      </section>

      {/* --- Cuotas --- */}
      {reporte.cuotas.length > 0 && (
        <section aria-labelledby="t-cuotas">
          <TituloSeccion id="t-cuotas" nota="No suman al total de la semana: el balance ya las descuenta del sueldo.">
            Cuotas de deudas pagadas esta semana
          </TituloSeccion>
          <ul className={`divide-y divide-borde overflow-hidden ${TARJETA}`}>
            {reporte.cuotas.map((c) => (
              <li key={c.id} className="fila-viva viva-avance flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span>
                  <span className="font-semibold">{c.cuota?.deudaNombre ?? c.descripcion}</span>
                  <span className="ml-2 text-xs text-texto-tenue">{capitalizar(fechaLarga(c.fecha))}</span>
                </span>
                <span className="cifra font-bold">{formatearCLP(c.monto)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between bg-superficie-tenue px-4 py-3 text-sm font-bold">
              <span>Total en cuotas</span>
              <span className="cifra">{formatearCLP(reporte.totalCuotas)}</span>
            </li>
          </ul>
        </section>
      )}

      <p className="border-t border-borde pt-4 text-xs leading-relaxed text-texto-tenue">
        <span className="font-semibold">Cómo se lee:</span> {COMO_SE_LEE.charAt(0).toLowerCase()}
        {COMO_SE_LEE.slice(1)}
      </p>
    </div>
  );
}
