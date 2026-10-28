import { describe, expect, test } from "vitest";
import {
  diasEnMes,
  diasEnMesISO,
  fechaDesdeISO,
  hoyISO,
  isoDesdeFecha,
  mesActual,
  mesDesdeFecha,
  rangoDelMes,
  rangoDelMesISO,
} from "@/lib/fecha";

describe("fechaDesdeISO", () => {
  test("construye el dia en medianoche UTC", () => {
    const fecha = fechaDesdeISO("2026-10-27");
    expect(fecha.toISOString()).toBe("2026-10-27T00:00:00.000Z");
  });

  test("acepta el primero y el ultimo dia del mes", () => {
    expect(isoDesdeFecha(fechaDesdeISO("2026-02-01"))).toBe("2026-02-01");
    expect(isoDesdeFecha(fechaDesdeISO("2026-02-28"))).toBe("2026-02-28");
  });

  test("acepta el 29 de febrero en anio bisiesto", () => {
    expect(isoDesdeFecha(fechaDesdeISO("2028-02-29"))).toBe("2028-02-29");
  });

  test("rechaza el 29 de febrero en anio no bisiesto", () => {
    expect(() => fechaDesdeISO("2026-02-29")).toThrow(/inexistente/i);
  });

  test("rechaza dias que no existen en vez de normalizarlos", () => {
    expect(() => fechaDesdeISO("2026-04-31")).toThrow(/inexistente/i);
    expect(() => fechaDesdeISO("2026-13-01")).toThrow(/inexistente|invalida/i);
  });

  test("rechaza formatos que no son YYYY-MM-DD", () => {
    expect(() => fechaDesdeISO("27-10-2026")).toThrow(/invalida/i);
    expect(() => fechaDesdeISO("2026-10-7")).toThrow(/invalida/i);
    expect(() => fechaDesdeISO("")).toThrow(/invalida/i);
  });
});

describe("isoDesdeFecha", () => {
  test("no corre el dia aunque la zona local sea Chile", () => {
    // Este test corre con TZ=America/Santiago (ver vitest.config.ts).
    const fecha = fechaDesdeISO("2026-10-01");
    expect(isoDesdeFecha(fecha)).toBe("2026-10-01");
  });

  test("usar metodos locales si corre el dia: por eso existe el helper", () => {
    const fecha = fechaDesdeISO("2026-10-01");

    const conMetodosLocales = [
      fecha.getFullYear(),
      String(fecha.getMonth() + 1).padStart(2, "0"),
      String(fecha.getDate()).padStart(2, "0"),
    ].join("-");

    // En Chile (UTC-3) la medianoche UTC del 1 cae el 30 del mes anterior.
    expect(conMetodosLocales).toBe("2026-09-30");
    expect(isoDesdeFecha(fecha)).not.toBe(conMetodosLocales);
  });

  test("ida y vuelta para todos los dias de un mes", () => {
    for (let dia = 1; dia <= 31; dia += 1) {
      const iso = `2026-10-${String(dia).padStart(2, "0")}`;
      expect(isoDesdeFecha(fechaDesdeISO(iso))).toBe(iso);
    }
  });
});

describe("mesDesdeFecha", () => {
  test("entrega YYYY-MM", () => {
    expect(mesDesdeFecha(fechaDesdeISO("2026-10-27"))).toBe("2026-10");
    expect(mesDesdeFecha(fechaDesdeISO("2026-01-01"))).toBe("2026-01");
    expect(mesDesdeFecha(fechaDesdeISO("2026-12-31"))).toBe("2026-12");
  });
});

describe("rangoDelMes", () => {
  test("entrega un rango semiabierto que cubre el mes", () => {
    const { desde, hasta } = rangoDelMes(2026, 10);
    expect(desde.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  test("diciembre salta al anio siguiente", () => {
    const { desde, hasta } = rangoDelMes(2026, 12);
    expect(desde.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(hasta.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  test("febrero bisiesto cierra en marzo", () => {
    const { hasta } = rangoDelMes(2028, 2);
    expect(hasta.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  });

  test("el ultimo dia del mes queda dentro del rango", () => {
    const { desde, hasta } = rangoDelMes(2026, 10);
    const ultimo = fechaDesdeISO("2026-10-31");
    expect(ultimo >= desde).toBe(true);
    expect(ultimo < hasta).toBe(true);
  });

  test("el primero del mes siguiente queda fuera", () => {
    const { hasta } = rangoDelMes(2026, 10);
    expect(fechaDesdeISO("2026-11-01") < hasta).toBe(false);
  });

  test("rechaza meses fuera de 1..12", () => {
    expect(() => rangoDelMes(2026, 0)).toThrow(/mes invalido/i);
    expect(() => rangoDelMes(2026, 13)).toThrow(/mes invalido/i);
  });
});

describe("diasEnMes", () => {
  test("los meses de 31 y de 30", () => {
    expect(diasEnMes(2026, 1)).toBe(31);
    expect(diasEnMes(2026, 4)).toBe(30);
    expect(diasEnMes(2026, 10)).toBe(31);
    expect(diasEnMes(2026, 12)).toBe(31);
  });

  test("febrero segun si el anio es bisiesto", () => {
    expect(diasEnMes(2026, 2)).toBe(28);
    expect(diasEnMes(2028, 2)).toBe(29);
    // 2100 no es bisiesto: divisible por 100 pero no por 400.
    expect(diasEnMes(2100, 2)).toBe(28);
    expect(diasEnMes(2000, 2)).toBe(29);
  });

  test("la suma de los doce meses da el largo del anio", () => {
    const sumar = (anio: number) =>
      Array.from({ length: 12 }, (_, i) => diasEnMes(anio, i + 1)).reduce((a, b) => a + b, 0);
    expect(sumar(2026)).toBe(365);
    expect(sumar(2028)).toBe(366);
  });

  test("diasEnMesISO coincide con diasEnMes", () => {
    expect(diasEnMesISO("2026-02")).toBe(diasEnMes(2026, 2));
    expect(diasEnMesISO("2028-02")).toBe(diasEnMes(2028, 2));
  });

  test("rechaza meses invalidos", () => {
    expect(() => diasEnMes(2026, 13)).toThrow(/mes invalido/i);
    expect(() => diasEnMesISO("2026-13")).toThrow(/invalido/i);
  });
});

describe("rangoDelMesISO", () => {
  test("equivale a rangoDelMes", () => {
    expect(rangoDelMesISO("2026-10")).toEqual(rangoDelMes(2026, 10));
  });

  test("rechaza formatos malos", () => {
    expect(() => rangoDelMesISO("2026-1")).toThrow(/invalido/i);
    expect(() => rangoDelMesISO("octubre")).toThrow(/invalido/i);
  });
});

describe("mesActual y hoyISO", () => {
  test("usan la zona indicada, no la del servidor", () => {
    // 2026-11-01 a las 01:00 UTC es todavia 31 de octubre en Chile (UTC-3).
    const instante = new Date("2026-11-01T01:00:00.000Z");
    expect(hoyISO("America/Santiago", instante)).toBe("2026-10-31");
    expect(mesActual("America/Santiago", instante)).toBe("2026-10");
    expect(hoyISO("UTC", instante)).toBe("2026-11-01");
    expect(mesActual("UTC", instante)).toBe("2026-11");
  });

  test("entregan formatos parseables por los otros helpers", () => {
    expect(() => fechaDesdeISO(hoyISO())).not.toThrow();
    expect(() => rangoDelMesISO(mesActual())).not.toThrow();
  });
});
