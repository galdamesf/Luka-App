/**
 * Copia Luka de tu Mac a la nube: los datos a Neon y las boletas al Vercel
 * Blob privado. Se corre en tu Mac, con la base local levantada:
 *
 *   npm run nube:subir                    revisa y muestra que haria; no cambia nada
 *   npm run nube:subir -- --de-verdad     copia de verdad
 *
 * Copiar REEMPLAZA lo que haya en la base de la nube por lo de tu Mac (tu
 * Mac no se toca). Si en la nube hay algo que no esta en tu Mac (otra
 * persona que ya entro, un gasto anotado alla), se niega, a menos que
 * agregues --borrar-lo-demas.
 *
 * Las conexiones salen de .env.nube.local (no va al repositorio):
 *   - BLOB_STORE_ID y VERCEL_OIDC_TOKEN, de `vercel env pull .env.nube.local`
 *     (con el Blob conectado tambien a Development; el permiso dura 12 horas).
 *   - DATABASE_URL_UNPOOLED, la linea que pegas de Neon.
 * Borralo al terminar.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import * as sdkDeBlob from "@vercel/blob";
import { cargarEnv, parsearEnv } from "../src/lib/env";
import { carpetaDeBoletas } from "../src/lib/boletas";
import {
  NOMBRE_DE_TABLA,
  TABLAS,
  boletasEnUso,
  compararMigraciones,
  contar,
  credencialesDeBlob,
  loQueSePierde,
  nadaSePierde,
  urlDeLaNube,
  type Datos,
} from "../src/dominio/subir-a-la-nube";
import { copiarDatos, leerTodo, migracionesAplicadas, tablasDistintas } from "../src/datos/subir-a-la-nube";
import { boletasEnElBlob, boletasQueNoCalzan, planDeBoletas, subirBoletas } from "../src/lib/boletas-a-la-nube";

const ARCHIVO = ".env.nube.local";
const DE_VERDAD = process.argv.includes("--de-verdad");
const BORRAR_LO_DEMAS = process.argv.includes("--borrar-lo-demas");

/** Para cortar con un mensaje claro, sin el detalle tecnico. */
class Alto extends Error {}

function leerVariablesDeLaNube(): Map<string, string> {
  try {
    return parsearEnv(readFileSync(ARCHIVO, "utf8"));
  } catch {
    throw new Alto(
      `No encontré ${ARCHIVO}. Créalo con: npx vercel@latest env pull ${ARCHIVO}`,
    );
  }
}

/** Una tabla de dos columnas de numeros, alineada. */
function tablaDeConteos(mac: Datos, nube: Datos): string {
  const enMac = contar(mac);
  const enNube = contar(nube);
  const ancho = Math.max(...TABLAS.map((t) => NOMBRE_DE_TABLA[t].length));
  const lineas = [`  ${"".padEnd(ancho)}   tu Mac   la nube`];
  for (const t of TABLAS) {
    lineas.push(`  ${NOMBRE_DE_TABLA[t].padEnd(ancho)}   ${String(enMac[t]).padStart(6)}   ${String(enNube[t]).padStart(7)}`);
  }
  return lineas.join("\n");
}

function hogaresDe(datos: Datos): string {
  if (datos.hogar.length === 0) return "  (ninguno)";
  return datos.hogar
    .map((h) => {
      const correos = datos.miembro.filter((m) => m.hogarId === h.id).map((m) => String(m.correo));
      const gastos = datos.gasto.filter((g) => g.hogarId === h.id).length;
      const quienes = correos.length === 0 ? "sin miembros" : correos.join(", ");
      return `  · «${String(h.nombre)}» (${String(h.id)}): ${quienes}; ${gastos} ${gastos === 1 ? "gasto" : "gastos"}`;
    })
    .join("\n");
}

async function main() {
  cargarEnv();
  const urlLocal = process.env.DATABASE_URL?.trim();
  if (!urlLocal) throw new Alto("Falta DATABASE_URL en .env (la base de tu Mac).");

  const variables = leerVariablesDeLaNube();
  const urlNube = (() => {
    try {
      return urlDeLaNube(variables, urlLocal);
    } catch (error) {
      throw new Alto((error as Error).message);
    }
  })();
  const blob = credencialesDeBlob(variables);
  // El SDK del Blob lee sus credenciales del entorno.
  if (blob !== null) Object.assign(process.env, blob.variables);

  const mac = new PrismaClient({ datasourceUrl: urlLocal });
  const nube = new PrismaClient({ datasourceUrl: urlNube });

  try {
    console.log(DE_VERDAD ? "Copiando Luka a la nube.\n" : "Revisando (no se cambia nada).\n");

    // 1. Las dos bases tienen que tener las mismas tablas.
    let migraciones;
    try {
      migraciones = compararMigraciones(await migracionesAplicadas(mac), await migracionesAplicadas(nube));
    } catch (error) {
      throw new Alto(
        `No pude conectarme a una de las bases. ¿Está levantada la de tu Mac (npm run db:up) y es correcta la línea de Neon?\n  ${(error as Error).message.split("\n").slice(-1)[0]}`,
      );
    }
    if (!migraciones.iguales) {
      const detalle = [
        ...migraciones.soloEnOrigen.map((m) => `  · solo en tu Mac: ${m}`),
        ...migraciones.soloEnDestino.map((m) => `  · solo en la nube: ${m}`),
      ].join("\n");
      throw new Alto(
        `Las dos bases no tienen las mismas migraciones, así que sus tablas no calzan:\n${detalle}\n` +
          "Corre npm run dev una vez en tu Mac (aplica las que falten) y que el último deploy de Vercel esté «Ready».",
      );
    }
    console.log("✓ Las dos bases tienen las mismas tablas.\n");

    // 2. Que hay en cada lado.
    const datosMac = await leerTodo(mac);
    const datosNube = await leerTodo(nube);
    console.log(`Filas:\n${tablaDeConteos(datosMac, datosNube)}\n`);
    console.log(`Hogares en tu Mac (estos quedan en la nube):\n${hogaresDe(datosMac)}\n`);
    console.log(`Hogares que hay ahora en la nube (se reemplazan):\n${hogaresDe(datosNube)}\n`);

    const perdida = loQueSePierde(datosMac, datosNube);
    if (!nadaSePierde(perdida)) {
      console.log("⚠ En la nube hay cosas que no están en tu Mac y se borrarían:");
      for (const { tabla, cuantas } of perdida.filas) console.log(`  · ${cuantas} en ${NOMBRE_DE_TABLA[tabla]}`);
      if (perdida.correos.length > 0) console.log(`  · personas: ${perdida.correos.join(", ")}`);
      console.log("");
    }

    // 3. Las boletas.
    const enUso = boletasEnUso(datosMac);
    if (blob === null) {
      throw new Alto(
        `Faltan las credenciales del Blob en ${ARCHIVO} (BLOB_STORE_ID y VERCEL_OIDC_TOKEN). ` +
          "Conecta el Blob también a Development y vuelve a correr vercel env pull.",
      );
    }
    let enBlob: Map<string, number>;
    try {
      enBlob = await boletasEnElBlob(sdkDeBlob);
    } catch (error) {
      throw new Alto(
        `No pude entrar al Blob: ${(error as Error).message}\n` +
          "Revisa que el Blob esté conectado a Development y vuelve a correr vercel env pull (el permiso dura 12 horas).",
      );
    }
    const plan = await planDeBoletas(enUso, carpetaDeBoletas(), enBlob);
    console.log(
      `Boletas que usan tus gastos y cuentas: ${enUso.length}\n` +
        `  · por subir: ${plan.subir.length}\n` +
        `  · ya están en la nube: ${plan.yaEstan.length}`,
    );
    if (plan.faltanEnDisco.length > 0) {
      console.log(`  · ⚠ no están en tu Mac (esos gastos quedarán sin foto): ${plan.faltanEnDisco.length}`);
      for (const b of plan.faltanEnDisco) console.log(`      ${b.hogarId}/${b.nombre}`);
    }
    if (plan.distintas.length > 0) {
      console.log(`  · ⚠ en la nube hay otra con el mismo nombre y otro tamaño: ${plan.distintas.length}`);
      for (const b of plan.distintas) console.log(`      ${b.hogarId}/${b.nombre}`);
    }
    console.log("");

    // Hasta aqui la revision.
    const problemas: string[] = [];
    if (!nadaSePierde(perdida) && !BORRAR_LO_DEMAS) {
      problemas.push(
        "En la nube hay cosas que no están en tu Mac (arriba). Si quieres borrarlas igual, agrega --borrar-lo-demas.",
      );
    }
    if (plan.distintas.length > 0) {
      problemas.push("Hay boletas que no calzan con las de la nube (arriba). No se pisan: avísame antes de seguir.");
    }

    if (!DE_VERDAD) {
      for (const p of problemas) console.log(`✗ ${p}`);
      if (problemas.length === 0) {
        console.log("Todo listo. Para copiar de verdad:\n  npm run nube:subir -- --de-verdad");
      } else {
        console.log("Arregla lo de arriba antes de copiar.");
        process.exitCode = 1;
      }
      return;
    }
    if (problemas.length > 0) throw new Alto(problemas.join("\n"));

    // 4. De verdad: primero las boletas (si los datos fallan despues, una
    //    boleta de mas en la nube no molesta a nadie), despues los datos.
    if (plan.subir.length > 0) {
      await subirBoletas(plan.subir, sdkDeBlob, (_b, n) => {
        process.stdout.write(`\rSubiendo boletas: ${n} de ${plan.subir.length}`);
      });
      process.stdout.write("\n");
    }
    const locales = [...plan.subir, ...plan.yaEstan];
    const noCalzan = boletasQueNoCalzan(locales, await boletasEnElBlob(sdkDeBlob));
    if (noCalzan.length > 0) {
      throw new Alto(
        `${noCalzan.length} boletas no quedaron bien en la nube. No se copiaron los datos; vuelve a correrlo.`,
      );
    }
    console.log(`✓ Las ${locales.length} boletas están en la nube.`);

    console.log("Copiando los datos (todo o nada)…");
    await copiarDatos(datosMac, nube);
    const distintas = await tablasDistintas(datosMac, nube);
    if (distintas.length > 0) {
      throw new Alto(
        `La copia no quedó idéntica en: ${distintas.map((t) => NOMBRE_DE_TABLA[t]).join(", ")}. Avísame antes de usar Luka en la nube.`,
      );
    }
    console.log("✓ Los datos en la nube quedaron idénticos a los de tu Mac, fila por fila.\n");
    console.log(
      "Listo. Ahora:\n" +
        "  1. Entra a Luka en la nube y revisa tus gastos y una boleta.\n" +
        `  2. Borra ${ARCHIVO}: tiene la conexión a tu base de la nube.`,
    );
  } finally {
    await Promise.all([mac.$disconnect(), nube.$disconnect()]);
  }
}

main().catch((error) => {
  if (error instanceof Alto) {
    console.error(`\n✗ ${error.message}`);
  } else {
    console.error("\n✗ Algo falló:", error);
  }
  process.exitCode = 1;
});
