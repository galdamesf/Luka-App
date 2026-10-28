import { esPagoDeCuota, type CategoriaPlana, type GastoPlano } from "./resumen";

/**
 * Presupuesto por categoria y mes, y cuanto se lleva gastado contra el.
 *
 * Funciones puras: reciben los presupuestos y los gastos del mes, devuelven
 * las lineas ya calculadas. Sin Prisma ni React.
 */

export type PresupuestoPlano = {
  id: string;
  categoria: CategoriaPlana;
  /** Mes al que aplica, "YYYY-MM". */
  mes: string;
  monto: number;
  /** Dia en que se creo, "YYYY-MM-DD". */
  creadoEn: string;
};

export type LineaPresupuesto = {
  presupuesto: PresupuestoPlano;
  /** Lo gastado en esa categoria durante el mes. */
  gastado: number;
  /** monto - gastado. Negativo si se paso. */
  restante: number;
  /** Cuanto se consumio, 0 a 100 o mas. Sin tope: pasarse se tiene que ver. */
  porcentaje: number;
  /** Ya no queda nada: gastaste justo el tope o te pasaste. */
  agotado: boolean;
  excedido: boolean;
  /** Cerca del limite: 80% o mas, sin haberse pasado todavia. */
  alLimite: boolean;
};

/**
 * Las tres cosas distintas que se avisan arriba de la seccion.
 *
 * Van separadas y no como un solo contador porque no son el mismo aviso:
 * "te queda poco" se puede corregir, "ya no queda" no, y "te pasaste" ya
 * paso. Meterlas en una sola linea obliga a leer el detalle para saber cual
 * de las tres es.
 */
export type AlertasPresupuesto = {
  /** Gastaste mas que el techo. */
  excedidas: CategoriaPlana[];
  /** Justo en el techo: no te pasaste, pero no queda nada. */
  enElTope: CategoriaPlana[];
  /** Del 80% para arriba y todavia queda algo. */
  cerca: CategoriaPlana[];
};

export type ResumenPresupuestos = {
  mes: string;
  lineas: LineaPresupuesto[];
  totalPresupuestado: number;
  /** Lo gastado SOLO en categorias con presupuesto. */
  totalGastado: number;
  totalRestante: number;
  /** Cuantas categorias se pasaron del presupuesto. */
  excedidas: number;
  /** Las categorias que hay que avisar, ya separadas por que les pasa. */
  alertas: AlertasPresupuesto;
  /** Categorias con gasto este mes y sin presupuesto puesto. */
  sinPresupuesto: CategoriaPlana[];
};

/** Desde donde se considera que una categoria esta al limite. */
const UMBRAL_LIMITE = 80;

/**
 * Arma el resumen de presupuestos del mes.
 *
 * Los pagos de cuota se dejan fuera del gasto por categoria, igual que en
 * resumirMes: tienen su propia seccion y el balance ya los descuenta aparte.
 * Si entraran aqui, un presupuesto de "Deudas y creditos" se consumiria con
 * plata que ya se conto en otro lado.
 */
export function armarPresupuestos(
  presupuestos: readonly PresupuestoPlano[],
  gastos: readonly GastoPlano[],
  mes: string,
): ResumenPresupuestos {
  const delMes = gastos.filter((g) => g.fecha.startsWith(mes) && !esPagoDeCuota(g));

  const gastadoPorCategoria = new Map<string, number>();
  for (const g of delMes) {
    gastadoPorCategoria.set(
      g.categoria.id,
      (gastadoPorCategoria.get(g.categoria.id) ?? 0) + g.monto,
    );
  }

  const delMesPresupuestado = presupuestos.filter((p) => p.mes === mes);

  const lineas: LineaPresupuesto[] = delMesPresupuestado
    .map((presupuesto) => {
      const gastado = gastadoPorCategoria.get(presupuesto.categoria.id) ?? 0;
      const restante = presupuesto.monto - gastado;
      // El monto nunca es 0 (lo impide la base), pero si alguien lo saltara
      // no se divide por cero.
      const porcentaje = presupuesto.monto === 0 ? 0 : (gastado / presupuesto.monto) * 100;

      return {
        presupuesto,
        gastado,
        restante,
        porcentaje,
        // `agotado` es "no queda nada": justo en el tope o pasado. Es lo que
        // pinta la barra de rojo. `excedido` sigue siendo solo pasarse, porque
        // de eso depende el texto ("te pasaste por X"), y gastar exactamente
        // el presupuesto no es pasarse.
        agotado: gastado >= presupuesto.monto,
        excedido: gastado > presupuesto.monto,
        alLimite: porcentaje >= UMBRAL_LIMITE && gastado < presupuesto.monto,
      };
    })
    // Lo mas consumido primero: lo que esta por reventar va arriba. A igual
    // porcentaje, por nombre, para que el orden no baile entre renders.
    .sort(
      (a, b) =>
        b.porcentaje - a.porcentaje ||
        a.presupuesto.categoria.nombre.localeCompare(b.presupuesto.categoria.nombre, "es"),
    );

  const conPresupuesto = new Set(delMesPresupuestado.map((p) => p.categoria.id));

  // Categorias donde si hubo gasto pero nadie puso presupuesto. Sirve para
  // ofrecerlas de primeras al crear uno.
  const sinPresupuesto = new Map<string, CategoriaPlana>();
  for (const g of delMes) {
    if (!conPresupuesto.has(g.categoria.id)) sinPresupuesto.set(g.categoria.id, g.categoria);
  }

  const totalPresupuestado = lineas.reduce((s, l) => s + l.presupuesto.monto, 0);
  const totalGastado = lineas.reduce((s, l) => s + l.gastado, 0);

  return {
    mes,
    lineas,
    totalPresupuestado,
    totalGastado,
    totalRestante: totalPresupuestado - totalGastado,
    excedidas: lineas.filter((l) => l.excedido).length,
    alertas: {
      excedidas: lineas.filter((l) => l.excedido).map((l) => l.presupuesto.categoria),
      // En el tope exacto: agotado pero sin pasarse. Es su propio aviso.
      enElTope: lineas
        .filter((l) => l.agotado && !l.excedido)
        .map((l) => l.presupuesto.categoria),
      cerca: lineas.filter((l) => l.alLimite).map((l) => l.presupuesto.categoria),
    },
    sinPresupuesto: [...sinPresupuesto.values()].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    ),
  };
}

export type SemanaDeCategoria = {
  /** 1, 2, 3... contando desde el dia 1 del mes. */
  semana: number;
  /** Dia del mes en que empieza y termina el bloque. */
  desde: number;
  hasta: number;
  total: number;
  gastos: GastoPlano[];
};

export type DetalleDeCategoria = {
  categoriaId: string;
  /** Todos los gastos del mes en esa categoria, del mas nuevo al mas viejo. */
  gastos: GastoPlano[];
  total: number;
  cantidad: number;
  /** Los mismos gastos repartidos por semana. Las vacias vienen igual. */
  semanas: SemanaDeCategoria[];
  /** Cuantos tienen boleta adjunta. */
  conBoleta: number;
};

/**
 * El desglose de una categoria: que se gasto, cuando y cuanto.
 *
 * Las semanas son bloques de 7 dias desde el dia 1, igual que en el informe:
 * no son semanas de calendario a proposito, para que no cambien de forma
 * segun en que dia caiga el primero.
 *
 * Los pagos de cuota quedan fuera, igual que en el presupuesto que este
 * desglose explica: si entraran, la suma del detalle no calzaria con la
 * barra de arriba.
 */
export function detalleDeCategoria(
  gastos: readonly GastoPlano[],
  categoriaId: string,
  mes: string,
  diasDelMes: number,
): DetalleDeCategoria {
  const delMes = gastos
    .filter(
      (g) =>
        g.fecha.startsWith(mes) && g.categoria.id === categoriaId && !esPagoDeCuota(g),
    )
    // Del mas nuevo al mas viejo; a igual fecha, el mas caro primero, y el id
    // como ultimo desempate para que el orden no baile entre renders.
    .sort(
      (a, b) =>
        b.fecha.localeCompare(a.fecha) || b.monto - a.monto || a.id.localeCompare(b.id),
    );

  const cantidadSemanas = Math.max(1, Math.ceil(diasDelMes / 7));
  const semanas: SemanaDeCategoria[] = Array.from(
    { length: cantidadSemanas },
    (_, i) => ({
      semana: i + 1,
      desde: i * 7 + 1,
      hasta: Math.min((i + 1) * 7, diasDelMes),
      total: 0,
      gastos: [],
    }),
  );

  for (const gasto of delMes) {
    const dia = Number(gasto.fecha.slice(8, 10));
    const indice = Math.min(Math.max(Math.floor((dia - 1) / 7), 0), cantidadSemanas - 1);
    const semana = semanas[indice] as SemanaDeCategoria;
    semana.total += gasto.monto;
    semana.gastos.push(gasto);
  }

  return {
    categoriaId,
    gastos: delMes,
    total: delMes.reduce((s, g) => s + g.monto, 0),
    cantidad: delMes.length,
    semanas,
    conBoleta: delMes.filter((g) => g.boletaArchivo !== null).length,
  };
}
