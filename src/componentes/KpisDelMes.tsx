import type { ResumenPanel, Tono } from "@/dominio/panel";
import { Icono } from "./Icono";
import { formatearCLP, nombreDelMes, porcentajeLegible, variacionLegible } from "./formato";
import { sumarMeses } from "@/lib/fecha";

type Props = {
  panel: ResumenPanel;
  mes: string;
};

type Ficha = Tono | "accion" | "avance" | "neutro";

const FICHA: Record<Ficha, string> = {
  exito: "bg-exito/15 text-exito",
  alerta: "bg-alerta/15 text-alerta",
  peligro: "bg-peligro/15 text-peligro",
  accion: "bg-accion/15 text-accion-tinta",
  avance: "bg-avance/15 text-avance",
  neutro: "bg-superficie-tenue text-texto-tenue",
};

// Cada tarjeta lleva su color: una franja arriba, un tinte que se desvanece
// hacia abajo y el brillo al pasar el mouse.
const COLOR: Record<Ficha, { franja: string; tinte: string; viva: string }> = {
  exito: { franja: "bg-exito-fuerte", tinte: "from-exito/12", viva: "viva-exito" },
  alerta: { franja: "bg-alerta", tinte: "from-alerta/12", viva: "viva-alerta" },
  peligro: { franja: "bg-peligro", tinte: "from-peligro/12", viva: "viva-peligro" },
  accion: { franja: "bg-accion", tinte: "from-accion/14", viva: "viva-accion" },
  avance: { franja: "bg-avance", tinte: "from-avance/12", viva: "viva-avance" },
  neutro: { franja: "bg-texto-tenue", tinte: "from-texto-tenue/10", viva: "viva-accion" },
};

function Tarjeta({
  titulo,
  icono,
  ficha,
  children,
}: {
  titulo: string;
  icono: string;
  ficha: Ficha;
  children: React.ReactNode;
}) {
  return (
    <article
      className={`tarjeta-viva ${COLOR[ficha].viva} relative isolate flex min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-borde bg-superficie p-5 shadow-sm`}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${COLOR[ficha].franja}`} />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 bg-linear-to-b ${COLOR[ficha].tinte} to-transparent to-70%`}
      />
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-texto-tenue">{titulo}</h3>
        <span
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${FICHA[ficha]}`}
        >
          <Icono nombre={icono} tamano={18} />
        </span>
      </div>
      {children}
    </article>
  );
}

// Clases completas y no armadas con plantilla: Tailwind solo genera las que
// encuentra escritas enteras en el codigo.
const TINTA: Record<Tono | "tenue" | "normal", string> = {
  exito: "text-exito",
  alerta: "text-alerta",
  peligro: "text-peligro",
  tenue: "text-texto-tenue",
  normal: "text-texto",
};

function Cifra({ valor, tono = "normal" }: { valor: string; tono?: Tono | "tenue" | "normal" }) {
  const color = TINTA[tono];
  return (
    <p className={`cifra text-[1.7rem] font-bold leading-tight tracking-tight sm:text-3xl ${color}`}>
      {valor}
    </p>
  );
}

function Chip({ tono, children }: { tono: Ficha; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${FICHA[tono]}`}>
      {children}
    </span>
  );
}

/**
 * Las cuatro cifras del mes, arriba de todo. Lo que dicen cuadra con la
 * secuencia del balance de mas abajo: sueldo - gastado = disponible, que es
 * su "Te queda".
 */
export function KpisDelMes({ panel, mes }: Props) {
  const {
    sinSueldo, sueldo, gastado, cuotasPagadas, disponible, porPagar, trasPagar,
    cuentasVencidas, porVencer, programadas, variacion, diaComparado, barra,
  } = panel;
  const mesAnterior = nombreDelMes(sumarMeses(mes, -1)).split(" ")[0];
  const subio = variacion !== null && variacion > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tarjeta titulo="Sueldo del mes" icono="arrow-down-left" ficha="exito">
        {sinSueldo ? (
          <>
            <Cifra valor="Sin definir" tono="tenue" />
            <p className="text-xs text-texto-tenue">
              <a href="#balance" className="font-semibold text-accion-tinta underline-offset-2 hover:underline">
                Defínelo en el balance
              </a>{" "}
              para ver cuánto te queda.
            </p>
          </>
        ) : (
          <>
            <Cifra valor={formatearCLP(sueldo)} tono="exito" />
            <p className="text-xs text-texto-tenue">Lo que entra este mes</p>
          </>
        )}
      </Tarjeta>

      <Tarjeta titulo="Total gastado" icono="trending-up" ficha="accion">
        <Cifra valor={formatearCLP(gastado)} />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-tenue">
          {variacion === null ? (
            <span>Sin mes anterior para comparar</span>
          ) : (
            <>
              <Chip tono={subio ? "peligro" : "exito"}>
                <Icono nombre={subio ? "trending-up" : "trending-down"} tamano={13} className="mr-1" />
                {variacionLegible(variacion)}
              </Chip>
              <span>
                vs. {mesAnterior}
                {barra.diaDeHoy !== null ? ` al día ${diaComparado}` : " completo"}
              </span>
            </>
          )}
        </div>
        {(cuotasPagadas > 0 || !sinSueldo) && (
          <p className="text-xs text-texto-tenue">
            {!sinSueldo && <>{porcentajeLegible(barra.gastadoPct)} de tu sueldo</>}
            {!sinSueldo && cuotasPagadas > 0 && " · "}
            {cuotasPagadas > 0 && (
              <>
                incluye <span className="cifra">{formatearCLP(cuotasPagadas)}</span> en cuotas
              </>
            )}
          </p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Disponible" icono="wallet" ficha="avance">
        {sinSueldo ? (
          <>
            <Cifra valor="—" tono="tenue" />
            <p className="text-xs text-texto-tenue">Aparece cuando definas tu sueldo.</p>
          </>
        ) : (
          <>
            <Cifra valor={formatearCLP(disponible)} tono={disponible < 0 ? "peligro" : "normal"} />
            <p className="text-xs text-texto-tenue">
              Tras pagar lo pendiente:{" "}
              <span className={`cifra font-semibold ${trasPagar < 0 ? "text-peligro" : "text-texto"}`}>
                {formatearCLP(trasPagar)}
              </span>
            </p>
          </>
        )}
      </Tarjeta>

      <Tarjeta
        titulo="Por pagar"
        icono="receipt"
        ficha={cuentasVencidas > 0 ? "peligro" : porVencer > 0 ? "alerta" : "exito"}
      >
        <Cifra valor={formatearCLP(porPagar)} />
        {porPagar === 0 ? (
          <p className="text-xs font-semibold text-exito">Todo pagado este mes</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {cuentasVencidas > 0 && (
              <Chip tono="peligro">
                {cuentasVencidas} {cuentasVencidas === 1 ? "vencida" : "vencidas"}
              </Chip>
            )}
            {porVencer > 0 && <Chip tono="alerta">{porVencer} por vencer</Chip>}
            {programadas > 0 && (
              <Chip tono="neutro">
                {programadas} {programadas === 1 ? "programada" : "programadas"}
              </Chip>
            )}
            <a
              href="#pagos"
              className="ml-auto font-semibold text-accion-tinta underline-offset-2 hover:underline"
            >
              Ver pagos
            </a>
          </div>
        )}
      </Tarjeta>
    </div>
  );
}
