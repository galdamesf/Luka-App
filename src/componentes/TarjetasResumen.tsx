import type { ResumenMensual } from "@/dominio/resumen";
import { formatearCLP, porcentajeLegible } from "./formato";

type Props = { resumen: ResumenMensual };

function Tarjeta({
  titulo,
  valor,
  detalle,
  acento,
}: {
  titulo: string;
  valor: string;
  detalle?: string;
  acento?: boolean;
}) {
  return (
    <div className="rounded-lg border border-borde bg-superficie p-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-texto-tenue">
        {titulo}
      </h3>
      <p
        className={`cifra mt-2 text-2xl font-semibold tabular-nums sm:text-3xl ${
          acento ? "text-exito" : "text-texto"
        }`}
      >
        {valor}
      </p>
      {detalle !== undefined && (
        <p className="mt-1 text-xs text-texto-tenue">{detalle}</p>
      )}
    </div>
  );
}

export function TarjetasResumen({ resumen }: Props) {
  const { total, esenciales, discrecionales, cantidad } = resumen;

  const pct = (parte: number) => (total === 0 ? 0 : (parte / total) * 100);

  return (
    <section aria-label="Resumen del mes">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta
          titulo="Total del mes"
          valor={formatearCLP(total)}
          detalle={`${cantidad} ${cantidad === 1 ? "gasto" : "gastos"}`}
          acento
        />
        <Tarjeta
          titulo="Esenciales"
          valor={formatearCLP(esenciales)}
          detalle={`${porcentajeLegible(pct(esenciales))} del total`}
        />
        <Tarjeta
          titulo="Discrecionales"
          valor={formatearCLP(discrecionales)}
          detalle={`${porcentajeLegible(pct(discrecionales))} del total`}
        />
        <Tarjeta
          titulo="Promedio diario"
          valor={formatearCLP(Math.round(resumen.promedioDiario))}
          detalle={
            resumen.mesEnCurso
              ? `sobre ${resumen.diasConsiderados} días corridos`
              : `sobre los ${resumen.diasConsiderados} días del mes`
          }
        />
      </div>
    </section>
  );
}
