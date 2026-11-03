import { IMAGENES_GUIA, type ImagenGuia } from "./contenido";

/** Las capturas se sacaron al 150%: mostradas a 2/3 se ven del tamano real. */
const ESCALA = 1.5;

/**
 * Una captura del panel, en la version del tema que tengas puesto. Van las
 * dos en la pagina y el CSS (.guia-claro / .guia-oscuro, en globals.css)
 * muestra la que corresponde, asi que cambiar el tema no recarga nada.
 *
 * Tocarla la abre en grande en otra pestana. El ancho y el alto reservan su
 * espacio antes de que cargue, para que la pagina no salte.
 */
export function ImagenDeGuia({ imagen }: { imagen: ImagenGuia }) {
  const [ancho, alto] = IMAGENES_GUIA[imagen.archivo];
  const estilo = { maxWidth: `${Math.round(ancho / ESCALA)}px` };

  return (
    <figure className="space-y-2">
      {(["claro", "oscuro"] as const).map((tema) => {
        const ruta = `/guia/${imagen.archivo}-${tema}.webp`;
        return (
          <a
            key={tema}
            href={ruta}
            target="_blank"
            rel="noopener"
            title="Abrir en grande"
            className={`guia-${tema} w-full overflow-hidden rounded-xl border border-borde shadow-sm transition-shadow duration-150 hover:shadow-md`}
            style={estilo}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- capturas fijas, ya optimizadas en webp */}
            <img
              src={ruta}
              alt={imagen.alt}
              width={ancho}
              height={alto}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
          </a>
        );
      })}
      <figcaption className="text-xs text-texto-tenue">{imagen.pie}</figcaption>
    </figure>
  );
}
