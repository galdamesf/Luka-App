import { describe, expect, test } from "vitest";
import {
  desdeFormData,
  erroresDe,
  esquemaGastoFormulario,
  esquemaMes,
  ETIQUETA_MEDIO_PAGO,
  MEDIOS_PAGO,
  MONTO_MAXIMO,
} from "@/dominio/esquemas";

const VALIDO = {
  fecha: "2026-10-15",
  descripcion: "Feria del martes",
  monto: "23450",
  categoriaId: "cat-123",
  medioPago: "DEBITO",
  notas: "",
};

function validar(cambios: Partial<typeof VALIDO> = {}) {
  return esquemaGastoFormulario.safeParse({ ...VALIDO, ...cambios });
}

function primerError(cambios: Partial<typeof VALIDO>, campo: string): string {
  const r = validar(cambios);
  expect(r.success).toBe(false);
  if (r.success) throw new Error("se esperaba un fallo");
  const errores = erroresDe(r.error);
  expect(errores[campo], `sin errores en "${campo}": ${JSON.stringify(errores)}`).toBeDefined();
  return (errores[campo] as string[])[0] as string;
}

describe("gasto valido", () => {
  test("pasa y convierte los tipos", () => {
    const r = validar();
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.monto).toBe(23450);
    expect(typeof r.data.monto).toBe("number");
    expect(r.data.fecha).toBe("2026-10-15");
    expect(r.data.medioPago).toBe("DEBITO");
    expect(r.data.notas).toBeNull();
  });

  test("recorta espacios de la descripcion", () => {
    const r = validar({ descripcion: "   Supermercado   " });
    expect(r.success && r.data.descripcion).toBe("Supermercado");
  });

  test("acepta los montos como los escribe la gente", () => {
    for (const [entrada, esperado] of [
      ["45990", 45990],
      ["45.990", 45990],
      ["$45.990", 45990],
      ["45 990", 45990],
      ["  12.500  ", 12500],
    ] as const) {
      const r = validar({ monto: entrada });
      expect(r.success, `fallo con "${entrada}"`).toBe(true);
      if (r.success) expect(r.data.monto).toBe(esperado);
    }
  });

  test("las notas vacias quedan en null, no en string vacio", () => {
    expect(validar({ notas: "" }).success && validar({ notas: "" }).data?.notas).toBeNull();
    expect(validar({ notas: "   " }).success && validar({ notas: "   " }).data?.notas).toBeNull();
  });

  test("las notas con contenido se conservan recortadas", () => {
    const r = validar({ notas: "  pagado con la tarjeta de Angelina  " });
    expect(r.success && r.data.notas).toBe("pagado con la tarjeta de Angelina");
  });

  test("acepta los cinco medios de pago", () => {
    for (const medio of MEDIOS_PAGO) {
      expect(validar({ medioPago: medio }).success, `fallo con ${medio}`).toBe(true);
    }
  });
});

describe("fecha", () => {
  test("rechaza vacia", () => {
    expect(primerError({ fecha: "" }, "fecha")).toMatch(/elige una fecha/i);
  });

  test("rechaza formatos que no son YYYY-MM-DD", () => {
    for (const mala of ["15-10-2026", "2026-10-5", "ayer"]) {
      expect(primerError({ fecha: mala }, "fecha")).toMatch(/no es válida/i);
    }
  });

  test("rechaza dias que no existen", () => {
    expect(primerError({ fecha: "2026-02-29" }, "fecha")).toMatch(/no es válida/i);
    expect(primerError({ fecha: "2026-04-31" }, "fecha")).toMatch(/no es válida/i);
  });

  test("acepta el 29 de febrero bisiesto", () => {
    expect(validar({ fecha: "2028-02-29" }).success).toBe(true);
  });
});

describe("descripcion", () => {
  test("rechaza vacia o solo espacios", () => {
    expect(primerError({ descripcion: "" }, "descripcion")).toMatch(/escribe una descripción/i);
    expect(primerError({ descripcion: "    " }, "descripcion")).toMatch(/escribe una descripción/i);
  });

  test("acepta justo 120 y rechaza 121", () => {
    expect(validar({ descripcion: "x".repeat(120) }).success).toBe(true);
    expect(primerError({ descripcion: "x".repeat(121) }, "descripcion")).toMatch(/120/);
  });
});

describe("monto", () => {
  test("rechaza vacio", () => {
    expect(primerError({ monto: "" }, "monto")).toMatch(/escribe un monto/i);
  });

  test("rechaza cero y texto sin digitos", () => {
    expect(primerError({ monto: "0" }, "monto")).toMatch(/mayor que cero/i);
    expect(primerError({ monto: "$0" }, "monto")).toMatch(/mayor que cero/i);
    expect(primerError({ monto: "mil pesos" }, "monto")).toMatch(/mayor que cero/i);
  });

  test("rechaza lo que desbordaria la columna INTEGER", () => {
    expect(primerError({ monto: String(MONTO_MAXIMO + 1) }, "monto")).toMatch(/no puede pasar/i);
    // El maximo de INTEGER en Postgres es 2.147.483.647.
    expect(MONTO_MAXIMO).toBeLessThan(2_147_483_647);
  });

  test("acepta justo el maximo", () => {
    expect(validar({ monto: String(MONTO_MAXIMO) }).success).toBe(true);
  });
});

describe("medio de pago y categoria", () => {
  test("rechaza un medio de pago inventado", () => {
    expect(primerError({ medioPago: "BITCOIN" }, "medioPago")).toMatch(/no válido/i);
  });

  test("rechaza categoria vacia", () => {
    expect(primerError({ categoriaId: "   " }, "categoriaId")).toMatch(/elige una categoría/i);
  });
});

describe("acumulacion de errores", () => {
  test("informa todos los campos malos de una vez, no solo el primero", () => {
    const r = esquemaGastoFormulario.safeParse({
      fecha: "",
      descripcion: "",
      monto: "0",
      categoriaId: "",
      medioPago: "X",
      notas: "",
    });
    expect(r.success).toBe(false);
    if (r.success) return;
    const errores = erroresDe(r.error);
    for (const campo of ["fecha", "descripcion", "monto", "categoriaId", "medioPago"]) {
      expect(errores[campo], `falta el error de ${campo}`).toBeDefined();
    }
  });
});

describe("esquemaMes", () => {
  test("acepta meses validos", () => {
    for (const mes of ["2026-01", "2026-10", "2026-12"]) {
      expect(esquemaMes.safeParse(mes).success, `fallo con ${mes}`).toBe(true);
    }
  });

  test("rechaza mes 00, 13 y formatos cortos", () => {
    for (const mes of ["2026-00", "2026-13", "2026-1", "octubre"]) {
      expect(esquemaMes.safeParse(mes).success, `acepto ${mes}`).toBe(false);
    }
  });
});

describe("desdeFormData", () => {
  test("convierte un FormData en objeto plano", () => {
    const fd = new FormData();
    fd.set("descripcion", "Supermercado");
    fd.set("monto", "23450");
    expect(desdeFormData(fd)).toEqual({ descripcion: "Supermercado", monto: "23450" });
  });

  test("omite los campos ausentes en vez de ponerlos en undefined", () => {
    const fd = new FormData();
    fd.set("descripcion", "x");
    expect("monto" in desdeFormData(fd)).toBe(false);
  });

  test("un FormData completo pasa la validacion", () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(VALIDO)) fd.set(k, v);
    expect(esquemaGastoFormulario.safeParse(desdeFormData(fd)).success).toBe(true);
  });
});

describe("etiquetas", () => {
  test("hay etiqueta para cada medio de pago", () => {
    for (const medio of MEDIOS_PAGO) {
      expect(ETIQUETA_MEDIO_PAGO[medio]).toBeTruthy();
    }
  });
});
