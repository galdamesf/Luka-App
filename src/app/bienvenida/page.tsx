import type { Metadata } from "next";
import { Header } from "@/componentes/portada/Header";

export const metadata: Metadata = {
  title: "Luka · Sigue el rastro de tu plata",
  description:
    "Control de gastos mensuales del hogar. Todo se queda en tu computador.",
};

/**
 * La portada publica.
 *
 * Vive en /bienvenida y no en / mientras el ingreso no exista: asi Fernando
 * sigue abriendo su app en / como siempre. Cuando el ingreso este listo,
 * esta pagina pasa a ser / y lo de hoy se mueve detras de la sesion.
 */
export default function Bienvenida() {
  return (
    <main>
      <Header />
    </main>
  );
}
