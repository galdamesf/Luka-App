import type { Metadata } from "next";
import { NavPortada } from "@/componentes/portada/NavPortada";
import { Heroe } from "@/componentes/portada/Heroe";
import { Vitrina } from "@/componentes/portada/Vitrina";
import { Tarjetas } from "@/componentes/portada/Tarjetas";
import { Preguntas } from "@/componentes/portada/Preguntas";
import { Cierre } from "@/componentes/portada/Cierre";
import { PiePortada } from "@/componentes/portada/PiePortada";
import { Paralaje } from "@/componentes/portada/Paralaje";

export const metadata: Metadata = {
  title: "Luka · Sigue el rastro de tu dinero",
  description:
    "Control de gastos mensuales del hogar, con boletas y presupuestos. Cada hogar ve solo lo suyo.",
};

/**
 * La portada publica, «Mediodia», de punta a punta: el navbar propio de la
 * portada, el heroe, la vitrina con la seccion 06 · Presupuestos, las seis
 * tarjetas de lo que hace Luka, las preguntas, el cierre con Luka y su lupa,
 * y el pie.
 *
 * Vive en /bienvenida y no en / mientras el ingreso no exista: asi Fernando
 * sigue abriendo su app en / como siempre. Cuando el ingreso este listo, esta
 * pagina pasa a ser / y lo de hoy se mueve detras de la sesion.
 *
 * `portada` trae los tonos de la portada (globals.css) y `@container` deja que
 * cada seccion se acomode al ancho de la pagina con consultas de contenedor.
 * Las cifras son el mes de ejemplo de cifras-ejemplo.ts: ningun numero vive
 * escrito dentro de un componente.
 */
export default function Bienvenida() {
  return (
    <div className="portada @container min-h-svh">
      <NavPortada />
      <main>
        <Heroe />
        <Vitrina />
        <Tarjetas />
        <Preguntas />
        <Cierre />
      </main>
      <PiePortada />
      <Paralaje />
    </div>
  );
}
