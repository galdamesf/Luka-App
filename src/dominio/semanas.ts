import { diasEnMesISO } from "@/lib/fecha";
import { esPagoDeCuota, type CategoriaPlana, type GastoPlano } from "./resumen";

/**
 * El mes repartido en bloques de 7 dias desde el dia 1, igual que el informe
 * y el desglose de cada presupuesto: dias 1-7, 8-14, 15-21, 22-28 y, si el
 * mes los tiene, 29 en adelante.
 *
 * Los pagos de cuota no entran, igual que en resumirMes: tienen su propia
 * seccion y el balance ya los descuenta aparte.
 */

export type CategoriaDeSemana = { categoria: CategoriaPlana; total: number };

export type SemanaDelMes = {
  semana: number;
  desde: number;
  hasta: number;
  /** Dias del bloque que ya pasaron. En el mes en curso, hasta hoy inclusive. */
  diasTranscurridos: number;
  /** Hoy cae dentro de este bloque. */
  enCurso: boolean;
  total: number;
  esenciales: number;
  discrecionales: number;
  cantidad: number;
  /** total / diasTranscurridos. null si todavia no pasa ningun dia. */
  promedioDiario: number | null;
  /**
   * Cuanto cambio el gasto discrecional POR DIA contra el bloque anterior, en
   * %. Por dia y no total: el ultimo bloque tiene 2 o 3 dias y comparado en
   * total siempre pareceria que bajaste. null si no hay con que comparar.
   */
  tendencia: number | null;
  /** De mayor a menor. */
  categorias: CategoriaDeSemana[];
};

export type RitmoSemanal = {
  mes: string;
  semanas: SemanaDelMes[];
  /** La que conviene mostrar abierta: la en curso, o la ultima con dias. */
  semanaInicial: number;
  /** El mayor total semanal, para escalar las barras. */
  maximo: number;
  maximoDiscrecional: number;
  /** Lo gastado cada 7 dias, en promedio, sobre los dias que van. */
  promedioSemanal: number | null;
  promedioDiario: number | null;
  /** Solo lo discrecional, por dia, sobre los dias que van. */
  discrecionalDiario: number | null;
  /** La semana con mas gasto. null si el mes no tiene gastos. */
  semanaMasAlta: number | null;
};

export function ritmoSemanal(
  gastos: readonly GastoPlano[],
  mes: string,
  hoy: string,
): RitmoSemanal {
  const dias = diasEnMesISO(mes);
  const cantidad = Math.ceil(dias / 7);
  const mesDeHoy = hoy.slice(0, 7);
  const diaDeHoy = Number(hoy.slice(8, 10));
  const enCursoElMes = mes === mesDeHoy;
  const cerrado = mes < mesDeHoy;

  const porCategoria = Array.from({ length: cantidad }, () => new Map<string, CategoriaDeSemana>());
  const semanas: SemanaDelMes[] = Array.from({ length: cantidad }, (_, i) => {
    const desde = i * 7 + 1;
    const hasta = Math.min((i + 1) * 7, dias);
    const diasTranscurridos = cerrado
      ? hasta - desde + 1
      : enCursoElMes
        ? Math.max(0, Math.min(hasta, diaDeHoy) - desde + 1)
        : 0;
    return {
      semana: i + 1,
      desde,
      hasta,
      diasTranscurridos,
      enCurso: enCursoElMes && diaDeHoy >= desde && diaDeHoy <= hasta,
      total: 0,
      esenciales: 0,
      discrecionales: 0,
      cantidad: 0,
      promedioDiario: null,
      tendencia: null,
      categorias: [],
    };
  });

  for (const gasto of gastos) {
    if (!gasto.fecha.startsWith(mes) || esPagoDeCuota(gasto)) continue;
    const indice = Math.min(Math.floor((Number(gasto.fecha.slice(8, 10)) - 1) / 7), cantidad - 1);
    const semana = semanas[indice] as SemanaDelMes;
    semana.total += gasto.monto;
    semana.cantidad += 1;
    if (gasto.categoria.esencial) semana.esenciales += gasto.monto;
    else semana.discrecionales += gasto.monto;

    const mapa = porCategoria[indice] as Map<string, CategoriaDeSemana>;
    const fila = mapa.get(gasto.categoria.id);
    if (fila) fila.total += gasto.monto;
    else mapa.set(gasto.categoria.id, { categoria: gasto.categoria, total: gasto.monto });
  }

  semanas.forEach((semana, i) => {
    semana.categorias = [...(porCategoria[i] as Map<string, CategoriaDeSemana>).values()].sort(
      (a, b) => b.total - a.total || a.categoria.nombre.localeCompare(b.categoria.nombre, "es"),
    );
    semana.promedioDiario =
      semana.diasTranscurridos === 0 ? null : semana.total / semana.diasTranscurridos;

    const anterior = semanas[i - 1];
    // Una semana en curso sin gasto discrecional todavia no dice nada: el
    // primer dia del bloque daria "-100%" y se leeria como un logro.
    const prematura = semana.enCurso && semana.discrecionales === 0;
    if (anterior !== undefined && anterior.diasTranscurridos > 0 && semana.diasTranscurridos > 0 && !prematura) {
      const antes = anterior.discrecionales / anterior.diasTranscurridos;
      const ahora = semana.discrecionales / semana.diasTranscurridos;
      semana.tendencia = antes === 0 ? null : ((ahora - antes) / antes) * 100;
    }
  });

  const conDias = semanas.filter((s) => s.diasTranscurridos > 0);
  const diasQueVan = conDias.reduce((suma, s) => suma + s.diasTranscurridos, 0);
  const total = semanas.reduce((suma, s) => suma + s.total, 0);
  const discrecional = semanas.reduce((suma, s) => suma + s.discrecionales, 0);
  const enCurso = semanas.find((s) => s.enCurso);
  const masAlta = semanas.reduce<SemanaDelMes | null>(
    (mayor, s) => (s.total > 0 && (mayor === null || s.total > mayor.total) ? s : mayor),
    null,
  );

  return {
    mes,
    semanas,
    // La en curso si ya tiene gastos; si no, la ultima que tuvo. Abrir una
    // semana vacia (el dia 29, la quinta recien empieza) no muestra nada.
    semanaInicial:
      (enCurso !== undefined && enCurso.cantidad > 0 ? enCurso.semana : undefined) ??
      [...conDias].reverse().find((s) => s.cantidad > 0)?.semana ??
      enCurso?.semana ??
      conDias[conDias.length - 1]?.semana ??
      1,
    maximo: Math.max(0, ...semanas.map((s) => s.total)),
    maximoDiscrecional: Math.max(0, ...semanas.map((s) => s.discrecionales)),
    promedioSemanal: diasQueVan === 0 ? null : (total / diasQueVan) * 7,
    promedioDiario: diasQueVan === 0 ? null : total / diasQueVan,
    discrecionalDiario: diasQueVan === 0 ? null : discrecional / diasQueVan,
    semanaMasAlta: masAlta?.semana ?? null,
  };
}

export type NivelSemana = "bajo" | "normal" | "alto" | "muy-alto";

/**
 * Donde corta cada nivel, como veces el ritmo discrecional del mes: hasta
 * 0.85 es bajo, hasta 1.15 es normal (±15% es ruido de una semana a otra),
 * hasta 1.5 es alto y de ahi para arriba, muy alto.
 */
export const CORTES_NIVEL = { bajo: 0.85, normal: 1.15, alto: 1.5 } as const;

/**
 * Que tan cargada fue una semana: su gasto discrecional por dia contra el
 * del mes. Discrecional y no total porque el arriendo hace que la primera
 * semana siempre parezca la peor, y eso no es algo que se pueda corregir.
 *
 * `veces` es la razon: 1 es exactamente el ritmo del mes.
 *
 * null si todavia no se puede decir: la semana no empieza, no tiene ningun
 * gasto registrado (casi siempre es que no se anoto, no que no se gasto: no
 * se puede llamar "baja"), el mes no tiene gasto discrecional, o la semana en
 * curso aun no gasta nada discrecional (el primer dia del bloque se leeria
 * como "bajo" sin serlo).
 */
export function nivelDeSemana(
  semana: SemanaDelMes,
  ritmo: Pick<RitmoSemanal, "discrecionalDiario">,
): { nivel: NivelSemana; veces: number } | null {
  if (semana.diasTranscurridos === 0 || semana.cantidad === 0) return null;
  if (semana.enCurso && semana.discrecionales === 0) return null;
  const delMes = ritmo.discrecionalDiario;
  if (delMes === null || delMes === 0) return null;

  const veces = semana.discrecionales / semana.diasTranscurridos / delMes;
  const nivel: NivelSemana =
    veces <= CORTES_NIVEL.bajo
      ? "bajo"
      : veces <= CORTES_NIVEL.normal
        ? "normal"
        : veces <= CORTES_NIVEL.alto
          ? "alto"
          : "muy-alto";
  return { nivel, veces };
}

/**
 * Cuanto habras gastado al cerrar el mes si sigues igual.
 *
 * Suma lo gastado, lo que falta pagar (cuentas y cuotas, que van a salir
 * igual) y lo discrecional al ritmo diario que llevas, por los dias que
 * quedan DESPUES de hoy: lo de hoy ya esta en lo gastado. Lo esencial no se
 * proyecta: o ya se pago o esta en "por pagar". null fuera del mes en curso.
 */
export function proyectarCierre(
  gastado: number,
  porPagar: number,
  diasRestantes: number,
  ritmo: RitmoSemanal,
  enCurso: boolean,
): number | null {
  if (!enCurso || ritmo.discrecionalDiario === null) return null;
  return gastado + porPagar + ritmo.discrecionalDiario * Math.max(0, diasRestantes - 1);
}
