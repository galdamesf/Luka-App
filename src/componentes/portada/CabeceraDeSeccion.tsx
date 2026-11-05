import type { ReactNode } from "react";

/**
 * La cabecera de una seccion de la portada, centrada como el titular del
 * heroe y el del cierre: el titular, con su palabra clave en durazno y
 * subrayada a mano, y debajo la bajada o los controles de la seccion.
 *
 * Son dos capas del parallax (Paralaje.tsx): el titular se adelanta y lo de
 * abajo va mas lento. Velocidades positivas y topes chicos, como pide el
 * parallax: las capas se separan al bajar y no pisan otra seccion.
 */
export function CabeceraDeSeccion({
  id,
  children,
  debajo,
}: {
  /** El id del titular, para el aria-labelledby de la seccion. */
  id: string;
  /** El titular. */
  children: ReactNode;
  /** La bajada o los controles, bajo el titular. */
  debajo?: ReactNode;
}) {
  return (
    <header className="mx-auto max-w-3xl px-5 text-center">
      <h2
        id={id}
        data-paralaje="0.22"
        data-paralaje-min="-60"
        data-paralaje-max="60"
        className="text-[clamp(2rem,5cqi,3rem)] leading-[1.1] font-black tracking-[-0.03em] text-balance text-texto"
      >
        {children}
      </h2>
      {debajo !== undefined && (
        <div data-paralaje="0.12" data-paralaje-min="-50" data-paralaje-max="50" className="mt-6">
          {debajo}
        </div>
      )}
    </header>
  );
}
