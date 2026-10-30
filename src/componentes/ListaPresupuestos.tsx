"use client";

import { useState } from "react";
import type { DetalleDeCategoria, LineaPresupuesto } from "@/dominio/presupuestos";
import type { AccionFormulario } from "@/dominio/formulario";
import { FilaPresupuesto } from "./FilaPresupuesto";

type Item = {
  linea: LineaPresupuesto;
  detalle: DetalleDeCategoria;
  comprometido: number;
};

type Props = {
  items: readonly Item[];
  accionEditar: AccionFormulario;
  alEliminar: (datos: FormData) => void;
};

type Filtro = "todas" | "agotadas" | "cerca" | "sanas";

const FILTROS: ReadonlyArray<{ id: Filtro; nombre: string; punto: string; cumple: (l: LineaPresupuesto) => boolean }> = [
  { id: "todas", nombre: "Todas", punto: "bg-texto-tenue", cumple: () => true },
  { id: "agotadas", nombre: "Agotadas", punto: "bg-peligro", cumple: (l) => l.agotado },
  { id: "cerca", nombre: "Al límite", punto: "bg-alerta", cumple: (l) => l.alLimite },
  { id: "sanas", nombre: "Sanas", punto: "bg-exito-fuerte", cumple: (l) => !l.agotado && !l.alLimite },
];

/**
 * La lista de presupuestos con un filtro por estado. Cada fila es la misma
 * FilaPresupuesto de siempre: se despliega con sus gastos por semana y sus
 * boletas, y se edita o elimina igual que antes.
 */
export function ListaPresupuestos({ items, accionEditar, alEliminar }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const activo = FILTROS.find((f) => f.id === filtro) ?? FILTROS[0]!;
  const visibles = items.filter((i) => activo.cumple(i.linea));

  return (
    <div className="border-t border-borde">
      {items.length > 1 && (
        <div role="group" aria-label="Filtrar presupuestos por estado" className="flex flex-wrap gap-2 px-5 pt-3">
          {FILTROS.map((f) => {
            const cantidad = items.filter((i) => f.cumple(i.linea)).length;
            const elegido = f.id === filtro;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={elegido}
                onClick={() => setFiltro(f.id)}
                className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors duration-150 ${
                  elegido ? "border-accion bg-accion/15 text-accion-tinta" : "border-borde text-texto-tenue hover:text-texto"
                }`}
              >
                <span aria-hidden="true" className={`size-2 rounded-full ${f.punto}`} />
                {f.nombre}
                <span className="cifra text-xs font-normal">{cantidad}</span>
              </button>
            );
          })}
        </div>
      )}

      {visibles.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-texto-tenue">Ningún presupuesto en este estado.</p>
      ) : (
        <ul className="px-5">
          {visibles.map((i) => (
            <FilaPresupuesto
              key={i.linea.presupuesto.id}
              linea={i.linea}
              detalle={i.detalle}
              comprometido={i.comprometido}
              accionEditar={accionEditar}
              alEliminar={alEliminar}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
