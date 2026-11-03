import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { ETIQUETA_MEDIO_PAGO } from "@/dominio/esquemas";
import type { NivelSemana } from "@/dominio/semanas";
import type { ReporteSemanal } from "@/dominio/reporte-semanal";
import { formatearCLP } from "./dinero";
import { fechaLarga, nombreDelMes, porcentajeLegible } from "@/componentes/formato";
import {
  COMO_SE_LEE,
  comparacionConAnterior,
  estadoDeLaSemana,
  nombreArchivoReporte,
  rangoDeLaSemana,
} from "@/componentes/textos-reporte";

export { nombreArchivoReporte, rangoDeLaSemana };

/**
 * El reporte semanal como PDF descargable.
 *
 * Se dibuja con pdf-lib y las fuentes estandar del PDF (Helvetica): no hay
 * que incrustar archivos de fuente y el resultado pesa pocos KB. La
 * contracara es que Helvetica estandar solo conoce Latin-1 (WinAnsi): tildes,
 * enes, "¿" y "·" si, emojis no. Todo texto pasa por `limpiar` antes de
 * dibujarse, porque un emoji en una descripcion haria fallar el PDF entero.
 *
 * El PDF va en tonos claros siempre, como la impresion del informe: es para
 * leer en papel o en pantalla de cualquiera.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGEN = 40;
const ANCHO = A4[0] - 2 * MARGEN;
/** Espacio reservado abajo para el pie de cada pagina. */
const PIE = 34;

function hex(color: string): RGB {
  const n = Number.parseInt(color.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const TINTA = hex("#0f172a");
const TENUE = hex("#475569");
const SUAVE = hex("#94a3b8");
const BORDE = hex("#e2e8f0");
const FONDO = hex("#f1f5f9");
const ACCION = hex("#7c3aed");
const EXITO = hex("#047857");
const PELIGRO = hex("#be123c");
const ESENCIAL = hex("#0284c7");
const DISCRECIONAL = hex("#c026d3");

/** Mismos niveles y colores que el dashboard, en su version para fondo claro. */
const NIVEL: Record<NivelSemana, { nombre: string; color: RGB }> = {
  bajo: { nombre: "Bajo", color: EXITO },
  normal: { nombre: "Normal", color: hex("#1557c0") },
  alto: { nombre: "Alto", color: hex("#b45309") },
  "muy-alto": { nombre: "Muy alto", color: PELIGRO },
};

const UN_DECIMAL = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
// Fecha y hora por separado: cada version de ICU une las dos a su manera
// ("a las", ", "...) y el reporte tiene que decir lo mismo en todos lados.
const FECHA = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", day: "numeric", month: "long", year: "numeric" });
const HORA = new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fechaYHora = (fecha: Date) => `${FECHA.format(fecha)}, ${HORA.format(fecha)}`;

const REEMPLAZOS: Record<string, string> = {
  "−": "-",
  " ": " ",
  " ": " ",
  " ": " ",
  "\t": " ",
  "\n": " ",
  "\r": " ",
};

type Fuente = "regular" | "negrita" | "cursiva";
type OpcionesTexto = { fuente?: Fuente; tam?: number; color?: RGB; alinear?: "izq" | "der"; ancho?: number };

export type Columna = { titulo: string; ancho: number; alinear?: "izq" | "der" };
export type Celda = {
  texto: string;
  negrita?: boolean;
  color?: RGB;
  /** Cuadrito de color antes del texto (la categoria). */
  cuadro?: RGB;
  /** Parte el texto en varias lineas en vez de recortarlo. */
  envolver?: boolean;
  /** Segunda linea mas chica y en cursiva (las notas de un gasto). */
  nota?: string;
  /** Barra horizontal antes del texto: fraccion de 0 a 1 del ancho disponible. */
  barra?: { fraccion: number; color: RGB };
};
/** Fila que agrupa a las que siguen, a todo el ancho: el dia en el detalle. */
export type Grupo = { grupo: string; derecha: string };

const capitalizar = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** La hoja y el lapiz: lleva el cursor vertical y salta de pagina cuando no cabe algo. */
class Lienzo {
  readonly paginas: PDFPage[] = [];
  private pagina!: PDFPage;
  /** Borde superior de lo proximo que se dibuja. */
  y = 0;
  private readonly permitidos: Set<number>;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fuentes: Record<Fuente, PDFFont>,
    private readonly encabezado: string,
  ) {
    this.permitidos = new Set(fuentes.regular.getCharacterSet());
    this.nuevaPagina();
  }

  nuevaPagina() {
    this.pagina = this.doc.addPage(A4);
    this.paginas.push(this.pagina);
    this.y = A4[1] - MARGEN;
    if (this.paginas.length > 1) {
      this.texto(this.encabezado, MARGEN, this.y, { tam: 8, color: TENUE });
      this.y -= 22;
    }
  }

  /** Salta de pagina si lo que viene (de `alto` puntos) no cabe. true si salto. */
  asegurar(alto: number): boolean {
    if (this.y - alto < MARGEN + PIE) {
      this.nuevaPagina();
      return true;
    }
    return false;
  }

  /** Deja solo lo que Helvetica estandar sabe dibujar. */
  limpiar(texto: string): string {
    let limpio = "";
    for (const caracter of texto.normalize("NFC")) {
      const reemplazo = REEMPLAZOS[caracter] ?? caracter;
      for (const c of reemplazo) {
        if (this.permitidos.has(c.codePointAt(0) as number)) limpio += c;
      }
    }
    return limpio.replace(/ {2,}/g, " ").trim();
  }

  medir(texto: string, fuente: Fuente, tam: number): number {
    return this.fuentes[fuente].widthOfTextAtSize(texto, tam);
  }

  /** Corta con "…" lo que no cabe en `ancho`. */
  recortar(texto: string, fuente: Fuente, tam: number, ancho: number): string {
    if (this.medir(texto, fuente, tam) <= ancho) return texto;
    let corto = texto;
    while (corto.length > 0 && this.medir(`${corto}…`, fuente, tam) > ancho) corto = corto.slice(0, -1);
    return `${corto.trimEnd()}…`;
  }

  /** Parte en lineas que caben en `ancho`. Una palabra mas larga que la linea se corta a la fuerza. */
  partir(texto: string, fuente: Fuente, tam: number, ancho: number): string[] {
    const lineas: string[] = [];
    let actual = "";
    for (const palabra of this.limpiar(texto).split(" ")) {
      const candidata = actual === "" ? palabra : `${actual} ${palabra}`;
      if (this.medir(candidata, fuente, tam) <= ancho) {
        actual = candidata;
        continue;
      }
      if (actual !== "") lineas.push(actual);
      let resto = palabra;
      while (this.medir(resto, fuente, tam) > ancho) {
        let corte = resto.length;
        while (corte > 1 && this.medir(resto.slice(0, corte), fuente, tam) > ancho) corte -= 1;
        lineas.push(resto.slice(0, corte));
        resto = resto.slice(corte);
      }
      actual = resto;
    }
    if (actual !== "") lineas.push(actual);
    return lineas.length === 0 ? [""] : lineas;
  }

  /** Texto con la linea base en `base`. Con alinear "der", `x` es el borde derecho. */
  texto(texto: string, x: number, base: number, opciones: OpcionesTexto = {}) {
    const { fuente = "regular", tam = 9, color = TINTA, alinear = "izq", ancho } = opciones;
    let limpio = this.limpiar(texto);
    if (ancho !== undefined) limpio = this.recortar(limpio, fuente, tam, ancho);
    if (limpio === "") return;
    const izquierda = alinear === "der" ? x - this.medir(limpio, fuente, tam) : x;
    this.pagina.drawText(limpio, { x: izquierda, y: base, size: tam, font: this.fuentes[fuente], color });
  }

  /** Rectangulo con su borde superior en `arriba`. */
  rect(x: number, arriba: number, ancho: number, alto: number, color: RGB, borde?: RGB) {
    this.pagina.drawRectangle({
      x,
      y: arriba - alto,
      width: ancho,
      height: alto,
      color,
      ...(borde ? { borderColor: borde, borderWidth: 0.75 } : {}),
    });
  }

  linea(x1: number, y: number, x2: number, color = BORDE, grosor = 0.75) {
    this.pagina.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: grosor, color });
  }

  /** Titulo de seccion. `siguiente` es cuanto de lo que viene debe caber junto al titulo. */
  seccion(titulo: string, siguiente = 40) {
    this.y -= 10;
    this.asegurar(24 + siguiente);
    this.rect(MARGEN, this.y - 1, 3, 13, ACCION);
    this.texto(titulo, MARGEN + 9, this.y - 11, { fuente: "negrita", tam: 12 });
    this.y -= 24;
  }

  /** Tabla con encabezado que se repite en cada pagina nueva. */
  tabla(columnas: Columna[], filas: (Celda[] | Grupo)[], total?: Celda[]) {
    const RELLENO = 5;
    const TAM = 8.5;
    const encabezado = () => {
      this.rect(MARGEN, this.y, ANCHO, 17, FONDO);
      let x = MARGEN;
      for (const c of columnas) {
        const opciones = { fuente: "negrita" as const, tam: 7, color: TENUE, ancho: c.ancho - 2 * RELLENO };
        if (c.alinear === "der") this.texto(c.titulo.toUpperCase(), x + c.ancho - RELLENO, this.y - 11.5, { ...opciones, alinear: "der" });
        else this.texto(c.titulo.toUpperCase(), x + RELLENO, this.y - 11.5, opciones);
        x += c.ancho;
      }
      this.y -= 17;
    };

    const dibujarFila = (celdas: Celda[], esTotal: boolean) => {
      // Primero se mide: el alto de la fila lo pone su celda mas larga.
      const medidas = celdas.map((celda, i) => {
        const columna = columnas[i] as Columna;
        const util = columna.ancho - 2 * RELLENO - (celda.cuadro ? 11 : 0);
        const fuente: Fuente = celda.negrita || esTotal ? "negrita" : "regular";
        const lineas = celda.envolver
          ? this.partir(celda.texto, fuente, TAM, util)
          : [this.recortar(this.limpiar(celda.texto), fuente, TAM, util)];
        const notas = celda.nota ? this.partir(celda.nota, "cursiva", 7.5, util) : [];
        return { lineas, notas, fuente, util };
      });
      const alto = Math.max(...medidas.map((m) => m.lineas.length * 11 + m.notas.length * 9.5)) + 9;

      if (this.asegurar(alto)) encabezado();
      if (esTotal) this.rect(MARGEN, this.y, ANCHO, alto, FONDO);

      let x = MARGEN;
      celdas.forEach((celda, i) => {
        const columna = columnas[i] as Columna;
        const { lineas, notas, fuente } = medidas[i] as (typeof medidas)[number];
        let base = this.y - 4.5 - TAM * 0.8;
        let izquierda = x + RELLENO;
        if (celda.cuadro) {
          this.rect(izquierda, base + 6.5, 7, 7, celda.cuadro);
          izquierda += 11;
        }
        if (celda.barra) {
          const largo = Math.max(0, Math.min(1, celda.barra.fraccion)) * (columna.ancho - 2 * RELLENO - 40);
          if (largo > 0) this.rect(izquierda, base + 6.5, Math.max(1.5, largo), 7, celda.barra.color);
          izquierda += largo + 6;
        }
        for (const linea of lineas) {
          if (columna.alinear === "der") this.texto(linea, x + columna.ancho - RELLENO, base, { fuente, tam: TAM, color: celda.color ?? TINTA, alinear: "der" });
          else this.texto(linea, izquierda, base, { fuente, tam: TAM, color: celda.color ?? TINTA });
          base -= 11;
        }
        for (const nota of notas) {
          this.texto(nota, izquierda, base + 1, { fuente: "cursiva", tam: 7.5, color: TENUE });
          base -= 9.5;
        }
        x += columna.ancho;
      });
      this.y -= alto;
      this.linea(MARGEN, this.y, MARGEN + ANCHO);
    };

    const ALTO_GRUPO = 22;
    const dibujarGrupo = (fila: Grupo) => {
      // Un dia no puede quedar solo al pie de la pagina: con el, al menos su primer gasto.
      if (this.asegurar(ALTO_GRUPO + 22)) encabezado();
      this.texto(fila.grupo, MARGEN + RELLENO, this.y - 15, { fuente: "negrita", tam: 9.5, color: ACCION });
      this.texto(fila.derecha, MARGEN + ANCHO - RELLENO, this.y - 15, { tam: 8.5, color: TENUE, alinear: "der" });
      this.y -= ALTO_GRUPO;
      this.linea(MARGEN, this.y, MARGEN + ANCHO, ACCION, 0.75);
    };

    this.asegurar(17 + 20);
    encabezado();
    for (const fila of filas) {
      if ("grupo" in fila) dibujarGrupo(fila);
      else dibujarFila(fila, false);
    }
    if (total) dibujarFila(total, true);
    this.y -= 4;
  }

  /** Parrafo que se parte en lineas y salta de pagina si hace falta. */
  parrafo(texto: string, opciones: { tam?: number; color?: RGB; fuente?: Fuente; ancho?: number; x?: number } = {}) {
    const { tam = 8.5, color = TENUE, fuente = "regular", ancho = ANCHO, x = MARGEN } = opciones;
    for (const linea of this.partir(texto, fuente, tam, ancho)) {
      this.asegurar(tam + 4);
      this.texto(linea, x, this.y - tam * 0.8, { tam, color, fuente });
      this.y -= tam + 3.5;
    }
  }

  /** El pie de todas las paginas, cuando ya se sabe cuantas son. */
  pies(texto: string) {
    const total = this.paginas.length;
    this.paginas.forEach((pagina, i) => {
      this.pagina = pagina;
      this.linea(MARGEN, MARGEN + 14, MARGEN + ANCHO);
      this.texto(texto, MARGEN, MARGEN, { tam: 7.5, color: SUAVE, ancho: ANCHO - 80 });
      this.texto(`Página ${i + 1} de ${total}`, MARGEN + ANCHO, MARGEN, { tam: 7.5, color: SUAVE, alinear: "der" });
    });
  }
}

/** El reporte semanal completo, listo para descargar. */
export async function generarPdfReporteSemanal(reporte: ReporteSemanal, generadoEn: Date = new Date()): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const rango = rangoDeLaSemana(reporte);
  const [nombreMes] = nombreDelMes(reporte.mes).split(" ");
  const titulo = `Semana ${reporte.semana} · ${rango}`;

  doc.setTitle(`Reporte semanal Luka · ${titulo}`);
  doc.setAuthor("Luka");
  doc.setCreator("Luka");
  doc.setProducer("Luka");
  doc.setLanguage("es-CL");
  doc.setCreationDate(generadoEn);

  const fuentes: Record<Fuente, PDFFont> = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    negrita: await doc.embedFont(StandardFonts.HelveticaBold),
    cursiva: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const l = new Lienzo(doc, fuentes, `Luka · Reporte semanal · ${titulo}`);

  // --- Encabezado ---
  l.texto("LUKA · REPORTE SEMANAL", MARGEN, l.y - 8, { fuente: "negrita", tam: 8, color: ACCION });
  l.y -= 16;
  l.texto(titulo, MARGEN, l.y - 18, { fuente: "negrita", tam: 20 });
  l.y -= 28;
  l.texto(`${estadoDeLaSemana(reporte)} · Semana ${reporte.semana} de ${reporte.semanasDelMes} de ${nombreMes} · Generado el ${fechaYHora(generadoEn)}`, MARGEN, l.y - 8, {
    tam: 8.5,
    color: TENUE,
    ancho: ANCHO,
  });
  l.y -= 18;
  l.linea(MARGEN, l.y, MARGEN + ANCHO, BORDE, 1);
  l.y -= 14;

  // --- Las cuatro cifras ---
  const nivel = reporte.nivel === null ? null : NIVEL[reporte.nivel.nivel];
  const tarjetas: { nombre: string; valor: string; nota: string; color: RGB; valorColor?: RGB }[] = [
    {
      nombre: "Total de la semana",
      valor: formatearCLP(reporte.total),
      nota: reporte.cantidad === 0 ? "Sin gastos registrados" : `${plural(reporte.cantidad, "gasto", "gastos")} · ${reporte.conBoleta} con boleta`,
      color: ACCION,
    },
    {
      nombre: "Promedio diario",
      valor: reporte.promedioDiario === null ? "—" : formatearCLP(reporte.promedioDiario),
      nota:
        reporte.diasTranscurridos === 0
          ? "La semana no empieza"
          : `Sobre ${plural(reporte.diasTranscurridos, "día", "días")}${reporte.estado === "en-curso" ? " que van" : ""}`,
      color: ESENCIAL,
    },
    {
      nombre: "Parte del mes",
      valor: reporte.porcentajeDelMes === null ? "—" : porcentajeLegible(reporte.porcentajeDelMes),
      nota: `De ${formatearCLP(reporte.totalDelMes)} en ${nombreMes}`,
      color: EXITO,
    },
    {
      nombre: "Ritmo discrecional",
      valor: nivel?.nombre ?? "Sin dato",
      nota: reporte.nivel === null ? "Aún no hay con qué medirlo" : `${UN_DECIMAL.format(reporte.nivel.veces)}× tu promedio diario del mes`,
      color: nivel?.color ?? SUAVE,
      valorColor: nivel?.color,
    },
  ];
  const separacion = 8;
  const anchoTarjeta = (ANCHO - separacion * 3) / 4;
  tarjetas.forEach((t, i) => {
    const x = MARGEN + i * (anchoTarjeta + separacion);
    l.rect(x, l.y, anchoTarjeta, 60, rgb(1, 1, 1), BORDE);
    l.rect(x, l.y, anchoTarjeta, 3, t.color);
    l.texto(t.nombre, x + 9, l.y - 16, { tam: 7.5, color: TENUE, ancho: anchoTarjeta - 18 });
    l.texto(t.valor, x + 9, l.y - 35, { fuente: "negrita", tam: 15, color: t.valorColor ?? TINTA, ancho: anchoTarjeta - 18 });
    l.texto(t.nota, x + 9, l.y - 50, { tam: 7, color: TENUE, ancho: anchoTarjeta - 18 });
  });
  l.y -= 74;

  // --- Esencial contra discrecional ---
  l.texto("Esencial y discrecional", MARGEN, l.y - 8, { fuente: "negrita", tam: 9 });
  l.y -= 15;
  l.rect(MARGEN, l.y, ANCHO, 9, FONDO);
  if (reporte.total > 0) {
    const anchoEsencial = (reporte.esenciales / reporte.total) * ANCHO;
    if (anchoEsencial > 0) l.rect(MARGEN, l.y, anchoEsencial, 9, ESENCIAL);
    if (ANCHO - anchoEsencial > 0) l.rect(MARGEN + anchoEsencial, l.y, ANCHO - anchoEsencial, 9, DISCRECIONAL);
  }
  l.y -= 16;
  const parte = (monto: number) => (reporte.total === 0 ? "0%" : porcentajeLegible((monto / reporte.total) * 100));
  l.rect(MARGEN, l.y + 1, 7, 7, ESENCIAL);
  l.texto(`Esencial ${formatearCLP(reporte.esenciales)} · ${parte(reporte.esenciales)}`, MARGEN + 11, l.y - 5.5, { tam: 8.5 });
  l.rect(MARGEN + 200, l.y + 1, 7, 7, DISCRECIONAL);
  l.texto(`Discrecional ${formatearCLP(reporte.discrecionales)} · ${parte(reporte.discrecionales)}`, MARGEN + 211, l.y - 5.5, { tam: 8.5 });
  l.y -= 18;

  // --- Contra la semana anterior ---
  const lineasComparacion = comparacionConAnterior(reporte).map((linea) => ({
    texto: linea.texto,
    color: linea.tono === "sube" ? PELIGRO : linea.tono === "baja" ? EXITO : undefined,
    negrita: linea.tono !== "neutro",
  }));
  const altoComparacion = 26 + lineasComparacion.length * 12;
  l.asegurar(altoComparacion);
  l.rect(MARGEN, l.y, ANCHO, altoComparacion, FONDO);
  l.texto("Contra la semana anterior", MARGEN + 10, l.y - 14, { fuente: "negrita", tam: 9 });
  let base = l.y - 28;
  for (const linea of lineasComparacion) {
    l.texto(linea.texto, MARGEN + 10, base, { tam: 8.5, color: linea.color ?? TENUE, fuente: linea.negrita ? "negrita" : "regular", ancho: ANCHO - 20 });
    base -= 12;
  }
  l.y -= altoComparacion + 8;

  // --- Destacados ---
  if (reporte.cantidad > 0) {
    l.seccion("Lo más destacado", 70);
    const principal = reporte.categorias[0];
    const destacados: [string, string, string][] = [
      [
        "Mayor gasto",
        reporte.mayorGasto?.descripcion ?? "—",
        reporte.mayorGasto
          ? `${formatearCLP(reporte.mayorGasto.monto)} · ${reporte.mayorGasto.categoria.nombre} · ${fechaLarga(reporte.mayorGasto.fecha)}`
          : "",
      ],
      [
        "Día con más gasto",
        reporte.diaMasAlto ? capitalizar(fechaLarga(reporte.diaMasAlto.fecha)) : "—",
        reporte.diaMasAlto ? formatearCLP(reporte.diaMasAlto.total) : "",
      ],
      [
        "Categoría principal",
        principal?.categoria.nombre ?? "—",
        principal ? `${formatearCLP(principal.total)} · ${porcentajeLegible(principal.porcentaje)} de la semana` : "",
      ],
      [
        "Boletas adjuntas",
        `${reporte.conBoleta} de ${reporte.cantidad}`,
        reporte.cantidad - reporte.conBoleta === 0 ? "Todos los gastos tienen boleta" : `${plural(reporte.cantidad - reporte.conBoleta, "gasto", "gastos")} sin boleta`,
      ],
    ];
    const anchoDestacado = (ANCHO - 10) / 2;
    destacados.forEach(([nombre, valor, nota], i) => {
      const x = MARGEN + (i % 2) * (anchoDestacado + 10);
      const arriba = l.y - Math.floor(i / 2) * 40;
      l.texto(nombre, x, arriba - 7, { tam: 7.5, color: TENUE });
      l.texto(valor, x, arriba - 19, { fuente: "negrita", tam: 10, ancho: anchoDestacado });
      l.texto(nota, x, arriba - 30, { tam: 8, color: TENUE, ancho: anchoDestacado });
    });
    l.y -= 82;
  }

  // --- Por categoria ---
  if (reporte.categorias.length > 0) {
    const hayAnterior = reporte.anterior !== null;
    l.seccion("Por categoría", 60);
    const columnas: Columna[] = hayAnterior
      ? [
          { titulo: "Categoría", ancho: 140 },
          { titulo: "Tipo", ancho: 70 },
          { titulo: "Gastos", ancho: 42, alinear: "der" },
          { titulo: "Monto", ancho: 72, alinear: "der" },
          { titulo: "% semana", ancho: 50, alinear: "der" },
          { titulo: `Semana ${reporte.semana - 1}`, ancho: 70, alinear: "der" },
          { titulo: "Diferencia", ancho: ANCHO - 444, alinear: "der" },
        ]
      : [
          { titulo: "Categoría", ancho: 190 },
          { titulo: "Tipo", ancho: 90 },
          { titulo: "Gastos", ancho: 60, alinear: "der" },
          { titulo: "Monto", ancho: 95, alinear: "der" },
          { titulo: "% semana", ancho: ANCHO - 435, alinear: "der" },
        ];
    const filas = reporte.categorias.map((c): Celda[] => {
      const fila: Celda[] = [
        { texto: c.categoria.nombre, cuadro: hex(c.categoria.color) },
        { texto: c.categoria.esencial ? "Esencial" : "Discrecional", color: TENUE },
        { texto: String(c.cantidad) },
        { texto: formatearCLP(c.total), negrita: true },
        { texto: porcentajeLegible(c.porcentaje) },
      ];
      if (hayAnterior) {
        const diferencia = c.total - (c.anterior ?? 0);
        fila.push(
          { texto: formatearCLP(c.anterior ?? 0), color: TENUE },
          {
            texto: diferencia === 0 ? "=" : `${diferencia > 0 ? "+" : "-"}${formatearCLP(Math.abs(diferencia))}`,
            color: diferencia > 0 ? PELIGRO : diferencia < 0 ? EXITO : TENUE,
          },
        );
      }
      return fila;
    });
    const total: Celda[] = [
      { texto: "Total" },
      { texto: "" },
      { texto: String(reporte.cantidad) },
      { texto: formatearCLP(reporte.total) },
      { texto: "100%" },
    ];
    if (hayAnterior) {
      const anteriorCategorias = reporte.categorias.reduce((suma, c) => suma + (c.anterior ?? 0), 0);
      total.push({ texto: formatearCLP(anteriorCategorias) }, { texto: "" });
    }
    l.tabla(columnas, filas, total);
    if (hayAnterior) {
      l.parrafo(
        `"Semana ${reporte.semana - 1}" es lo que sumó cada categoría la semana anterior. Una diferencia positiva es más gasto que entonces.`,
        { tam: 7.5 },
      );
    }
  }

  // --- Por medio de pago ---
  if (reporte.medios.length > 0) {
    l.seccion("Por medio de pago", 50);
    l.tabla(
      [
        { titulo: "Medio de pago", ancho: 190 },
        { titulo: "Gastos", ancho: 70, alinear: "der" },
        { titulo: "Monto", ancho: 110, alinear: "der" },
        { titulo: "% semana", ancho: ANCHO - 370, alinear: "der" },
      ],
      reporte.medios.map((m) => [
        { texto: m.nombre },
        { texto: String(m.cantidad) },
        { texto: formatearCLP(m.total), negrita: true },
        { texto: porcentajeLegible(m.porcentaje) },
      ]),
    );
  }

  // --- Dia por dia ---
  l.seccion("Día por día", 60);
  const maximoDia = Math.max(0, ...reporte.dias.map((d) => d.total));
  l.tabla(
    [
      { titulo: "Día", ancho: 160 },
      { titulo: "Gastos", ancho: 60, alinear: "der" },
      { titulo: "Monto", ancho: 100, alinear: "der" },
      { titulo: "Del total de la semana", ancho: ANCHO - 320 },
    ],
    reporte.dias.map((d) => [
      { texto: capitalizar(fechaLarga(d.fecha)), color: d.transcurrido ? TINTA : SUAVE },
      { texto: d.transcurrido ? String(d.gastos.length) : "—", color: d.transcurrido ? TINTA : SUAVE },
      { texto: d.transcurrido ? formatearCLP(d.total) : "Por venir", negrita: d.total > 0, color: d.transcurrido ? TINTA : SUAVE },
      d.total > 0
        ? {
            texto: porcentajeLegible((d.total / reporte.total) * 100),
            color: TENUE,
            barra: { fraccion: maximoDia === 0 ? 0 : d.total / maximoDia, color: ACCION },
          }
        : { texto: "" },
    ]),
  );

  // --- Cada gasto ---
  l.seccion("Detalle de gastos", 80);
  if (reporte.cantidad === 0) {
    l.parrafo(reporte.estado === "por-venir" ? "La semana todavía no empieza." : "No hay gastos registrados en esta semana.", { tam: 9 });
  }
  if (reporte.cantidad > 0) {
    // Una sola tabla, con una fila por dia que agrupa sus gastos: el
    // encabezado de columnas se repite solo al saltar de pagina.
    let numero = 0;
    const filas: (Celda[] | Grupo)[] = [];
    for (const dia of reporte.dias) {
      if (dia.gastos.length === 0) continue;
      filas.push({
        grupo: capitalizar(fechaLarga(dia.fecha)),
        derecha: `${plural(dia.gastos.length, "gasto", "gastos")} · ${formatearCLP(dia.total)}`,
      });
      for (const g of dia.gastos) {
        numero += 1;
        filas.push([
          { texto: String(numero), color: SUAVE },
          { texto: g.descripcion, envolver: true, ...(g.notas ? { nota: g.notas } : {}) },
          { texto: g.categoria.nombre, cuadro: hex(g.categoria.color) },
          { texto: ETIQUETA_MEDIO_PAGO[g.medioPago], color: TENUE },
          { texto: g.boletaArchivo ? "Adjunta" : "No", color: g.boletaArchivo ? EXITO : SUAVE },
          { texto: formatearCLP(g.monto), negrita: true },
        ]);
      }
    }
    l.tabla(
      [
        { titulo: "#", ancho: 20, alinear: "der" },
        { titulo: "Descripción", ancho: 190 },
        { titulo: "Categoría", ancho: 105 },
        { titulo: "Medio", ancho: 72 },
        { titulo: "Boleta", ancho: 48 },
        { titulo: "Monto", ancho: ANCHO - 435, alinear: "der" },
      ],
      filas,
      [
        { texto: "" },
        { texto: `Total · ${plural(reporte.cantidad, "gasto", "gastos")}` },
        { texto: "" },
        { texto: "" },
        { texto: `${reporte.conBoleta} de ${reporte.cantidad}` },
        { texto: formatearCLP(reporte.total) },
      ],
    );
  }

  // --- Cuotas ---
  if (reporte.cuotas.length > 0) {
    l.seccion("Cuotas de deudas pagadas esta semana", 60);
    l.tabla(
      [
        { titulo: "Fecha", ancho: 130 },
        { titulo: "Deuda", ancho: 150 },
        { titulo: "Descripción", ancho: 145 },
        { titulo: "Monto", ancho: ANCHO - 425, alinear: "der" },
      ],
      reporte.cuotas.map((c) => [
        { texto: capitalizar(fechaLarga(c.fecha)) },
        { texto: c.cuota?.deudaNombre ?? "—" },
        { texto: c.descripcion, color: TENUE },
        { texto: formatearCLP(c.monto), negrita: true },
      ]),
      [{ texto: "Total en cuotas" }, { texto: "" }, { texto: "" }, { texto: formatearCLP(reporte.totalCuotas) }],
    );
    l.parrafo("Las cuotas no se suman al total de la semana: el balance ya las descuenta del sueldo por su lado.", { tam: 7.5 });
  }

  // --- Como se lee ---
  l.y -= 8;
  l.asegurar(40);
  l.linea(MARGEN, l.y, MARGEN + ANCHO);
  l.y -= 8;
  l.parrafo(`Cómo se lee: ${COMO_SE_LEE.charAt(0).toLowerCase()}${COMO_SE_LEE.slice(1)}`, { tam: 7.5, color: SUAVE });

  l.pies(`Luka · Reporte semanal · ${titulo}`);
  return doc.save();
}
