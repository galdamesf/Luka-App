import type { ResumenPanel } from "./panel";
import type { ResumenPresupuestos } from "./presupuestos";

/**
 * El Health Score del mes: un numero de 0 a 100 que junta cinco senales.
 *
 *   ahorro         30  lo que te sobraria del sueldo si pagas todo lo pendiente
 *   presupuestos   25  cuantos van dentro de su techo
 *   cuentas        20  si tienes cuentas vencidas (cada una resta 10)
 *   deuda          15  cuanto del sueldo se va en cuotas
 *   ritmo          10  si gastas mas rapido de lo que pasa el mes
 *
 * Un factor que no aplica (sin presupuestos, o un mes cerrado para el ritmo)
 * no se cuenta como cero: se saca, y el puntaje se escala sobre lo que queda.
 * Si no, un mes sin presupuestos se veria peor que uno con presupuestos
 * reventados.
 */

/** Meta de ahorro, en % del sueldo. La regla 50/30/20 deja 20 para ahorrar. */
export const META_AHORRO = 20;
/** Bajo este % del sueldo en cuotas, la carga es sana. */
export const CARGA_SANA = 25;
/** Desde este % la carga ya no suma nada. */
export const CARGA_LIMITE = 40;
/** Cuanto resta cada cuenta vencida, de los 20 de "cuentas al dia". */
export const CASTIGO_POR_VENCIDA = 10;

export type ClaveFactor = "ahorro" | "presupuestos" | "cuentas" | "deuda" | "ritmo";

export type FactorSalud = {
  clave: ClaveFactor;
  nombre: string;
  puntos: number;
  maximo: number;
  detalle: string;
};

export type BandaSalud = "excelente" | "buena" | "regular" | "critica";

export type Recomendacion = {
  titulo: string;
  texto: string;
  accion: string;
  /** Ancla de la seccion donde se resuelve, "#pagos". */
  destino: string;
};

export type SaludFinanciera = {
  /** null si falta el sueldo: sin el no hay como medir ni ahorro ni carga. */
  puntaje: number | null;
  banda: BandaSalud | null;
  /** Solo los que aplican este mes. */
  factores: FactorSalud[];
  recomendacion: Recomendacion | null;
};

export type EntradaSalud = {
  panel: ResumenPanel;
  presupuestos: ResumenPresupuestos;
  /** Todas las cuotas que caen este mes, pagadas o no. */
  cuotasDelMes: number;
};

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const pesos = (n: number) => CLP.format(Math.round(n));
const pct = (n: number) => `${Math.round(n)}%`;
const limitar = (n: number) => Math.max(0, Math.min(1, n));

export function bandaDe(puntaje: number): BandaSalud {
  if (puntaje >= 85) return "excelente";
  if (puntaje >= 70) return "buena";
  if (puntaje >= 40) return "regular";
  return "critica";
}

function factoresDe({ panel, presupuestos, cuotasDelMes }: EntradaSalud): FactorSalud[] {
  const { sueldo, gastado, porPagar, cuentasVencidas, montoVencido, barra } = panel;
  const factores: FactorSalud[] = [];

  const tasa = ((sueldo - gastado - porPagar) / sueldo) * 100;
  factores.push({
    clave: "ahorro",
    nombre: "Tasa de ahorro",
    puntos: Math.round(limitar(tasa / META_AHORRO) * 30),
    maximo: 30,
    detalle:
      tasa < 0
        ? "Si pagas todo lo pendiente, este mes sale más de lo que entra."
        : `Si pagas todo lo pendiente, te queda el ${pct(tasa)} del sueldo (meta: ${META_AHORRO}%).`,
  });

  const { lineas } = presupuestos;
  if (lineas.length > 0) {
    const dentro = lineas.filter((l) => !l.excedido).length;
    factores.push({
      clave: "presupuestos",
      nombre: "Presupuestos dentro del límite",
      puntos: Math.round((dentro / lineas.length) * 25),
      maximo: 25,
      detalle: `${dentro} de ${lineas.length} ${lineas.length === 1 ? "presupuesto va" : "presupuestos van"} dentro de su techo.`,
    });
  }

  factores.push({
    clave: "cuentas",
    nombre: "Cuentas al día",
    puntos: Math.max(0, 20 - CASTIGO_POR_VENCIDA * cuentasVencidas),
    maximo: 20,
    detalle:
      cuentasVencidas === 0
        ? "No tienes cuentas vencidas."
        : `${cuentasVencidas} ${cuentasVencidas === 1 ? "cuenta vencida" : "cuentas vencidas"} por ${pesos(montoVencido)}. Cada una resta ${CASTIGO_POR_VENCIDA} puntos.`,
  });

  const carga = (cuotasDelMes / sueldo) * 100;
  factores.push({
    clave: "deuda",
    nombre: "Carga de deuda",
    puntos: Math.round(limitar((CARGA_LIMITE - carga) / (CARGA_LIMITE - CARGA_SANA)) * 15),
    maximo: 15,
    detalle:
      cuotasDelMes === 0
        ? "No tienes cuotas este mes."
        : `Tus cuotas son el ${pct(carga)} de tu sueldo (sano: bajo ${CARGA_SANA}%).`,
  });

  if (barra.ritmo !== null && barra.marcadorDia !== null && barra.marcadorDia > 0) {
    const razon = barra.gastadoPct / barra.marcadorDia;
    factores.push({
      clave: "ritmo",
      nombre: "Ritmo de gasto",
      puntos: Math.round(razon <= 1 ? 10 : limitar(1 - (razon - 1) / 0.3) * 10),
      maximo: 10,
      detalle: `Llevas el ${pct(barra.gastadoPct)} del sueldo con el ${pct(barra.marcadorDia)} del mes.`,
    });
  }

  return factores;
}

function puntajeDe(factores: readonly FactorSalud[]): number {
  const maximo = factores.reduce((s, f) => s + f.maximo, 0);
  const puntos = factores.reduce((s, f) => s + f.puntos, 0);
  return maximo === 0 ? 0 : Math.round((puntos / maximo) * 100);
}

/** Solo el numero, para comparar con el mes anterior. */
export function puntajeDeSalud(entrada: EntradaSalud): number | null {
  if (entrada.panel.sinSueldo || entrada.panel.sueldo <= 0) return null;
  return puntajeDe(factoresDe(entrada));
}

function recomendar(entrada: EntradaSalud, puntaje: number): Recomendacion {
  const { panel, presupuestos } = entrada;

  // 1. Lo vencido primero: es lo que mas pesa y lo unico que ya esta atrasado.
  if (panel.cuentasVencidas > 0) {
    // Pagar no cambia el ahorro proyectado (la plata ya estaba comprometida):
    // pasa de "por pagar" a "gastado". Lo que si cambia es cuentas al dia.
    const pagando = puntajeDe(
      factoresDe({
        ...entrada,
        panel: {
          ...panel,
          cuentasVencidas: 0,
          montoVencido: 0,
          gastado: panel.gastado + panel.montoVencido,
          porPagar: panel.porPagar - panel.montoVencido,
          barra: {
            ...panel.barra,
            gastadoPct: panel.barra.gastadoPct + (panel.montoVencido / panel.sueldo) * 100,
          },
        },
      }),
    );
    const una = panel.cuentasVencidas === 1;
    return {
      titulo: una ? "Paga tu cuenta vencida" : `Paga tus ${panel.cuentasVencidas} cuentas vencidas`,
      texto: `${una ? "Es" : "Suman"} ${pesos(panel.montoVencido)} y hoy son lo que más baja tu score: al pagar${una ? "la" : "las"} subiría de ${puntaje} a ${pagando} puntos.`,
      accion: "Ir a pagos",
      destino: "#pagos",
    };
  }

  // 2. Un presupuesto reventado: el que mas se paso.
  const excedida = [...presupuestos.lineas]
    .filter((l) => l.excedido)
    .sort((a, b) => a.restante - b.restante)[0];
  if (excedida !== undefined) {
    return {
      titulo: `${excedida.presupuesto.categoria.nombre} pasó su presupuesto`,
      texto: `Se pasó por ${pesos(-excedida.restante)}. Revisa sus gastos antes de cerrar el mes, o súbele el techo si el presupuesto quedó corto.`,
      accion: "Ver presupuestos",
      destino: "#presupuestos",
    };
  }

  // 3. Lo que vence esta semana.
  if (panel.porVencer > 0) {
    return {
      titulo:
        panel.porVencer === 1
          ? "Tienes una cuenta que vence esta semana"
          : `Tienes ${panel.porVencer} cuentas que vencen esta semana`,
      texto: "Pagarlas a tiempo mantiene completos los 20 puntos de cuentas al día.",
      accion: "Ver pagos",
      destino: "#pagos",
    };
  }

  // 4. El ahorro bajo la meta.
  const libre = panel.sueldo - panel.gastado - panel.porPagar;
  const meta = (panel.sueldo * META_AHORRO) / 100;
  if (libre < meta) {
    return {
      titulo: `Te faltan ${pesos(meta - libre)} para la meta de ahorro`,
      texto: `La meta es guardar el ${META_AHORRO}% del sueldo. Mira en qué semana y en qué categorías se fue más plata.`,
      accion: "Ver el ritmo semanal",
      destino: "#semanas",
    };
  }

  return {
    titulo: "Vas muy bien este mes",
    texto: "Estás al día, dentro de tus presupuestos y sobre la meta de ahorro. Si cierras así, lo que sobre puede ir directo a ahorro.",
    accion: "Ver presupuestos",
    destino: "#presupuestos",
  };
}

export function calcularSalud(entrada: EntradaSalud): SaludFinanciera {
  if (entrada.panel.sinSueldo || entrada.panel.sueldo <= 0) {
    return { puntaje: null, banda: null, factores: [], recomendacion: null };
  }
  const factores = factoresDe(entrada);
  const puntaje = puntajeDe(factores);
  return {
    puntaje,
    banda: bandaDe(puntaje),
    factores,
    recomendacion: recomendar(entrada, puntaje),
  };
}
