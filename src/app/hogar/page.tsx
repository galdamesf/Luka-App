import type { Metadata } from "next";
import Link from "next/link";
import { leerHogar } from "@/datos/hogares";
import { appsDelHogar, estadoDeLaApp } from "@/datos/dos-pasos";
import { RUTA_CONFIGURAR } from "@/dominio/dos-pasos";
import { primerNombre, puedeBorrarHogar } from "@/dominio/hogar";
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
import { TusBancos } from "@/componentes/hogar/TusBancos";
import { TusCorreos } from "@/componentes/hogar/TusCorreos";
import { ConectarTusCorreos } from "@/componentes/hogar/ConectarTusCorreos";
import { TuDireccionDeLuka } from "@/componentes/conectar/TuDireccionDeLuka";
import { ResumenDiario } from "@/componentes/hogar/ResumenDiario";
import { leerLosBancosDelHogar } from "@/datos/bancos";
import { leerMisCorreos } from "@/datos/correos-registrados";
import { leerMiBuzon } from "@/datos/buzon";
import { bancosConClave, leerCartolasDelHogar } from "@/datos/cartolas";
import { leerParaConectar } from "@/datos/conectar";
import { PISTA_DE_LA_CLAVE } from "@/dominio/cartolas";
import { pasoParaConectar } from "@/dominio/conectar";
import { configuracionDelBuzon } from "@/lib/buzon";
import { revisionAutomatica } from "@/lib/automatico";
import {
  accionBorrarHogar,
  accionCambiarDeCelular,
  accionDesactivarDosPasos,
  accionHacerDueno,
  accionInvitar,
  accionPedirCodigoDeBorrado,
  accionQuitarMiembro,
  accionReiniciarApp,
  accionRenombrarHogar,
  accionRenovarRespaldos,
  accionSalirDelHogar,
} from "../acciones/hogar";
import { accionAgregarBanco, accionEditarCuentaBancaria, accionQuitarCuentaBancaria } from "../acciones/bancos";
import { accionGuardarClaveDeCartola, accionQuitarClaveDeCartola, accionSubirCartola } from "../acciones/cartolas";
import {
  accionAgregarCorreo,
  accionCambiarMiDireccion,
  accionConfirmarCorreo,
  accionOlvidarCodigoDeGmail,
  accionPedirCodigoDeCorreo,
  accionQuitarCorreo,
  accionRevisarBuzon,
} from "../acciones/correos";
import { accionBuscarCodigoDeGmail, accionCambiarResumenDiario, accionMarcarMisBancos } from "../acciones/conectar";

export const metadata: Metadata = {
  title: "Hogar · Luka",
};

const TARJETA = "rounded-2xl border border-borde bg-superficie p-5 shadow-sm sm:p-6";
const BOTON_SECUNDARIO =
  "inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold transition-colors hover:bg-superficie-tenue";

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
  const configDelBuzon = configuracionDelBuzon();
  const [hogar, miApp, conApp, losBancos, misCorreos, miBuzon, misClaves, cartolasLeidas, paraConectar] = await Promise.all([
    leerHogar(hogarId),
    estadoDeLaApp(miembroId),
    appsDelHogar(hogarId),
    leerLosBancosDelHogar(hogarId, { hoy: hoyISO() }),
    leerMisCorreos(hogarId, miembroId),
    configDelBuzon === null ? null : leerMiBuzon(hogarId, miembroId, { base: configDelBuzon.direccion }),
    bancosConClave(miembroId),
    leerCartolasDelHogar(hogarId),
    leerParaConectar(hogarId, miembroId),
  ]);
  const soyDueno = rol === "DUENO";
  const entraron = hogar.miembros.filter((m) => m.entroEn !== null).length;
  const puedeBorrar = puedeBorrarHogar({ miembroId, rol }, hogar.miembros) === null;
  const miCorreo = hogar.miembros.find((m) => m.id === miembroId)?.correo ?? "";
  const hayCorreo = configuracionDeCorreo() !== null;
  // De quien es cada cuenta, solo si en el hogar hay mas de una persona.
  const nombres: Record<string, string> =
    entraron > 1 ? Object.fromEntries(hogar.miembros.map((m) => [m.id, m.id === miembroId ? "tuya" : `de ${primerNombre(m)}`])) : {};
  // Para conectar su correo: los que ya confirmo, sus bancos (los marcados y
  // los de sus cuentas) y en que paso va.
  const correosConfirmados = misCorreos.filter((c) => c.confirmado).map((c) => ({ direccion: c.direccion, proveedor: c.proveedor }));
  const misBancos = [
    ...paraConectar.bancos,
    ...losBancos.bancos.filter((b) => b.cuentas.some((c) => c.miembroId === miembroId)).map((b) => b.banco),
  ];
  const pasoDeConectar = pasoParaConectar(
    { ...paraConectar, codigoDeGmail: miBuzon?.codigoDeGmail?.codigo ?? miBuzon?.codigoDeGmail?.enlace ?? null },
    correosConfirmados[0]?.proveedor ?? "GMAIL",
  );

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
          Todos los del hogar ven y anotan lo mismo: los gastos, las cuentas, los sueldos y los presupuestos. Cada
          uno anota su propio sueldo, y el balance usa la suma.
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

      <section id="correos" aria-labelledby="titulo-correos" className={`mt-6 scroll-mt-24 ${TARJETA}`}>
        <h2 id="titulo-correos" className="text-lg font-bold tracking-tight">
          Reenvíale a Luka los avisos de tu banco
        </h2>
        <p className="mt-1 mb-4 max-w-[60ch] text-sm leading-relaxed text-texto-tenue">
          Cuando te llegue un aviso de compra o transferencia, reenvíalo tal cual a tu dirección de Luka. Aparece en
          Inicio, en «Por revisar», y nada cuenta hasta que lo confirmas. Luka nunca entra a tu correo ni te pide su
          contraseña.
        </p>
        <div className="space-y-6">
          {miBuzon === null ? (
            <p className="rounded-lg border border-borde bg-superficie-tenue px-3 py-2 text-sm text-texto-tenue">
              El buzón de Luka todavía no está configurado: falta el correo de Luka en el .env (CORREO_SMTP_USUARIO y
              CORREO_SMTP_CLAVE).
            </p>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-bold tracking-tight">Tu dirección de Luka</h3>
              <TuDireccionDeLuka direccion={miBuzon.direccion} />
              <p className="text-xs text-texto-tenue">Es solo tuya: no la compartas.</p>
            </div>
          )}
          <TusCorreos
            correos={misCorreos}
            buzon={miBuzon}
            puedeMandarCodigos={hayCorreo}
            accionAgregar={accionAgregarCorreo}
            accionPedirCodigo={accionPedirCodigoDeCorreo}
            accionConfirmar={accionConfirmarCorreo}
            accionQuitar={accionQuitarCorreo}
            accionRevisar={accionRevisarBuzon}
            accionCambiarDireccion={accionCambiarMiDireccion}
          />
          {/* La opcion de mas: que lleguen solos, configurando el correo una vez. */}
          {miBuzon !== null && correosConfirmados.length > 0 && (
            <ConectarTusCorreos
              paso={pasoDeConectar}
              correos={correosConfirmados}
              direccionDeLuka={miBuzon.direccion}
              misBancos={misBancos}
              remitentes={losBancos.remitentes}
              permisoDeGmail={
                miBuzon.codigoDeGmail
                  ? { codigo: miBuzon.codigoDeGmail.codigo, enlace: miBuzon.codigoDeGmail.enlace, de: miBuzon.codigoDeGmail.de, aceptado: false }
                  : miBuzon.reenvioAceptado
                    ? { codigo: null, enlace: null, de: miBuzon.reenvioAceptado.de, aceptado: true }
                    : null
              }
              revisaSolo={revisionAutomatica()}
              accionMarcarBancos={accionMarcarMisBancos}
              accionBuscarCodigo={accionBuscarCodigoDeGmail}
              accionOlvidarCodigoDeGmail={accionOlvidarCodigoDeGmail}
            />
          )}
          <ResumenDiario activo={paraConectar.resumenDiario} puedeMandar={hayCorreo} correo={miCorreo} accion={accionCambiarResumenDiario} />
        </div>
      </section>

      <section id="bancos" aria-labelledby="titulo-bancos" className={`mt-6 scroll-mt-24 ${TARJETA}`}>
        <h2 id="titulo-bancos" className="text-lg font-bold tracking-tight">
          Tus bancos y tarjetas
        </h2>
        <p className="mt-1 mb-4 max-w-[60ch] text-sm leading-relaxed text-texto-tenue">
          Luka reconoce tus cuentas y tarjetas sola, con los avisos que van llegando, y de cada una guarda solo el banco
          y los últimos 4 dígitos: así sabe de cuál es cada comprobante y reconoce los traspasos entre las cuentas del
          hogar. Todos los del hogar las ven.
        </p>
        <TusBancos
          bancos={losBancos.bancos}
          nombres={nombres}
          accionAgregar={accionAgregarBanco}
          accionEditar={accionEditarCuentaBancaria}
          accionQuitar={accionQuitarCuentaBancaria}
          cartolas={{
            pistas: { ...PISTA_DE_LA_CLAVE },
            misClaves,
            leidas: cartolasLeidas,
            accionGuardarClave: accionGuardarClaveDeCartola,
            accionQuitarClave: accionQuitarClaveDeCartola,
            accionSubir: accionSubirCartola,
          }}
        />
      </section>

      <section aria-labelledby="titulo-dos-pasos" className={`mt-6 ${TARJETA}`}>
        <h2 id="titulo-dos-pasos" className="text-lg font-bold tracking-tight">
          Verificación en dos pasos
        </h2>
        {miApp.configuradaEn ? (
          <>
            <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-texto-tenue">
              Está activada: para entrar, Luka te pide Google y un código de la app de tu celular (desde el{" "}
              {fechaLarga(hoyISO("America/Santiago", miApp.configuradaEn))}).
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
                conCodigo
                claseBoton={BOTON_SECUNDARIO}
              >
                <p>La app de ahora deja de servir para Luka, y también tus códigos de respaldo.</p>
                <p>Enseguida te mostramos un código QR nuevo para escanearlo con el otro celular.</p>
              </ConfirmarAccion>
              <ConfirmarAccion
                etiqueta="Desactivar"
                pregunta="¿Desactivar la verificación en dos pasos?"
                confirmar="Sí, desactivarla"
                accion={accionDesactivarDosPasos}
                conCodigo
                claseBoton={BOTON_SECUNDARIO}
              >
                <p>Desde ahora entras solo con Google. Tu app y tus códigos de respaldo dejan de servir para Luka.</p>
                <p>Puedes activarla de nuevo cuando quieras.</p>
              </ConfirmarAccion>
            </div>
          </>
        ) : (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[48ch] text-sm leading-relaxed text-texto-tenue">
              Está desactivada: entras solo con Google. Si la activas, Luka además te pide un código de la app de tu
              celular, como Google Authenticator. Así, aunque alguien entre a tu cuenta de Google, no ve tu hogar sin tu
              celular.
            </p>
            <Link href={RUTA_CONFIGURAR} className="boton-luka">
              Activar
            </Link>
          </div>
        )}
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
