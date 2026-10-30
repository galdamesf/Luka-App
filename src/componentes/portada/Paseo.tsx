import { formatearCLP } from "@/lib/dinero";
import { Luka } from "@/componentes/Luka";
import { Onda } from "./Onda";
import {
  FALTA_CUENTAS,
  MES_EJEMPLO,
  QUEDA_EJEMPLO,
  RESTANTE_DEUDAS,
} from "./cifras-ejemplo";

/**
 * El paseo: cinco paradas unidas por un hilo punteado que baja en zigzag, y en
 * cada doblez Luka reaparece chico con la pieza REAL de la app al lado.
 *
 * Es la seccion elegida de las maquetas (la 13, «El paseo»), y su regla viene
 * de ahi: el hilo cruza a la altura del centro de las patas del perro —el 85 %
 * de su alto desde arriba— porque si pasa mas abajo, las patas claras no se
 * apoyan en nada y el perro flota. La geometria vive en globals.css bajo
 * `.paseo-*`: angosta, el hilo baja recto por el canal izquierdo; ancha,
 * zigzaguea con los porcentajes --d y --h de cada parada.
 *
 * La banda es NOCTURNA en los dos temas (tokens --noche-*), igual que la banda
 * durazno es clara en los dos: la portada no cambia de escena con el tema.
 *
 * Las cifras salen todas de cifras-ejemplo.ts. Ninguna esta escrita aqui.
 */

const plata = (n: number) => formatearCLP(n);

/** El semaforo de los techos: color del riel y ancho, desde el estado. */
const SEMAFORO = {
  tope: "var(--peligro)",
  aviso: "var(--alerta)",
  sobra: "var(--exito-fuerte)",
} as const;

type Parada = {
  hito: string;
  titulo: string;
  dice: string;
  carta: React.ReactNode;
  /** Geometria del hilo en la pagina ancha, como fraccion del ancho. */
  vars: { d: string; h: string; pad: string; xn: string };
  lado: "izq" | "der" | "medio";
};

function Carta({ children }: { children: React.ReactNode }) {
  return <div className="paseo-carta">{children}</div>;
}

export function Paseo() {
  const m = MES_EJEMPLO;
  const paradas: Parada[] = [
    {
      hito: "Parada 01 · El balance",
      titulo: "¿Cuánto te queda?",
      dice:
        "Luka resta solo: el sueldo, lo esencial, las cuotas del mes y lo demás. Y cada línea de gasto se abre para mostrarte de qué está hecha.",
      lado: "izq",
      vars: { d: "50%", h: "16%", pad: "21%", xn: "30%" },
      carta: (
        <Carta>
          <p className="paseo-ct">
            Balance de {m.nombre}
            <em>{m.comprometido}% comprometido</em>
          </p>
          <p className="paseo-r">
            <span>Sueldo</span>
            <span className="cifra">{plata(m.sueldo)}</span>
          </p>
          <p className="paseo-r">
            <span>− Gastos en lo esencial</span>
            <span className="cifra">−{plata(m.esenciales)}</span>
          </p>
          <p className="paseo-r">
            <span>− Cuotas de deudas</span>
            <span className="cifra">−{plata(m.cuotasPagadas)}</span>
          </p>
          <p className="paseo-r">
            <span>− Gastos en lo demás</span>
            <span className="cifra">−{plata(m.discrecionales)}</span>
          </p>
          <p className="paseo-tot">
            <b>Te queda</b>
            <span className="cifra text-exito-fuerte">{plata(QUEDA_EJEMPLO)}</span>
          </p>
        </Carta>
      ),
    },
    {
      hito: "Parada 02 · Los techos",
      titulo: "Un techo para cada categoría",
      dice:
        "Verde mientras sobra, ocre desde el 80 % y rojo al llegar al 100 %. El aviso de arriba dice qué categoría se pasó, con su nombre.",
      lado: "der",
      vars: { d: "16%", h: "84%", pad: "21%", xn: "46%" },
      carta: (
        <Carta>
          <p className="paseo-aviso">
            <i aria-hidden="true" />
            Café llegó al 100 % de su presupuesto.
          </p>
          {m.techos.map((t) => (
            <div key={t.categoria} className="paseo-techo">
              <div className="paseo-riel">
                <i
                  style={{
                    width: `${Math.min(100, (t.gastado / t.techo) * 100)}%`,
                    background: SEMAFORO[t.estado],
                  }}
                />
              </div>
              <p className="paseo-pp">
                <b>{t.categoria}</b>
                <span className="cifra">
                  {plata(t.gastado)} / {plata(t.techo)}
                </span>
              </p>
            </div>
          ))}
        </Carta>
      ),
    },
    {
      hito: "Parada 03 · La boleta",
      titulo: "La boleta, pegada al gasto",
      dice:
        "Le sacas una foto a la boleta y queda con el gasto. Cuando no te acuerdas de qué fue ese monto, la abres ahí mismo.",
      lado: "izq",
      vars: { d: "84%", h: "22%", pad: "26%", xn: "62%" },
      carta: (
        <Carta>
          <p className="paseo-ct">
            Gasto
            <em>{m.boleta.dia}</em>
          </p>
          <div className="paseo-gasto">
            <div className="paseo-gtex">
              <p>{m.boleta.que}</p>
              <span>{m.boleta.categoria} · con boleta</span>
            </div>
            <span className="paseo-gmonto cifra">{plata(m.boleta.monto)}</span>
            <span className="paseo-boleta" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
        </Carta>
      ),
    },
    {
      hito: "Parada 04 · Cuentas y cuotas",
      titulo: "Las del mes y las de tus deudas",
      dice:
        "Las cuentas de octubre quedan separadas entre pagadas y pendientes. Marcar una como pagada crea el gasto y lo descuenta de lo que te queda, sin escribirlo de nuevo.",
      lado: "der",
      vars: { d: "22%", h: "78%", pad: "26%", xn: "38%" },
      carta: (
        <Carta>
          <p className="paseo-ct">
            Cuentas de {m.nombre}
            <em>{m.cuentas.filter((c) => !c.pagada).length} pendientes</em>
          </p>
          {m.cuentas.map((c) => (
            <p key={c.que} className="paseo-r">
              <span>
                {c.que} · {c.pagada ? "pagada" : "pendiente"}
              </span>
              <span className="cifra">{plata(c.monto)}</span>
            </p>
          ))}
          <p className="paseo-tot">
            <b>Te falta pagar</b>
            <span className="cifra paseo-falta">{plata(FALTA_CUENTAS)}</span>
          </p>
          <p className="paseo-ct paseo-ct2">
            Deudas
            <em>queda por pagar {plata(RESTANTE_DEUDAS)}</em>
          </p>
          {m.deudas.map((d) => (
            <p key={d.que} className="paseo-r">
              <span>
                {d.que}
                <em>
                  cuota {d.cuota} de {d.de}
                </em>
              </span>
              <span className="cifra">{plata(d.monto)}</span>
            </p>
          ))}
        </Carta>
      ),
    },
    {
      hito: "Parada 05 · Las categorías",
      titulo: "Diecisiete cajones para el mes",
      dice:
        "Cada gasto cae en una categoría, con su color y su ícono. De ahí salen los informes del mes: el gráfico de en qué se fue la plata y la comparación con el mes anterior.",
      lado: "medio",
      vars: { d: "78%", h: "50%", pad: "0px", xn: "54%" },
      carta: (
        <Carta>
          <p className="paseo-ct">
            Categorías
            <em>{m.categorias}</em>
          </p>
          <p className="paseo-chips">
            {["Supermercado", "Feria", "Bencina", "Café", "Arriendo", "Cuentas", "Ropa", "Salidas", "Suscripciones"].map(
              (c) => (
                <span key={c}>{c}</span>
              ),
            )}
            <b>y {m.categorias - 9} más</b>
          </p>
        </Carta>
      ),
    },
  ];

  return (
    <section
      aria-label="El paseo: lo que Luka hace por tu mes"
      className="paseo con-onda relative overflow-x-clip"
    >
      <div className="mx-auto w-full max-w-[1080px] px-[clamp(20px,4vw,56px)] pt-[clamp(30px,5vw,64px)]">
        {paradas.map((p, i) => (
          <article
            key={p.hito}
            className={`paseo-parada paseo-${p.lado}`}
            style={
              {
                "--i": i,
                "--d": p.vars.d,
                "--h": p.vars.h,
                "--pad": p.vars.pad,
                "--xn": p.vars.xn,
              } as React.CSSProperties
            }
          >
            <span className="paseo-entra" aria-hidden="true" />
            <span className="paseo-piso" aria-hidden="true" />
            <span className="paseo-nodo" aria-hidden="true" />
            <span className="paseo-sale" aria-hidden="true" />
            <div className="paseo-perro" aria-hidden="true">
              <span className="paseo-anda">
                <Luka pose="rastreando" descripcion={null} className="h-full w-auto" />
              </span>
            </div>
            <div className="paseo-cuerpo">
              <div className="paseo-dice">
                <p className="paseo-hito">{p.hito}</p>
                <h2>{p.titulo}</h2>
                <p>{p.dice}</p>
              </div>
              <div className="paseo-arte">{p.carta}</div>
            </div>
          </article>
        ))}
      </div>
      <Onda color="durazno" curva={3} />
    </section>
  );
}
