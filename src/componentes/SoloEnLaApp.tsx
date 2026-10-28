"use client";

import { usePathname } from "next/navigation";

/** Rutas publicas: las ve quien todavia no entro, y traen su propio marco. */
const PUBLICAS = ["/bienvenida", "/ingresar"];

/**
 * Esconde el navbar y el pie de la app en las paginas publicas.
 *
 * El layout raiz envuelve todo con el navbar y el pie, pero la portada trae
 * los suyos y se veria con dos. El pie es un componente de servidor y no
 * puede leer la ruta por su cuenta, asi que se le pasa como `children` a
 * este, que si es de cliente.
 *
 * Es temporal a proposito: cuando el ingreso este listo y la portada pase a
 * ser `/`, lo que corresponde es separar los layouts en grupos de rutas. Se
 * revierte borrando este archivo y volviendo a poner el navbar y el pie
 * directos en el layout.
 */
export function SoloEnLaApp({ children }: { children: React.ReactNode }) {
  const ruta = usePathname();
  if (ruta && PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))) {
    return null;
  }
  return <>{children}</>;
}
