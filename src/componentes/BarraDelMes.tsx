import type { ResumenPanel, Tono } from "@/dominio/panel";
import { Icono } from "./Icono";
import { formatearCLP, nombreDelMes, porcentajeLegible } from "./formato";

type Props = {
  panel: ResumenPanel;
  mes: string;
};

// Clases enteras: Tailwind no genera las que se arman con plantilla.
const RELLENO: Record<Tono, string> = {
  exito: "bg-exito-fuerte",
  alerta: "bg-alerta",
  peligro: "bg-peligro",
};
const RAYAS: Record<Tono, string> = {
  exito: "rayas-exito",
  alerta: "rayas-alerta",
  peligro: "rayas-peligro",
};
const VIVA: Record<Tono, string> = {
  exito: "viva-exito",
  alerta: "viva-alerta",
  peligro: "viva-peligro",
};
const PILDORA: Record<Tono, string> = {
  exito: "border-exito/40 bg-exito/10 text-exito",
  alerta: "border-alerta/40 bg-alerta/10 text-alerta",
  peligro: "border-peligro/40 bg-peligro/10 text-peligro",
};

const numero = (valor: number) => valor.toFixed(1).replace(".", ",");

/**
 * El sueldo del mes en una barra: lo que ya salio, lo que falta pagar
 * (rayado) y lo que queda libre. La raya vertical es el dia de hoy: si lo
 * gastado termina antes que ella, vas bajo el ritmo del mes.
 *
 * Todo lo que dice la barra esta tambien escrito en la leyenda: la barra
 * ayuda a verlo de un golpe, pero no es la unica forma de saberlo.
 */
export function BarraDelMes({ panel, mes }: Props) {
  const { sinSueldo, sueldo, gastado, porPagar, barra } = panel;
  const nombre = nombreDelMes(mes).split(" ")[0];

  if (sinSueldo) {
    return (
      <article className="rounded-xl border border-dashed border-borde bg-superficie p-5 text-sm text-texto-tenue">
        Define tu sueldo en el{" "}
        <a href="#balance" className="font-semibold text-accion-tinta underline-offset-2 hover:underline">
          balance de más abajo
        </a>{" "}
        para ver qué parte de tu mes ya está gastada, comprometida y libre.
      </article>
    );
  }

  const anchoGastado = Math.min(barra.gastadoPct, 100);
  const anchoComprometido = Math.max(0, Math.min(barra.comprometidoPct, 100 - anchoGastado));
  const proyectado = barra.gastadoPct + barra.comprometidoPct;

  const estado =
    barra.libre < 0
      ? `No alcanza: faltan ${formatearCLP(-barra.libre)}`
      : barra.tono === "alerta"
        ? `Atención: ${porcentajeLegible(proyectado)} comprometido`
        : barra.tono === "peligro"
          ? "Sueldo agotado"
          : "Vas bien";

  const marcador = barra.marcadorDia;
  const etiquetaAlaIzquierda = marcador !== null && marcador > 50;

  return (
    <article
      aria-labelledby="titulo-barra-mes"
      className={`tarjeta-viva ${VIVA[barra.tono]} flex flex-col gap-5 rounded-xl border border-borde bg-superficie p-5 shadow-sm`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="space-y-1">
          <h3 id="titulo-barra-mes" className="text-sm font-semibold text-texto-tenue">
            Tu sueldo de {nombre}
          </h3>
          <p className="text-2xl font-bold tracking-tight">
            <span className="cifra">{formatearCLP(gastado)}</span>{" "}
            {/* En celular va en su propia linea: partida a la mitad no se lee. */}
            <span className="block text-sm font-medium text-texto-tenue sm:inline">
              de <span className="cifra">{formatearCLP(sueldo)}</span> ·{" "}
              {porcentajeLegible(barra.gastadoPct)} usado
            </span>
          </p>
        </div>
        <span
          className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-bold ${PILDORA[barra.tono]}`}
        >
          <Icono nombre={barra.tono === "exito" ? "check" : "alert"} tamano={16} />
          {estado}
        </span>
      </div>

      <div className="relative pb-7">
        <div
          role="img"
          aria-label={`Gastado ${porcentajeLegible(barra.gastadoPct)} del sueldo, por pagar ${porcentajeLegible(
            barra.comprometidoPct,
          )}, libre ${porcentajeLegible(barra.librePct)}${
            barra.diaDeHoy !== null ? `. Hoy es el día ${barra.diaDeHoy}` : ""
          }`}
          className="flex h-3.5 overflow-hidden rounded-full border border-borde bg-superficie-tenue"
        >
          <span
            className={`block h-full transition-[width] duration-500 ${RELLENO[barra.tonoGastado]}`}
            style={{ width: `${anchoGastado}%` }}
          />
          <span
            className={`block h-full transition-[width] duration-500 ${RAYAS[barra.tono]}`}
            style={{ width: `${anchoComprometido}%` }}
          />
        </div>
        {marcador !== null && (
          <>
            <span
              aria-hidden="true"
              className="absolute -top-1.5 h-7 w-0.5 -translate-x-1/2 rounded-full bg-texto"
              style={{ left: `${marcador}%` }}
            />
            <span
              aria-hidden="true"
              className={`cifra absolute top-6 whitespace-nowrap text-[11px] text-texto-tenue ${
                etiquetaAlaIzquierda ? "-translate-x-full pr-2" : "pl-2"
              }`}
              style={{ left: `${marcador}%` }}
            >
              Hoy · día {barra.diaDeHoy}
            </span>
          </>
        )}
      </div>

      <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
        <li className="flex items-start gap-2.5">
          <span aria-hidden="true" className={`mt-1 size-3 shrink-0 rounded ${RELLENO[barra.tonoGastado]}`} />
          <span className="space-y-0.5">
            <span className="block text-xs text-texto-tenue">Gastado</span>
            <span className="block text-base font-bold">
              <span className="cifra">{formatearCLP(gastado)}</span>{" "}
              <span className="text-xs font-medium text-texto-tenue">
                {porcentajeLegible(barra.gastadoPct)}
              </span>
            </span>
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span aria-hidden="true" className={`mt-1 size-3 shrink-0 rounded ${RAYAS[barra.tono]}`} />
          <span className="space-y-0.5">
            <span className="block text-xs text-texto-tenue">Por pagar (cuentas y cuotas)</span>
            <span className="block text-base font-bold">
              <span className="cifra">{formatearCLP(porPagar)}</span>{" "}
              <span className="text-xs font-medium text-texto-tenue">
                {porcentajeLegible(barra.comprometidoPct)}
              </span>
            </span>
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <span
            aria-hidden="true"
            className="mt-1 size-3 shrink-0 rounded border border-texto-tenue bg-superficie-tenue"
          />
          <span className="space-y-0.5">
            <span className="block text-xs text-texto-tenue">Libre para gastar</span>
            <span className={`block text-base font-bold ${barra.libre < 0 ? "text-peligro" : ""}`}>
              <span className="cifra">{formatearCLP(barra.libre)}</span>
            </span>
            {barra.librePorDia !== null && (
              <span className="block text-xs text-texto-tenue">
                <span className="cifra">{formatearCLP(barra.librePorDia)}</span> por día,{" "}
                {barra.diasRestantes === 1 ? "solo hoy" : `${barra.diasRestantes} días contando hoy`}
              </span>
            )}
          </span>
        </li>
        {barra.ritmo !== null && (
          <li className="flex items-start gap-2.5">
            <span aria-hidden="true" className="mx-[5px] mt-0.5 h-4 w-0.5 shrink-0 rounded-full bg-texto" />
            <span className="space-y-0.5">
              <span className="block text-xs text-texto-tenue">Ritmo del mes</span>
              <span className={`block text-sm font-bold ${barra.ritmo >= 0 ? "text-exito" : "text-alerta"}`}>
                {barra.ritmo >= 0
                  ? `Vas ${numero(barra.ritmo)} pts bajo el ritmo`
                  : `Vas ${numero(-barra.ritmo)} pts sobre el ritmo`}
              </span>
              <span className="block text-xs text-texto-tenue">
                Llevas {porcentajeLegible(barra.gastadoPct)} del sueldo con{" "}
                {porcentajeLegible(marcador ?? 0)} del mes
              </span>
            </span>
          </li>
        )}
      </ul>
    </article>
  );
}
