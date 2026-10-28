import type { Balance } from "@/dominio/balance";
import { repartirGastos, type GastoPlano } from "@/dominio/resumen";
import { LineaGastosDesplegable } from "./LineaGastosDesplegable";
import { formatearCLP, nombreDelMes, porcentajeLegible } from "./formato";

type Props = {
  balance: Balance;
  /** Los gastos del mes, para poder abrir cada linea y ver de que esta hecha. */
  gastos: readonly GastoPlano[];
  /** El formulario de sueldo, que es componente de cliente. */
  children?: React.ReactNode;
};

function Linea({
  etiqueta,
  monto,
  signo,
  detalle,
  tenue,
}: {
  etiqueta: string;
  monto: number;
  signo?: "menos";
  detalle?: string;
  tenue?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={`text-sm ${tenue ? "text-texto-tenue" : ""}`}>
        {signo === "menos" && (
          <span aria-hidden="true" className="mr-1 text-texto-tenue">−</span>
        )}
        {etiqueta}
        {detalle !== undefined && (
          <span className="ml-2 text-xs text-texto-tenue">{detalle}</span>
        )}
      </span>
      <span
        className={`cifra shrink-0 whitespace-nowrap text-sm tabular-nums ${
          tenue ? "text-texto-tenue" : "font-medium"
        }`}
      >
        {signo === "menos" && monto !== 0 ? "−" : ""}
        {formatearCLP(monto)}
      </span>
    </div>
  );
}

export function SecuenciaBalance({ balance, gastos, children }: Props) {
  const { esenciales, resto } = repartirGastos(gastos, balance.mes);
  const {
    sueldo, gastosBasicos, cuotas, gastosDiscrecionales,
    disponible, saldo, enRojo, sinSueldo, porcentajeComprometido, cuotasDelMes,
  } = balance;

  return (
    <section
      aria-labelledby="titulo-balance"
      className="rounded-lg border border-borde bg-superficie p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-balance" className="text-sm font-semibold">
          Balance de <span className="capitalize">{nombreDelMes(balance.mes)}</span>
        </h2>
        {!sinSueldo && (
          <p className="text-xs text-texto-tenue">
            {porcentajeLegible(porcentajeComprometido)} del sueldo comprometido
          </p>
        )}
      </div>

      {sinSueldo ? (
        <p className="mt-4 rounded-md bg-superficie-tenue px-3 py-4 text-center text-sm text-texto-tenue">
          Define tu sueldo para ver cuánto te queda cada mes.
        </p>
      ) : (
        <>
          {/* UNA sola cuenta que termina en UN solo numero.
              Antes "Disponible" aparecia como cifra grande en el medio y se
              leia como el resultado final, cuando es solo un paso: el total
              de verdad es el de abajo. Dos numeros grandes compitiendo en la
              misma tarjeta hacian dudar de cual era cual. */}
          <div className="mt-3">
            <Linea etiqueta="Sueldo" monto={sueldo} />
            <LineaGastosDesplegable
              etiqueta="Gastos en lo esencial"
              detalle="super, bencina, cuentas, salud…"
              monto={gastosBasicos}
              gastos={esenciales}
            />
            <Linea
              etiqueta="Cuotas de deudas"
              monto={cuotas}
              signo="menos"
              detalle={
                cuotasDelMes.length === 0
                  ? "ninguna este mes"
                  : `${cuotasDelMes.length} ${cuotasDelMes.length === 1 ? "cuota" : "cuotas"} ${
                      cuotas === 0 ? "· sin pagar todavía" : ""
                    }`.trim()
              }
            />
            <LineaGastosDesplegable
              etiqueta="Gastos en lo demás"
              detalle="restaurantes, ropa, salidas…"
              monto={gastosDiscrecionales}
              gastos={resto}
            />

            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-borde pt-2">
              <span className="text-sm font-semibold">
                {enRojo ? "Te pasaste por" : "Te queda"}
              </span>
              <span
                className={`cifra shrink-0 text-2xl font-semibold tabular-nums ${
                  enRojo ? "text-peligro" : "text-exito"
                }`}
              >
                {formatearCLP(Math.abs(saldo))}
              </span>
            </div>

            {/* El total gastado, explicito.
                Las dos lineas de arriba se reparten por categoria (esencial o
                no), y eso hacia dudar de si estaban TODOS los gastos: "gasté
                mucho mas que eso hoy". Mostrar la suma cierra esa duda sin
                tener que sumar a mano. */}
            <p className="mt-1.5 text-xs text-texto-tenue">
              Toca cualquiera de las dos líneas para ver qué hay adentro. Llevas{" "}
              <span className="cifra tabular-nums">
                {formatearCLP(gastosBasicos + gastosDiscrecionales)}
              </span>{" "}
              gastados este mes, entre las dos líneas.
            </p>
            <p className="mt-0.5 text-xs text-texto-tenue">
              Arrancaste con{" "}
              <span className="cifra tabular-nums">{formatearCLP(disponible)}</span> para
              gastar, después de lo fijo.
            </p>
          </div>

          {/* Barra de lo comprometido. La cifra ya esta arriba en texto, asi
              que esto no es la unica forma de saberlo. */}
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-superficie-tenue"
            aria-hidden="true"
          >
            <div
              className={`h-full rounded-full ${
                porcentajeComprometido > 100
                  ? "bg-peligro"
                  : porcentajeComprometido > 80
                    ? "bg-alerta"
                    : "bg-exito-fuerte"
              }`}
              style={{ width: `${Math.min(porcentajeComprometido, 100)}%` }}
            />
          </div>
        </>
      )}

      {children}
    </section>
  );
}
