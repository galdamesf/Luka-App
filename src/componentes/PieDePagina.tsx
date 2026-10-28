import Link from "next/link";
import { Luka } from "./Luka";

const ENLACES = [
  { href: "/", etiqueta: "Inicio" },
  { href: "/informes", etiqueta: "Informes" },
] as const;

/**
 * El pie, con el mismo diseno que el de Vitalia: una banda oscura con el
 * contenido en una grilla de 12 columnas y una linea de cierre abajo que
 * cruza las doce.
 *
 * Luka va echado, no rastreando: llegaste al final de la pagina.
 *
 * La banda usa sus propios tokens (--pie) y no --primario, porque --primario
 * se da vuelta con el tema y el pie tiene que quedar oscuro en los dos.
 *
 * Se oculta al imprimir: el informe lleva su propia portada.
 */
export function PieDePagina() {
  return (
    <footer className="mt-12 bg-pie text-pie-texto print:hidden">
      <div
        className="mx-auto grid w-full max-w-6xl gap-10 pt-12 pb-10 md:grid-cols-12"
        style={{
          paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
          paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
        }}
      >
        <div className="min-w-0 md:col-span-5">
          <p className="flex items-end gap-2.5">
            <Luka pose="echado" className="h-11 w-auto" />
            <span
              className="text-2xl leading-none tracking-tight"
              style={{ fontFamily: "var(--font-marca)", fontWeight: 800 }}
            >
              Luka
            </span>
          </p>
          <p className="mt-4 max-w-[34ch] text-sm text-pie-texto/75">
            Sigue el rastro de tu plata. Cuánto entra, en qué se va y cuánto te queda,
            mes a mes.
          </p>
        </div>

        <nav aria-label="Pie de página" className="min-w-0 md:col-span-3">
          <p className="text-xs font-extrabold tracking-[0.14em] text-pie-texto/60 uppercase">
            Secciones
          </p>
          <ul className="mt-4 space-y-2.5">
            {ENLACES.map(({ href, etiqueta }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm font-semibold text-pie-texto/90 hover:text-pie-texto hover:underline"
                >
                  {etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 md:col-span-4">
          <p className="text-xs font-extrabold tracking-[0.14em] text-pie-texto/60 uppercase">
            Tus datos
          </p>
          <p className="mt-4 text-sm text-pie-texto/75">
            Se guardan en tu computador, en tu propia base de datos. Las boletas que
            subes quedan en el disco, junto al proyecto.
          </p>
        </div>

        <p className="border-t border-pie-texto/15 pt-6 text-[0.8rem] text-pie-texto/60 md:col-span-12">
          Luka · Hecho para llevar las cuentas de la casa.
        </p>
      </div>
    </footer>
  );
}
