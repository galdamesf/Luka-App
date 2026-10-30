import { ETIQUETA_MEDIO_PAGO, type MedioPago } from "./esquemas";
import { esPagoDeCuota, type CategoriaPlana, type GastoPlano } from "./resumen";
import { nivelDeSemana, ritmoSemanal, type NivelSemana } from "./semanas";

/**
 * El reporte de una semana: cada gasto, dia por dia, con sus totales y
 * contra la semana anterior. Lo mismo alimenta la pagina y el PDF, para que
 * nunca digan cosas distintas.
 *
 * Las semanas son los mismos bloques de 7 dias del dashboard (1-7, 8-14...).
 * Las cuotas de deudas van aparte y no suman al total, igual que en el resto
 * de la app: el balance ya las descuenta por su lado.
 */

export type EstadoSemana = "cerrada" | "en-curso" | "por-venir";

export type LineaCategoriaSemana = {
  categoria: CategoriaPlana;
  cantidad: number;
  total: number;
  /** Parte de la semana, 0 a 100. */
  porcentaje: number;
  /** Lo que sumo la misma categoria la semana anterior. null en la semana 1. */
  anterior: number | null;
};

export type LineaMedioSemana = {
  medio: MedioPago;
  nombre: string;
  cantidad: number;
  total: number;
  /** Parte de la semana, 0 a 100. */
  porcentaje: number;
};

export type DiaDelReporte = {
  fecha: string;
  /** Ya paso o es hoy. Los que vienen salen vacios y marcados como tales. */
  transcurrido: boolean;
  total: number;
  /** De mayor a menor monto. */
  gastos: GastoPlano[];
};

export type ReporteSemanal = {
  mes: string;
  semana: number;
  /** Cuantas semanas tiene el mes: 4 o 5. */
  semanasDelMes: number;
  fechaDesde: string;
  fechaHasta: string;
  estado: EstadoSemana;
  diasTranscurridos: number;
  totalDias: number;

  total: number;
  cantidad: number;
  esenciales: number;
  discrecionales: number;
  /** Sobre los dias que van. null si todavia no empieza. */
  promedioDiario: number | null;
  /** Lo gastado en el mes completo, sin cuotas. */
  totalDelMes: number;
  /** Que parte del mes cayo en esta semana, 0 a 100. null si el mes va en cero. */
  porcentajeDelMes: number | null;

  nivel: { nivel: NivelSemana; veces: number } | null;
  /** Discrecional por dia contra la semana anterior, en %. */
  tendencia: number | null;
  anterior: { semana: number; total: number; discrecionales: number; diasTranscurridos: number } | null;

  mayorGasto: GastoPlano | null;
  diaMasAlto: { fecha: string; total: number } | null;
  /** Cuantos gastos de la semana tienen la boleta adjunta. */
  conBoleta: number;

  /** De mayor a menor. */
  categorias: LineaCategoriaSemana[];
  /** De mayor a menor; solo los medios que se usaron. */
  medios: LineaMedioSemana[];
  /** Todos los dias del bloque, en orden, aunque no tengan gastos. */
  dias: DiaDelReporte[];
  /** Pagos de cuota de la semana, por fecha. No suman al total. */
  cuotas: GastoPlano[];
  totalCuotas: number;
};

const dosDigitos = (n: number) => String(n).padStart(2, "0");
const porMonto = (a: GastoPlano, b: GastoPlano) =>
  b.monto - a.monto || a.descripcion.localeCompare(b.descripcion, "es");

/**
 * Arma el reporte de la semana `semana` (1 a 5) de `mes`. null si esa semana
 * no existe en el mes (la quinta de un febrero de 28 dias).
 *
 * `gastos` son los del mes; los de otros meses se ignoran.
 */
export function armarReporteSemanal(
  gastos: readonly GastoPlano[],
  mes: string,
  semana: number,
  hoy: string,
): ReporteSemanal | null {
  const ritmo = ritmoSemanal(gastos, mes, hoy);
  const bloque = ritmo.semanas.find((s) => s.semana === semana);
  if (bloque === undefined) return null;
  const previo = ritmo.semanas.find((s) => s.semana === semana - 1) ?? null;

  const fechaDe = (dia: number) => `${mes}-${dosDigitos(dia)}`;
  const enBloque = (g: GastoPlano, desde: number, hasta: number) => {
    if (!g.fecha.startsWith(mes)) return false;
    const dia = Number(g.fecha.slice(8, 10));
    return dia >= desde && dia <= hasta;
  };

  const delMes = gastos.filter((g) => g.fecha.startsWith(mes));
  const deLaSemana = delMes.filter((g) => enBloque(g, bloque.desde, bloque.hasta));
  const normales = deLaSemana.filter((g) => !esPagoDeCuota(g));
  const cuotas = deLaSemana.filter(esPagoDeCuota).sort((a, b) => a.fecha.localeCompare(b.fecha) || porMonto(a, b));
  const total = bloque.total;
  const parte = (monto: number) => (total === 0 ? 0 : (monto / total) * 100);

  // Por categoria, con lo que la misma categoria sumo la semana anterior.
  const anteriorPorCategoria = new Map<string, number>();
  if (previo !== null) {
    for (const g of delMes) {
      if (esPagoDeCuota(g) || !enBloque(g, previo.desde, previo.hasta)) continue;
      anteriorPorCategoria.set(g.categoria.id, (anteriorPorCategoria.get(g.categoria.id) ?? 0) + g.monto);
    }
  }
  const categorias = new Map<string, LineaCategoriaSemana>();
  for (const g of normales) {
    const linea = categorias.get(g.categoria.id);
    if (linea) {
      linea.total += g.monto;
      linea.cantidad += 1;
    } else {
      categorias.set(g.categoria.id, {
        categoria: g.categoria,
        cantidad: 1,
        total: g.monto,
        porcentaje: 0,
        anterior: previo === null ? null : (anteriorPorCategoria.get(g.categoria.id) ?? 0),
      });
    }
  }

  const medios = new Map<MedioPago, LineaMedioSemana>();
  for (const g of normales) {
    const linea = medios.get(g.medioPago);
    if (linea) {
      linea.total += g.monto;
      linea.cantidad += 1;
    } else {
      medios.set(g.medioPago, { medio: g.medioPago, nombre: ETIQUETA_MEDIO_PAGO[g.medioPago], cantidad: 1, total: g.monto, porcentaje: 0 });
    }
  }

  const ultimoTranscurrido = bloque.desde + bloque.diasTranscurridos - 1;
  const dias: DiaDelReporte[] = [];
  for (let dia = bloque.desde; dia <= bloque.hasta; dia++) {
    const fecha = fechaDe(dia);
    const delDia = normales.filter((g) => g.fecha === fecha).sort(porMonto);
    dias.push({
      fecha,
      transcurrido: dia <= ultimoTranscurrido,
      total: delDia.reduce((suma, g) => suma + g.monto, 0),
      gastos: delDia,
    });
  }
  const diaMasAlto = dias.reduce<DiaDelReporte | null>(
    (mayor, d) => (d.total > 0 && (mayor === null || d.total > mayor.total) ? d : mayor),
    null,
  );

  const totalDelMes = ritmo.semanas.reduce((suma, s) => suma + s.total, 0);

  return {
    mes,
    semana,
    semanasDelMes: ritmo.semanas.length,
    fechaDesde: fechaDe(bloque.desde),
    fechaHasta: fechaDe(bloque.hasta),
    estado: bloque.enCurso ? "en-curso" : bloque.diasTranscurridos === 0 ? "por-venir" : "cerrada",
    diasTranscurridos: bloque.diasTranscurridos,
    totalDias: bloque.hasta - bloque.desde + 1,

    total,
    cantidad: bloque.cantidad,
    esenciales: bloque.esenciales,
    discrecionales: bloque.discrecionales,
    promedioDiario: bloque.promedioDiario,
    totalDelMes,
    porcentajeDelMes: totalDelMes === 0 ? null : (total / totalDelMes) * 100,

    nivel: nivelDeSemana(bloque, ritmo),
    tendencia: bloque.tendencia,
    anterior:
      previo === null
        ? null
        : { semana: previo.semana, total: previo.total, discrecionales: previo.discrecionales, diasTranscurridos: previo.diasTranscurridos },

    mayorGasto: [...normales].sort(porMonto)[0] ?? null,
    diaMasAlto: diaMasAlto === null ? null : { fecha: diaMasAlto.fecha, total: diaMasAlto.total },
    conBoleta: normales.filter((g) => g.boletaArchivo !== null).length,

    categorias: [...categorias.values()]
      .map((l) => ({ ...l, porcentaje: parte(l.total) }))
      .sort((a, b) => b.total - a.total || a.categoria.nombre.localeCompare(b.categoria.nombre, "es")),
    medios: [...medios.values()]
      .map((l) => ({ ...l, porcentaje: parte(l.total) }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, "es")),
    dias,
    cuotas,
    totalCuotas: cuotas.reduce((suma, g) => suma + g.monto, 0),
  };
}
