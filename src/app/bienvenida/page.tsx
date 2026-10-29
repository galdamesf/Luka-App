import type { Metadata } from "next";
import { Header } from "@/componentes/portada/Header";
import { ComoFunciona } from "@/componentes/portada/ComoFunciona";
import { CATEGORIAS_BASE } from "@/dominio/categorias-base";

export const metadata: Metadata = {
  title: "Luka · Sigue el rastro de tu plata",
  description:
    "Control de gastos mensuales del hogar. Todo se queda en tu computador.",
};

/**
 * La portada publica.
 *
 * Vive en /bienvenida y no en / mientras el ingreso no exista: asi Fernando
 * sigue abriendo su app en / como siempre. Cuando el ingreso este listo, esta
 * pagina pasa a ser / y lo de hoy se mueve detras de la sesion.
 *
 * Las cifras de los paneles son de ejemplo y se pasan desde aqui, nunca
 * escritas dentro del componente: el dia que la portada muestre el mes real
 * de quien la mira, cambia esta linea y nada mas.
 */
export default function Bienvenida() {
  return (
    <main>
      <Header />
      <ComoFunciona queda="$428.020" categorias={CATEGORIAS_BASE.length} />
    </main>
  );
}
