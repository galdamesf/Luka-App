import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { claveParaConfigurar, ErrorDeDosPasos } from "@/datos/dos-pasos";
import { RUTA_VERIFICAR, agruparClave, enlaceDeLaApp, nombreEnLaApp } from "@/dominio/dos-pasos";
import { FaltaClaveDosPasos } from "@/lib/dos-pasos";
import { RUTA_SESION_TERMINADA, leerAcceso } from "@/lib/hogar-actual";
import { qrEnSvg } from "@/lib/qr";
import { MarcoVerificacion } from "@/componentes/verificacion/MarcoVerificacion";
import { FormularioConfigurar } from "@/componentes/verificacion/FormularioConfigurar";
import { accionConfirmarApp } from "../../acciones/verificacion";

export const metadata: Metadata = {
  title: "Configura tu app · Luka",
};

// La clave de la app se arma en cada visita: esta pagina nunca se guarda.
export const dynamic = "force-dynamic";

/**
 * Configurar la app de autenticacion: la primera vez que se entra, y al
 * pasarla a otro celular. Como /verificacion, no pide hogarActual() (es la
 * puerta): revisa con leerAcceso() que a la persona le toque configurar.
 *
 * El QR se dibuja aqui mismo, en el servidor: la clave no pasa por ningun
 * servicio de afuera.
 */
export default async function ConfigurarApp() {
  const acceso = await leerAcceso();
  if (acceso.estado === "sin-sesion" || acceso.hogar === null) redirect(RUTA_SESION_TERMINADA);
  if (acceso.estado === "verificar") redirect(RUTA_VERIFICAR);
  if (acceso.estado === "listo") redirect("/");

  let clave: string;
  try {
    clave = await claveParaConfigurar(acceso.hogar.miembroId);
  } catch (error) {
    if (error instanceof ErrorDeDosPasos) redirect(RUTA_VERIFICAR);
    if (error instanceof FaltaClaveDosPasos) {
      return (
        <MarcoVerificacion titulo="Falta un ajuste en Luka" bajada={<p>Todavía no se puede configurar la verificación en dos pasos.</p>}>
          <p role="alert" className="rounded-xl border border-peligro/40 bg-peligro/10 px-3 py-2.5 text-sm text-pretty">
            Falta la variable CLAVE_DOS_PASOS. Avísale a quien administra Luka.
          </p>
        </MarcoVerificacion>
      );
    }
    throw error;
  }

  const correo = acceso.correo ?? "";
  const enlace = enlaceDeLaApp({ emisor: nombreEnLaApp(), correo, clave });

  return (
    <MarcoVerificacion
      ancho="ancho"
      titulo="Protege tu cuenta con tu celular"
      bajada={
        <p>
          Desde ahora, para entrar a Luka vas a usar Google y un código de 6 dígitos de una app de tu celular. Así, aunque
          alguien entre a tu cuenta de Google, no puede ver tu hogar sin tu celular.
        </p>
      }
    >
      <FormularioConfigurar
        accion={accionConfirmarApp}
        qrSvg={qrEnSvg(enlace)}
        enlace={enlace}
        claveAgrupada={agruparClave(clave)}
        correo={correo}
      />
    </MarcoVerificacion>
  );
}
