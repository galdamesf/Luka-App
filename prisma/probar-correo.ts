/**
 * Probar como lee Luka un correo de verdad, sin el buzon ni IMAP: le pasas
 * el correo guardado como .eml y te muestra lo que ve.
 *
 *   npm run correos:probar -- comprobante.eml
 *   npm run correos:probar -- comprobante.eml --guardar --correo tu@gmail.com
 *
 * Para guardar un correo como .eml: en Gmail, ábrelo → los tres puntos →
 * «Descargar el mensaje». En Apple Mail, Archivo → Guardar como, en formato
 * «Fuente». En Outlook, arrástralo al escritorio.
 *
 * Sin --guardar no toca la base: dice para quien es, quien lo mando, si trae
 * su firma, que adjuntos trae (y si se pudo sacar el texto de sus PDF) y lo
 * que leyo el lector, con plantilla o con IA si ANTHROPIC_API_KEY esta en el
 * .env.
 *
 * Con --guardar y --correo, lo deja «Por revisar» en el hogar de esa persona,
 * como si lo hubiera reenviado ella, con su cuenta si calza. Guardarlo dos
 * veces no lo duplica. Solo contra la base de tu computador.
 *
 * El correo es tuyo y se queda en tu computador: no lo pongas en el
 * repositorio.
 */
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { cargarEnv } from "../src/lib/env";
import { comprobanteDelCorreo, correoAdjunto, leerCorreo } from "../src/lib/correo-entrante";
import { configuracionDelBuzon } from "../src/lib/buzon";
import { leerConIADelEntorno } from "../src/lib/leer-con-ia";
import { formatearCLP } from "../src/lib/dinero";
import { crearLector } from "../src/dominio/comprobantes/lector";
import { normalizarComprobante } from "../src/dominio/comprobantes/normalizar";
import { claveDelBuzon, firmadoPor, leerAutenticacion } from "../src/dominio/buzon";
import { normalizarCorreo } from "../src/dominio/entrada";
import { huellaDelComprobante } from "../src/datos/buzon";
import { registrarMovimiento } from "../src/datos/movimientos";

cargarEnv();

const MAQUINA_LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function monto(lectura: { monto: number; moneda: string }): string {
  return lectura.moneda === "USD" ? `US$ ${(lectura.monto / 100).toFixed(2)}` : formatearCLP(lectura.monto);
}

async function main() {
  const argumentos = process.argv.slice(2);
  const archivo = argumentos.find((a, i) => !a.startsWith("--") && argumentos[i - 1] !== "--correo");
  const guardar = argumentos.includes("--guardar");
  const posCorreo = argumentos.indexOf("--correo");
  const correoDeLaPersona = posCorreo === -1 ? null : normalizarCorreo(argumentos[posCorreo + 1] ?? "");

  if (!archivo) {
    console.error("Falta el correo: npm run correos:probar -- comprobante.eml");
    process.exitCode = 1;
    return;
  }

  const fuente = new Uint8Array(await readFile(archivo));
  const correo = await leerCorreo(fuente);
  const autenticacion = correo.autenticacion === null ? null : leerAutenticacion(correo.autenticacion);
  const dominio = correo.de?.slice(correo.de.lastIndexOf("@") + 1) ?? "";
  const base = configuracionDelBuzon()?.direccion ?? null;

  console.log(`De:      ${correo.de ?? "(sin remitente)"}`);
  console.log(`Para:    ${correo.destinatarios.join(", ") || "(nadie)"}`);
  console.log(`Asunto:  ${correo.asunto || "(sin asunto)"}`);
  console.log(`Fecha:   ${correo.fecha?.toISOString() ?? "(sin fecha)"}`);
  console.log(
    `Firma:   ${
      autenticacion === null
        ? "el correo no trae Authentication-Results (es normal si no pasó por un servidor de correo)"
        : firmadoPor(autenticacion, dominio)
          ? `firmado por ${dominio}, según ${autenticacion.servidor}`
          : `sin la firma de ${dominio}, según ${autenticacion.servidor}`
    }`,
  );
  if (base !== null) {
    const clave = claveDelBuzon([...correo.entregadoA, ...correo.destinatarios], base);
    console.log(`Buzón:   ${clave === null ? "no va a ninguna dirección de Luka" : `va a la dirección de Luka con clave ${clave}`}`);
  }
  if (correo.reenviadoPor.length > 0) console.log(`Reenvío: ${correo.reenviadoPor.join(", ")}`);

  const original = await correoAdjunto(correo);
  if (original !== null) console.log(`Trae adjunto el correo original, de ${original.de ?? "(sin remitente)"}: se lee ese.`);
  const comprobante = await comprobanteDelCorreo(original ?? correo, correo.de ?? "", new Date());
  for (const adjunto of comprobante.adjuntos ?? []) {
    console.log(`Adjunto: ${adjunto.nombre || "(sin nombre)"} (${adjunto.tipo}) ${adjunto.texto !== undefined ? "con texto" : "sin texto: con clave, escaneado o no es un PDF"}`);
  }
  const normalizado = normalizarComprobante(comprobante);
  if (normalizado.reenviadoAMano) console.log(`Reenviado a mano: el original es de ${normalizado.remitente}.`);

  const ia = leerConIADelEntorno();
  const lectura = await crearLector({ leerConIA: ia })(comprobante);
  console.log("");
  if (!lectura.ok) {
    console.log(`Luka no lo anotaría: ${lectura.motivo}${lectura.detalle ? `. ${lectura.detalle}` : ""}`);
    if (!ia && lectura.motivo === "no-se-pudo-leer") console.log("Con ANTHROPIC_API_KEY en el .env, la IA lo intentaría.");
    return;
  }
  console.log(`Leído ${lectura.via === "ia" ? `con IA (seguridad ${Math.round((lectura.confianza ?? 0) * 100)} %)` : `con la plantilla ${lectura.plantilla}`}:`);
  console.log(`  ${lectura.tipo}, ${lectura.sentido}: ${monto(lectura)} el ${lectura.fecha}, ${lectura.comercio}`);
  console.log(`  Fuente: ${lectura.fuente}`);
  if (lectura.medioPago) console.log(`  Medio: ${lectura.medioPago}${lectura.ultimos4 ? ` •••• ${lectura.ultimos4}` : ""}`);
  else if (lectura.ultimos4) console.log(`  Cuenta o tarjeta: •••• ${lectura.ultimos4}`);
  if (lectura.cuotas) console.log(`  En ${lectura.cuotas} cuotas`);
  if (lectura.contraparte) {
    const c = lectura.contraparte;
    console.log(`  Con: ${[c.nombre, c.banco, c.ultimos4 ? `•••• ${c.ultimos4}` : null].filter(Boolean).join(" · ")}`);
  }

  if (!guardar) {
    console.log("\nPara dejarlo «Por revisar»: agrega --guardar --correo tu@gmail.com");
    return;
  }
  if (correoDeLaPersona === null) {
    console.error("Para guardarlo, di de quién es: --correo tu@gmail.com");
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
    const registrado = await registrarMovimiento(
      miembro.hogarId,
      {
        huella: huellaDelComprobante(correo, original, comprobante, fuente),
        lectura: original !== null ? { ...lectura, reenviadoAMano: true } : lectura,
        recibidoEn: (original ?? correo).fecha ?? new Date(),
        miembroId: miembro.id,
        reenviadoPor: correoDeLaPersona,
        remitente: normalizado.remitente || correo.de,
      },
      prisma,
    );
    const cuenta = await prisma.movimiento.findUnique({
      where: { id: registrado.id },
      select: { cuentaBancaria: { select: { banco: true, ultimos4: true } } },
    });
    console.log(
      `\n${registrado.nuevo ? "Quedó" : "Ya estaba"} en el hogar (${registrado.estado})` +
        (cuenta?.cuentaBancaria ? `, en la cuenta de ${cuenta.cuentaBancaria.banco} •••• ${cuenta.cuentaBancaria.ultimos4}.` : ", sin cuenta del hogar que calce."),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("No se pudo probar el correo:", error);
  process.exitCode = 1;
});
