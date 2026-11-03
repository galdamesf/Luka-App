import { mesesEntre, sumarMeses } from "@/lib/fecha";

/**
 * Que hay que hacer para pasar lo anotado en un mes a otro: las cuentas, los
 * presupuestos, los ahorros y el calendario de las deudas con sus pagos.
 *
 * Existe por el cambio de nombre de los meses: con el mes que empieza el 27,
 * lo que se anoto como "octubre" entre el 27 y el 31 de octubre es, en
 * realidad, de noviembre (27 oct – 26 nov). Funcion pura: recibe las filas y
 * devuelve el plan, sin tocar la base. Asi se puede mostrar antes de
 * aplicarlo y probar sin Postgres.
 *
 * El sueldo no se mueve: rige desde un mes en adelante, asi que el de octubre
 * ya vale para noviembre. Los gastos tampoco: van por su fecha.
 */

export type CuentaParaMover = {
  id: string;
  nombre: string;
  monto: number;
  pagada: boolean;
  /** Si ya tiene una boleta adjunta: entonces no es una copia sin tocar. */
  conBoleta: boolean;
};

export type PresupuestoParaMover = { id: string; categoriaId: string; categoriaNombre: string; monto: number };
export type AhorroParaMover = { id: string; monto: number; nota: string | null };

/** Lo de un mes que va anotado con ese mes. */
export type DatosDeUnMes = {
  cuentas: CuentaParaMover[];
  presupuestos: PresupuestoParaMover[];
  ahorros: AhorroParaMover[];
};

/** Una deuda con todos sus pagos, del mes que sean. */
export type DeudaParaMover = {
  id: string;
  nombre: string;
  /** "YYYY-MM". */
  primeraCuota: string;
  cuotasTotales: number;
  pagos: { id: string; mes: string; monto: number }[];
};

export type DeudaCorrida = {
  id: string;
  nombre: string;
  primeraCuota: string;
  nuevaPrimeraCuota: string;
  cuotasTotales: number;
  /** El numero de cuota que muestra el mes de destino, antes y despues. null si ese mes no tiene cuota. */
  cuotaAntes: number | null;
  cuotaDespues: number | null;
};

export type PagoCorrido = {
  id: string;
  deudaId: string;
  deudaNombre: string;
  monto: number;
  mes: string;
  nuevoMes: string;
};

export type Conflicto = { que: string; motivo: string };

export type PlanMovimiento = {
  cuentas: CuentaParaMover[];
  /**
   * Cuentas del mes de destino con el mismo nombre, pendientes y sin boleta:
   * son las copias que la app crea sola para las cuentas mensuales. Se quitan
   * para que la que se mueve no quede repetida.
   */
  copiasQueSobran: CuentaParaMover[];
  presupuestos: PresupuestoParaMover[];
  ahorros: AhorroParaMover[];
  /**
   * Las deudas cuyo calendario se corre. Una deuda dice "primera cuota:
   * octubre"; si octubre ahora se llama noviembre, su calendario tiene que
   * correrse igual, o la cuota que se paga con este sueldo quedaria con el
   * numero de la siguiente (Ripley, de 2 cuotas, se daria por terminada).
   */
  deudas: DeudaCorrida[];
  /** Los pagos de esas deudas, todos: van pegados a su calendario. */
  pagos: PagoCorrido[];
  /** Lo que no se mueve porque en el destino ya hay algo de verdad. */
  conflictos: Conflicto[];
};

/** Numero de la cuota que toca en `mes`, o null si la deuda no corre ese mes. */
function numeroDeCuota(primeraCuota: string, cuotasTotales: number, mes: string): number | null {
  const transcurridos = mesesEntre(primeraCuota, mes);
  return transcurridos < 0 || transcurridos >= cuotasTotales ? null : transcurridos + 1;
}

/**
 * Arma el plan para pasar de `desde` a `hasta`.
 *
 * Las deudas se corren solo si en `desde` queda algo que mover. Es lo que
 * hace seguro repetir el comando: despues de aplicarlo, el mes de origen
 * queda vacio y una segunda vez no corre los calendarios de nuevo.
 */
export function planearMovimiento(
  origen: DatosDeUnMes,
  destino: DatosDeUnMes,
  meses: { desde: string; hasta: string },
  deudas: readonly DeudaParaMover[] = [],
): PlanMovimiento {
  const plan: PlanMovimiento = {
    cuentas: [], copiasQueSobran: [], presupuestos: [], ahorros: [], deudas: [], pagos: [], conflictos: [],
  };

  const cuentasDestino = new Map(destino.cuentas.map((c) => [c.nombre, c]));
  for (const cuenta of origen.cuentas) {
    const yaEsta = cuentasDestino.get(cuenta.nombre);
    if (yaEsta === undefined) {
      plan.cuentas.push(cuenta);
    } else if (!yaEsta.pagada && !yaEsta.conBoleta) {
      plan.copiasQueSobran.push(yaEsta);
      plan.cuentas.push(cuenta);
    } else {
      plan.conflictos.push({
        que: `Cuenta "${cuenta.nombre}"`,
        motivo: "en el mes de destino ya está pagada o tiene boleta; revísala a mano",
      });
    }
  }

  const presupuestosDestino = new Set(destino.presupuestos.map((p) => p.categoriaId));
  for (const presupuesto of origen.presupuestos) {
    if (presupuestosDestino.has(presupuesto.categoriaId)) {
      plan.conflictos.push({
        que: `Presupuesto de "${presupuesto.categoriaNombre}"`,
        motivo: "en el mes de destino ya hay uno para esa categoría",
      });
    } else {
      plan.presupuestos.push(presupuesto);
    }
  }

  plan.ahorros.push(...origen.ahorros);

  const quedaAlgo = origen.cuentas.length + origen.presupuestos.length + origen.ahorros.length > 0;
  const corrimiento = mesesEntre(meses.desde, meses.hasta);
  if (quedaAlgo && corrimiento !== 0) {
    for (const deuda of deudas) {
      const nuevaPrimeraCuota = sumarMeses(deuda.primeraCuota, corrimiento);
      plan.deudas.push({
        id: deuda.id,
        nombre: deuda.nombre,
        primeraCuota: deuda.primeraCuota,
        nuevaPrimeraCuota,
        cuotasTotales: deuda.cuotasTotales,
        cuotaAntes: numeroDeCuota(deuda.primeraCuota, deuda.cuotasTotales, meses.hasta),
        cuotaDespues: numeroDeCuota(nuevaPrimeraCuota, deuda.cuotasTotales, meses.hasta),
      });
      for (const pago of deuda.pagos) {
        plan.pagos.push({
          id: pago.id,
          deudaId: deuda.id,
          deudaNombre: deuda.nombre,
          monto: pago.monto,
          mes: pago.mes,
          nuevoMes: sumarMeses(pago.mes, corrimiento),
        });
      }
    }
  }

  return plan;
}

/** Cuantas cosas cambia el plan: si es cero no hay nada que aplicar. */
export function cambiosDelPlan(plan: PlanMovimiento): number {
  return (
    plan.cuentas.length + plan.copiasQueSobran.length + plan.presupuestos.length +
    plan.ahorros.length + plan.deudas.length + plan.pagos.length
  );
}
