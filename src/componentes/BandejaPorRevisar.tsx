"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Bandeja, Deshacer, ItemDejadoFuera, ItemPorRevisar, ReglaPosible, ResultadoBandeja } from "@/dominio/bandeja";
import type { TipoMovimiento } from "@/dominio/comprobantes/tipos";
import type { CategoriaPlana } from "@/dominio/resumen";
import { AvisoFlotante } from "./AvisoFlotante";
import { Icono } from "./Icono";
import { Luka } from "./Luka";
import { cuandoFue, detalleDe, fichaDe, medioDe, montoDe, porQueQuedoFuera, textoJuntados, type Ficha } from "./textos-bandeja";

/** Las acciones de src/app/acciones/movimientos.ts: reciben un objeto y devuelven el aviso. */
type Accion = (entrada: unknown) => Promise<ResultadoBandeja>;

type Props = {
  bandeja: Bandeja;
  /** Las categorias activas del hogar, en su orden. */
  categorias: readonly CategoriaPlana[];
  /** AAAA-MM-DD, para decir "Hoy" y "Ayer". */
  hoy: string;
  accionConfirmar: Accion;
  accionConfirmarListas: Accion;
  accionDescartar: Accion;
  accionAnotarIgual: Accion;
  accionDeshacer: Accion;
  accionCrearRegla: Accion;
};

type Aviso = { titulo: string; mensaje: string; deshacer: Deshacer | null };

/**
 * Cuantos se ven sin apretar «Ver todos». Cada uno ocupa harto, y con la
 * bandeja llena el resto del panel quedaria muy abajo. Si sobraria uno solo,
 * se muestran todos.
 */
export const VISIBLES_EN_LA_BANDEJA = 5;
type Correccion = { descripcion: string; monto: string; fecha: string };

const CAMPO_BASE =
  "min-h-11 rounded-md border border-borde px-3 py-2 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue";
const CAMPO = `${CAMPO_BASE} w-full bg-superficie-tenue`;
/** Los campos de «Corregir», que van sobre un fondo tenue. */
const CAMPO_EN_TENUE = `${CAMPO_BASE} w-full bg-superficie`;
const SECUNDARIO =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-borde px-3 text-[13px] font-semibold text-texto transition-colors duration-150 hover:bg-superficie-tenue disabled:cursor-not-allowed disabled:opacity-60";
const DE_TEXTO =
  "inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md px-2 text-[13px] font-semibold text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto disabled:cursor-not-allowed disabled:opacity-60";

const FICHA: Record<Ficha["tono"], string> = {
  alerta: "bg-alerta/15 text-alerta",
  acento: "bg-durazno text-durazno-texto",
  neutro: "bg-superficie-tenue text-texto-tenue",
};

/** El icono de un movimiento sin categoria todavia. */
const ICONO_DEL_TIPO: Record<TipoMovimiento, string> = {
  COMPRA: "credit-card",
  BOLETA: "receipt",
  TRANSFERENCIA: "arrow-right",
  PAGO: "receipt",
  PAGO_TARJETA: "credit-card",
  TRASPASO_PROPIO: "repeat",
  ABONO: "arrow-down-left",
  GIRO: "wallet",
  CARGO: "arrow-down-left",
};

/**
 * La bandeja «Por revisar»: lo que llego de los comprobantes de los bancos y
 * las tiendas, esperando que alguien del hogar diga que es. Nada de aqui
 * suma en el mes hasta que se confirma.
 *
 * Cada movimiento trae lo que Luka propone (src/dominio/movimientos.ts):
 * anotarlo como gasto en una categoria, enlazarlo con un gasto que ya estaba,
 * pagar la cuenta o la cuota con que calza, o anotar una compra en cuotas
 * como deuda. Lo que esta listo (categoria conocida, sin preguntas) se puede
 * confirmar todo junto. Cada accion deja un aviso con «Deshacer».
 */
export function BandejaPorRevisar({
  bandeja,
  categorias,
  hoy,
  accionConfirmar,
  accionConfirmarListas,
  accionDescartar,
  accionAnotarIgual,
  accionDeshacer,
  accionCrearRegla,
}: Props) {
  const { dejadosFuera } = bandeja;
  const [elegidas, setElegidas] = useState<Record<string, string>>({});
  // Quien dijo «Son distintos», «Como gasto» o «Es otra cosa»: ahora se anota como gasto.
  const [comoGasto, setComoGasto] = useState<Record<string, boolean>>({});
  const [corrigiendo, setCorrigiendo] = useState<Record<string, Correccion | undefined>>({});
  // El monto en pesos de lo que llego en dolares.
  const [pesos, setPesos] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string | null>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [regla, setRegla] = useState<ReglaPosible | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  // Lo que se acaba de confirmar o descartar se saca al tiro, sin esperar a
  // que la pagina se refresque: asi no se puede apretar dos veces.
  const [hechos, setHechos] = useState<ReadonlySet<string>>(new Set());
  const barraDeLaRegla = useRef<HTMLDivElement>(null);
  const [, iniciar] = useTransition();

  // Si la pregunta de la regla aparece fuera de la vista (se confirmo algo
  // de mas abajo), se acerca lo justo para verla.
  useEffect(() => {
    if (regla === null) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    barraDeLaRegla.current?.scrollIntoView({ block: "nearest", behavior: quieto ? "auto" : "smooth" });
  }, [regla]);

  const categoriaElegida = (item: ItemPorRevisar) => elegidas[item.id] ?? item.revision.categoria?.categoriaId ?? "";
  const enModoGasto = (item: ItemPorRevisar) => item.revision.propuesta.como === "gasto" || comoGasto[item.id] === true;

  const porRevisar = bandeja.porRevisar.filter((item) => !hechos.has(item.id));
  const sobran = porRevisar.length > VISIBLES_EN_LA_BANDEJA + 1;
  const aLaVista = sobran && !verTodos ? porRevisar.slice(0, VISIBLES_EN_LA_BANDEJA) : porRevisar;

  // Solo lo que esta a la vista: nada se confirma sin haberse visto.
  const listas = aLaVista.filter(
    (item) =>
      item.revision.lista &&
      item.revision.propuesta.como === "gasto" &&
      corrigiendo[item.id] === undefined &&
      categoriaElegida(item) !== "",
  );

  /** Corre una accion: el error queda junto a lo que se apreto, y lo hecho en el aviso. */
  function correr(clave: string, hacer: () => Promise<ResultadoBandeja>, despues?: (resultado: ResultadoBandeja) => void) {
    setErrores((e) => ({ ...e, [clave]: null }));
    setOcupado(clave);
    iniciar(async () => {
      const resultado = await hacer();
      setOcupado(null);
      if (!resultado.ok) {
        setErrores((e) => ({ ...e, [clave]: resultado.mensaje ?? "No se pudo guardar. Intenta de nuevo." }));
        return;
      }
      setAviso({ titulo: resultado.titulo ?? "Listo", mensaje: resultado.mensaje ?? "", deshacer: resultado.deshacer });
      const hecho = resultado.deshacer;
      if (hecho !== null && hecho.de !== "anotar-igual") setHechos((h) => new Set([...h, ...hecho.ids]));
      despues?.(resultado);
    });
  }

  function confirmarComoGasto(item: ItemPorRevisar) {
    const categoriaId = categoriaElegida(item);
    const enPesos = (pesos[item.id] ?? "").trim();
    const falta = categoriaId === "" ? "Elige una categoría." : item.moneda === "USD" && enPesos === "" ? "Escribe cuánto fue en pesos." : null;
    if (falta !== null) {
      setErrores((e) => ({ ...e, [item.id]: falta }));
      return;
    }
    const correccion = corrigiendo[item.id];
    const confirmacion = {
      como: "gasto",
      categoriaId,
      ...(correccion === undefined
        ? {}
        : { descripcion: correccion.descripcion, fecha: correccion.fecha, ...(item.moneda === "CLP" ? { monto: correccion.monto } : {}) }),
      ...(item.moneda === "USD" ? { monto: enPesos } : {}),
    };
    correr(item.id, () => accionConfirmar({ id: item.id, confirmacion }), (resultado) => setRegla(resultado.regla));
  }

  function confirmarPropuesta(item: ItemPorRevisar) {
    const { propuesta } = item.revision;
    const confirmacion =
      propuesta.como === "mismo-gasto"
        ? { como: "mismo-gasto", gastoId: propuesta.gasto.id }
        : propuesta.como === "pago-de-cuenta"
          ? { como: "pago-de-cuenta", cuentaId: propuesta.cuenta.id }
          : propuesta.como === "pago-de-cuota"
            ? { como: "pago-de-cuota", deudaId: propuesta.cuota.deudaId, mes: propuesta.cuota.mes }
            : { como: "deuda" };
    correr(item.id, () => accionConfirmar({ id: item.id, confirmacion }));
  }

  function deshacer(cual: Deshacer) {
    setAviso(null);
    if (regla !== null && cual.ids.includes(regla.movimientoId)) setRegla(null);
    correr("deshacer", () => accionDeshacer(cual), () =>
      setHechos((h) => new Set([...h].filter((id) => !cual.ids.includes(id)))),
    );
  }

  return (
    <section
      id="por-revisar"
      aria-labelledby="titulo-por-revisar"
      className="tarjeta-viva viva-acento scroll-mt-28 overflow-hidden rounded-xl border border-borde bg-superficie shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borde px-5 py-4">
        <h2 id="titulo-por-revisar" className="text-base font-bold">
          Por revisar
        </h2>
        {porRevisar.length > 0 && (
          <span className="cifra inline-flex min-w-7 items-center justify-center rounded-full bg-acento px-2 py-0.5 text-[13px] font-bold text-acento-tinta">
            {porRevisar.length}
            <span className="sr-only"> {porRevisar.length === 1 ? "movimiento" : "movimientos"}</span>
          </span>
        )}
        <p className="text-[13px] text-texto-tenue">De los comprobantes de tus bancos y tiendas. Nada suma hasta que lo confirmas.</p>
        {listas.length > 0 && (
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() =>
              correr("listas", () =>
                accionConfirmarListas({ elegidos: listas.map((item) => ({ id: item.id, categoriaId: categoriaElegida(item) })) }),
              )
            }
            className="boton-luka ml-auto cursor-pointer"
          >
            <Icono nombre="check" tamano={16} />
            {ocupado === "listas" ? "Guardando…" : `Confirmar ${listas.length} ${listas.length === 1 ? "lista" : "listas"}`}
          </button>
        )}
        {errores.listas && (
          <p role="status" className="basis-full text-xs text-peligro">
            {errores.listas}
          </p>
        )}
      </div>

      {regla !== null && (
        <div
          ref={barraDeLaRegla}
          className="aviso-entra flex scroll-mt-28 flex-wrap items-center gap-3 border-b border-borde bg-durazno px-5 py-3 text-durazno-texto"
        >
          <p className="text-[14px] font-semibold">
            {regla.cambia
              ? `¿Cambio la regla de «${regla.etiqueta}» a «${regla.categoria}»?`
              : `¿Uso «${regla.categoria}» siempre que el comercio sea «${regla.etiqueta}»?`}
          </p>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={ocupado !== null}
              onClick={() => {
                const pedida = regla;
                setRegla(null);
                correr("regla", () => accionCrearRegla({ movimientoId: pedida.movimientoId, categoriaId: pedida.categoriaId }));
              }}
              className="boton-luka cursor-pointer"
            >
              {regla.cambia ? "Sí, cambiarla" : "Sí, crear regla"}
            </button>
            <button
              type="button"
              onClick={() => setRegla(null)}
              className="min-h-11 cursor-pointer rounded-md px-3 text-[14px] font-bold underline decoration-2 underline-offset-4"
            >
              Ahora no
            </button>
          </div>
        </div>
      )}
      {(errores.regla || errores.deshacer) && (
        <p role="status" className="border-b border-borde px-5 py-2 text-xs text-peligro">
          {errores.regla ?? errores.deshacer}
        </p>
      )}

      {porRevisar.length === 0 ? (
        <div className="flex items-center gap-4 px-5 py-4">
          <Luka pose="echado" quieto alto={40} />
          <div>
            <p className="text-sm font-bold">Todo al día</p>
            <p className="text-[13px] text-texto-tenue">Luka sigue atento: el próximo comprobante que llegue aparece aquí.</p>
          </div>
        </div>
      ) : (
        <ul id="lista-por-revisar" className="divide-y divide-borde">
          {aLaVista.map((item) => (
            <ItemDeLaBandeja
              key={item.id}
              item={item}
              hoy={hoy}
              categorias={categorias}
              categoriaId={categoriaElegida(item)}
              enModoGasto={enModoGasto(item)}
              correccion={corrigiendo[item.id]}
              pesos={pesos[item.id] ?? ""}
              ocupado={ocupado === item.id}
              bloqueado={ocupado !== null}
              error={errores[item.id] ?? null}
              alElegir={(id) => setElegidas((e) => ({ ...e, [item.id]: id }))}
              alPasarAGasto={() => setComoGasto((m) => ({ ...m, [item.id]: true }))}
              alCorregir={(correccion) => setCorrigiendo((c) => ({ ...c, [item.id]: correccion }))}
              alEscribirPesos={(monto) => setPesos((p) => ({ ...p, [item.id]: monto }))}
              alConfirmarGasto={() => confirmarComoGasto(item)}
              alConfirmarPropuesta={() => confirmarPropuesta(item)}
              alDescartar={() => correr(item.id, () => accionDescartar({ id: item.id }))}
            />
          ))}
        </ul>
      )}
      {sobran && (
        <div className="flex justify-center border-t border-borde px-5 py-1.5">
          <button
            type="button"
            aria-expanded={verTodos}
            aria-controls="lista-por-revisar"
            onClick={() => setVerTodos(!verTodos)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md px-2 text-[13px] font-semibold enlace-luka transition-colors duration-150 hover:bg-superficie-tenue"
          >
            {verTodos ? "Ver menos" : `Ver ${porRevisar.length - VISIBLES_EN_LA_BANDEJA === 1 ? "el que falta" : `los ${porRevisar.length - VISIBLES_EN_LA_BANDEJA} que faltan`}`}
            <span className={`transition-transform duration-150 ${verTodos ? "rotate-180" : ""}`}>
              <Icono nombre="chevron-down" tamano={14} />
            </span>
          </button>
        </div>
      )}

      {dejadosFuera.length > 0 && (
        <DejadosFuera
          items={dejadosFuera}
          hoy={hoy}
          bloqueado={ocupado !== null}
          errores={errores}
          alAnotar={(item) => correr(item.id, () => accionAnotarIgual({ id: item.id }))}
        />
      )}

      <AvisoFlotante
        titulo={aviso?.titulo ?? ""}
        mensaje={aviso?.mensaje ?? null}
        alCerrar={() => setAviso(null)}
        duracion={aviso?.deshacer ? 8000 : 4500}
        accion={aviso?.deshacer ? { etiqueta: "Deshacer", icono: "undo", alHacer: () => deshacer(aviso.deshacer!) } : null}
      />
    </section>
  );
}

type PropsItem = {
  item: ItemPorRevisar;
  hoy: string;
  categorias: readonly CategoriaPlana[];
  categoriaId: string;
  enModoGasto: boolean;
  correccion: Correccion | undefined;
  pesos: string;
  /** Esta accion se esta guardando. */
  ocupado: boolean;
  /** Alguna accion se esta guardando: no se aprieta otra encima. */
  bloqueado: boolean;
  error: string | null;
  alElegir: (categoriaId: string) => void;
  alPasarAGasto: () => void;
  alCorregir: (correccion: Correccion | undefined) => void;
  alEscribirPesos: (monto: string) => void;
  alConfirmarGasto: () => void;
  alConfirmarPropuesta: () => void;
  alDescartar: () => void;
};

/** Lo que dice el boton principal de cada propuesta. */
function textoDeLaPropuesta(item: ItemPorRevisar): { si: string; no: string } {
  const { propuesta } = item.revision;
  switch (propuesta.como) {
    case "mismo-gasto":
      return { si: "Es el mismo", no: "Son distintos" };
    case "pago-de-cuenta":
      return { si: "Marcar pagada", no: "Es otra cosa" };
    case "pago-de-cuota":
      return { si: "Marcar la cuota pagada", no: "Es otra cosa" };
    case "deuda":
      return { si: "Anotar como deuda", no: "Como gasto" };
    case "gasto":
      return { si: "Confirmar", no: "" };
  }
}

function ItemDeLaBandeja({
  item,
  hoy,
  categorias,
  categoriaId,
  enModoGasto,
  correccion,
  pesos,
  ocupado,
  bloqueado,
  error,
  alElegir,
  alPasarAGasto,
  alCorregir,
  alEscribirPesos,
  alConfirmarGasto,
  alConfirmarPropuesta,
  alDescartar,
}: PropsItem) {
  const categoria = categorias.find((c) => c.id === categoriaId) ?? null;
  // La ficha nombra la categoria que propuso Luka, aunque se haya elegido otra.
  const propuesta = categorias.find((c) => c.id === item.revision.categoria?.categoriaId) ?? null;
  const ficha = fichaDe(item, propuesta?.nombre ?? null);
  const detalle = detalleDe(item, hoy);
  const juntados = textoJuntados(item.juntados);
  const medio = medioDe(item);
  const monto = montoDe(item);
  const queEs = `${item.comercio} por ${monto}`;
  const textos = textoDeLaPropuesta(item);
  const idBase = `movimiento-${item.id}`;

  return (
    <li className="fila-viva viva-acento flex gap-3 px-5 py-4">
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full ${
          categoria === null ? "border border-borde bg-superficie-tenue text-texto-tenue" : "text-white"
        }`}
        style={categoria === null ? undefined : { backgroundColor: categoria.color }}
      >
        <Icono nombre={categoria?.icono ?? ICONO_DEL_TIPO[item.tipo]} tamano={18} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 font-bold leading-snug [overflow-wrap:anywhere]">{item.comercio}</p>
          <p className="cifra shrink-0 font-bold">{monto}</p>
        </div>
        <p className="mt-0.5 text-[13px] text-texto-tenue">
          {cuandoFue(item.fecha, hoy)}
          {medio !== null && <> · {medio}</>} · <span className="font-semibold">{item.fuente}</span>
        </p>
        {juntados !== null && <p className="mt-0.5 text-xs text-texto-tenue">{juntados}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${FICHA[ficha.tono]}`}>
            {ficha.texto}
          </span>
          {item.revision.avisos.includes("reenviado-a-mano") && (
            <span className="inline-flex items-center rounded-md bg-superficie-tenue px-2 py-0.5 text-xs font-semibold text-texto-tenue">
              Reenviado a mano
            </span>
          )}
          {detalle !== null && <span className="text-[13px] text-texto-tenue">{detalle}</span>}
        </div>

        {!enModoGasto ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={bloqueado} onClick={alConfirmarPropuesta} className="boton-luka cursor-pointer">
              {ocupado ? "Guardando…" : textos.si}
              <span className="sr-only">: {queEs}</span>
            </button>
            <button type="button" disabled={bloqueado} onClick={alPasarAGasto} className={SECUNDARIO}>
              {textos.no}
              <span className="sr-only">: anotar {queEs} como un gasto nuevo</span>
            </button>
          </div>
        ) : (
          <>
            {item.moneda === "USD" && (
              <div className="mt-3 max-w-72">
                <label htmlFor={`${idBase}-pesos`} className="mb-1 block text-xs font-medium text-texto-tenue">
                  ¿Cuánto fue en pesos? <span className="font-normal">Lo dice tu estado de cuenta.</span>
                </label>
                <input
                  id={`${idBase}-pesos`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pesos}
                  onChange={(e) => alEscribirPesos(e.target.value)}
                  className={`${CAMPO} cifra`}
                />
              </div>
            )}

            {correccion !== undefined && (
              <div className="mt-3 grid gap-2 rounded-md bg-superficie-tenue p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <label htmlFor={`${idBase}-descripcion`} className="mb-1 block text-xs font-medium text-texto-tenue">
                    Descripción
                  </label>
                  <input
                    id={`${idBase}-descripcion`}
                    type="text"
                    maxLength={120}
                    value={correccion.descripcion}
                    onChange={(e) => alCorregir({ ...correccion, descripcion: e.target.value })}
                    className={CAMPO_EN_TENUE}
                  />
                </div>
                {item.moneda === "CLP" && (
                  <div>
                    <label htmlFor={`${idBase}-monto`} className="mb-1 block text-xs font-medium text-texto-tenue">
                      Monto
                    </label>
                    <input
                      id={`${idBase}-monto`}
                      type="text"
                      inputMode="numeric"
                      value={correccion.monto}
                      onChange={(e) => alCorregir({ ...correccion, monto: e.target.value })}
                      className={`${CAMPO_EN_TENUE} cifra`}
                    />
                  </div>
                )}
                <div>
                  <label htmlFor={`${idBase}-fecha`} className="mb-1 block text-xs font-medium text-texto-tenue">
                    Fecha
                  </label>
                  <input
                    id={`${idBase}-fecha`}
                    type="date"
                    value={correccion.fecha}
                    onChange={(e) => alCorregir({ ...correccion, fecha: e.target.value })}
                    className={`${CAMPO_EN_TENUE} cifra`}
                  />
                </div>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor={`${idBase}-categoria`} className="sr-only">
                Categoría de {item.comercio}
              </label>
              <select
                id={`${idBase}-categoria`}
                value={categoriaId}
                onChange={(e) => alElegir(e.target.value)}
                className={`${CAMPO_BASE} w-full cursor-pointer bg-superficie-tenue sm:w-auto sm:min-w-44`}
              >
                <option value="" disabled>
                  Elige una categoría
                </option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <button type="button" disabled={bloqueado} onClick={alConfirmarGasto} className="boton-luka cursor-pointer">
                {ocupado ? "Guardando…" : "Confirmar"}
                <span className="sr-only">: {queEs}</span>
              </button>
              <button
                type="button"
                disabled={bloqueado}
                aria-expanded={correccion !== undefined}
                onClick={() =>
                  alCorregir(
                    correccion !== undefined
                      ? undefined
                      : { descripcion: item.comercio, monto: item.moneda === "CLP" ? String(item.monto) : "", fecha: item.fecha },
                  )
                }
                className={DE_TEXTO}
              >
                <Icono nombre="pencil" tamano={14} />
                {correccion !== undefined ? "Cerrar" : "Corregir"}
                <span className="sr-only">: la descripción, el monto o la fecha de {item.comercio}</span>
              </button>
              <button type="button" disabled={bloqueado} onClick={alDescartar} className={DE_TEXTO}>
                <Icono nombre="x" tamano={14} />
                Descartar
                <span className="sr-only">: {queEs} no es un gasto</span>
              </button>
            </div>
          </>
        )}

        {error !== null && (
          <p role="status" className="mt-2 text-xs text-peligro">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}

function DejadosFuera({
  items,
  hoy,
  bloqueado,
  errores,
  alAnotar,
}: {
  items: readonly ItemDejadoFuera[];
  hoy: string;
  bloqueado: boolean;
  errores: Record<string, string | null>;
  alAnotar: (item: ItemDejadoFuera) => void;
}) {
  return (
    <details className="group border-t border-borde px-5 py-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[14px] font-bold [&::-webkit-details-marker]:hidden">
        <span className="transition-transform duration-150 group-open:rotate-180">
          <Icono nombre="chevron-down" tamano={16} />
        </span>
        Luka dejó fuera {items.length} {items.length === 1 ? "movimiento" : "movimientos"} (ver por qué)
      </summary>
      <ul className="divide-y divide-borde pb-1">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[14px]">
            <span className="min-w-0 flex-1">
              <span className="font-semibold">{item.comercio}</span>{" "}
              <span className="text-texto-tenue">
                · {cuandoFue(item.fecha, hoy)} · {porQueQuedoFuera(item)}
              </span>
            </span>
            <span className="cifra text-texto-tenue">{montoDe(item)}</span>
            {item.puedeAnotarse && (
              <button type="button" disabled={bloqueado} onClick={() => alAnotar(item)} className={DE_TEXTO}>
                Anotar igual
                <span className="sr-only">: {item.comercio} por {montoDe(item)}</span>
              </button>
            )}
            {errores[item.id] && (
              <p role="status" className="basis-full text-xs text-peligro">
                {errores[item.id]}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}
