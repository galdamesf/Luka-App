import { Icono } from "./Icono";

type Props = {
  /** Distingue el input cuando hay varios formularios en la pagina. */
  id: string;
  etiqueta?: string;
};

/**
 * Campo para adjuntar la foto de la boleta.
 *
 * El `accept` solo orienta al selector de archivos; lo que manda es la
 * validacion del servidor, que ademas mira los primeros bytes. En el celular,
 * `capture` deja abrir la camara directo.
 */
export function CampoBoleta({ id, etiqueta = "Foto de la boleta" }: Props) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 flex items-center gap-1.5 text-xs font-medium text-texto-tenue"
      >
        <Icono nombre="camera" tamano={13} />
        {etiqueta}
        <span className="font-normal opacity-70">(opcional)</span>
      </label>
      <input
        id={id}
        name="boleta"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        capture="environment"
        className="w-full cursor-pointer rounded-md border border-borde bg-superficie px-3 py-2 text-xs text-texto-tenue transition-colors duration-150 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-superficie-tenue file:px-2 file:py-1 file:text-xs file:text-texto hover:border-texto-tenue"
      />
    </div>
  );
}
