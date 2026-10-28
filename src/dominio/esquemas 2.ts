import { z } from "zod";
import { fechaDesdeISO } from "@/lib/fecha";
import { parsearMonto } from "@/lib/dinero";

/**
 * Validacion de entrada. Los mensajes estan en espanol porque se muestran tal
 * cual al lado del campo en el formulario.
 *
 * Hay dos esquemas por cada cosa:
 *   - `...Formulario` recibe lo que manda un <form>, o sea puros strings.
 *   - el tipo resultante ya viene con los tipos reales (number, Date).
 *
 * El limite de monto es 2.000.000.000: la columna es INTEGER en Postgres y su
 * maximo es 2.147.483.647. Pasarse revienta en la base, no en la validacion.
 */
export const MONTO_MAXIMO = 2_000_000_000;

export const MEDIOS_PAGO = [
  "EFECTIVO",
  "DEBITO",
  "CREDITO",
  "TRANSFERENCIA",
  "OTRO",
] as const;

export type MedioPago = (typeof MEDIOS_PAGO)[number];

/** Etiquetas para mostrar en la interfaz. */
export const ETIQUETA_MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
  OTRO: "Otro",
};

const fechaISO = z
  .string()
  .trim()
  .min(1, "Elige una fecha.")
  .refine((valor) => {
    try {
      fechaDesdeISO(valor);
      return true;
    } catch {
      return false;
    }
  }, "La fecha no es válida.");

const descripcion = z
  .string()
  .trim()
  .min(1, "Escribe una descripción.")
  .max(120, "La descripción no puede pasar de 120 caracteres.");

/**
 * El monto llega como texto porque la gente escribe "45.990" o "$45.990".
 * parsearMonto limpia todo lo que no sea digito y rechaza el cero.
 */
const montoTexto = z
  .string()
  .trim()
  .min(1, "Escribe un monto.")
  .transform((valor, ctx) => {
    const monto = parsearMonto(valor);
    if (monto === null) {
      ctx.addIssue({
        code: "custom",
        message: "El monto debe ser un número mayor que cero.",
      });
      return z.NEVER;
    }
    if (monto > MONTO_MAXIMO) {
      ctx.addIssue({
        code: "custom",
        message: `El monto no puede pasar de ${MONTO_MAXIMO.toLocaleString("es-CL")}.`,
      });
      return z.NEVER;
    }
    return monto;
  });

const notas = z
  .string()
  .trim()
  .max(500, "Las notas no pueden pasar de 500 caracteres.")
  .transform((valor) => (valor === "" ? null : valor))
  .nullable()
  .optional()
  .transform((valor) => valor ?? null);

export const esquemaGastoFormulario = z.object({
  fecha: fechaISO,
  descripcion,
  monto: montoTexto,
  categoriaId: z.string().trim().min(1, "Elige una categoría."),
  medioPago: z.enum(MEDIOS_PAGO, { message: "Medio de pago no válido." }),
  notas,
});

export type GastoValidado = z.infer<typeof esquemaGastoFormulario> & {
  /** Nombre del archivo ya guardado en disco, si se adjunto una foto. */
  boletaArchivo?: string | null;
};

/** Igual que el anterior pero todos los campos opcionales, para editar. */
export const esquemaGastoParcial = esquemaGastoFormulario.partial();
export type GastoParcial = z.infer<typeof esquemaGastoParcial>;

/** Identificador de mes "YYYY-MM". */
export const esquemaMes = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes debe tener el formato YYYY-MM.");

export const esquemaId = z.string().trim().min(1, "Falta el identificador.");

/**
 * Convierte un FormData en objeto plano antes de validar.
 * Los campos ausentes quedan fuera, no como undefined, para que `partial()`
 * los distinga de los que vienen vacios a proposito.
 */
export function desdeFormData(datos: FormData): Record<string, string> {
  const plano: Record<string, string> = {};
  for (const [clave, valor] of datos.entries()) {
    if (typeof valor === "string") plano[clave] = valor;
  }
  return plano;
}

/** Errores por campo, en la forma que consume el formulario. */
export type ErroresPorCampo = Record<string, string[]>;

export function erroresDe(error: z.ZodError): ErroresPorCampo {
  const salida: ErroresPorCampo = {};
  for (const problema of error.issues) {
    const campo = problema.path.join(".") || "_";
    (salida[campo] ??= []).push(problema.message);
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Sueldo y deudas
// ---------------------------------------------------------------------------

/** Tope de cuotas: 50 anios. Esta para atajar errores de tipeo, no por regla. */
export const CUOTAS_MAXIMAS = 600;

/**
 * Monto escrito a mano. `permitirCero` para el sueldo, donde cero significa
 * un mes sin ingresos y es un dato valido, no un error.
 */
function campoMonto(permitirCero: boolean) {
  return z
    .string()
    .trim()
    .min(1, "Escribe un monto.")
    .transform((valor, ctx) => {
      const monto = parsearMonto(valor, { permitirCero });
      if (monto === null) {
        ctx.addIssue({
          code: "custom",
          message: permitirCero
            ? "El monto debe ser un número."
            : "El monto debe ser un número mayor que cero.",
        });
        return z.NEVER;
      }
      if (monto > MONTO_MAXIMO) {
        ctx.addIssue({
          code: "custom",
          message: `El monto no puede pasar de ${MONTO_MAXIMO.toLocaleString("es-CL")}.`,
        });
        return z.NEVER;
      }
      return monto;
    });
}

export const esquemaSueldoFormulario = z.object({
  /** Mes desde el que rige este sueldo. */
  mes: esquemaMes,
  monto: campoMonto(true),
  nota: notas,
});

export type SueldoValidado = z.infer<typeof esquemaSueldoFormulario>;

const cuotasTotales = z
  .string()
  .trim()
  .min(1, "Indica en cuántas cuotas.")
  .transform((valor, ctx) => {
    const limpio = valor.replace(/[^\d]/g, "");
    const numero = limpio === "" ? Number.NaN : Number(limpio);

    if (!Number.isSafeInteger(numero) || numero < 1) {
      ctx.addIssue({ code: "custom", message: "Las cuotas deben ser un número de 1 o más." });
      return z.NEVER;
    }
    if (numero > CUOTAS_MAXIMAS) {
      ctx.addIssue({
        code: "custom",
        message: `${CUOTAS_MAXIMAS} cuotas son 50 años. ¿Seguro que es ese número?`,
      });
      return z.NEVER;
    }
    return numero;
  });

export const esquemaDeudaFormulario = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Ponle un nombre a la deuda.")
    .max(80, "El nombre no puede pasar de 80 caracteres."),
  montoCuota: campoMonto(false),
  cuotasTotales,
  /** Mes en que se paga (o se pagó) la primera cuota. */
  primeraCuota: esquemaMes,
  nota: notas,
});

export type DeudaValidada = z.infer<typeof esquemaDeudaFormulario>;

/** Edicion de una deuda ya creada. */
export const esquemaEdicionDeudaFormulario = esquemaDeudaFormulario.extend({
  id: esquemaId,
});

export type EdicionDeudaValidada = z.infer<typeof esquemaEdicionDeudaFormulario>;

/** Pago de una cuota: que deuda, que mes, que dia y cuanto. */
export const esquemaPagoCuotaFormulario = z.object({
  deudaId: esquemaId,
  mes: esquemaMes,
  fechaPago: fechaISO,
  monto: campoMonto(false),
});

export type PagoCuotaValidado = z.infer<typeof esquemaPagoCuotaFormulario>;

// ---------------------------------------------------------------------------
// Cuentas por pagar
// ---------------------------------------------------------------------------

/** Una casilla marcada llega como "on"; si no se marca, no llega. */
const casilla = z
  .string()
  .optional()
  .transform((valor) => valor === "on" || valor === "true");

const diaVencimiento = z
  .string()
  .trim()
  .optional()
  .transform((valor, ctx) => {
    if (valor === undefined || valor === "") return null;

    const numero = Number(valor.replace(/[^\d]/g, ""));
    if (!Number.isSafeInteger(numero) || numero < 1 || numero > 31) {
      ctx.addIssue({ code: "custom", message: "El día de vencimiento va entre 1 y 31." });
      return z.NEVER;
    }
    return numero;
  });

export const esquemaCuentaFormulario = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Ponle un nombre a la cuenta.")
    .max(120, "El nombre no puede pasar de 120 caracteres."),
  monto: campoMonto(false),
  mes: esquemaMes,
  diaVencimiento,
  categoriaId: z.string().trim().min(1, "Elige una categoría."),
  mensual: casilla,
  nota: notas,
});

export type CuentaValidada = z.infer<typeof esquemaCuentaFormulario>;

/**
 * Edicion de una cuenta ya creada.
 *
 * No incluye `mes` a proposito: el mes es el casillero donde vive la cuenta,
 * no un dato suyo. Moverla de mes seria otra operacion, y hacerlo sin querer
 * desde un formulario de edicion le vaciaria el mes a alguien.
 */
export const esquemaEdicionCuentaFormulario = z.object({
  id: esquemaId,
  nombre: z
    .string()
    .trim()
    .min(1, "Ponle un nombre a la cuenta.")
    .max(120, "El nombre no puede pasar de 120 caracteres."),
  monto: campoMonto(false),
  diaVencimiento,
  categoriaId: z.string().trim().min(1, "Elige una categoría."),
  mensual: casilla,
  nota: notas,
});

export type EdicionCuentaValidada = z.infer<typeof esquemaEdicionCuentaFormulario>;

/** Datos del pago: la fecha exacta en que se pago y el monto real. */
export const esquemaPagoFormulario = z.object({
  id: esquemaId,
  fechaPago: fechaISO,
  monto: campoMonto(false),
});

export type PagoValidado = z.infer<typeof esquemaPagoFormulario>;
