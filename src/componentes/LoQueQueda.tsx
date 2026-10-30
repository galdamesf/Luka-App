import type { EstadoDelMes, LoQueQueda as Queda } from "@/dominio/lo-que-queda";
import { Icono } from "./Icono";
import { TONOS, type Tono } from "./tonos";
import { formatearCLP, nombreDelMes, porcentajeLegible } from "./formato";

type Props = {
  queda: Queda;
  mes: string;
  estado: EstadoDelMes;
  diasRestantes: number;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
/** Con el menos tipografico delante del signo peso: "−$1.030.890", no "$-1.030.890". */
const conSigno = (monto: number) => (monto < 0 ? `−${formatearCLP(-monto)}` : formatearCLP(monto));

// Clases enteras: Tailwind solo genera las que ve escritas completas.
const ESTADO = {
  sobra: { texto: "text-exito", pildora: "border-exito/40 bg-exito/10 text-exito", icono: "check" },
  ajustado: { texto: "text-alerta", pildora: "border-alerta/40 bg-alerta/10 text-alerta", icono: "alert" },
  falta: { texto: "text-peligro", pildora: "border-peligro/40 bg-peligro/10 text-peligro", icono: "alert" },
} as const;

type Linea = { clave: string; nombre: string; detalle: string; monto: number; tono: Tono; destino?: string };

/**
 * La cuenta completa del mes, de arriba abajo: el sueldo, cada cosa que se
 * lleva una parte y lo que queda al final. La barra muestra lo mismo de un
 * vistazo: cada color se come un pedazo del sueldo y lo gris es lo libre.
 */
export function LoQueQueda({ queda, mes, estado, diasRestantes }: Props) {
  const [nombreMes] = nombreDelMes(mes).split(" ");
  const cerrado = estado === "cerrado";
  const estilo = ESTADO[queda.estado];

  const lineas: Linea[] = [
    {
      clave: "pagado",
      nombre: "Pagos realizados",
      detalle:
        queda.pagado.cuotas > 0
          ? `Gastos del mes ${formatearCLP(queda.pagado.gastos)} y cuotas pagadas ${formatearCLP(queda.pagado.cuotas)}`
          : "Todo lo que ya salió este mes, cuentas pagadas incluidas",
      monto: queda.pagado.total,
      tono: "violeta",
      destino: "#movimientos",
    },
    {
      clave: "cuentas",
      nombre: "Cuentas por pagar",
      detalle:
        queda.cuentasPorPagar.cantidad === 0
          ? "No queda ninguna cuenta pendiente"
          : `${plural(queda.cuentasPorPagar.cantidad, "cuenta pendiente", "cuentas pendientes")}`,
      monto: queda.cuentasPorPagar.total,
      tono: "cielo",
      destino: "#pagos",
    },
    {
      clave: "cuotas",
      nombre: "Cuotas de deudas por pagar",
      detalle:
        queda.cuotasPorPagar.cantidad === 0
          ? "No quedan cuotas por pagar este mes"
          : `${plural(queda.cuotasPorPagar.cantidad, "cuota", "cuotas")} de este mes`,
      monto: queda.cuotasPorPagar.total,
      tono: "fucsia",
      destino: "#deudas",
    },
    {
      clave: "presupuesto",
      nombre: "Presupuesto por gastar",
      detalle: cerrado
        ? "El mes cerró: lo que no se gastó ya no se descuenta"
        : queda.presupuestoPorGastar.lineas.length === 0
          ? "Ningún presupuesto tiene saldo por gastar"
          : `Lo que falta gastar en ${plural(queda.presupuestoPorGastar.lineas.length, "presupuesto", "presupuestos")}`,
      monto: queda.presupuestoPorGastar.total,
      tono: "naranja",
      destino: "#presupuestos",
    },
    {
      clave: "ahorro",
      nombre: `Ahorro de ${nombreMes}`,
      detalle:
        queda.ahorro.cantidad === 0
          ? "Todavía no apartas ahorro este mes"
          : plural(queda.ahorro.cantidad, "aporte apartado", "aportes apartados"),
      monto: queda.ahorro.total,
      tono: "esmeralda",
      destino: "#ahorros",
    },
  ];

  // La barra se mide contra el sueldo o, si no alcanza, contra todo lo que
  // se resta: asi lo que se pasa del sueldo se ve como que se pasa.
  const base = Math.max(queda.sueldo, queda.descuentos, 1);
  const ancho = (monto: number) => `${(monto / base) * 100}%`;
  const marcaSueldo = queda.estado === "falta" && queda.sueldo > 0 ? (queda.sueldo / base) * 100 : null;

  return (
    <article
      aria-labelledby="titulo-queda"
      className="tarjeta-viva viva-exito flex h-full min-w-0 flex-col gap-5 rounded-xl border border-borde bg-superficie p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 id="titulo-queda" className="text-base font-bold">
            {cerrado ? `Lo que te quedó en ${nombreMes}` : `Lo que te quedaría al cerrar ${nombreMes}`}
          </h3>
          <p className="max-w-[56ch] text-[13px] leading-snug text-texto-tenue">
            {cerrado
              ? "El sueldo menos todo lo que se pagó, lo que quedó pendiente y lo que ahorraste."
              : estado === "futuro"
                ? "Con lo que ya está programado para ese mes: cuentas, cuotas, presupuestos y ahorro."
                : "Si pagas todo lo pendiente, gastas lo que queda de tus presupuestos y apartas tu ahorro."}
          </p>
        </div>
        {!queda.sinSueldo && (
          <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${estilo.pildora}`}>
            <Icono nombre={estilo.icono} tamano={15} />
            {queda.estado === "sobra"
              ? "Te sobra"
              : queda.estado === "ajustado"
                ? "Ajustado"
                : `No alcanza: faltan ${formatearCLP(-queda.quedaria)}`}
          </span>
        )}
      </div>

      {/* --- La cifra --- */}
      {queda.sinSueldo ? (
        <div className="rounded-lg border border-dashed border-borde p-4 text-sm text-texto-tenue">
          <p className="text-lg font-bold text-texto">Falta tu sueldo</p>
          Sin él no hay de dónde restar.{" "}
          <a href="#balance" className="font-semibold text-accion-tinta underline-offset-2 hover:underline">
            Defínelo en el balance
          </a>
          . Por ahora, lo comprometido este mes suma{" "}
          <span className="cifra font-bold text-texto">{formatearCLP(queda.descuentos)}</span>.
        </div>
      ) : (
        <div className="space-y-1">
          <p className={`cifra text-4xl font-bold leading-none tracking-tight sm:text-5xl ${estilo.texto}`}>
            {conSigno(queda.quedaria)}
          </p>
          <p className="text-sm text-texto-tenue">
            {queda.porcentajeDelSueldo !== null && queda.quedaria >= 0 && (
              <>
                <span className="font-semibold text-texto">{porcentajeLegible(queda.porcentajeDelSueldo)}</span> de tu sueldo
              </>
            )}
            {queda.porDia !== null && (
              <>
                {" "}· unos <span className="cifra font-semibold text-texto">{formatearCLP(queda.porDia)}</span> por día en los{" "}
                {plural(diasRestantes, "día que queda", "días que quedan")}
              </>
            )}
            {queda.estado === "ajustado" && " · menos del 10% del sueldo: poco margen para imprevistos"}
            {queda.estado === "falta" && "Lo comprometido supera el sueldo: algo de lo de abajo tiene que bajar."}
          </p>
        </div>
      )}

      {/* --- La barra del sueldo --- */}
      {!queda.sinSueldo && (
        <div className="space-y-1.5">
          <div className="relative">
            <div
              role="img"
              aria-label={`Del sueldo de ${formatearCLP(queda.sueldo)} se van ${formatearCLP(queda.descuentos)}; ${
                queda.quedaria >= 0 ? `quedan ${formatearCLP(queda.quedaria)}` : `faltan ${formatearCLP(-queda.quedaria)}`
              }.`}
              className="flex h-4 overflow-hidden rounded-full bg-superficie-tenue"
            >
              {lineas.map((l) =>
                l.monto > 0 ? (
                  <span
                    key={l.clave}
                    className={`h-full border-r-2 border-superficie last:border-r-0 ${TONOS[l.tono].barra}`}
                    style={{ width: ancho(l.monto) }}
                  />
                ) : null,
              )}
            </div>
            {marcaSueldo !== null && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-texto"
                style={{ left: `${marcaSueldo}%` }}
              />
            )}
          </div>
          <p className="flex justify-between text-[11px] text-texto-tenue">
            <span>Lo que ya tiene destino</span>
            <span>{queda.quedaria >= 0 ? "Lo gris es lo que queda libre" : "La raya marca dónde termina tu sueldo"}</span>
          </p>
        </div>
      )}

      {/* --- La cuenta, linea por linea --- */}
      <ol className="divide-y divide-borde border-y border-borde text-sm">
        {!queda.sinSueldo && (
          <li className="flex items-center justify-between gap-3 py-2.5">
            <span className="font-semibold">Sueldo de {nombreMes}</span>
            <span className="cifra font-bold">{formatearCLP(queda.sueldo)}</span>
          </li>
        )}
        {lineas.map((l) => (
          <li key={l.clave} className={`fila-viva ${TONOS[l.tono].viva} -mx-2 rounded-md px-2 py-2.5`}>
            <div className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto] items-start gap-x-2.5">
              <span aria-hidden="true" className={`mt-1 size-3 rounded-sm ${TONOS[l.tono].barra}`} />
              <span className="min-w-0">
                <a href={l.destino} className="font-medium underline-offset-2 hover:underline">
                  {l.nombre}
                </a>
                <span className="block text-xs text-texto-tenue">{l.detalle}</span>
              </span>
              <span className={`cifra whitespace-nowrap font-semibold ${l.monto === 0 ? "text-texto-tenue" : ""}`}>
                {l.monto === 0 ? formatearCLP(0) : `−${formatearCLP(l.monto)}`}
              </span>
            </div>
            {l.clave === "presupuesto" && queda.presupuestoPorGastar.lineas.length > 0 && (
              <details className="mt-1.5 ml-[1.375rem]">
                <summary className="cursor-pointer text-xs font-semibold text-accion-tinta">
                  Ver por categoría
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {queda.presupuestoPorGastar.lineas.map((p) => (
                    <li key={p.categoria.id} className="flex items-baseline justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0" style={{ color: p.categoria.color }}>
                          <Icono nombre={p.categoria.icono} tamano={13} />
                        </span>
                        <span className="truncate">{p.categoria.nombre}</span>
                        <span className="hidden text-texto-tenue sm:inline">
                          · {formatearCLP(p.gastado)} de {formatearCLP(p.presupuesto)}
                          {p.enCuentas > 0 && ` · ${formatearCLP(p.enCuentas)} en cuentas`}
                        </span>
                      </span>
                      <span className="cifra font-semibold">{formatearCLP(p.porGastar)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] leading-snug text-texto-tenue">
                  Lo ya gastado de cada presupuesto está en los pagos realizados y las cuentas pendientes de esa
                  categoría, en cuentas por pagar: aquí va solo lo que falta, para no contarlo dos veces.
                </p>
              </details>
            )}
          </li>
        ))}
        <li className="flex items-center justify-between gap-3 pt-3 pb-1">
          <span className="text-base font-bold">{queda.sinSueldo ? "Comprometido este mes" : cerrado ? "Te quedó" : "Te quedaría"}</span>
          <span className={`cifra text-xl font-bold ${queda.sinSueldo ? "" : estilo.texto}`}>
            {queda.sinSueldo ? formatearCLP(queda.descuentos) : conSigno(queda.quedaria)}
          </span>
        </li>
      </ol>
    </article>
  );
}
