import type { AccionFormulario } from "@/dominio/formulario";
import { nombreParaMostrar, primerNombre, type MiembroDelHogar } from "@/dominio/hogar";
import type { Rol } from "@/dominio/entrada";
import { ConfirmarAccion } from "./ConfirmarAccion";

type Props = {
  miembros: readonly MiembroDelHogar[];
  /** Quien mira la pagina. */
  yo: { miembroId: string; rol: Rol };
  accionQuitar: AccionFormulario;
  accionHacerDueno: AccionFormulario;
  /** Quienes tienen la verificacion en dos pasos activa (la app configurada). */
  conApp: ReadonlySet<string>;
  /** El dueno le reinicia la app a quien perdio el celular. */
  accionReiniciarApp: AccionFormulario;
};

const PILDORA = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase";

/** La inicial en un circulo: con fondo durazno el dueno, gris el resto. */
function Inicial({ miembro }: { miembro: MiembroDelHogar }) {
  const letra = nombreParaMostrar(miembro).charAt(0).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full text-base font-bold ${
        miembro.rol === "DUENO" ? "bg-acento text-acento-tinta" : "bg-superficie-tenue text-texto-tenue"
      }`}
    >
      {letra}
    </span>
  );
}

/**
 * Las personas del hogar: el dueno primero, despues quienes ya entraron y al
 * final las invitaciones pendientes. El dueno ve, en cada fila, como pasarle
 * el hogar o sacar a esa persona (o cancelar su invitacion).
 */
export function ListaMiembros({ miembros, yo, accionQuitar, accionHacerDueno, conApp, accionReiniciarApp }: Props) {
  const soyDueno = yo.rol === "DUENO";

  return (
    <ul className="divide-y divide-borde">
      {miembros.map((m) => {
        const soyYo = m.id === yo.miembroId;
        const pendiente = m.entroEn === null;
        const nombre = nombreParaMostrar(m);
        return (
          <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5">
            <Inicial miembro={m} />
            <div className="min-w-0 flex-1 basis-48">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
                <span className="truncate">{pendiente ? m.correo : nombre}</span>
                {soyYo && <span className={`${PILDORA} bg-superficie-tenue text-texto-tenue`}>Tú</span>}
                {m.rol === "DUENO" && <span className={`${PILDORA} bg-acento text-acento-tinta`}>Dueño</span>}
                {pendiente && (
                  <span className={`${PILDORA} border border-borde text-texto-tenue`}>Invitación pendiente</span>
                )}
                {!pendiente && !conApp.has(m.id) && (
                  <span className={`${PILDORA} border border-borde text-texto-tenue`}>Sin dos pasos</span>
                )}
              </p>
              <p className="truncate text-xs text-texto-tenue">
                {pendiente ? "Todavía no entra a Luka." : m.correo}
              </p>
            </div>

            {soyDueno && !soyYo && (
              // En celular las acciones bajan a su propia linea, alineadas con el nombre.
              <div className="flex flex-wrap items-center gap-1 max-sm:basis-full max-sm:pl-10">
                {!pendiente && (
                  <ConfirmarAccion
                    etiqueta="Pasarle el hogar"
                    pregunta={`¿Pasarle el hogar a ${primerNombre(m)}?`}
                    confirmar="Sí, pasárselo"
                    accion={accionHacerDueno}
                    id={m.id}
                  >
                    <p>
                      {primerNombre(m)} queda como dueño: invita, saca miembros, cambia el nombre del hogar y elige el
                      día en que empieza el mes.
                    </p>
                    <p>Tú sigues en el hogar como miembro, con todo a la vista igual que hoy.</p>
                  </ConfirmarAccion>
                )}
                {!pendiente && conApp.has(m.id) && (
                  <ConfirmarAccion
                    etiqueta="Reiniciar su app"
                    pregunta={`¿Reiniciar la app de ${primerNombre(m)}?`}
                    confirmar="Sí, reiniciarla"
                    accion={accionReiniciarApp}
                    id={m.id}
                  >
                    <p>
                      Hazlo solo si {primerNombre(m)} perdió el celular y sus códigos de respaldo: su app deja de servir
                      para Luka.
                    </p>
                    <p>En su próximo clic, Luka le pregunta si quiere activar la verificación de nuevo.</p>
                  </ConfirmarAccion>
                )}
                <ConfirmarAccion
                  etiqueta={pendiente ? "Cancelar invitación" : "Sacar del hogar"}
                  pregunta={pendiente ? `¿Cancelar la invitación a ${m.correo}?` : `¿Sacar a ${primerNombre(m)} del hogar?`}
                  confirmar={pendiente ? "Sí, cancelarla" : "Sí, sacar"}
                  accion={accionQuitar}
                  id={m.id}
                  tono="peligro"
                >
                  {pendiente ? (
                    <p>Si entra a Luka con ese correo, ya no quedará en tu hogar.</p>
                  ) : (
                    <>
                      <p>
                        {primerNombre(m)} deja de ver los datos del hogar desde su próximo clic: su sesión se cierra
                        sola.
                      </p>
                      <p>
                        Los gastos que anotó se quedan en el hogar. Para que vuelva, tendrás que invitar su correo de
                        nuevo.
                      </p>
                    </>
                  )}
                </ConfirmarAccion>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
