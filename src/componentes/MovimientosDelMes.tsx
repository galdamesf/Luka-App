"use client";

import { useMemo, useState } from "react";
import type { CategoriaPlana, GastoPlano } from "@/dominio/resumen";
import type { AccionFormulario } from "@/dominio/formulario";
import { ETIQUETA_MEDIO_PAGO } from "@/dominio/esquemas";
import { TablaGastos } from "./TablaGastos";
import { Icono } from "./Icono";
import { formatearCLP } from "./formato";

type Props = {
  gastos: readonly GastoPlano[];
  categorias: readonly CategoriaPlana[];
  alEliminar?: (datos: FormData) => void;
  accionBoleta?: AccionFormulario;
};

/** Sin tildes ni mayusculas: "cafe" encuentra "Café". */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * La tabla de gastos de siempre (con sus boletas y su boton de eliminar),
 * con un buscador y un filtro por categoria encima. Filtra en el navegador:
 * los gastos del mes ya estan cargados y son pocos.
 */
export function MovimientosDelMes({ gastos, categorias, alEliminar, accionBoleta }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaId, setCategoriaId] = useState("todas");

  // Solo las categorias que tienen gastos este mes: filtrar por una vacia
  // no sirve de nada.
  const conGastos = useMemo(() => {
    const ids = new Set(gastos.map((g) => g.categoria.id));
    return categorias.filter((c) => ids.has(c.id));
  }, [gastos, categorias]);

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return gastos.filter(
      (g) =>
        (categoriaId === "todas" || g.categoria.id === categoriaId) &&
        (q === "" ||
          normalizar(g.descripcion).includes(q) ||
          normalizar(g.categoria.nombre).includes(q) ||
          normalizar(ETIQUETA_MEDIO_PAGO[g.medioPago]).includes(q)),
    );
  }, [gastos, busqueda, categoriaId]);

  const filtrando = busqueda.trim() !== "" || categoriaId !== "todas";
  const total = filtrados.reduce((s, g) => s + g.monto, 0);

  const herramientas =
    gastos.length === 0 ? null : (
      <div className="no-imprimir flex flex-wrap items-center gap-3 border-b border-borde px-5 py-3">
        <div className="relative min-w-0 flex-[1_1_15rem]">
          <label htmlFor="buscar-gasto" className="sr-only">
            Buscar gastos
          </label>
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-tenue">
            <Icono nombre="search" tamano={16} />
          </span>
          <input
            id="buscar-gasto"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por descripción, categoría o medio de pago"
            className="min-h-11 w-full rounded-md border border-borde bg-superficie-tenue pr-3 pl-9 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue"
          />
        </div>
        <div className="min-w-0 flex-[0_1_14rem]">
          <label htmlFor="filtrar-categoria" className="sr-only">
            Filtrar por categoría
          </label>
          <select
            id="filtrar-categoria"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
            className="min-h-11 w-full cursor-pointer rounded-md border border-borde bg-superficie-tenue px-3 text-sm text-texto transition-colors duration-150 hover:border-texto-tenue"
          >
            <option value="todas">Todas las categorías</option>
            {conGastos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <p className="ml-auto text-[13px] text-texto-tenue" aria-live="polite">
          {filtrados.length} de {gastos.length} · <span className="cifra font-semibold text-texto">{formatearCLP(total)}</span>
        </p>
        {filtrando && (
          <button
            type="button"
            onClick={() => {
              setBusqueda("");
              setCategoriaId("todas");
            }}
            className="min-h-11 cursor-pointer rounded-md px-2 text-[13px] font-semibold text-accion-tinta hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    );

  return (
    <TablaGastos
      gastos={filtrados}
      alEliminar={alEliminar}
      accionBoleta={accionBoleta}
      herramientas={herramientas}
      nivelTitulo="h3"
      mensajeVacio={
        filtrando ? "No hay gastos que coincidan con la búsqueda." : "Todavía no hay gastos registrados en este mes."
      }
    />
  );
}
