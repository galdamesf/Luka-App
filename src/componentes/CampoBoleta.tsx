"use client";

import { useEffect, useRef, useState } from "react";
import { megas, queHacerConLaBoleta, TAMANO_MAXIMO_BOLETA } from "@/dominio/tamano-boleta";
import { achicarFoto } from "@/lib/achicar-foto";
import { Icono } from "./Icono";

type Props = {
  /** Distingue el input cuando hay varios formularios en la pagina. */
  id: string;
  etiqueta?: string;
};

type Aviso = { tono: "info" | "error"; texto: string };

const ESPERA = "Espera a que se termine de achicar la foto.";

/**
 * Campo para adjuntar la foto de la boleta.
 *
 * El `accept` solo orienta al selector de archivos; lo que manda es la
 * validacion del servidor, que ademas mira los primeros bytes. En el celular,
 * `capture` deja abrir la camara directo.
 *
 * Una foto de mas de 3 MB se achica aqui mismo antes de enviarse
 * (src/lib/achicar-foto.ts): la boleta tiene tope de 4 MB. Mientras se
 * achica, el formulario no se puede enviar (el campo queda «invalido» con un
 * mensaje). Un PDF de mas de 4 MB se quita del campo y se avisa.
 */
export function CampoBoleta({ id, etiqueta = "Foto de la boleta" }: Props) {
  const campo = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  // Cuando el formulario se limpia (al guardar), el aviso tambien.
  useEffect(() => {
    const formulario = campo.current?.form;
    if (!formulario) return;
    const limpiar = () => setAviso(null);
    formulario.addEventListener("reset", limpiar);
    return () => formulario.removeEventListener("reset", limpiar);
  }, []);

  async function alElegir(evento: React.ChangeEvent<HTMLInputElement>) {
    const input = evento.currentTarget;
    const archivo = input.files?.[0];
    input.setCustomValidity("");
    setAviso(null);
    if (archivo === undefined) return;

    const que = queHacerConLaBoleta(archivo.type, archivo.size);
    if (que === "subir") return;

    if (que === "rechazar") {
      input.value = "";
      setAviso({
        tono: "error",
        texto: `Ese archivo pesa ${megas(archivo.size)} y el máximo es ${megas(TAMANO_MAXIMO_BOLETA)}.`,
      });
      return;
    }

    input.setCustomValidity(ESPERA);
    setAviso({ tono: "info", texto: "Achicando la foto…" });
    const achicada = await achicarFoto(archivo);
    input.setCustomValidity("");

    // Si mientras tanto eligio otro archivo, este resultado ya no sirve.
    if (input.files?.[0] !== archivo) return;

    if (achicada === null) {
      if (archivo.size > TAMANO_MAXIMO_BOLETA) {
        input.value = "";
        setAviso({
          tono: "error",
          texto: `No se pudo achicar esa foto y pesa más de ${megas(TAMANO_MAXIMO_BOLETA)}. Prueba sacándola de nuevo o con una captura de pantalla.`,
        });
      } else {
        setAviso(null);
      }
      return;
    }

    const lista = new DataTransfer();
    lista.items.add(achicada);
    input.files = lista.files;
    setAviso({ tono: "info", texto: `Foto achicada: de ${megas(archivo.size)} a ${megas(achicada.size)}.` });
  }

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
        ref={campo}
        id={id}
        name="boleta"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        capture="environment"
        onChange={alElegir}
        aria-describedby={aviso === null ? undefined : `${id}-aviso`}
        className="w-full cursor-pointer rounded-md border border-borde bg-superficie px-3 py-2 text-xs text-texto-tenue transition-colors duration-150 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-superficie-tenue file:px-2 file:py-1 file:text-xs file:text-texto hover:border-texto-tenue"
      />
      {aviso !== null && (
        <p
          id={`${id}-aviso`}
          role={aviso.tono === "error" ? "alert" : "status"}
          className={`mt-1 text-xs ${aviso.tono === "error" ? "text-peligro" : "text-texto-tenue"}`}
        >
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
