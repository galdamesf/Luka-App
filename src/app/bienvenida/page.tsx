import type { Metadata } from "next";
import { formatearCLP } from "@/lib/dinero";
import { Header } from "@/componentes/portada/Header";
import { ComoFunciona } from "@/componentes/portada/ComoFunciona";
import { Paseo } from "@/componentes/portada/Paseo";
import { Preguntas } from "@/componentes/portada/Preguntas";
import { Cierre } from "@/componentes/portada/Cierre";
import { MES_EJEMPLO, QUEDA_EJEMPLO } from "@/componentes/portada/cifras-ejemplo";

export const metadata: Metadata = {
  title: "Luka · Sigue el rastro de tu plata",
  description:
    "Control de gastos mensuales del hogar. Todo se queda en tu computador.",
};

/**
 * La portada publica, de punta a punta: el header con el paseo por la
 * cordillera, los seis paneles de «Como funciona», las cinco paradas del
 * paseo, las preguntas y el cierre.
 *
 * Vive en /bienvenida y no en / mientras el ingreso no exista: asi Fernando
 * sigue abriendo su app en / como siempre. Cuando el ingreso este listo, esta
 * pagina pasa a ser / y lo de hoy se mueve detras de la sesion.
 *
 * Las cifras que se ven son el mes de ejemplo de cifras-ejemplo.ts y entran
 * desde aqui: ningun numero vive escrito dentro de un componente.
 */
export default function Bienvenida() {
  return (
    <main>
      <Header />
      <ComoFunciona queda={formatearCLP(QUEDA_EJEMPLO)} categorias={MES_EJEMPLO.categorias} />
      <Paseo />
      <Preguntas />
      <Cierre />
    </main>
  );
}
