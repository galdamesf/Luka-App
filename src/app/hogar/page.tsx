import type { Metadata } from "next";
import { leerHogar } from "@/datos/hogares";
import { appsDelHogar, estadoDeLaApp } from "@/datos/dos-pasos";
import { puedeBorrarHogar } from "@/dominio/hogar";
import { configuracionDeCorreo } from "@/lib/correo";
import { hogarActual } from "@/lib/hogar-actual";
import { hoyISO } from "@/lib/fecha";
import { fechaLarga } from "@/componentes/formato";
import { NombreDelHogar } from "@/componentes/hogar/NombreDelHogar";
import { ListaMiembros } from "@/componentes/hogar/ListaMiembros";
import { InvitarMiembro } from "@/componentes/hogar/InvitarMiembro";
import { ConfirmarAccion } from "@/componentes/hogar/ConfirmarAccion";
import { BorrarHogar } from "@/componentes/hogar/BorrarHogar";
import { RenovarRespaldos } from "@/componentes/hogar/RenovarRespaldos";
import {
  accionBorrarHogar,
  accionCambiarDeCelular,
  accionHacerDueno,
  accionInvitar,
  accionPedirCodigoDeBorrado,
  accionQuitarMiembro,
  accionReiniciarApp,
  accionRenombrarHogar,
  accionRenovarRespaldos,
  accionSalirDelHogar,
} from "../acciones/hogar";

export const metadata: Metadata = {
  title: "Hogar · Luka",
};

const TARJETA = "rounded-2xl border border-borde bg-superficie p-5 shadow-sm sm:p-6";

/**
 * El hogar: quienes lo comparten, y lo que el dueno puede hacer con eso
 * (invitar, sacar, pasar el hogar, cambiarle el nombre). Cualquiera puede
 * salir; el dueno, despues de pasarle el hogar a otro. El dueno que esta
 * solo, en vez de salir, puede borrar el hogar, con un codigo que le llega
 * al correo.
 */
export default async function PaginaHogar() {
  // Cada visita revisa contra la base que la persona siga en el hogar con
  // que entro (si no, la sesion se cierra aqui mismo), y de ese hogar, y de
  // ningun otro, se lee todo lo que sigue.
  const { hogarId, miembroId, rol } = await hogarActual();
  const [hogar, miApp, conApp] = await Promise.all([leerHogar(hogarId), estadoDeLaApp(miembroId), appsDelHogar(hogarId)]);
  const soyDueno = rol === "DUENO";
  const entraron = hogar.miembros.filter((m) => m.entroEn !== null).length;
  const puedeBorrar = puedeBorrarHogar({ miembroId, rol }, hogar.miembros) === null;
  const miCorreo = hogar.miembros.find((m) => m.id === miembroId)?.correo ?? "";
  const hayCorreo = configuracionDeCorreo() !== null;

  return (
    <main
      className="mx-auto w-full max-w-3xl pt-6 pb-10 sm:pt-10"
      style={{
        paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <header className="space-y-3">
        <p className="cifra text-xs uppercase tracking-[0.08em] text-texto-tenue">Tu hogar</p>
        <NombreDelHogar nombre={hogar.nombre} puedeCambiar={soyDueno} accion={accionRenombrarHogar} />
        <p className="max-w-[60ch] text-base leading-relaxed text-texto-tenue">
          Todos los del hogar ven y anotan lo mismo: los gastos, las cuentas, el sueldo y los presupuestos.
          {entraron > 1 && " Cada gasto dice quién lo anotó."}
        </p>
      </header>

      <section aria-labelledby="titulo-miembros" className={`mt-8 ${TARJETA}`}>
        <h2 id="titulo-miembros" className="text-lg font-bold tracking-tight">
          Quiénes están
        </h2>
        <p className="mt-1 text-sm text-texto-tenue">
          {soyDueno
            ? "Eres el dueño: invitas, sacas miembros, cambias el nombre y eliges el día en que empieza el mes."
            : "El dueño invita, saca miembros, cambia el nombre y elige el día en que empieza el mes."}
        </p>
        <div className="mt-3">
          <ListaMiembros
            miembros={hogar.miembros}
            yo={{ miembroId, rol }}
            accionQuitar={accionQuitarMiembro}
            accionHacerDueno={accionHacerDueno}
            conApp={conApp}
            accionReiniciarApp={accionReiniciarApp}
          />
        </div>
      </section>

      {soyDueno && (
        <section aria-labelledby="titulo-invitar" className={`mt-6 ${TARJETA}`}>
          <h2 id="titulo-invitar" className="text-lg font-bold tracking-tight">
            Invitar a alguien
          </h2>
          <p className="mt-1 mb-4 text-sm leading-relaxed text-texto-tenue">
            No se manda ningún correo: la persona entra a Luka con esa cuenta de Google y queda en tu hogar, con todo a
            la vista. Cada persona puede estar en un solo hogar.
          </p>
          <InvitarMiembro accion={accionInvitar} />
        </section>
      )}

      <section aria-labelledby="titulo-dos-pasos" className={`mt-6 ${TARJETA}`}>
        <h2 id="titulo-dos-pasos" className="text-lg font-bold tracking-tight">
          Verificación en dos pasos
        </h2>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-texto-tenue">
          Para entrar, Luka te pide Google y un código de la app de tu celular
          {miApp.configuradaEn ? ` (activa desde el ${fechaLarga(hoyISO("America/Santiago", miApp.configuradaEn))})` : ""}.
        </p>
        <p className={`mt-3 text-sm ${miApp.respaldosQueQuedan <= 3 ? "font-semibold text-peligro" : "text-texto-tenue"}`}>
          {miApp.respaldosQueQuedan === 0
            ? "No te quedan códigos de respaldo: genera nuevos por si pierdes el celular."
            : `Te ${miApp.respaldosQueQuedan === 1 ? "queda 1 código" : `quedan ${miApp.respaldosQueQuedan} códigos`} de respaldo sin usar${miApp.respaldosQueQuedan <= 3 ? ": conviene generar nuevos." : "."}`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <RenovarRespaldos accion={accionRenovarRespaldos} correo={miCorreo} />
          <ConfirmarAccion
            etiqueta="Pasar la app a otro celular"
            pregunta="¿Pasar la app a otro celular?"
            confirmar="Sí, configurar otra"
            accion={accionCambiarDeCelular}
            claseBoton="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold transition-colors hover:bg-superficie-tenue"
          >
            <p>La app de ahora deja de servir para Luka, y también tus códigos de respaldo.</p>
            <p>Enseguida te mostramos un código QR nuevo para escanearlo con el otro celular.</p>
          </ConfirmarAccion>
        </div>
      </section>

      <section aria-labelledby="titulo-salir" className={`mt-6 ${TARJETA}`}>
        <h2 id="titulo-salir" className="text-lg font-bold tracking-tight">
          {puedeBorrar ? "Borrar este hogar" : "Salir del hogar"}
        </h2>
        {puedeBorrar ? (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[48ch] text-sm leading-relaxed text-texto-tenue">
              Eres el único que ha entrado a este hogar. Si quieres irte, por ejemplo porque te invitaron a otro, puedes
              borrarlo con todo lo que tiene.{" "}
              {hayCorreo
                ? "Para confirmar, te mandamos un código a tu correo."
                : "Para eso, Luka tiene que poder mandarte un código por correo, y todavía no está configurado."}
            </p>
            {hayCorreo && (
              <BorrarHogar
                nombreDelHogar={hogar.nombre}
                correo={miCorreo}
                accionPedirCodigo={accionPedirCodigoDeBorrado}
                accionBorrar={accionBorrarHogar}
              />
            )}
          </div>
        ) : soyDueno ? (
          <p className="mt-1 text-sm leading-relaxed text-texto-tenue">
            Como dueño, antes de salir tienes que pasarle el hogar a otro miembro que ya haya entrado: un hogar no
            puede quedar sin dueño.
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[48ch] text-sm leading-relaxed text-texto-tenue">
              Dejas de ver los datos del hogar y tu sesión se cierra. Lo que anotaste se queda en el hogar.
            </p>
            <ConfirmarAccion
              etiqueta="Salir del hogar"
              pregunta="¿Salir del hogar?"
              confirmar="Sí, salir"
              accion={accionSalirDelHogar}
              tono="peligro"
              claseBoton="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-peligro/50 px-4 text-sm font-semibold text-peligro transition-colors hover:bg-peligro/10"
            >
              <p>Dejas de ver los datos del hogar y tu sesión se cierra.</p>
              <p>Para volver, el dueño tendrá que invitarte de nuevo.</p>
            </ConfirmarAccion>
          </div>
        )}
      </section>
    </main>
  );
}
