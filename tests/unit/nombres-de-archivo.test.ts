import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

/**
 * En el Mac los nombres de archivo no distinguen mayusculas: Vitrina.tsx y
 * vitrina.ts conviven, pero "./vitrina" puede resolverse a cualquiera de los
 * dos (Next prueba .tsx antes que .ts) y un modulo termina importandose a si
 * mismo. En Linux no pasa, asi que el error solo se ve en el computador.
 * Esta prueba lo atrapa en cualquier sistema.
 */
function archivos(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivos(join(carpeta, e.name)) : [join(carpeta, e.name)],
  );
}

test("no hay dos modulos en la misma carpeta que solo se distingan por mayusculas", () => {
  const raiz = resolve(process.cwd());
  const porNombre = new Map<string, Set<string>>();
  for (const carpeta of ["src", "tests"]) {
    for (const ruta of archivos(join(raiz, carpeta))) {
      if (!/\.(ts|tsx|js|jsx|mts|mjs)$/.test(ruta)) continue;
      const corte = ruta.lastIndexOf("/");
      const base = ruta.slice(corte + 1).split(".")[0] as string;
      const llave = `${ruta.slice(0, corte)}/${base.toLowerCase()}`;
      porNombre.set(llave, (porNombre.get(llave) ?? new Set()).add(base));
    }
  }
  const choques = [...porNombre.entries()].filter(([, nombres]) => nombres.size > 1).map(([llave, nombres]) => `${llave}: ${[...nombres].join(" y ")}`);
  expect(choques).toEqual([]);
});
