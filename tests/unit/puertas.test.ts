import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Las puertas de la app, leidas del codigo: que el middleware no toque la
 * base y que cada pagina y cada ruta con datos revise el hogar de quien mira.
 *
 * Es una prueba sobre el texto a proposito. Una pagina nueva que se olvide
 * de revisar el hogar no rompe nada que se vea: solo deja una puerta abierta.
 */

const RAIZ = join(process.cwd(), "src");
const leer = (ruta: string) =>
  readFileSync(join(RAIZ, ruta), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Todos los archivos con ese nombre bajo la carpeta, relativos a src/. */
function archivos(carpeta: string, nombre: string): string[] {
  const buscar = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const ruta = join(dir, n);
      return statSync(ruta).isDirectory() ? buscar(ruta) : n === nombre ? [ruta] : [];
    });
  return buscar(carpeta).map((r) => relative(RAIZ, r)).sort();
}

const IMPORTA_LA_BASE = /from\s+["'](@\/datos\/|@\/lib\/prisma|@prisma\/client|@\/auth["']|@\/lib\/hogar-actual)/;

describe("el middleware decide solo con la cookie", () => {
  test.each(["middleware.ts", "auth.config.ts", "lib/sesion.ts"])("%s no importa nada que toque la base", (ruta) => {
    expect(leer(ruta)).not.toMatch(IMPORTA_LA_BASE);
  });

  test("el ingreso completo (src/auth.ts) es el unico que usa la base", () => {
    expect(leer("auth.ts")).toMatch(/from\s+["']@\/lib\/ingreso["']/);
  });

  test("el middleware usa la configuracion base, no la completa", () => {
    expect(leer("middleware.ts")).toMatch(/from\s+["']@\/auth\.config["']/);
  });
});

describe("cada pagina revisa el hogar en cada visita", () => {
  const PUBLICAS = ["app/bienvenida/page.tsx", "app/ingresar/page.tsx"];
  const paginas = archivos(join(RAIZ, "app"), "page.tsx").filter((p) => !PUBLICAS.includes(p));

  test("hay paginas que revisar", () => {
    expect(paginas.length).toBeGreaterThanOrEqual(4);
  });

  test.each(paginas)("%s llama a hogarActual()", (ruta) => {
    expect(leer(ruta)).toMatch(/await hogarActual\(\)/);
  });
});

describe("cada ruta con datos revisa el hogar contra la base", () => {
  const SIN_DATOS = ["app/api/auth/[...nextauth]/route.ts", "app/sesion/terminada/route.ts"];
  const rutas = archivos(join(RAIZ, "app"), "route.ts").filter((r) => !SIN_DATOS.includes(r));

  test("hay rutas que revisar", () => {
    expect(rutas.length).toBeGreaterThanOrEqual(2);
  });

  test.each(rutas)("%s llama a leerHogarActual() y responde 401 sin hogar", (ruta) => {
    const codigo = leer(ruta);
    expect(codigo).toMatch(/await leerHogarActual\(\)/);
    expect(codigo).toMatch(/status:\s*401/);
  });
});
