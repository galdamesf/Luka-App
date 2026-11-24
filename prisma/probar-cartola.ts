/**
 * Probar como lee Luka la cartola en PDF de tu banco, sin el buzon.
 *
 *   npm run cartola:probar -- cartolas/cartola.pdf
 *   npm run cartola:probar -- cartolas/cartola.pdf --guardar --correo tu@gmail.com
 *   npm run cartola:probar -- cartolas/cartola.pdf --volcar
 *
 * Te pide la clave del PDF (el correo del banco dice cual es) y no la guarda
 * en ninguna parte. Muestra de que cuenta y periodo es, cada fila como la
 * anotaria Luka y si cuadra con los totales del banco.
 *
 * Con --guardar y --correo, la lee en el hogar de esa persona, como si la
 * hubiera subido ella: lo nuevo queda «Por revisar» y lo que ya estaba no se
 * repite. Solo contra la base de tu computador.
 *
 * Con --volcar deja el texto de cada pagina, con su posicion, en
 * cartolas/<archivo>.texto.json: sirve para ensenarle a Luka a leer la
 * cartola de otro banco.
 *
 * La carpeta cartolas/ no va al repositorio: lo que hay ahi tiene tus datos.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import { PrismaClient } from "@prisma/client";
import { cargarEnv } from "../src/lib/env";
import { formatearCLP } from "../src/lib/dinero";
import { abrirCartola } from "../src/lib/cartola-pdf";
import { cuadrar, leerCartola, lecturaDeLaFila } from "../src/dominio/cartolas";
import { NOMBRE_DEL_TIPO } from "../src/dominio/bancos";
import { normalizarCorreo } from "../src/dominio/entrada";
import { leerCartolaEnPdf } from "../src/datos/cartolas";

cargarEnv();

const MAQUINA_LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const MENSAJE = {
  "falta-la-clave": "El PDF pide una clave.",
  "clave-incorrecta": "La clave no es la del PDF. Revisa en el correo del banco cuál es.",
  "no-se-pudo-abrir": "No se pudo abrir: puede que no sea un PDF o que esté dañado.",
  "muy-grande": "El archivo es demasiado grande para ser una cartola.",
} as const;

/**
 * Pregunta la clave sin mostrar lo que se escribe. En la terminal lee tecla
 * por tecla (readline borra la linea de la pregunta al redibujarla); si la
 * clave llega por una tuberia, lee la primera linea.
 */
function preguntarClave(pregunta: string): Promise<string> {
  const entrada = process.stdin;
  process.stdout.write(pregunta);
  if (!entrada.isTTY) {
    return new Promise((resolve) => {
      const rl = createInterface({ input: entrada });
      rl.once("line", (linea) => {
        rl.close();
        process.stdout.write("\n");
        resolve(linea.trim());
      });
    });
  }
  return new Promise((resolve) => {
    let clave = "";
    const terminar = () => {
      entrada.off("data", alEscribir);
      entrada.setRawMode(false);
      entrada.pause();
      process.stdout.write("\n");
      resolve(clave.trim());
    };
    const alEscribir = (texto: string) => {
      for (const tecla of texto) {
        if (tecla === "\r" || tecla === "\n") return terminar();
        if (tecla === "\u0003") {
          // Control + C
          entrada.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (tecla === "\u007f" || tecla === "\b") clave = clave.slice(0, -1);
        else if (tecla >= " ") clave += tecla;
      }
    };
    entrada.setEncoding("utf8");
    entrada.setRawMode(true);
    entrada.resume();
    entrada.on("data", alEscribir);
  });
}

function fecha(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

async function main() {
  const argumentos = process.argv.slice(2);
  const archivo = argumentos.find((a, i) => !a.startsWith("--") && argumentos[i - 1] !== "--correo");
  const volcar = argumentos.includes("--volcar");
  const guardar = argumentos.includes("--guardar");
  const posCorreo = argumentos.indexOf("--correo");
  const correoDeLaPersona = posCorreo === -1 ? null : normalizarCorreo(argumentos[posCorreo + 1] ?? "");
  if (!archivo) {
    console.error("Falta la cartola: npm run cartola:probar -- cartolas/cartola.pdf");
    process.exitCode = 1;
    return;
  }

  const datos = new Uint8Array(await readFile(archivo));
  let clave: string | undefined;
  let pdf = await abrirCartola(datos);
  if (!pdf.ok && pdf.motivo === "falta-la-clave") {
    clave = await preguntarClave("Clave del PDF (no se guarda): ");
    pdf = await abrirCartola(datos, clave);
  }
  if (!pdf.ok) {
    console.error(MENSAJE[pdf.motivo]);
    process.exitCode = 1;
    return;
  }

  if (volcar) {
    await mkdir("cartolas", { recursive: true });
    const destino = join("cartolas", `${basename(archivo, ".pdf")}.texto.json`);
    await writeFile(destino, JSON.stringify({ archivo: basename(archivo), paginas: pdf.paginas }, null, 1));
    console.log(`El texto quedó en ${destino}. Tiene tus datos: no lo subas al repositorio.\n`);
  }

  const cartola = leerCartola(pdf.paginas);
  if (!cartola.ok) {
    console.log(`Luka no la puede leer: ${cartola.detalle}`);
    if (cartola.motivo === "formato-desconocido") console.log("Con --volcar queda su texto, para enseñarle a Luka a leerla.");
    process.exitCode = 1;
    return;
  }

  const cuenta = cartola.ultimos4SinVerificador
    ? `•••• ${cartola.ultimos4} (o ${cartola.ultimos4SinVerificador}, sin el dígito verificador)`
    : `•••• ${cartola.ultimos4}`;
  console.log(`Cartola de ${cartola.banco}${cartola.numero !== null ? ` N° ${cartola.numero}` : ""}, leída con la plantilla ${cartola.plantilla}`);
  console.log(`  ${NOMBRE_DEL_TIPO[cartola.tipoDeCuenta]} ${cuenta}`);
  console.log(`  Del ${fecha(cartola.desde)} al ${fecha(cartola.hasta)}: ${cartola.filas.length} movimientos\n`);
  for (const fila of cartola.filas) {
    const lectura = lecturaDeLaFila(fila, cartola);
    const monto = `${fila.lado === "cargo" ? "-" : "+"}${formatearCLP(fila.monto)}`.padStart(13);
    console.log(`  ${fecha(fila.fecha).slice(0, 5)} ${monto}  ${lectura.tipo.padEnd(13)} ${lectura.comercio}`);
  }

  const cuadre = cuadrar(cartola);
  console.log("");
  if (cuadre.cuadra && cartola.totales) {
    console.log(
      `Cuadra con ${cartola.banco}: cargos ${formatearCLP(cuadre.cargos)}, abonos ${formatearCLP(cuadre.abonos)}, saldo final ${formatearCLP(cartola.totales.saldoFinal)}.`,
    );
  } else {
    console.log("No cuadra con los totales del banco, así que Luka no la anotaría:");
    for (const problema of cuadre.problemas) console.log(`  - ${problema}`);
    process.exitCode = 1;
    return;
  }

  if (!guardar) {
    console.log("\nPara dejarla en la base de tu computador: agrega --guardar --correo tu@gmail.com");
    return;
  }
  if (correoDeLaPersona === null) {
    console.error("Para guardarla, di de quién es: --correo tu@gmail.com");
    process.exitCode = 1;
    return;
  }
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    // Sin URL valida no hay base local.
  }
  if (!MAQUINA_LOCAL.has(host)) {
    console.error("Guardar va solo en la base de tu computador: DATABASE_URL no apunta a localhost.");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const miembro = await prisma.miembro.findUnique({ where: { correo: correoDeLaPersona }, select: { id: true, hogarId: true } });
    if (miembro === null) {
      console.error(`Ningún hogar tiene a ${correoDeLaPersona} como miembro.`);
      process.exitCode = 1;
      return;
    }
    const resultado = await leerCartolaEnPdf(miembro.hogarId, { pdf: datos, miembroId: miembro.id, clave }, { db: prisma });
    if (!resultado.ok) {
      console.error(resultado.mensaje);
      process.exitCode = 1;
      return;
    }
    const { cartola: leida } = resultado;
    console.log(
      resultado.yaLeida
        ? "\nEsa cartola ya estaba leída: no se anotó nada de nuevo."
        : `\nGuardada${leida.cuenta ? ` en ${leida.cuenta}` : " (la cuenta no está en «Tus bancos»)"}: ${leida.nuevas} quedaron «Por revisar», ${leida.yaEstaban} ya estaban anotados y ${leida.fuera} quedaron fuera (ingresos, traspasos y giros).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
