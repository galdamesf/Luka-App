import type { BandaSalud, SaludFinanciera as Salud } from "@/dominio/salud";
import { Icono } from "./Icono";
import { nombreDelMes } from "./formato";
import { IDENTIDAD_FACTOR, TONOS } from "./tonos";
import { sumarMeses } from "@/lib/fecha";

type Props = {
  salud: Salud;
  mes: string;
  /** El puntaje del mes anterior, para la variacion. null si no hay. */
  anterior: number | null;
};

const RADIO = 70;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

// Clases enteras: Tailwind solo genera las que ve escritas completas.
const BANDA: Record<BandaSalud, { nombre: string; trazo: string; pildora: string }> = {
  excelente: { nombre: "Salud excelente", trazo: "stroke-exito-fuerte", pildora: "border-exito/40 bg-exito/10 text-exito" },
  buena: { nombre: "Salud buena", trazo: "stroke-exito-fuerte", pildora: "border-exito/40 bg-exito/10 text-exito" },
  regular: { nombre: "Salud regular", trazo: "stroke-alerta", pildora: "border-alerta/40 bg-alerta/10 text-alerta" },
  critica: { nombre: "Salud crítica", trazo: "stroke-peligro", pildora: "border-peligro/40 bg-peligro/10 text-peligro" },
};

function tonoDeFactor(puntos: number, maximo: number) {
  const r = puntos / maximo;
  if (r >= 0.8) return { barra: "bg-exito-fuerte", texto: "text-exito", viva: "viva-exito" };
  if (r >= 0.5) return { barra: "bg-alerta", texto: "text-alerta", viva: "viva-alerta" };
  return { barra: "bg-peligro", texto: "text-peligro", viva: "viva-peligro" };
}

/**
 * El Health Score del mes: el anillo con el numero, lo que suma y lo que
 * resta, y una sola recomendacion, la que mas lo subiria.
 */
export function SaludFinanciera({ salud, mes, anterior }: Props) {
  const { puntaje, banda, factores, recomendacion } = salud;
  const mesAnterior = nombreDelMes(sumarMeses(mes, -1)).split(" ")[0];

  if (puntaje === null || banda === null) {
    return (
      <article className="rounded-xl border border-dashed border-borde bg-superficie p-5 text-sm text-texto-tenue">
        <h3 className="mb-1 text-base font-bold text-texto">Health Score</h3>
        Se calcula con tu sueldo: con él se mide cuánto ahorras y cuánto se lleva la deuda.{" "}
        <a href="#balance" className="font-semibold text-accion-tinta underline-offset-2 hover:underline">
          Defínelo en el balance
        </a>
        .
      </article>
    );
  }

  const estilo = BANDA[banda];
  const delta = anterior === null ? null : puntaje - anterior;
  const suman = factores.filter((f) => f.puntos / f.maximo >= 0.8);
  const restan = factores.filter((f) => f.puntos / f.maximo < 0.8);

  // Cada factor lleva su propio color e icono (el ahorro es esmeralda, la
  // deuda fucsia...). Lo que suma se pinta con ese color; lo que resta pasa
  // la barra y la cifra a ambar o rojo, que es lo que tiene que saltar.
  const Factor = ({ f }: { f: (typeof factores)[number] }) => {
    const senal = tonoDeFactor(f.puntos, f.maximo);
    const suma = f.puntos / f.maximo >= 0.8;
    const identidad = IDENTIDAD_FACTOR[f.clave];
    const tono = TONOS[identidad.tono];
    return (
      <li
        className={`fila-viva ${suma ? tono.viva : senal.viva} -mx-3 grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-0.5 rounded-lg px-3 py-1.5`}
      >
        <span aria-hidden="true" className={`inline-flex size-8 items-center justify-center rounded-lg shadow-sm ${tono.ficha}`}>
          <Icono nombre={identidad.icono} tamano={16} />
        </span>
        <span className="space-y-0.5">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            {f.nombre}
            {!suma && (
              <span className={senal.texto}>
                <Icono nombre="alert" tamano={14} />
                <span className="sr-only">(necesita atención)</span>
              </span>
            )}
          </span>
          <span className="block text-[13px] leading-snug text-texto-tenue">{f.detalle}</span>
          <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-superficie-tenue">
            <span
              className={`block h-full rounded-full ${suma ? tono.barra : senal.barra}`}
              style={{ width: `${Math.max(2, (f.puntos / f.maximo) * 100)}%` }}
            />
          </span>
        </span>
        <span className={`cifra whitespace-nowrap text-[13px] font-semibold ${suma ? "text-texto" : senal.texto}`}>
          {f.puntos}/{f.maximo}
        </span>
      </li>
    );
  };

  return (
    <article
      aria-labelledby="titulo-salud"
      className="tarjeta-viva flex min-w-0 flex-col gap-6 rounded-xl border border-borde bg-superficie p-5 shadow-sm"
    >
      <h3 id="titulo-salud" className="text-base font-bold">
        Health Score de {nombreDelMes(mes).split(" ")[0]}
      </h3>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-6">
        <div className="mx-auto flex w-48 flex-col items-center gap-3">
          <div className="relative size-44">
            <svg
              viewBox="0 0 172 172"
              className="size-44 -rotate-90"
              role="img"
              aria-label={`Health Score ${puntaje} de 100: ${estilo.nombre.toLowerCase()}`}
            >
              <circle cx="86" cy="86" r={RADIO} fill="none" strokeWidth="14" className="stroke-superficie-tenue" />
              <circle
                cx="86"
                cy="86"
                r={RADIO}
                fill="none"
                strokeWidth="14"
                strokeLinecap="round"
                className={`${estilo.trazo} transition-[stroke-dasharray] duration-500`}
                strokeDasharray={`${(CIRCUNFERENCIA * puntaje) / 100} ${CIRCUNFERENCIA}`}
              />
            </svg>
            <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="cifra text-5xl font-bold leading-none tracking-tight">{puntaje}</span>
              <span className="cifra mt-1 text-xs text-texto-tenue">de 100</span>
            </div>
          </div>
          <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-sm font-bold ${estilo.pildora}`}>
            {estilo.nombre}
          </span>
          {delta !== null && (
            <span
              className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${
                delta >= 0 ? "text-exito" : "text-peligro"
              }`}
            >
              <Icono nombre={delta >= 0 ? "trending-up" : "trending-down"} tamano={15} />
              {delta > 0 ? "+" : delta < 0 ? "−" : ""}
              {Math.abs(delta)} pts vs. {mesAnterior} ({anterior})
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-[2_1_18rem] flex-col gap-5">
          {suman.length > 0 && (
            <div className="space-y-3">
              <h4 className="cifra text-[11px] font-semibold uppercase tracking-[0.08em] text-exito">
                Lo que suma
              </h4>
              <ul className="space-y-3.5">
                {suman.map((f) => (
                  <Factor key={f.clave} f={f} />
                ))}
              </ul>
            </div>
          )}
          {restan.length > 0 && (
            <div className="space-y-3 border-t border-borde pt-4">
              <h4 className="cifra text-[11px] font-semibold uppercase tracking-[0.08em] text-peligro">
                Lo que resta
              </h4>
              <ul className="space-y-3.5">
                {restan.map((f) => (
                  <Factor key={f.clave} f={f} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {recomendacion !== null && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-accion/40 bg-accion/10 p-4">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-accion/20 text-accion-tinta">
            <Icono nombre="lightbulb" tamano={20} />
          </span>
          <div className="min-w-0 flex-[1_1_16rem] space-y-0.5">
            <p className="cifra text-[11px] uppercase tracking-[0.08em] text-accion-tinta">Recomendación</p>
            <p className="text-[15px] font-bold">{recomendacion.titulo}</p>
            <p className="text-[13px] leading-relaxed text-texto-tenue">{recomendacion.texto}</p>
          </div>
          <a
            href={recomendacion.destino}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accion px-4 text-sm font-bold whitespace-nowrap text-accion-texto transition-[filter] duration-150 hover:brightness-110"
          >
            {recomendacion.accion}
            <Icono nombre="arrow-right" tamano={16} />
          </a>
        </div>
      )}
    </article>
  );
}
