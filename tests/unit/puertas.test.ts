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

  test("la politica de privacidad y los terminos se ven siempre, con o sin sesion", () => {
    const middleware = leer("middleware.ts");
    expect(middleware).toMatch(/esLegal = pathname === "\/privacidad" \|\| pathname === "\/terminos"/);
    expect(middleware).toMatch(/if \(esLegal\) return NextResponse\.next\(\)/);
  });

  test("el middleware usa la configuracion base, no la completa", () => {
    expect(leer("middleware.ts")).toMatch(/from\s+["']@\/auth\.config["']/);
  });
});

describe("cada pagina revisa el hogar en cada visita", () => {
  const PUBLICAS = ["app/bienvenida/page.tsx", "app/ingresar/page.tsx", "app/privacidad/page.tsx", "app/terminos/page.tsx"];
  // El segundo paso: son la puerta, asi que no pueden pedir hogarActual().
  const SEGUNDO_PASO = ["app/verificacion/configurar/page.tsx", "app/verificacion/page.tsx"];
  const paginas = archivos(join(RAIZ, "app"), "page.tsx").filter((p) => !PUBLICAS.includes(p) && !SEGUNDO_PASO.includes(p));

  test("hay paginas que revisar", () => {
    expect(paginas.length).toBeGreaterThanOrEqual(4);
  });

  test.each(paginas)("%s llama a hogarActual()", (ruta) => {
    expect(leer(ruta)).toMatch(/await hogarActual\(\)/);
  });

  test("las paginas del segundo paso existen y revisan en que paso va la persona", () => {
    expect(archivos(join(RAIZ, "app"), "page.tsx").filter((p) => p.startsWith("app/verificacion/"))).toEqual(SEGUNDO_PASO);
    for (const ruta of SEGUNDO_PASO) {
      const codigo = leer(ruta);
      expect(codigo, ruta).toMatch(/await leerAcceso\(\)/);
      expect(codigo, ruta).toMatch(/acceso\.estado === "sin-sesion"/);
      expect(codigo, ruta).toMatch(/force-dynamic/);
    }
  });
});

describe("el segundo paso esta en la puerta de todo", () => {
  test("hogarActual() solo deja pasar a quien hizo los dos pasos", () => {
    const codigo = leer("lib/hogar-actual.ts");
    expect(codigo).toMatch(/redirect\(RUTA_CONFIGURAR\)/);
    expect(codigo).toMatch(/redirect\(RUTA_VERIFICAR\)/);
    expect(codigo).toMatch(/acceso\.estado !== "listo"/);
  });

  test("leerHogarActual(), el de las rutas con datos, tambien", () => {
    expect(leer("lib/hogar-actual.ts")).toMatch(/acceso\.estado === "listo" \? acceso\.hogar : null/);
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

describe("cada accion guarda en el hogar de la sesion", () => {
  // Todas las acciones, menos la de entrar con Google y las del segundo paso:
  // son la puerta misma, y todavia no hay hogar que pedir.
  const SIN_HOGAR = ["app/acciones/entrar.ts", "app/acciones/verificacion.ts"];
  const ACCIONES = readdirSync(join(RAIZ, "app", "acciones"))
    .filter((n) => n.endsWith(".ts"))
    .map((n) => `app/acciones/${n}`)
    .filter((ruta) => !SIN_HOGAR.includes(ruta));

  test("revisa todos los archivos de acciones", () => {
    expect(ACCIONES).toEqual(
      expect.arrayContaining([
        "app/acciones/ahorros.ts",
        "app/acciones/ajustes.ts",
        "app/acciones/cuentas.ts",
        "app/acciones/finanzas.ts",
        "app/acciones/gastos.ts",
        "app/acciones/presupuestos.ts",
      ]),
    );
  });

  const funciones = ACCIONES.flatMap((ruta) =>
    leer(ruta)
      .split(/(?=export async function )/)
      .filter((trozo) => trozo.startsWith("export async function "))
      .map((trozo) => [`${ruta} › ${/export async function (\w+)/.exec(trozo)![1]}`, trozo] as const),
  );

  test("hay acciones que revisar", () => {
    expect(funciones.length).toBeGreaterThanOrEqual(20);
  });

  test.each(funciones)("%s pide el hogar con hogarActual(), antes de cualquier try", (_nombre, codigo) => {
    const pide = codigo.indexOf("await hogarActual()");
    expect(pide).toBeGreaterThan(-1);
    // Dentro de un try, la redireccion que corta la sesion se volveria un
    // mensaje de error y la accion seguiria.
    const intento = codigo.indexOf("try {");
    if (intento !== -1) expect(pide).toBeLessThan(intento);
  });
});

describe("las acciones del segundo paso revisan en que paso va la persona", () => {
  const funciones = leer("app/acciones/verificacion.ts")
    .split(/(?=export async function )/)
    .filter((trozo) => trozo.startsWith("export async function "))
    .map((trozo) => [/export async function (\w+)/.exec(trozo)![1]!, trozo] as const);

  test("son las tres: confirmar la app, verificar el codigo y salir", () => {
    expect(funciones.map(([nombre]) => nombre).sort()).toEqual([
      "accionConfirmarApp",
      "accionSalirSinVerificar",
      "accionVerificarCodigo",
    ]);
  });

  test.each(funciones)("%s llama a leerAcceso() antes de cualquier try", (_nombre, codigo) => {
    const pide = codigo.indexOf("await leerAcceso()");
    expect(pide).toBeGreaterThan(-1);
    const intento = codigo.indexOf("try {");
    if (intento !== -1) expect(pide).toBeLessThan(intento);
  });
});
