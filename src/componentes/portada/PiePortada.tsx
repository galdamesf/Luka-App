import Link from "next/link";
import { Luka } from "@/componentes/Luka";
import { hoyISO } from "@/lib/fecha";
import { ANCLA_PREGUNTAS, ANCLA_QUE_HACEMOS } from "./enlaces";

/**
 * El pie de la portada: la banda azul oscuro de la app, con Luka echado (y
 * quieto: en la portada nada queda en bucle), dos columnas de enlaces y la
 * letra chica de que las cifras de arriba son de un mes de ejemplo.
 */

type Enlace = { texto: string; href: string };

const COLUMNAS: readonly { titulo: string; enlaces: readonly Enlace[] }[] = [
  {
    titulo: "Luka",
    enlaces: [
      { texto: "¿Qué hacemos?", href: `#${ANCLA_QUE_HACEMOS}` },
      { texto: "Preguntas", href: `#${ANCLA_PREGUNTAS}` },
      { texto: "Entrar", href: "/ingresar" },
    ],
  },
  {
    titulo: "Tus datos",
    enlaces: [
      { texto: "Dónde quedan", href: `#${ANCLA_PREGUNTAS}` },
      { texto: "Sesión y seguridad", href: `#${ANCLA_PREGUNTAS}` },
    ],
  },
];

const ENLACE = "inline-flex min-h-9 items-center text-sm font-semibold text-pie-texto/85 hover:text-pie-texto hover:underline";

export function PiePortada() {
  return (
    <footer className="bg-pie text-pie-texto">
      <div className="mx-auto grid max-w-5xl gap-10 px-5 py-12 @3xl:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex items-start gap-4">
          <Luka pose="echado" quieto className="h-10 w-auto" />
          <div>
            <p className="font-marca text-xl font-extrabold tracking-[-0.03em]">Luka</p>
            <p className="mt-1 max-w-[30ch] text-sm leading-relaxed text-pie-texto/75">
              Control de gastos de la casa. Un mes que parte cuando te pagan.
            </p>
          </div>
        </div>
        {COLUMNAS.map((col) => (
          <nav key={col.titulo} aria-label={col.titulo}>
            <p className="text-xs font-extrabold tracking-[0.14em] text-pie-texto/65 uppercase">{col.titulo}</p>
            <ul className="mt-3 flex flex-col gap-1">
              {col.enlaces.map(({ texto, href }) => (
                <li key={texto}>
                  {href.startsWith("/") ? (
                    <Link href={href} className={ENLACE}>
                      {texto}
                    </Link>
                  ) : (
                    <a href={href} className={ENLACE}>
                      {texto}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-pie-texto/10">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-5 py-5 text-xs text-pie-texto/65">
          {/* El año en hora de Chile: el servidor corre en UTC. */}
          <p>© {hoyISO().slice(0, 4)} Luka · Hecho en Chile, para la casa.</p>
          <p>Las cifras de esta página son de un mes de ejemplo.</p>
        </div>
      </div>
    </footer>
  );
}
