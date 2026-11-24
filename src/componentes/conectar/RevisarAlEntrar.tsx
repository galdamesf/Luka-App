"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Al abrir el panel, le pide al servidor que revise el buzon (si Luka lo
 * revisa sola) y, si llego algo, refresca «Por revisar». No dibuja nada: el
 * panel se ve al tiro y lo nuevo aparece un momento despues.
 */
export function RevisarAlEntrar({ accion }: { accion: () => Promise<{ cambios: number }> }) {
  const router = useRouter();
  useEffect(() => {
    let vivo = true;
    accion()
      .then((resultado) => {
        if (vivo && resultado.cambios > 0) router.refresh();
      })
      .catch(() => {
        // Si no se pudo, sera la proxima vez.
      });
    return () => {
      vivo = false;
    };
  }, [accion, router]);
  return null;
}
