import { Luka } from "./Luka";

/**
 * El pie de la pagina. Luka echado, porque llegaste al final.
 *
 * No lleva enlaces: los dos que existen ya estan en el navbar, y repetirlos
 * abajo solo agrega ruido a una app de dos pantallas.
 *
 * Se oculta al imprimir: el informe impreso lleva su propia portada y un
 * perro durmiendo ahi no aporta nada.
 */
export function PieDePagina() {
  return (
    <footer className="mt-10 border-t border-borde print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-4 px-4 py-7">
        <div className="flex items-end gap-2.5">
          <Luka pose="echado" alto={44} />
          <p className="flex flex-col gap-0.5">
            <span
              className="text-lg leading-none tracking-tight"
              style={{ fontFamily: "var(--font-marca)", fontWeight: 800 }}
            >
              Luka
            </span>
            <span className="text-xs text-texto-tenue">Sigue el rastro de tu plata.</span>
          </p>
        </div>

        <p className="text-xs text-texto-tenue">
          Tus gastos se guardan solo en este computador.
        </p>
      </div>
    </footer>
  );
}
