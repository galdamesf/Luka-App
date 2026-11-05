import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { claveParaConfigurar, ErrorDeDosPasos } from "@/datos/dos-pasos";
import { RUTA_VERIFICAR, agruparClave, enlaceDeLaApp, nombreEnLaApp } from "@/dominio/dos-pasos";
import { FaltaClaveDosPasos } from "@/lib/dos-pasos";
import { RUTA_SESION_TERMINADA, leerAcceso } from "@/lib/hogar-actual";
import { qrEnSvg } from "@/lib/qr";
import { FormularioConfigurar } from "@/componentes/verificacion/FormularioConfigurar";
import { ENLACE_DE_ABAJO, MarcoVerificacion } from "@/componentes/verificacion/MarcoVerificacion";
import { accionAhoraNo, accionConfirmarApp } from "../../acciones/verificacion";

export const metadata: Metadata = {
  title: "Configura tu app · Luka",
};

// La clave de la app se arma en cada visita: esta pagina nunca se guarda.
export const dynamic = "force-dynamic";

/**
 * Configurar la app de autenticacion: al entrar, si eligio activarla; desde
 * «Tu hogar», si entra solo con Google; y al pasarla a otro celular. Como
 * /verificacion, no pide hogarActual() (es la puerta): revisa con
 * leerAcceso() que la persona todavia no tenga la app.
 *
 * El QR se dibuja aqui mismo, en el servidor: la clave no pasa por ningun
 * servicio de afuera.
 */
export default async function ConfigurarApp() {
  const acceso = await leerAcceso();
  if (acceso.estado === "sin-sesion" || acceso.hogar === null) redirect(RUTA_SESION_TERMINADA);
  if (acceso.estado === "verificar") redirect(RUTA_VERIFICAR);
  if (acceso.appConfigurada) redirect("/hogar");
  // Si todavia no elige, esto es parte de entrar; si no, la activa desde «Tu hogar».
  const desde = acceso.estado === "elegir" ? "entrada" : "hogar";

  let clave: string;
  try {
    clave = await claveParaConfigurar(acceso.hogar.miembroId);
  } catch (error) {
    if (error instanceof ErrorDeDosPasos) redirect(RUTA_VERIFICAR);
    if (error instanceof FaltaClaveDosPasos) {
      return (
        <MarcoVerificacion
          titulo="Falta un ajuste en Luka"
          bajada={<p>Todavía no se puede configurar la verificación en dos pasos.</p>}
          desde={desde}
        >
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
      desde={desde}
      pie={
        desde === "entrada" && (
          <form action={accionAhoraNo}>
            <button type="submit" className={`cursor-pointer ${ENLACE_DE_ABAJO}`}>
              Ahora no
            </button>
          </form>
        )
      }
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
        alTerminar={
          desde === "entrada"
            ? { href: "/?bienvenida=1", etiqueta: "Ya los guardé: entrar a Luka" }
            : { href: "/hogar", etiqueta: "Ya los guardé: volver a «Tu hogar»" }
        }
      />
    </MarcoVerificacion>
  );
}
