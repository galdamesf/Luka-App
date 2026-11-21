"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import {
  BANCOS,
  NOMBRE_DEL_TIPO,
  TIPOS_DE_CUENTA,
  limpiarUltimos4,
  nombreDeLaCuenta,
  type BancoDelHogar,
  type CuentaBancariaDelHogar,
  type TipoCuentaBancaria,
} from "@/dominio/bancos";
import { fechaCorta } from "@/componentes/formato";
import { BotonCopiar } from "./BotonCopiar";
import { ConfirmarAccion } from "./ConfirmarAccion";

type Props = {
  bancos: BancoDelHogar[];
  /** De quien es cada cuenta, por persona: «tuya», «de Ana». Vacio si en el hogar hay una sola persona. */
  nombres: Record<string, string>;
  /** Los remitentes que Luka ya conoce de cada banco del catalogo, por su id. */
  remitentesDelCatalogo: Record<string, string[]>;
  accionAgregar: AccionFormulario;
  accionEditar: AccionFormulario;
  accionQuitar: AccionFormulario;
};

const CAMPO =
  "min-h-11 w-full rounded-lg border border-borde bg-superficie-tenue px-3 text-base text-texto transition-colors duration-150 hover:border-texto-tenue sm:text-sm";
const SECUNDARIO =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-borde px-4 text-sm font-semibold text-texto transition-colors duration-150 hover:bg-superficie-tenue disabled:cursor-not-allowed disabled:opacity-60";
const DE_TEXTO =
  "inline-flex min-h-9 cursor-pointer items-center rounded-lg px-2.5 text-[13px] font-semibold text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto";
const ERROR = "rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm";

type CuentaEnArmado = { tipo: TipoCuentaBancaria; apodo: string; ultimos4: string };

/**
 * «Tus bancos y tarjetas»: los bancos del hogar con sus cuentas (solo los
 * ultimos 4 digitos), lo ultimo que llego de cada uno y sus remitentes, y el
 * paso a paso para agregar otro: el banco, sus cuentas, y que el banco le
 * avise a Luka por correo.
 */
export function TusBancos({ bancos, nombres, remitentesDelCatalogo, accionAgregar, accionEditar, accionQuitar }: Props) {
  const [agregando, setAgregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {bancos.length === 0 && !agregando && (
        <p className="text-sm text-texto-tenue">Todavía no agregas ningún banco. Con tus cuentas, Luka sabe de cuál es cada comprobante.</p>
      )}

      {bancos.length > 0 && (
        <ul className="divide-y divide-borde rounded-xl border border-borde">
          {bancos.map((banco) => (
            <FilaBanco key={banco.banco} banco={banco} nombres={nombres} accionEditar={accionEditar} accionQuitar={accionQuitar} />
          ))}
        </ul>
      )}

      {agregando ? (
        <AgregarBanco
          accion={accionAgregar}
          remitentesDelCatalogo={remitentesDelCatalogo}
          alTerminar={(mensaje) => {
            setAgregando(false);
            setAviso(mensaje);
          }}
          alCancelar={() => setAgregando(false)}
        />
      ) : (
        <button
          type="button"
          className="boton-luka cursor-pointer"
          onClick={() => {
            setAviso(null);
            setAgregando(true);
          }}
        >
          Agregar banco
        </button>
      )}
      <p role="status" aria-live="polite" className="text-sm font-semibold text-exito-fuerte empty:hidden">
        {aviso}
      </p>
    </div>
  );
}

function FilaBanco({
  banco,
  nombres,
  accionEditar,
  accionQuitar,
}: {
  banco: BancoDelHogar;
  nombres: Record<string, string>;
  accionEditar: AccionFormulario;
  accionQuitar: AccionFormulario;
}) {
  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-bold tracking-tight">{banco.banco}</h3>
        <p className="text-xs text-texto-tenue">
          {banco.conPlantillas ? "Luka ya sabe leer sus correos." : "Luka lee sus correos con IA y aprende su remitente."}
        </p>
      </div>

      <ul className="space-y-2" aria-label={`Cuentas y tarjetas de ${banco.banco}`}>
        {banco.cuentas.map((cuenta) => (
          <FilaCuenta
            key={cuenta.id}
            cuenta={cuenta}
            banco={banco.banco}
            deQuien={cuenta.miembroId ? nombres[cuenta.miembroId] : undefined}
            accionEditar={accionEditar}
            accionQuitar={accionQuitar}
          />
        ))}
      </ul>

      <p className="text-sm">
        {banco.ultimo ? (
          <>
            <span className="font-semibold text-exito-fuerte">Llegan solos.</span>{" "}
            <span className="text-texto-tenue">
              El último: {banco.ultimo.fuente}, del {fechaCorta(banco.ultimo.fecha)}.
            </span>
          </>
        ) : (
          <span className="text-texto-tenue">Todavía no llega ningún comprobante de {banco.banco}.</span>
        )}
      </p>
      {banco.remitentes.length > 0 && (
        <p className="text-xs leading-relaxed text-texto-tenue">
          Sus remitentes: <span className="break-all font-mono">{banco.remitentes.join(", ")}</span>
        </p>
      )}
    </li>
  );
}

function FilaCuenta({
  cuenta,
  banco,
  deQuien,
  accionEditar,
  accionQuitar,
}: {
  cuenta: CuentaBancariaDelHogar;
  banco: string;
  deQuien: string | undefined;
  accionEditar: AccionFormulario;
  accionQuitar: AccionFormulario;
}) {
  const [cambiando, setCambiando] = useState(false);
  const [estado, guardar, guardando] = useActionState(accionEditar, ESTADO_INICIAL);
  const ids = { tipo: useId(), apodo: useId(), ultimos4: useId() };

  useEffect(() => {
    if (estado.ok) setCambiando(false);
  }, [estado]);

  if (cambiando) {
    return (
      <li className="rounded-lg border border-borde bg-superficie-tenue p-3">
        <form action={guardar} className="space-y-3">
          <input type="hidden" name="id" value={cuenta.id} />
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem]">
            <div>
              <label htmlFor={ids.tipo} className="mb-1 block text-xs font-semibold text-texto-tenue">Tipo</label>
              <select id={ids.tipo} name="tipo" defaultValue={cuenta.tipo} className={`${CAMPO} cursor-pointer bg-superficie`}>
                {TIPOS_DE_CUENTA.map((tipo) => (
                  <option key={tipo} value={tipo}>{NOMBRE_DEL_TIPO[tipo]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={ids.apodo} className="mb-1 block text-xs font-semibold text-texto-tenue">Nombre (opcional)</label>
              <input id={ids.apodo} name="apodo" defaultValue={cuenta.apodo ?? ""} maxLength={60} className={`${CAMPO} bg-superficie`} />
            </div>
            <div>
              <label htmlFor={ids.ultimos4} className="mb-1 block text-xs font-semibold text-texto-tenue">Últimos 4</label>
              <input
                id={ids.ultimos4}
                name="ultimos4"
                defaultValue={cuenta.ultimos4}
                inputMode="numeric"
                maxLength={4}
                required
                className={`cifra ${CAMPO} bg-superficie`}
              />
            </div>
          </div>
          {estado.mensaje !== null && !estado.ok && <p role="alert" className={ERROR}>{estado.mensaje}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={guardando} className="boton-luka cursor-pointer">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" onClick={() => setCambiando(false)} className={SECUNDARIO}>
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-borde bg-superficie-tenue py-1.5 pr-1.5 pl-3">
      {/* En el celular el nombre va entero en su linea y los botones abajo. */}
      <span className="flex-[1_1_12rem] text-sm">
        <span className="font-semibold">{nombreDeLaCuenta(cuenta)}</span>
        {cuenta.apodo && <span className="text-texto-tenue"> · {NOMBRE_DEL_TIPO[cuenta.tipo]}</span>}
        {deQuien && <span className="text-texto-tenue"> · {deQuien}</span>}
      </span>
      <button type="button" onClick={() => setCambiando(true)} className={DE_TEXTO}>
        Cambiar
      </button>
      <ConfirmarAccion
        etiqueta="Quitar"
        pregunta={`¿Quitar ${nombreDeLaCuenta(cuenta)} de ${banco}?`}
        confirmar="Sí, quitarla"
        accion={accionQuitar}
        id={cuenta.id}
        claseBoton={DE_TEXTO}
      >
        <p>Lo que ya llegó de esa cuenta se queda en Luka. Los comprobantes nuevos dejan de saber que son de ella.</p>
      </ConfirmarAccion>
    </li>
  );
}

const PASOS = ["El banco", "Sus cuentas", "Que avise a Luka"] as const;

function AgregarBanco({
  accion,
  remitentesDelCatalogo,
  alTerminar,
  alCancelar,
}: {
  accion: AccionFormulario;
  remitentesDelCatalogo: Record<string, string[]>;
  alTerminar: (mensaje: string) => void;
  alCancelar: () => void;
}) {
  const [paso, setPaso] = useState(0);
  const [bancoId, setBancoId] = useState(BANCOS[0]!.id);
  const [bancoOtro, setBancoOtro] = useState("");
  const [cuentas, setCuentas] = useState<CuentaEnArmado[]>([]);
  const [tipo, setTipo] = useState<TipoCuentaBancaria>("CUENTA_CORRIENTE");
  const [apodo, setApodo] = useState("");
  const [ultimos4, setUltimos4] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [estado, guardar, guardando] = useActionState(accion, ESTADO_INICIAL);
  const ids = { banco: useId(), otro: useId(), tipo: useId(), apodo: useId(), ultimos4: useId(), error: useId(), titulo: useId() };

  const nombre = bancoId === "otro" ? bancoOtro.trim() : (BANCOS.find((b) => b.id === bancoId)?.nombre ?? "");
  const remitentes = remitentesDelCatalogo[bancoId] ?? [];

  // Solo cuando cambia lo que devolvio la accion: alTerminar cambia en cada dibujo del padre.
  const terminar = useRef(alTerminar);
  useEffect(() => {
    terminar.current = alTerminar;
  });
  useEffect(() => {
    if (estado.ok && estado.mensaje) terminar.current(estado.mensaje);
  }, [estado]);

  function agregarCuenta() {
    const limpios = limpiarUltimos4(ultimos4);
    if (limpios === null) {
      setError("Los últimos dígitos son 4 números: nunca el número completo.");
      return;
    }
    if (cuentas.some((c) => c.tipo === tipo && c.ultimos4 === limpios)) {
      setError("Esa ya está en la lista.");
      return;
    }
    setCuentas((lista) => [...lista, { tipo, apodo: apodo.trim(), ultimos4: limpios }]);
    setApodo("");
    setUltimos4("");
    setError(null);
  }

  function siguiente() {
    if (paso === 0 && nombre === "") {
      setError("Escribe el nombre de tu banco o billetera.");
      return;
    }
    // Lo que quedo escrito sin agregar tambien cuenta.
    if (paso === 1 && ultimos4.trim() !== "") {
      agregarCuenta();
      if (limpiarUltimos4(ultimos4) === null) return;
    }
    setError(null);
    setPaso((p) => p + 1);
  }

  const listas = paso === 1 && ultimos4.trim() !== "" ? true : cuentas.length > 0;

  return (
    <section aria-labelledby={ids.titulo} className="rounded-xl border border-borde">
      <div className="border-b border-borde px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h3 id={ids.titulo} className="text-base font-bold tracking-tight">Agregar un banco</h3>
          <span className="text-xs font-semibold text-texto-tenue">Paso {paso + 1} de 3</span>
        </div>
        <ol className="mt-3 grid grid-cols-3 gap-1.5" aria-label="Pasos">
          {PASOS.map((nombreDelPaso, i) => (
            <li key={nombreDelPaso} aria-current={i === paso ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full ${i <= paso ? "bg-acento" : "bg-borde"}`} />
              <span className={`mt-1.5 block text-xs font-bold leading-tight ${i === paso ? "text-texto" : "text-texto-tenue"}`}>{nombreDelPaso}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-3 px-4 py-4 text-sm">
        {paso === 0 && (
          <>
            <div>
              <label htmlFor={ids.banco} className="mb-1.5 block font-semibold">¿Qué banco o billetera agregas?</label>
              <select id={ids.banco} value={bancoId} onChange={(e) => setBancoId(e.target.value)} className={`${CAMPO} cursor-pointer`}>
                {BANCOS.map((banco) => (
                  <option key={banco.id} value={banco.id}>{banco.nombre}</option>
                ))}
                <option value="otro">Otro banco o billetera</option>
              </select>
            </div>
            {bancoId === "otro" && (
              <div>
                <label htmlFor={ids.otro} className="mb-1.5 block font-semibold">Su nombre</label>
                <input
                  id={ids.otro}
                  value={bancoOtro}
                  onChange={(e) => setBancoOtro(e.target.value)}
                  maxLength={60}
                  autoFocus
                  aria-describedby={error ? ids.error : undefined}
                  className={CAMPO}
                />
              </div>
            )}
            <p className="text-texto-tenue">Luka no se conecta al banco ni te pide claves: el banco le avisa a Luka por correo.</p>
          </>
        )}

        {paso === 1 && (
          <>
            <p className="font-semibold">Tus cuentas y tarjetas en {nombre}</p>
            {cuentas.length > 0 && (
              <ul className="space-y-1.5">
                {cuentas.map((cuenta, i) => (
                  <li key={`${cuenta.tipo}-${cuenta.ultimos4}`} className="flex items-center gap-2 rounded-lg border border-borde bg-superficie-tenue py-1 pr-1 pl-3">
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold">{nombreDeLaCuenta({ ...cuenta, apodo: cuenta.apodo || null })}</span>
                      {cuenta.apodo && <span className="text-texto-tenue"> · {NOMBRE_DEL_TIPO[cuenta.tipo]}</span>}
                    </span>
                    <button type="button" onClick={() => setCuentas((lista) => lista.filter((_, j) => j !== i))} className={DE_TEXTO}>
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_7rem]">
              <div>
                <label htmlFor={ids.tipo} className="mb-1 block text-xs font-semibold text-texto-tenue">Tipo</label>
                <select id={ids.tipo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoCuentaBancaria)} className={`${CAMPO} cursor-pointer`}>
                  {TIPOS_DE_CUENTA.map((t) => (
                    <option key={t} value={t}>{NOMBRE_DEL_TIPO[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={ids.apodo} className="mb-1 block text-xs font-semibold text-texto-tenue">Nombre (opcional)</label>
                <input id={ids.apodo} value={apodo} onChange={(e) => setApodo(e.target.value)} maxLength={60} placeholder="Cuenta sueldo" className={CAMPO} />
              </div>
              <div>
                <label htmlFor={ids.ultimos4} className="mb-1 block text-xs font-semibold text-texto-tenue">Últimos 4</label>
                <input
                  id={ids.ultimos4}
                  value={ultimos4}
                  onChange={(e) => {
                    setUltimos4(e.target.value.replace(/\D/g, "").slice(0, 4));
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarCuenta();
                    }
                  }}
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="1234"
                  aria-describedby={error ? ids.error : undefined}
                  className={`cifra ${CAMPO}`}
                />
              </div>
            </div>
            <button type="button" onClick={agregarCuenta} className={SECUNDARIO}>
              Agregar esta cuenta
            </button>
            <p className="text-texto-tenue">
              Solo los últimos 4 dígitos, nunca el número completo ni claves. Con ellos Luka sabe de qué cuenta es cada
              comprobante y reconoce los traspasos entre las cuentas del hogar y los pagos de tu tarjeta.
            </p>
          </>
        )}

        {paso === 2 && (
          <>
            <p className="font-semibold">Que {nombre} le avise a Luka</p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>En la app o la web de {nombre}, activa los avisos por correo de tus transferencias y compras, si los ofrece.</li>
              <li>
                Suma sus correos a tu regla de reenvío (los pasos están en «Tus correos y tu buzón», más abajo).{" "}
                {remitentes.length > 0
                  ? "Estos son sus remitentes:"
                  : "Luka todavía no conoce sus remitentes: reenvía a mano el primer comprobante que te llegue, y Luka lo muestra aquí."}
              </li>
            </ol>
            {remitentes.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-borde bg-superficie-tenue p-2 pl-3">
                <code className="min-w-0 flex-1 break-all font-mono text-[13px]">{remitentes.join(" OR ")}</code>
                <BotonCopiar texto={remitentes.join(" OR ")} descripcion={`los remitentes de ${nombre}`} />
              </div>
            )}
          </>
        )}

        {error !== null && <p id={ids.error} role="alert" className={ERROR}>{error}</p>}
        {estado.mensaje !== null && !estado.ok && <p role="alert" className={ERROR}>{estado.mensaje}</p>}
      </div>

      <form action={guardar} className="flex flex-wrap items-center gap-2 border-t border-borde px-4 py-3">
        <input type="hidden" name="banco" value={bancoId} />
        <input type="hidden" name="bancoOtro" value={bancoOtro} />
        <input type="hidden" name="cuentas" value={JSON.stringify(cuentas)} />
        <button type="button" onClick={() => (paso === 0 ? alCancelar() : setPaso((p) => p - 1))} className={SECUNDARIO}>
          {paso === 0 ? "Cancelar" : "Atrás"}
        </button>
        {/* Con su key cada uno: si React reusara el mismo boton, al pasar al
            ultimo paso el clic de «Siguiente» terminaria enviando el formulario. */}
        {paso < 2 ? (
          <button key="siguiente" type="button" onClick={siguiente} disabled={paso === 1 && !listas} className="boton-luka ml-auto cursor-pointer">
            Siguiente
          </button>
        ) : (
          <button key="guardar" type="submit" disabled={guardando || cuentas.length === 0} className="boton-luka ml-auto cursor-pointer">
            {guardando ? "Guardando…" : "Guardar banco"}
          </button>
        )}
      </form>
    </section>
  );
}

