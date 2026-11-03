import { TRAMOS_SUELDO, type PedazoBarra, type ResumenPanel, type Tono } from "@/dominio/panel";
import { Icono } from "./Icono";
import { fechaCorta, formatearCLP, nombreDelMes, porcentajeLegible } from "./formato";

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

// Los tramos, tenues, en el fondo de la barra: se ve donde empieza el
// siguiente color antes de llegar a el.
const FONDO_TRAMO = [
  { desde: 0, hasta: TRAMOS_SUELDO.atencion, clase: "bg-exito/10" },
  { desde: TRAMOS_SUELDO.atencion, hasta: TRAMOS_SUELDO.cuidado, clase: "bg-alerta/15" },
  { desde: TRAMOS_SUELDO.cuidado, hasta: 100, clase: "bg-peligro/15" },
];

const numero = (valor: number) => valor.toFixed(1).replace(".", ",");

function Pedazos({ pedazos, clases }: { pedazos: PedazoBarra[]; clases: Record<Tono, string> }) {
  return pedazos.map((p) => (
    <span
      key={p.desde}
      className={`absolute inset-y-0 block transition-[left,width] duration-500 ${clases[p.tono]}`}
      style={{ left: `${p.desde}%`, width: `${p.hasta - p.desde}%` }}
    />
  ));
}

/**
 * El sueldo del mes en una barra: lo que ya salio, lo que falta pagar
 * (rayado) y lo que queda libre. La raya vertical es el dia de hoy: si lo
 * gastado termina antes que ella, vas bajo el ritmo del mes.
 *
 * Se pinta por tramos del sueldo (TRAMOS_SUELDO): verde hasta el 50%, ambar
 * hasta el 80% y rojo desde ahi. Un mismo rayado puede pasar de verde a
 * ambar: se ve en que tramo vas a terminar el mes.
 *
 * Todo lo que dice la barra esta tambien escrito en la leyenda: la barra
 * ayuda a verlo de un golpe, pero no es la unica forma de saberlo.
 */
export function BarraDelMes({ panel, mes }: Props) {
  const { sinSueldo, sueldo, gastado, porPagar, barra } = panel;
  // Con el mes calendario "dia 29" se entiende solo; si el mes parte el 27,
  // el dia del periodo no calza con el del calendario y va la fecha.
  const hoyLegible =
    barra.fechaDeHoy !== null && panel.periodo.diaInicio !== 1
      ? fechaCorta(barra.fechaDeHoy)
      : `día ${barra.diaDeHoy}`;
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

  const proyectado = barra.gastadoPct + barra.comprometidoPct;

  const estado =
    barra.libre < 0
      ? `No alcanza: faltan ${formatearCLP(-barra.libre)}`
      : proyectado >= 100
        ? "Sueldo agotado"
        : barra.tono === "peligro"
          ? `Cuidado: ${porcentajeLegible(proyectado)} comprometido`
          : barra.tono === "alerta"
            ? `Atención: ${porcentajeLegible(proyectado)} comprometido`
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

      <div className="relative pt-4 pb-7">
        {/* Donde cambia el color, sobre la barra. */}
        {[TRAMOS_SUELDO.atencion, TRAMOS_SUELDO.cuidado].map((corte) => (
          <span
            key={corte}
            aria-hidden="true"
            className="cifra absolute top-0 -translate-x-1/2 text-[10px] leading-none text-texto-tenue"
            style={{ left: `${corte}%` }}
          >
            {corte}%
          </span>
        ))}
        <div
          role="img"
          aria-label={`Gastado ${porcentajeLegible(barra.gastadoPct)} del sueldo, por pagar ${porcentajeLegible(
            barra.comprometidoPct,
          )}, libre ${porcentajeLegible(barra.librePct)}. Verde hasta el ${TRAMOS_SUELDO.atencion}% del sueldo, ámbar hasta el ${
            TRAMOS_SUELDO.cuidado
          }% y rojo desde ahí${
            barra.diaDeHoy !== null ? `. Hoy es el día ${barra.diaDeHoy} de ${panel.periodo.dias}` : ""
          }`}
          className="relative h-3.5 overflow-hidden rounded-full border border-borde bg-superficie-tenue"
        >
          {FONDO_TRAMO.map((t) => (
            <span
              key={t.desde}
              className={`absolute inset-y-0 block ${t.clase}`}
              style={{ left: `${t.desde}%`, width: `${t.hasta - t.desde}%` }}
            />
          ))}
          <Pedazos pedazos={barra.pedazos.gastado} clases={RELLENO} />
          <Pedazos pedazos={barra.pedazos.porPagar} clases={RAYAS} />
          {/* Los cortes entre tramos, como una raya fina. */}
          {[TRAMOS_SUELDO.atencion, TRAMOS_SUELDO.cuidado].map((corte) => (
            <span
              key={corte}
              className="absolute inset-y-0 w-px bg-superficie/70"
              style={{ left: `${corte}%` }}
            />
          ))}
        </div>
        {marcador !== null && (
          <>
            <span
              aria-hidden="true"
              className="absolute top-2.5 h-7 w-0.5 -translate-x-1/2 rounded-full bg-texto"
              style={{ left: `${marcador}%` }}
            />
            <span
              aria-hidden="true"
              className={`cifra absolute top-10 whitespace-nowrap text-[11px] text-texto-tenue ${
                etiquetaAlaIzquierda ? "-translate-x-full pr-2" : "pl-2"
              }`}
              style={{ left: `${marcador}%` }}
            >
              Hoy · {hoyLegible}
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
