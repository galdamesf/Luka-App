import type { EstadoDelMes, LoQueQueda as Queda } from "@/dominio/lo-que-queda";
import { Icono } from "./Icono";
import { formatearCLP, nombreDelMes, porcentajeLegible } from "./formato";

type Props = {
  queda: Queda;
  mes: string;
  estado: EstadoDelMes;
  diasRestantes: number;
  /** El % de la meta de ahorro, para nombrarla. */
  metaPct: number;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
/** Con el menos tipografico delante del signo peso: "−$1.030.890", no "$-1.030.890". */
const conSigno = (monto: number) => (monto < 0 ? `−${formatearCLP(-monto)}` : formatearCLP(monto));

// Clases enteras: Tailwind solo genera las que ve escritas completas.
const ESTADO = {
  sobra: { pildora: "border-exito/40 bg-exito/10 text-exito", icono: "check", texto: "Te sobra" },
  ajustado: { pildora: "border-alerta/40 bg-alerta/10 text-alerta", icono: "alert", texto: "Ajustado" },
  falta: { pildora: "border-peligro/40 bg-peligro/10 text-peligro", icono: "alert", texto: "No alcanza" },
} as const;

/** El signo entre dos cifras: en una fila en pantallas anchas, oculto en celular. */
function Operador({ signo }: { signo: "−" | "=" }) {
  return (
    <span
      aria-hidden="true"
      className="hidden size-8 shrink-0 items-center justify-center self-center rounded-full border border-borde bg-superficie text-lg font-bold text-texto-tenue sm:inline-flex"
    >
      {signo}
    </span>
  );
}

/**
 * Las tres cifras que responden lo que uno viene a preguntar: cuanta plata
 * hay para el mes despues de pagar todo, cuanta ya tiene destino en los
 * presupuestos y cuanto se puede ahorrar. Se leen como una resta:
 * libre − presupuestos = puedes ahorrar.
 *
 * Va arriba de la cuenta completa y a todo lo ancho, para que sea lo primero
 * que se ve de la seccion. Las cifras salen de calcularLoQueQueda: es la
 * misma cuenta de abajo, solo que resumida.
 */
export function CifrasQueda({ queda, mes, estado, diasRestantes, metaPct }: Props) {
  const [nombreMes] = nombreDelMes(mes).split(" ");
  const cerrado = estado === "cerrado";
  const estilo = ESTADO[queda.estado];
  const pendiente = queda.cuentasPorPagar.total + queda.cuotasPorPagar.total;

  if (queda.sinSueldo) {
    return (
      <section
        aria-labelledby="titulo-cifras-queda"
        className="rounded-2xl border border-dashed border-borde bg-superficie p-5 text-sm text-texto-tenue"
      >
        <h3 id="titulo-cifras-queda" className="text-lg font-bold text-texto">
          Falta tu sueldo de {nombreMes}
        </h3>
        Sin él no se puede saber cuánto te queda libre ni cuánto puedes ahorrar.{" "}
        <a href="#balance" className="font-semibold enlace-luka">
          Defínelo en el balance
        </a>
        .
      </section>
    );
  }

  const meta = queda.meta;
  // Cuanto de la meta quedaria cubierto si apartas todo lo que puedes.
  const coberturaMeta = meta === null ? 0 : Math.min(100, ((meta.apartado + queda.puedesAhorrar) / meta.monto) * 100);
  const apartadoMeta = meta === null ? 0 : Math.min(100, (meta.apartado / meta.monto) * 100);

  return (
    <section
      aria-labelledby="titulo-cifras-queda"
      className="tarjeta-viva viva-exito rounded-2xl border border-exito/40 bg-superficie p-5 shadow-md sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 id="titulo-cifras-queda" className="text-lg font-bold sm:text-xl">
            {cerrado ? `Así cerró tu plata de ${nombreMes}` : `Tu plata de ${nombreMes}`}
          </h3>
          <p className="text-[13px] text-texto-tenue">
            Sueldo de <span className="cifra font-semibold text-texto">{formatearCLP(queda.sueldo)}</span>
            {!cerrado && " · se actualiza con cada gasto, pago o cuenta nueva"}
          </p>
        </div>
        <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-bold ${estilo.pildora}`}>
          <Icono nombre={estilo.icono} tamano={15} />
          {estilo.texto}
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2">
        {/* 1 · Libre para el mes */}
        <div className="min-w-0 flex-1 rounded-xl border border-borde bg-superficie-tenue p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-texto-tenue">
            <Icono nombre="wallet" tamano={15} />
            Libre para el mes
          </p>
          <p className={`cifra mt-1.5 text-3xl font-bold leading-none tracking-tight lg:text-4xl ${queda.libre < 0 ? "text-peligro" : ""}`}>
            {conSigno(queda.libre)}
          </p>
          <p className="mt-2 text-xs leading-snug text-texto-tenue">
            Después de lo ya pagado (<span className="cifra">{formatearCLP(queda.pagado.total)}</span>) y de lo que
            falta pagar en cuentas y cuotas (<span className="cifra">{formatearCLP(pendiente)}</span>).
          </p>
        </div>

        <Operador signo="−" />

        {/* 2 · Lo reservado para los presupuestos */}
        <div className="min-w-0 flex-1 rounded-xl border border-borde bg-superficie-tenue p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-texto-tenue">
            <Icono nombre="receipt" tamano={15} />
            Para tus presupuestos
          </p>
          <p className="cifra mt-1.5 text-3xl font-bold leading-none tracking-tight lg:text-4xl">
            {formatearCLP(queda.presupuestoPorGastar.total)}
          </p>
          <p className="mt-2 text-xs leading-snug text-texto-tenue">
            {cerrado
              ? "El mes cerró: lo que no se gastó ya no se reserva."
              : queda.presupuestoPorGastar.lineas.length === 0
                ? "Ningún presupuesto tiene saldo por gastar."
                : `Lo que falta gastar en ${plural(queda.presupuestoPorGastar.lineas.length, "presupuesto", "presupuestos")} (súper, bencina…).`}
            {queda.ahorro.total > 0 && (
              <>
                {" "}Y ya apartaste <span className="cifra">{formatearCLP(queda.ahorro.total)}</span> de ahorro.
              </>
            )}
          </p>
        </div>

        <Operador signo="=" />

        {/* 3 · Lo que se puede ahorrar */}
        <div className="min-w-0 flex-1 rounded-xl border border-exito/40 bg-exito/10 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-exito">
            <Icono nombre="piggy-bank" tamano={15} />
            {cerrado ? "Te quedó sin destino" : queda.ahorro.total > 0 ? "Puedes ahorrar además" : "Puedes ahorrar"}
          </p>
          <p className={`cifra mt-1.5 text-3xl font-bold leading-none tracking-tight lg:text-4xl ${queda.quedaria < 0 ? "text-peligro" : "text-exito"}`}>
            {conSigno(queda.quedaria)}
          </p>

          {queda.quedaria < 0 ? (
            <p className="mt-2 text-xs leading-snug text-texto-tenue">
              Lo comprometido supera tu sueldo: algo de la cuenta de abajo tiene que bajar.
            </p>
          ) : meta === null ? (
            queda.porcentajeDelSueldo !== null && (
              <p className="mt-2 text-xs leading-snug text-texto-tenue">
                {porcentajeLegible(queda.porcentajeDelSueldo)} de tu sueldo.
              </p>
            )
          ) : (
            <div className="mt-2.5 space-y-1.5">
              <div
                role="img"
                aria-label={`Meta de ahorro: ${formatearCLP(meta.monto)}. Apartado: ${formatearCLP(meta.apartado)}.`}
                className="relative h-2 overflow-hidden rounded-full bg-superficie"
              >
                {/* Lo que cubririas si apartas todo lo que puedes, y encima lo ya apartado. */}
                <span className="absolute inset-y-0 left-0 rounded-full bg-exito/40" style={{ width: `${coberturaMeta}%` }} />
                <span className="absolute inset-y-0 left-0 rounded-full bg-exito" style={{ width: `${apartadoMeta}%` }} />
              </div>
              <p className="text-xs leading-snug text-texto-tenue">
                Meta del {metaPct}%: <span className="cifra font-semibold text-texto">{formatearCLP(meta.monto)}</span>
                {" · "}
                {meta.porApartar === 0 ? (
                  <span className="font-semibold text-exito">ya la cumpliste</span>
                ) : meta.alcanza ? (
                  <>
                    <span className="font-semibold text-exito">te alcanza</span>: aparta{" "}
                    <span className="cifra font-semibold text-texto">{formatearCLP(meta.porApartar)}</span> y aún te sobran{" "}
                    <span className="cifra font-semibold text-texto">{formatearCLP(meta.diferencia)}</span>
                  </>
                ) : (
                  <>
                    aunque ahorres todo, te faltarían{" "}
                    <span className="cifra font-semibold text-alerta">{formatearCLP(meta.diferencia)}</span>
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {queda.porDia !== null && (
        <p className="mt-4 text-[13px] text-texto-tenue">
          Si no apartas nada, tienes unos <span className="cifra font-semibold text-texto">{formatearCLP(queda.porDia)}</span>{" "}
          por día de margen para imprevistos en los {plural(diasRestantes, "día que queda", "días que quedan")}.
        </p>
      )}
    </section>
  );
}
