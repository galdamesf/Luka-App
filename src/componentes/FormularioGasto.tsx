"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { CategoriaPlana } from "@/dominio/resumen";
import { MEDIOS_PAGO, ETIQUETA_MEDIO_PAGO } from "@/dominio/esquemas";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { Icono } from "./Icono";
import { CampoBoleta } from "./CampoBoleta";
import { formatearCLP } from "./formato";
import { parsearMonto } from "@/lib/dinero";
import { tonoDeUso } from "@/dominio/panel";
import { AvisoFlotante } from "./AvisoFlotante";
import type { EstadoFormulario } from "@/dominio/formulario";

type Props = {
  categorias: readonly CategoriaPlana[];
  /** Fecha que trae el campo por omision, en formato YYYY-MM-DD. */
  fechaInicial: string;
  accion: AccionFormulario;
  /**
   * Lo que va gastado contra el techo de cada categoria con presupuesto, para
   * avisar ANTES de guardar como quedaria. Las sin presupuesto no aparecen.
   */
  presupuestos?: readonly { categoriaId: string; gastado: number; monto: number }[];
  /**
   * Antepuesto a los id de los campos. El formulario aparece dos veces en la
   * pagina (en la seccion 02 y en el popup) y un id repetido rompe los
   * <label>: el clic iria al campo equivocado.
   */
  prefijo?: string;
  /** Dentro del popup: sin tarjeta propia, el dialogo ya hace de tarjeta. */
  enDialogo?: boolean;
  /** Se llama despues de guardar bien. El popup la usa para cerrarse. */
  alGuardar?: () => void;
};

const ETIQUETA = "mb-1 block text-xs font-medium text-texto-tenue";
const CAMPO =
  "min-h-11 w-full rounded-md border border-borde bg-superficie-tenue px-3 py-2 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue";

const AVISO = {
  exito: "border-exito/40 bg-exito/10 text-exito",
  alerta: "border-alerta/40 bg-alerta/10 text-alerta",
  peligro: "border-peligro/40 bg-peligro/10 text-peligro",
} as const;

/** Error de un campo, anclado al input para que el lector de pantalla lo lea. */
function Error({ id, mensajes }: { id: string; mensajes?: string[] }) {
  if (mensajes === undefined || mensajes.length === 0) return null;
  return (
    <p id={id} className="mt-1 text-xs text-peligro">
      {mensajes[0]}
    </p>
  );
}

export function FormularioGasto({
  categorias, fechaInicial, accion, presupuestos = [], prefijo = "", enDialogo = false, alGuardar,
}: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  // Solo para la vista previa: el formulario sigue siendo no controlado y lo
  // que se guarda es lo que manda el <form>, no este estado.
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id ?? "");
  const [monto, setMonto] = useState<number | null>(null);

  // Lo que se mando, para el aviso: al volver la respuesta el formulario ya
  // se limpio y no quedaria de donde sacarlo.
  const enviado = useRef<{ monto: number | null; categoria: string } | null>(null);
  const atendido = useRef<EstadoFormulario | null>(null);
  const alGuardarRef = useRef(alGuardar);
  alGuardarRef.current = alGuardar;
  const [aviso, setAviso] = useState<string | null>(null);

  // Tras guardar: limpiar para anotar el siguiente de inmediato, avisar que
  // quedo registrado y, si es el popup, cerrarlo. El ref evita repetirlo si
  // el componente se vuelve a pintar con la misma respuesta.
  useEffect(() => {
    if (!estado.ok || atendido.current === estado) return;
    atendido.current = estado;
    const datos = enviado.current;
    formulario.current?.reset();
    setMonto(null);
    setCategoriaId(categorias[0]?.id ?? "");
    setAviso(
      datos !== null && datos.monto !== null
        ? `${formatearCLP(datos.monto)} en ${datos.categoria}. Ya se ve en tu resumen y en tus presupuestos.`
        : "Ya se ve en tu resumen y en tus presupuestos.",
    );
    alGuardarRef.current?.();
  }, [estado, categorias]);

  const id = (nombre: string) => `${prefijo}${nombre}`;

  const err = estado.errores;

  const techo = presupuestos.find((p) => p.categoriaId === categoriaId);
  const nombreCategoria = categorias.find((c) => c.id === categoriaId)?.nombre ?? "";
  const vistaPrevia =
    techo !== undefined && monto !== null && techo.monto > 0
      ? (() => {
          const nuevo = techo.gastado + monto;
          const porcentaje = (nuevo / techo.monto) * 100;
          return { nuevo, porcentaje, tono: tonoDeUso(porcentaje) };
        })()
      : null;

  return (
    <section
      aria-labelledby={id("titulo-formulario")}
      className={
        enDialogo
          ? "p-6"
          : "tarjeta-viva viva-accion rounded-xl border border-borde bg-superficie p-5 shadow-sm"
      }
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-accion/15 text-accion-tinta">
          <Icono nombre="plus" tamano={20} />
        </span>
        <div>
          {/* h3: vive dentro de la seccion 02 del dashboard, que ya tiene su h2. */}
          <h3 id={id("titulo-formulario")} className="text-base font-bold">
            Registrar nuevo gasto
          </h3>
          <p className="text-[13px] text-texto-tenue">
            Se suma a tu resumen, a la semana que corresponde y a tu score.
          </p>
        </div>
      </div>

      <form
        ref={formulario}
        action={enviar}
        onSubmit={() => {
          enviado.current = { monto, categoria: nombreCategoria };
        }}
        className="mt-4 space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={id("fecha")} className={ETIQUETA}>Fecha</label>
            <input
              id={id("fecha")}
              name="fecha"
              type="date"
              defaultValue={fechaInicial}
              required
              aria-describedby={err.fecha ? id("error-fecha") : undefined}
              aria-invalid={err.fecha ? true : undefined}
              className={`${CAMPO} cifra`}
            />
            <Error id={id("error-fecha")} mensajes={err.fecha} />
          </div>

          <div>
            <label htmlFor={id("monto")} className={ETIQUETA}>Monto</label>
            <input
              id={id("monto")}
              name="monto"
              type="text"
              inputMode="numeric"
              placeholder="45.990"
              required
              onChange={(e) => setMonto(parsearMonto(e.target.value))}
              aria-describedby={err.monto ? id("error-monto") : undefined}
              aria-invalid={err.monto ? true : undefined}
              className={`${CAMPO} cifra`}
            />
            <Error id={id("error-monto")} mensajes={err.monto} />
          </div>
        </div>

        <div>
          <label htmlFor={id("descripcion")} className={ETIQUETA}>Descripción</label>
          <input
            id={id("descripcion")}
            name="descripcion"
            type="text"
            maxLength={120}
            placeholder="Supermercado, bencina, farmacia…"
            required
            aria-describedby={err.descripcion ? id("error-descripcion") : undefined}
            aria-invalid={err.descripcion ? true : undefined}
            className={CAMPO}
          />
          <Error id={id("error-descripcion")} mensajes={err.descripcion} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={id("categoriaId")} className={ETIQUETA}>Categoría</label>
            <select
              id={id("categoriaId")}
              name="categoriaId"
              required
              onChange={(e) => setCategoriaId(e.target.value)}
              aria-describedby={err.categoriaId ? id("error-categoriaId") : undefined}
              className={`${CAMPO} cursor-pointer`}
            >
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>
            <Error id={id("error-categoriaId")} mensajes={err.categoriaId} />
          </div>

          <div>
            <label htmlFor={id("medioPago")} className={ETIQUETA}>Medio de pago</label>
            <select
              id={id("medioPago")}
              name="medioPago"
              defaultValue="DEBITO"
              className={`${CAMPO} cursor-pointer`}
            >
              {MEDIOS_PAGO.map((medio) => (
                <option key={medio} value={medio}>
                  {ETIQUETA_MEDIO_PAGO[medio]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <CampoBoleta id={id("gasto-boleta")} />

        {/* Antes de guardar: como quedaria el presupuesto de esa categoria. */}
        {vistaPrevia !== null && (
          <p
            aria-live="polite"
            className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] ${AVISO[vistaPrevia.tono]}`}
          >
            <span className="mt-px shrink-0">
              <Icono nombre={vistaPrevia.tono === "exito" ? "check" : "alert"} tamano={15} />
            </span>
            <span>
              {nombreCategoria} quedaría en {Math.round(vistaPrevia.porcentaje)}% de su presupuesto (
              <span className="cifra">{formatearCLP(vistaPrevia.nuevo)}</span> de{" "}
              <span className="cifra">{formatearCLP(techo?.monto ?? 0)}</span>).
            </span>
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-accion px-4 py-2.5 text-sm font-bold text-accion-texto transition-[filter] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Icono nombre="plus" />
          {pendiente ? "Guardando…" : "Agregar gasto"}
        </button>

        {/* role=status para que el lector de pantalla lo anuncie sin interrumpir. */}
        {estado.mensaje !== null && !estado.ok && (
          <p role="status" className="text-xs text-peligro">
            {estado.mensaje}
          </p>
        )}
      </form>

      <AvisoFlotante titulo="Gasto registrado" mensaje={aviso} alCerrar={() => setAviso(null)} />
    </section>
  );
}
