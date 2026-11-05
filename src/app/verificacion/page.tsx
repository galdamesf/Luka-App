import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DOS_PASOS, RUTA_ELEGIR, nombreEnLaApp } from "@/dominio/dos-pasos";
import { RUTA_SESION_TERMINADA, leerAcceso } from "@/lib/hogar-actual";
import { MarcoVerificacion } from "@/componentes/verificacion/MarcoVerificacion";
import { FormularioEntrar } from "@/componentes/verificacion/FormularioEntrar";
import { accionVerificarCodigo } from "../acciones/verificacion";

export const metadata: Metadata = {
  title: "Código de tu app · Luka",
};

export const dynamic = "force-dynamic";

/**
 * El segundo paso al entrar: el codigo de la app de autenticacion. Esta
 * pagina no puede pedir hogarActual() (ella es la puerta): revisa con
 * leerAcceso() que la persona este justo en este paso, y si no, la manda al
 * que le toca.
 */
export default async function Verificacion() {
  const acceso = await leerAcceso();
  if (acceso.estado === "sin-sesion") redirect(RUTA_SESION_TERMINADA);
  if (acceso.estado === "elegir") redirect(RUTA_ELEGIR);
  if (acceso.estado === "listo") redirect("/");

  return (
    <MarcoVerificacion
      titulo="Escribe el código de tu app"
      bajada={
        <p>
          Abre la app de autenticación de tu celular y escribe los {DOS_PASOS.digitos} dígitos de <strong>{nombreEnLaApp()}</strong>
          {acceso.correo ? (
            <>
              {" "}para <span className="font-semibold [overflow-wrap:anywhere] text-texto">{acceso.correo}</span>
            </>
          ) : null}
          .
        </p>
      }
    >
      <FormularioEntrar accion={accionVerificarCodigo} />
    </MarcoVerificacion>
  );
}
