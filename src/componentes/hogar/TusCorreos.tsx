"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { ESTADO_INICIAL, type AccionFormulario, type EstadoFormulario } from "@/dominio/formulario";
import { PASOS, REENVIO_A_MANO, type ProveedorDeCorreo } from "@/dominio/correos-registrados";
import { TEXTO_DE_LA_LLEGADA, pideAlgo, type ResultadoDeLlegada } from "@/dominio/buzon";
import { BotonCopiar } from "./BotonCopiar";
import { ConfirmarAccion } from "./ConfirmarAccion";

export type CorreoParaMostrar = {
  id: string | null;
  direccion: string;
  proveedor: ProveedorDeCorreo;
  confirmado: boolean;
  principal: boolean;
  esperandoCodigo: boolean;
};

export type BuzonParaMostrar = {
  direccion: string;
  codigoDeGmail: { codigo: string; de: string | null; llegoEn: Date } | null;
  llegadas: { id: string; llegoEn: Date; resultado: ResultadoDeLlegada; remitente: string; detalle: string | null }[];
};

type Props = {
  correos: CorreoParaMostrar[];
  /** Vacio si el buzon de Luka no esta configurado en el .env. */
  buzon: BuzonParaMostrar | null;
  /** Los remitentes de los bancos y tiendas para la regla de reenvio. */
  remitentes: string[];
  /** Si Luka puede mandar el codigo para confirmar un correo. */
  puedeMandarCodigos: boolean;
  accionAgregar: AccionFormulario;
  accionPedirCodigo: AccionFormulario;
  accionConfirmar: AccionFormulario;
  accionQuitar: AccionFormulario;
  accionRevisar: AccionFormulario;
  accionCambiarDireccion: AccionFormulario;
  accionOlvidarCodigoDeGmail: AccionFormulario;
};

const CAMPO =
  "min-h-11 rounded-lg border border-borde bg-superficie-tenue px-3 text-base text-texto transition-colors duration-150 hover:border-texto-tenue sm:text-sm";
const SECUNDARIO =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-borde px-4 text-sm font-semibold text-texto transition-colors duration-150 hover:bg-superficie-tenue disabled:cursor-not-allowed disabled:opacity-60";
const DE_TEXTO =
  "inline-flex min-h-9 cursor-pointer items-center rounded-lg px-2.5 text-[13px] font-semibold text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto disabled:cursor-not-allowed disabled:opacity-60";
const ERROR = "rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm";
const SUBTITULO = "text-sm font-bold tracking-tight";

const HORA = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Santiago" });

function Mensaje({ estado }: { estado: EstadoFormulario }) {
  if (estado.mensaje === null) return null;
  return estado.ok ? (
    <p role="status" className="text-sm font-semibold text-exito-fuerte">{estado.mensaje}</p>
  ) : (
    <p role="alert" className={ERROR}>{estado.mensaje}</p>
  );
}

/**
 * «Tus correos y tu buzón»: la direccion de Luka de la persona, los correos
 * desde donde reenvia (cada uno confirmado con un codigo), los pasos para su
 * proveedor y lo ultimo que llego a su buzon.
 */
export function TusCorreos(props: Props) {
  const { correos, buzon, remitentes } = props;
  const proveedores = [...new Set(correos.map((c) => c.proveedor))];
  const [proveedor, setProveedor] = useState<ProveedorDeCorreo>(proveedores[0] ?? "GMAIL");
  const guia = PASOS[proveedor];

  return (
    <div className="space-y-6">
      {buzon === null ? (
        <p className="rounded-lg border border-borde bg-superficie-tenue px-3 py-2 text-sm text-texto-tenue">
          El buzón de Luka todavía no está configurado: falta el correo de Luka en el .env (CORREO_SMTP_USUARIO y
          CORREO_SMTP_CLAVE). Mientras, puedes dejar listos tus correos y tus bancos.
        </p>
      ) : (
        <div className="space-y-2">
          <h3 className={SUBTITULO}>Tu dirección de Luka</h3>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-borde bg-superficie-tenue p-2 pl-3">
            <code className="min-w-0 flex-1 break-all font-mono text-sm font-semibold">{buzon.direccion}</code>
            <BotonCopiar texto={buzon.direccion} descripcion="tu dirección de Luka" />
          </div>
          <p className="text-sm text-texto-tenue">
            Lo que le reenvíes desde uno de tus correos confirmados queda en «Por revisar». Es solo tuya: no la compartas.
          </p>
          {buzon.codigoDeGmail && <CodigoDeGmail codigo={buzon.codigoDeGmail} accionOlvidar={props.accionOlvidarCodigoDeGmail} />}
        </div>
      )}

      <div className="space-y-3">
        <h3 className={SUBTITULO}>Tus correos</h3>
        <ul className="space-y-2">
          {correos.map((correo) => (
            <FilaCorreo key={correo.id ?? correo.direccion} correo={correo} {...props} />
          ))}
        </ul>
        {props.puedeMandarCodigos ? (
          <AgregarCorreo accion={props.accionAgregar} />
        ) : (
          <p className="text-sm text-texto-tenue">
            Para conectar otro correo, Luka tiene que poder mandarte un código, y todavía no está configurado.
          </p>
        )}
        <p className="text-xs text-texto-tenue">Luka nunca te pide la contraseña de tu correo: solo lee lo que tú le reenvías.</p>
      </div>

      <div className="space-y-3">
        <h3 className={SUBTITULO}>Cómo reenviar solo los comprobantes</h3>
        {proveedores.length > 1 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tu correo">
            {proveedores.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={p === proveedor}
                onClick={() => setProveedor(p)}
                className={`min-h-9 cursor-pointer rounded-full border px-3 text-[13px] font-bold transition-colors ${
                  p === proveedor ? "border-transparent bg-acento text-acento-tinta" : "border-borde hover:bg-superficie-tenue"
                }`}
              >
                {PASOS[p].nombre}
              </button>
            ))}
          </div>
        )}
        <p className="text-sm font-semibold">
          En {proveedor === "OTRO" ? "tu correo" : guia.nombre}:{" "}
          {guia.reenviaSolo
            ? `${proveedor === "GMAIL" ? "un filtro" : "una regla"} que le pasa a Luka solo los avisos de tus bancos y tiendas`
            : "sin reenvío automático gratis"}
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {guia.pasos.map((paso) => (
            <li key={paso}>{paso}</li>
          ))}
        </ol>
        {guia.nota && <p className="text-sm text-texto-tenue">{guia.nota}</p>}
        {guia.reenviaSolo && remitentes.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-texto-tenue">
              {proveedor === "GMAIL"
                ? "Esto va en el campo «De» del filtro. El «OR» es para que Gmail tome cualquiera de estas direcciones."
                : "Las direcciones desde donde te escriben tus bancos y tiendas"}
            </p>
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-borde bg-superficie-tenue p-2 pl-3">
              <code className="min-w-0 flex-1 break-all font-mono text-[13px]">
                {proveedor === "GMAIL" ? remitentes.join(" OR ") : remitentes.join(", ")}
              </code>
              <BotonCopiar
                texto={proveedor === "GMAIL" ? remitentes.join(" OR ") : remitentes.join("\n")}
                descripcion="las direcciones de tus bancos y tiendas"
              />
            </div>
            <p className="mt-1 text-xs text-texto-tenue">Luka arma esta lista con tus bancos y la completa con lo que va llegando.</p>
          </div>
        )}
        <p className="text-sm text-texto-tenue">{REENVIO_A_MANO}</p>
      </div>

      {buzon !== null && (
        <LoUltimo buzon={buzon} accionRevisar={props.accionRevisar} accionCambiarDireccion={props.accionCambiarDireccion} />
      )}
    </div>
  );
}

function CodigoDeGmail({
  codigo,
  accionOlvidar,
}: {
  codigo: NonNullable<BuzonParaMostrar["codigoDeGmail"]>;
  accionOlvidar: AccionFormulario;
}) {
  const [, olvidar, olvidando] = useActionState(accionOlvidar, ESTADO_INICIAL);
  return (
    <div role="status" className="space-y-2 rounded-lg border border-acento-canto/60 bg-durazno px-3 py-3 text-sm text-durazno-texto">
      <p className="font-semibold">
        Gmail pidió confirmar el reenvío{codigo.de ? ` desde ${codigo.de}` : ""}. Escribe este código en Gmail, donde agregaste tu
        dirección de Luka:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="cifra rounded-md bg-superficie px-3 py-1.5 text-lg font-bold tracking-[0.2em] text-texto">{codigo.codigo}</code>
        <BotonCopiar texto={codigo.codigo} descripcion="el código de Gmail" />
        <form action={olvidar}>
          <button type="submit" disabled={olvidando} className={DE_TEXTO}>
            Ya lo puse
          </button>
        </form>
      </div>
    </div>
  );
}

function FilaCorreo({
  correo,
  accionPedirCodigo,
  accionConfirmar,
  accionQuitar,
  puedeMandarCodigos,
}: { correo: CorreoParaMostrar } & Props) {
  const [confirmado, confirmar, confirmando] = useActionState(accionConfirmar, ESTADO_INICIAL);
  const [pedido, pedir, pidiendo] = useActionState(accionPedirCodigo, ESTADO_INICIAL);
  const [ultimo, setUltimo] = useState<"confirmar" | "pedir" | null>(null);
  const idCodigo = useId();

  useEffect(() => {
    if (confirmado !== ESTADO_INICIAL) setUltimo("confirmar");
  }, [confirmado]);
  useEffect(() => {
    if (pedido !== ESTADO_INICIAL) setUltimo("pedir");
  }, [pedido]);

  return (
    <li className="space-y-2 rounded-lg border border-borde px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {/* En el celular el correo va entero en su linea y lo demas abajo. */}
        <span className="flex-[1_1_12rem] break-all text-sm font-semibold">{correo.direccion}</span>
        <span className="text-xs font-bold text-texto-tenue">{PASOS[correo.proveedor].nombre}</span>
        {correo.confirmado ? (
          <span className="text-xs font-bold text-exito-fuerte">{correo.principal ? "con el que entras" : "confirmado"}</span>
        ) : (
          <span className="text-xs font-bold text-alerta">falta el código</span>
        )}
        {correo.id !== null && (
          <ConfirmarAccion
            etiqueta="Quitar"
            pregunta={`¿Quitar ${correo.direccion}?`}
            confirmar="Sí, quitarlo"
            accion={accionQuitar}
            id={correo.id}
            claseBoton={DE_TEXTO}
          >
            <p>Lo que reenvíe desde ahora no se va a leer. Lo que ya llegó se queda.</p>
          </ConfirmarAccion>
        )}
      </div>

      {correo.id !== null && !correo.confirmado && (
        <div className="space-y-2">
          {correo.esperandoCodigo ? (
            <form action={confirmar} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={correo.id} />
              <div>
                <label htmlFor={idCodigo} className="mb-1 block text-xs font-semibold text-texto-tenue">
                  El código que te llegó a ese correo
                </label>
                <input
                  id={idCodigo}
                  name="codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={9}
                  placeholder="123456"
                  required
                  className={`cifra w-36 tracking-[0.2em] ${CAMPO}`}
                />
              </div>
              <button type="submit" disabled={confirmando} className="boton-luka cursor-pointer">
                {confirmando ? "Un momento…" : "Confirmar"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-texto-tenue">El código venció o no se pudo mandar: pide otro.</p>
          )}
          {puedeMandarCodigos && (
            <form action={pedir}>
              <input type="hidden" name="id" value={correo.id} />
              <button type="submit" disabled={pidiendo} className={DE_TEXTO}>
                {pidiendo ? "Enviando…" : correo.esperandoCodigo ? "¿No te llegó? Enviar otro código" : "Enviar un código"}
              </button>
            </form>
          )}
          {ultimo === "confirmar" && <Mensaje estado={confirmado} />}
          {ultimo === "pedir" && <Mensaje estado={pedido} />}
        </div>
      )}
    </li>
  );
}

function AgregarCorreo({ accion }: { accion: AccionFormulario }) {
  const [estado, agregar, agregando] = useActionState(accion, ESTADO_INICIAL);
  const formulario = useRef<HTMLFormElement>(null);
  const id = useId();

  useEffect(() => {
    if (estado.ok) formulario.current?.reset();
  }, [estado]);

  return (
    <form ref={formulario} action={agregar} className="space-y-2">
      <label htmlFor={id} className="block text-sm text-texto-tenue">
        Agrega otro correo donde te lleguen comprobantes: Hotmail, iCloud, el del trabajo…
      </label>
      <div className="flex flex-wrap gap-2">
        <input id={id} name="correo" type="email" required maxLength={254} placeholder="nombre@hotmail.com" className={`min-w-0 flex-1 ${CAMPO}`} />
        <button type="submit" disabled={agregando} className={SECUNDARIO}>
          {agregando ? "Enviando código…" : "Agregar"}
        </button>
      </div>
      <Mensaje estado={estado} />
    </form>
  );
}

function LoUltimo({
  buzon,
  accionRevisar,
  accionCambiarDireccion,
}: {
  buzon: BuzonParaMostrar;
  accionRevisar: AccionFormulario;
  accionCambiarDireccion: AccionFormulario;
}) {
  const [revisado, revisar, revisando] = useActionState(accionRevisar, ESTADO_INICIAL);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={SUBTITULO}>Lo último que llegó a tu buzón</h3>
        <form action={revisar}>
          <button type="submit" disabled={revisando} className={SECUNDARIO}>
            {revisando ? "Revisando…" : "Revisar ahora"}
          </button>
        </form>
      </div>
      <Mensaje estado={revisado} />
      {buzon.llegadas.length === 0 ? (
        <p className="text-sm text-texto-tenue">
          Todavía no llega nada. Para probar, reenvía un comprobante antiguo a tu dirección de Luka y presiona «Revisar ahora».
        </p>
      ) : (
        <ul className="divide-y divide-borde rounded-lg border border-borde">
          {buzon.llegadas.map((llegada) => (
            <li key={llegada.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
              <span className="cifra text-xs text-texto-tenue">{HORA.format(llegada.llegoEn)}</span>
              <span className="min-w-0 flex-1">
                <span className="break-all font-semibold">{llegada.detalle && !pideAlgo(llegada.resultado) && llegada.resultado !== "NO_ES_COMPROBANTE" ? llegada.detalle : llegada.remitente}</span>{" "}
                <span className={pideAlgo(llegada.resultado) ? "text-alerta" : "text-texto-tenue"}>{TEXTO_DE_LA_LLEGADA[llegada.resultado]}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <ConfirmarAccion
        etiqueta="Cambiar mi dirección de Luka"
        pregunta="¿Cambiar tu dirección de Luka?"
        confirmar="Sí, cambiarla"
        accion={accionCambiarDireccion}
        claseBoton={DE_TEXTO}
      >
        <p>La dirección de ahora deja de servir: lo que llegue ahí se borra sin leer.</p>
        <p>Sirve si alguien más la conoce. Después tienes que cambiarla en el filtro o la regla de tu correo.</p>
      </ConfirmarAccion>
    </div>
  );
}
