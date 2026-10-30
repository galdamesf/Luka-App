/**
 * Las cifras de ejemplo de la portada.
 *
 * Son el octubre de muestra que el visor de maquetas llamaba DATOS: un mes
 * coherente de punta a punta, donde el balance cuadra con los gastos, los
 * techos con el semaforo y las cuotas con las deudas. Viven en un solo lugar
 * para que las secciones no puedan contarse historias distintas —en las
 * maquetas una portada llego a decir 66 % y otra 61 % por calcular cada una
 * por su lado— y para que el dia que la portada muestre el mes real de quien
 * la mira, cambie este modulo y nada mas.
 *
 * Los subtotales se CALCULAN aqui mismo en vez de escribirse: si alguien
 * cambia un monto y el mes deja de cuadrar, que se note en la fuente.
 */

export const MES_EJEMPLO = {
  nombre: "octubre",
  sueldo: 1_250_000,
  esenciales: 639_000,
  /** Solo las cuotas YA pagadas: son las que salen del sueldo. */
  cuotasPagadas: 118_000,
  discrecionales: 64_980,
  /** Lo esencial mas TODAS las cuotas del mes, pagadas o no, sobre el sueldo. */
  comprometido: 65,

  techos: [
    { categoria: "Café", gastado: 100_000, techo: 100_000, estado: "tope" },
    { categoria: "Feria", gastado: 85_000, techo: 100_000, estado: "aviso" },
    { categoria: "Supermercado", gastado: 87_350, techo: 400_000, estado: "sobra" },
  ],

  boleta: { que: "Zapatillas", categoria: "Ropa", dia: "12 oct", monto: 23_200 },

  cuentas: [
    { que: "Luz", monto: 38_400, pagada: true },
    { que: "Internet", monto: 24_990, pagada: true },
    { que: "Agua", monto: 21_300, pagada: false },
    { que: "Gas", monto: 34_500, pagada: false },
  ],

  deudas: [
    { que: "Crédito de consumo", cuota: 12, de: 24, monto: 118_000 },
    { que: "Notebook en cuotas", cuota: 5, de: 12, monto: 54_990 },
  ],

  categorias: 17,
} as const;

/** Lo que queda del mes: la resta completa, nunca un numero suelto. */
export const QUEDA_EJEMPLO =
  MES_EJEMPLO.sueldo -
  MES_EJEMPLO.esenciales -
  MES_EJEMPLO.cuotasPagadas -
  MES_EJEMPLO.discrecionales;

/** Lo que falta pagar de las cuentas del mes. */
export const FALTA_CUENTAS = MES_EJEMPLO.cuentas
  .filter((c) => !c.pagada)
  .reduce((suma, c) => suma + c.monto, 0);

/** Lo que queda por pagar de las deudas: las cuotas que aun no caen. */
export const RESTANTE_DEUDAS = MES_EJEMPLO.deudas.reduce(
  (suma, d) => suma + (d.de - d.cuota) * d.monto,
  0,
);
