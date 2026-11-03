import { describe, expect, test } from "vitest";
import { sumarMeses } from "@/lib/fecha";
import {
  aPeriodo,
  diaDelPeriodo,
  diasEntre,
  enPeriodo,
  fechaDelPeriodo,
  periodoDe,
  periodoDeFecha,
  periodoVecino,
  rangoDelPeriodo,
  sumarDias,
  vencimientoEnPeriodo,
} from "@/lib/periodo";

describe("periodoDe", () => {
  test("con dia 27, noviembre va del 27 de octubre al 26 de noviembre", () => {
    expect(periodoDe("2026-11", 27)).toEqual({
      mes: "2026-11", diaInicio: 27, desde: "2026-10-27", hasta: "2026-11-26", dias: 31,
    });
  });

  test("del 16 en adelante lleva el nombre del mes en que termina; antes, el del mes en que empieza", () => {
    expect(periodoDe("2026-10", 5)).toMatchObject({ desde: "2026-10-05", hasta: "2026-11-04" });
    expect(periodoDe("2026-10", 15)).toMatchObject({ desde: "2026-10-15", hasta: "2026-11-14" });
    expect(periodoDe("2026-11", 16)).toMatchObject({ desde: "2026-10-16", hasta: "2026-11-15" });
  });

  test("con dia 1 es el mes calendario", () => {
    expect(periodoDe("2026-02")).toMatchObject({ desde: "2026-02-01", hasta: "2026-02-28", dias: 28 });
    expect(periodoDe("2026-12")).toMatchObject({ desde: "2026-12-01", hasta: "2026-12-31", dias: 31 });
    expect(aPeriodo("2026-10")).toEqual(periodoDe("2026-10", 1));
  });

  test("cruza el cambio de ano", () => {
    expect(periodoDe("2027-01", 27)).toMatchObject({ desde: "2026-12-27", hasta: "2027-01-26" });
  });

  test("un dia que el mes no tiene se corre a su ultimo dia, sin huecos", () => {
    expect(periodoDe("2027-02", 31)).toMatchObject({ desde: "2027-01-31", hasta: "2027-02-27", dias: 28 });
    expect(periodoDe("2027-03", 31)).toMatchObject({ desde: "2027-02-28", hasta: "2027-03-30" });
    expect(periodoDe("2028-03", 30)).toMatchObject({ desde: "2028-02-29", hasta: "2028-03-29" });
  });

  test("los periodos quedan pegados para cualquier dia de inicio", () => {
    for (let dia = 1; dia <= 31; dia++) {
      let actual = periodoDe("2026-01", dia);
      for (let i = 0; i < 26; i++) {
        const siguiente = periodoVecino(actual, 1);
        expect(siguiente.desde, `dia ${dia}, ${actual.mes}`).toBe(sumarDias(actual.hasta, 1));
        expect(actual.dias).toBe(diasEntre(actual.desde, actual.hasta) + 1);
        actual = siguiente;
      }
    }
  });

  test("rechaza un dia de inicio fuera de 1 a 31", () => {
    expect(() => periodoDe("2026-10", 0)).toThrow(/invalido/i);
    expect(() => periodoDe("2026-10", 32)).toThrow(/invalido/i);
    expect(() => periodoDe("2026-10", 2.5)).toThrow(/invalido/i);
  });
});

describe("periodoDeFecha", () => {
  test("el 2 de noviembre, con dia 27, cae en noviembre (27 oct – 26 nov)", () => {
    expect(periodoDeFecha("2026-11-02", 27).mes).toBe("2026-11");
    expect(periodoDeFecha("2026-11-26", 27).mes).toBe("2026-11");
    expect(periodoDeFecha("2026-11-27", 27).mes).toBe("2026-12");
    expect(periodoDeFecha("2026-10-27", 27).mes).toBe("2026-11");
    expect(periodoDeFecha("2026-10-26", 27).mes).toBe("2026-10");
    expect(periodoDeFecha("2026-12-28", 27).mes).toBe("2027-01");
  });

  test("con dia 5, el 2 de noviembre cae en octubre (5 oct – 4 nov)", () => {
    expect(periodoDeFecha("2026-11-02", 5).mes).toBe("2026-10");
    expect(periodoDeFecha("2026-11-05", 5).mes).toBe("2026-11");
  });

  test("con dia 1 es el mes de la fecha", () => {
    expect(periodoDeFecha("2026-11-02").mes).toBe("2026-11");
  });

  test("cada fecha cae en exactamente un periodo, y ese periodo la contiene", () => {
    for (const dia of [1, 5, 15, 16, 27, 29, 30, 31]) {
      for (let i = 0; i < 400; i++) {
        const fecha = sumarDias("2027-01-01", i);
        const p = periodoDeFecha(fecha, dia);
        expect(enPeriodo(fecha, p), `${fecha} con dia ${dia}`).toBe(true);
        expect(enPeriodo(fecha, periodoVecino(p, -1))).toBe(false);
        expect(enPeriodo(fecha, periodoVecino(p, 1))).toBe(false);
      }
    }
  });
});

describe("dias dentro del periodo", () => {
  const noviembre = periodoDe("2026-11", 27);

  test("el 27 de octubre es el dia 1 y el 2 de noviembre el 7", () => {
    expect(diaDelPeriodo("2026-10-27", noviembre)).toBe(1);
    expect(diaDelPeriodo("2026-11-02", noviembre)).toBe(7);
    expect(fechaDelPeriodo(noviembre, 7)).toBe("2026-11-02");
    expect(fechaDelPeriodo(noviembre, noviembre.dias)).toBe(noviembre.hasta);
  });

  test("el rango para consultar es semiabierto", () => {
    const { desde, hasta } = rangoDelPeriodo(noviembre);
    expect(desde.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-11-27T00:00:00.000Z");
  });
});

describe("vencimientoEnPeriodo", () => {
  test("con dia 27, en noviembre lo que vence el 5 cae el 5 de noviembre y lo que vence el 30, el 30 de octubre", () => {
    const noviembre = periodoDe("2026-11", 27);
    expect(vencimientoEnPeriodo(noviembre, 5)).toBe("2026-11-05");
    expect(vencimientoEnPeriodo(noviembre, 26)).toBe("2026-11-26");
    expect(vencimientoEnPeriodo(noviembre, 27)).toBe("2026-10-27");
    expect(vencimientoEnPeriodo(noviembre, 31)).toBe("2026-10-31");
  });

  test("con dia 5, en octubre lo que vence el 2 cae el 2 de noviembre", () => {
    expect(vencimientoEnPeriodo(periodoDe("2026-10", 5), 2)).toBe("2026-11-02");
    expect(vencimientoEnPeriodo(periodoDe("2026-10", 5), 20)).toBe("2026-10-20");
  });

  test("con dia 1 es el mismo dia del mes, corrido al ultimo si no existe", () => {
    expect(vencimientoEnPeriodo(periodoDe("2026-10"), 20)).toBe("2026-10-20");
    expect(vencimientoEnPeriodo(periodoDe("2026-02"), 31)).toBe("2026-02-28");
  });

  test("siempre queda dentro del periodo", () => {
    for (let inicio = 1; inicio <= 31; inicio++) {
      for (let m = 0; m < 24; m++) {
        const p = periodoDe(sumarMeses("2026-01", m), inicio);
        for (let dia = 1; dia <= 31; dia++) {
          const fecha = vencimientoEnPeriodo(p, dia);
          expect(enPeriodo(fecha, p), `inicio ${inicio}, ${p.mes}, dia ${dia}: ${fecha}`).toBe(true);
        }
      }
    }
  });
});

describe("esquemaDiaInicioFormulario", async () => {
  const { esquemaDiaInicioFormulario } = await import("@/dominio/esquemas");

  test("acepta de 1 a 31 y rechaza lo demas", () => {
    expect(esquemaDiaInicioFormulario.parse({ diaInicioMes: "27" })).toEqual({ diaInicioMes: 27 });
    expect(esquemaDiaInicioFormulario.parse({ diaInicioMes: " 1 " })).toEqual({ diaInicioMes: 1 });
    for (const malo of ["0", "32", "", "2.5", "-3", "abc"]) {
      expect(esquemaDiaInicioFormulario.safeParse({ diaInicioMes: malo }).success, malo).toBe(false);
    }
  });
});

describe("rangos para leer", async () => {
  const { rangoCorto, rangoLargo, rangoDeDias } = await import("@/componentes/formato");

  test("en el mismo mes, cruzando de mes y cruzando de ano", () => {
    expect(rangoCorto("2026-10-01", "2026-10-31")).toBe("1 – 31 oct");
    expect(rangoCorto("2026-10-27", "2026-11-26")).toBe("27 oct – 26 nov");
    expect(rangoLargo("2026-10-01", "2026-10-07")).toBe("1 al 7 de octubre de 2026");
    expect(rangoLargo("2026-10-27", "2026-11-02")).toBe("27 de octubre al 2 de noviembre de 2026");
    expect(rangoLargo("2026-12-29", "2027-01-04")).toBe("29 de diciembre de 2026 al 4 de enero de 2027");
    expect(rangoLargo("2026-10-27", "2026-11-02", false)).toBe("27 de octubre al 2 de noviembre");
    expect(rangoDeDias("2026-10-27", "2026-11-02")).toBe("27–2");
  });
});
