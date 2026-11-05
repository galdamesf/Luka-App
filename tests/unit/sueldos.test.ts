import { describe, expect, test } from "vitest";
import {
  aportesDelMes,
  cierreDeSueldos,
  ingresosDelMes,
  mostrarAportes,
  type FilaDeSueldo,
} from "@/dominio/sueldos";

/**
 * El sueldo por persona: lo que entra al hogar es la suma del de cada uno, y
 * quien sale del hogar suma hasta el mes en que salio.
 */

const abierto = (miembroId: string, vigenteDesde: string, monto: number): FilaDeSueldo => ({
  miembroId,
  monto,
  vigenteDesde,
  vigenteHasta: null,
});
const cerrado = (vigenteDesde: string, vigenteHasta: string, monto: number): FilaDeSueldo => ({
  miembroId: null,
  monto,
  vigenteDesde,
  vigenteHasta,
});

describe("ingresosDelMes", () => {
  test("suma el sueldo vigente de cada miembro", () => {
    const filas = [abierto("yo", "2026-01", 1_000_000), abierto("ella", "2026-03", 800_000)];
    expect(ingresosDelMes(filas, "2026-02").total).toBe(1_000_000);
    expect(ingresosDelMes(filas, "2026-03").total).toBe(1_800_000);
  });

  test("de cada uno toma su ultimo sueldo hasta ese mes, no el ultimo de todos", () => {
    const filas = [
      abierto("yo", "2026-01", 1_000_000),
      abierto("yo", "2026-06", 1_100_000),
      abierto("ella", "2026-02", 800_000),
    ];
    const mayo = ingresosDelMes(filas, "2026-05");
    expect(mayo.porMiembro.get("yo")).toBe(1_000_000);
    expect(mayo.porMiembro.get("ella")).toBe(800_000);
    expect(ingresosDelMes(filas, "2026-06").total).toBe(1_900_000);
  });

  test("sin ningun sueldo que rija, el total es null: el mes queda sin sueldo", () => {
    expect(ingresosDelMes([], "2026-05").total).toBeNull();
    expect(ingresosDelMes([abierto("yo", "2026-06", 1)], "2026-05").total).toBeNull();
  });

  test("un sueldo de cero cuenta como anotado: el total es 0, no null", () => {
    const ingresos = ingresosDelMes([abierto("yo", "2026-01", 0)], "2026-05");
    expect(ingresos.total).toBe(0);
    expect(ingresos.porMiembro.get("yo")).toBe(0);
  });

  test("el sueldo cerrado suma solo entre su primer y su ultimo mes", () => {
    const filas = [abierto("yo", "2026-01", 1_000_000), cerrado("2026-02", "2026-04", 500_000)];
    expect(ingresosDelMes(filas, "2026-01").total).toBe(1_000_000);
    expect(ingresosDelMes(filas, "2026-02")).toMatchObject({ total: 1_500_000, deQuienesSalieron: 500_000 });
    expect(ingresosDelMes(filas, "2026-04").total).toBe(1_500_000);
    expect(ingresosDelMes(filas, "2026-05")).toMatchObject({ total: 1_000_000, deQuienesSalieron: 0 });
  });

  test("dos personas que salieron en meses distintos no se mezclan", () => {
    // Una rigio de enero a marzo, la otra de enero a junio.
    const filas = [cerrado("2026-01", "2026-03", 300_000), cerrado("2026-01", "2026-06", 400_000)];
    expect(ingresosDelMes(filas, "2026-02").total).toBe(700_000);
    expect(ingresosDelMes(filas, "2026-05").total).toBe(400_000);
    expect(ingresosDelMes(filas, "2026-07").total).toBeNull();
  });

  test("el sueldo de antes de los hogares, que espera a su dueno, suma igual", () => {
    const sinDueno = (vigenteDesde: string, monto: number): FilaDeSueldo => ({ miembroId: null, monto, vigenteDesde, vigenteHasta: null });
    const filas = [sinDueno("2026-01", 900_000), sinDueno("2026-06", 1_000_000)];
    expect(ingresosDelMes(filas, "2026-03")).toMatchObject({ total: 900_000, deQuienesSalieron: 0 });
    expect(ingresosDelMes(filas, "2026-07").total).toBe(1_000_000);
    expect(ingresosDelMes(filas, "2026-07").porMiembro.size).toBe(0);
  });

  test("el sueldo de quien salio no aparece como de ningun miembro", () => {
    const ingresos = ingresosDelMes([cerrado("2026-01", "2026-03", 300_000)], "2026-02");
    expect(ingresos.porMiembro.size).toBe(0);
    expect(ingresos.total).toBe(300_000);
  });
});

describe("cierreDeSueldos", () => {
  test("cada fila rige hasta el mes antes de la siguiente, y la ultima hasta el mes en que sale", () => {
    const filas = [
      { id: "b", vigenteDesde: "2026-06" },
      { id: "a", vigenteDesde: "2026-01" },
    ];
    expect(cierreDeSueldos(filas, "2026-09")).toEqual({
      borrar: [],
      cerrar: [
        { id: "a", vigenteHasta: "2026-05" },
        { id: "b", vigenteHasta: "2026-09" },
      ],
    });
  });

  test("lo anotado para despues del mes en que sale se borra: nunca llego a regir", () => {
    const filas = [
      { id: "a", vigenteDesde: "2026-01" },
      { id: "futuro", vigenteDesde: "2026-12" },
    ];
    expect(cierreDeSueldos(filas, "2026-11")).toEqual({
      borrar: ["futuro"],
      cerrar: [{ id: "a", vigenteHasta: "2026-11" }],
    });
  });

  test("un sueldo que empieza justo el mes en que sale rige ese mes", () => {
    expect(cierreDeSueldos([{ id: "a", vigenteDesde: "2026-11" }], "2026-11").cerrar).toEqual([
      { id: "a", vigenteHasta: "2026-11" },
    ]);
  });

  test("cruza el fin de ano", () => {
    const filas = [
      { id: "a", vigenteDesde: "2025-06" },
      { id: "b", vigenteDesde: "2026-01" },
    ];
    expect(cierreDeSueldos(filas, "2026-02").cerrar).toEqual([
      { id: "a", vigenteHasta: "2025-12" },
      { id: "b", vigenteHasta: "2026-02" },
    ]);
  });

  test("sin sueldos no hay nada que cerrar", () => {
    expect(cierreDeSueldos([], "2026-11")).toEqual({ borrar: [], cerrar: [] });
  });

  test("lo cerrado sigue sumando lo mismo en los meses en que estuvo", () => {
    const filas = [
      { id: "a", vigenteDesde: "2026-01", monto: 900_000 },
      { id: "b", vigenteDesde: "2026-04", monto: 1_000_000 },
    ];
    const { cerrar } = cierreDeSueldos(filas, "2026-06");
    const cerradas = cerrar.map(({ id, vigenteHasta }) => {
      const fila = filas.find((f) => f.id === id)!;
      return cerrado(fila.vigenteDesde, vigenteHasta, fila.monto);
    });
    const antes = filas.map((f) => abierto("ella", f.vigenteDesde, f.monto));

    for (const mes of ["2026-01", "2026-03", "2026-04", "2026-06"]) {
      expect(ingresosDelMes(cerradas, mes).total, mes).toBe(ingresosDelMes(antes, mes).total);
    }
    expect(ingresosDelMes(cerradas, "2026-07").total).toBeNull();
  });
});

describe("aportesDelMes", () => {
  const miembros = [
    { id: "yo", nombre: "Fernando Vilches", correo: "fer@gmail.com", entroEn: "2026-11-01T00:00:00.000Z" },
    { id: "ella", nombre: null, correo: "angelina@gmail.com", entroEn: new Date() },
    { id: "invitada", nombre: null, correo: "prima@gmail.com", entroEn: null },
  ];

  test("una fila por quien ya entro, con su primer nombre (o su correo) y su sueldo", () => {
    const ingresos = ingresosDelMes([abierto("yo", "2026-01", 1_000_000)], "2026-05");
    expect(aportesDelMes(miembros, ingresos, "ella")).toEqual([
      { miembroId: "yo", nombre: "Fernando", monto: 1_000_000, esTuyo: false },
      { miembroId: "ella", nombre: "angelina", monto: null, esTuyo: true },
    ]);
  });

  test("el detalle se muestra solo si hay mas de una fila", () => {
    const uno = aportesDelMes(miembros.slice(0, 1), ingresosDelMes([], "2026-05"), "yo");
    const dos = aportesDelMes(miembros, ingresosDelMes([], "2026-05"), "yo");
    expect(mostrarAportes(uno, 0)).toBe(false);
    expect(mostrarAportes(uno, 300_000)).toBe(true);
    expect(mostrarAportes(dos, 0)).toBe(true);
  });
});
