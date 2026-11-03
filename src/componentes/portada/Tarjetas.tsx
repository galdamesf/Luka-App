import { ANCLA_QUE_HACEMOS } from "./enlaces";

/**
 * Lo que hace Luka, en seis tarjetas de borde fino con el titulo en color de
 * marca. Cada promesa sale de la app tal como es hoy: el mes de pago a pago
 * (lib/periodo.ts), los avisos de presupuesto (dominio/presupuestos.ts), las
 * boletas, las categorias que trae (dominio/categorias-base.ts), las cuentas
 * y cuotas que se anotan solas y el Health Score (dominio/salud.ts).
 *
 * Es el destino de «¿Que hacemos?», en el navbar y en el heroe.
 */
export const TARJETAS: readonly { titulo: string; texto: string }[] = [
  {
    titulo: "Tu mes, de pago a pago",
    texto:
      "Tu día de inicio es el día en que te pagan. Si es el 27, tu octubre va del 27 de septiembre al 26 de octubre, y lo que te queda habla del mes que estás viviendo.",
  },
  {
    titulo: "Presupuesto por categoría",
    texto:
      "Ponle un techo a la feria, al café o a la bencina. Luka te avisa desde el 80%, cuando llegas al 100% y si te pasas.",
  },
  {
    titulo: "Cada gasto con su boleta",
    texto:
      "El monto, su categoría y la foto o el PDF de la boleta, para cuando alguien pregunte de dónde salió. Trae veintidós categorías listas.",
  },
  {
    titulo: "Cuentas que se anotan solas",
    texto:
      "La luz, el agua, internet. Marcas una como pagada y el gasto aparece en su categoría, ya restado de lo que te queda.",
  },
  {
    titulo: "Cuotas que no se olvidan",
    texto:
      "Cada mes sabe qué cuota toca: la 12 de 24 del crédito, la 5 de 12 del notebook. Al pagarla, se anota sola.",
  },
  {
    titulo: "La salud de tu mes",
    texto:
      "El Health Score: un número de 0 a 100 que junta tu ahorro, tus presupuestos, tus cuentas, tus deudas y tu ritmo de gasto, con una recomendación para subirlo.",
  },
];

/**
 * Cada tarjeta lleva esquinas de 24 px y, abajo, el mismo canto de 3 px de los
 * botones (.boton-luka en globals.css): son de la misma familia.
 */
export function Tarjetas() {
  return (
    <section
      id={ANCLA_QUE_HACEMOS}
      aria-labelledby="portada-tarjetas"
      className="mx-auto max-w-5xl scroll-mt-24 px-5 pb-20 @3xl:pb-28"
    >
      <h2 id="portada-tarjetas" className="sr-only">
        Lo que hace Luka
      </h2>
      <ul className="grid grid-cols-1 gap-5 @3xl:grid-cols-2 @3xl:gap-7">
        {TARJETAS.map((t, i) => (
          <li
            key={t.titulo}
            // Las dos columnas van a distinta velocidad: la de la derecha se
            // adelanta y las tarjetas se desfasan al bajar.
            data-paralaje={i % 2 === 0 ? "0.06" : "0.2"}
            data-paralaje-min="-70"
            data-paralaje-max="70"
            className="rounded-3xl border border-borde bg-superficie px-7 py-9 text-center shadow-[0_3px_0_var(--acento-canto)] transition-transform duration-200 hover:-translate-y-0.5 @3xl:px-10"
          >
            <h3 className="text-[1.3rem] leading-tight font-extrabold text-titulo">{t.titulo}</h3>
            <p className="mx-auto mt-3 max-w-[42ch] leading-relaxed text-texto-tenue">{t.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
