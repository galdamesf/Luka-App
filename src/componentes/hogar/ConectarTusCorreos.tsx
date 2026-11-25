"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { ESTADO_INICIAL, type AccionFormulario } from "@/dominio/formulario";
import { BANCOS, mismoBanco } from "@/dominio/bancos";
import { PASOS, type ProveedorDeCorreo } from "@/dominio/correos-registrados";
import {
  enlaceDeGmail,
  enlaceParaCrearElFiltro,
  textoDelFiltro,
  type PasoParaConectar,
  type PermisoDeGmail,
} from "@/dominio/conectar";
import { BotonCopiar } from "./BotonCopiar";

type Props = {
  /** Donde retoma: lo calcula el servidor con pasoParaConectar. */
  paso: PasoParaConectar;
  /** Sus correos confirmados: a cual le llegan los avisos de sus bancos. */
  correos: { direccion: string; proveedor: ProveedorDeCorreo }[];
  /** Su direccion de Luka. */
  direccionDeLuka: string;
  /** Los bancos que ya marco, o de los que ya tiene cuentas. */
  misBancos: string[];
  /** Lo que va en el campo «De» del filtro: los remitentes de los bancos del hogar y de las tiendas. */
  remitentes: string[];
  /** En que va el permiso que pide Gmail para reenviarle a Luka, si ya pidio. */
  permisoDeGmail: PermisoDeGmail | null;
  /** Si el buzon se revisa solo: entonces el permiso se da sin apretar nada. */
  revisaSolo: boolean;
  accionMarcarBancos: AccionFormulario;
  accionBuscarCodigo: (aMano: boolean) => Promise<PermisoDeGmail>;
  /** «Ya lo di»: el codigo o el enlace de Gmail deja de mostrarse. */
  accionOlvidarCodigoDeGmail: AccionFormulario;
};

const SECUNDARIO =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-borde px-4 text-sm font-semibold text-texto transition-colors duration-150 hover:bg-superficie-tenue disabled:cursor-not-allowed disabled:opacity-60";
const DE_TEXTO =
  "inline-flex min-h-9 cursor-pointer items-center rounded-lg px-2.5 text-[13px] font-semibold text-texto-tenue transition-colors duration-150 hover:bg-superficie-tenue hover:text-texto disabled:cursor-not-allowed disabled:opacity-60";
const ERROR = "rounded-lg border border-peligro/40 bg-peligro/10 px-3 py-2 text-sm";
const PARA_COPIAR = "flex flex-wrap items-center gap-2 rounded-lg border border-borde bg-superficie-tenue p-2 pl-3";

/** Cada cuanto se pregunta si Gmail ya pidio permiso, y hasta cuando. */
const CADA_MS = 6_000;
const HASTA_MS = 5 * 60_000;

/**
 * La opcion de mas, para quien no quiere reenviar cada aviso: que le lleguen
 * solos a Luka, configurando su correo una vez. Con Gmail, sus bancos, el
 * reenvio (el permiso que pide Gmail lo da Luka sola) y el filtro, que se
 * abre ya empezado; con otro correo, sus bancos y la regla. Luka no entra al
 * correo: cada paso abre la pantalla exacta y deja lo demas escrito.
 *
 * Se ve plegada, en una linea: lo principal es reenviar a mano. Se abre sola
 * cuando Gmail pidio permiso y falta darlo. No dice «Conectado»: con lo que
 * llega, Luka no sabe si llego por el filtro o reenviado a mano.
 */
export function ConectarTusCorreos(props: Props) {
  const { paso: pasoInicial, correos } = props;
  const [correo, setCorreo] = useState(correos[0]?.direccion ?? "");
  const proveedor = correos.find((c) => c.direccion === correo)?.proveedor ?? "GMAIL";
  const pasos: PasoParaConectar[] = proveedor === "GMAIL" ? ["bancos", "reenvio", "filtro"] : ["bancos", "filtro"];
  const nombres: Record<PasoParaConectar, string> = {
    bancos: "Tus bancos",
    reenvio: "Reenvío en Gmail",
    filtro: proveedor === "GMAIL" ? "Filtro en Gmail" : `La regla en ${PASOS[proveedor].nombre}`,
    listo: "Listo",
  };

  // Gmail pidio permiso y falta darlo: el asistente se abre ahi.
  const conCodigo = proveedor === "GMAIL" && Boolean(props.permisoDeGmail?.codigo || props.permisoDeGmail?.enlace);
  const desde: PasoParaConectar = conCodigo
    ? "reenvio"
    : pasoInicial === "listo"
      ? "bancos"
      : pasoInicial === "reenvio" && proveedor !== "GMAIL"
        ? "filtro"
        : pasoInicial;
  const [paso, setPaso] = useState<PasoParaConectar>(desde);
  const [abierto, setAbierto] = useState(conCodigo);
  const [terminado, setTerminado] = useState(false);

  function terminar() {
    setTerminado(true);
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-borde bg-superficie-tenue px-4 py-3 text-sm">
        <p className="min-w-0 flex-[1_1_18rem]">
          {terminado ? (
            <>
              <span className="font-semibold">Hecho.</span>{" "}
              <span className="text-texto-tenue">
                Desde ahora los avisos de tus bancos le llegan solos a Luka. Si en un par de días no llega nada, revisa los
                pasos.
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold">¿Prefieres no reenviar cada aviso?</span>{" "}
              <span className="text-texto-tenue">
                Configura {proveedor === "GMAIL" ? "Gmail" : "tu correo"} una vez y le llegan solos a Luka.
              </span>
            </>
          )}
        </p>
        <button
          type="button"
          className={DE_TEXTO}
          onClick={() => {
            setPaso(desde);
            setAbierto(true);
          }}
        >
          {terminado ? "Ver los pasos" : "Ver cómo"}
        </button>
      </div>
    );
  }

  const numero = Math.max(0, pasos.indexOf(paso));
  return (
    <section aria-labelledby="titulo-conectar" className="rounded-xl border border-acento-canto/60">
      <div className="border-b border-borde px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 id="titulo-conectar" className="text-base font-bold tracking-tight">
            Que tus gastos lleguen solos
          </h3>
          <span className="text-xs font-semibold text-texto-tenue">
            Paso {numero + 1} de {pasos.length} · una sola vez
          </span>
        </div>
        <ol className={`mt-3 grid gap-1.5 ${pasos.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} aria-label="Pasos">
          {pasos.map((p, i) => (
            <li key={p} aria-current={i === numero ? "step" : undefined}>
              <span className={`block h-1.5 rounded-full ${i <= numero ? "bg-acento" : "bg-borde"}`} />
              <span className={`mt-1.5 block text-xs font-bold leading-tight ${i === numero ? "text-texto" : "text-texto-tenue"}`}>{nombres[p]}</span>
            </li>
          ))}
        </ol>
      </div>

      {paso === "bancos" && (
        <PasoBancos
          {...props}
          correo={correo}
          setCorreo={setCorreo}
          alSeguir={() => setPaso(proveedor === "GMAIL" ? "reenvio" : "filtro")}
          alCerrar={() => setAbierto(false)}
        />
      )}
      {paso === "reenvio" && <PasoReenvio {...props} correo={correo} alVolver={() => setPaso("bancos")} alSeguir={() => setPaso("filtro")} />}
      {paso === "filtro" && (
        <PasoFiltro
          {...props}
          correo={correo}
          proveedor={proveedor}
          alVolver={() => setPaso(proveedor === "GMAIL" ? "reenvio" : "bancos")}
          alTerminar={terminar}
        />
      )}
    </section>
  );
}

function Botones({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-t border-borde px-4 py-3">{children}</div>;
}

function PasoBancos({
  misBancos,
  correos,
  correo,
  setCorreo,
  accionMarcarBancos,
  alSeguir,
  alCerrar,
}: Props & { correo: string; setCorreo: (c: string) => void; alSeguir: () => void; alCerrar: () => void }) {
  const [marcados, setMarcados] = useState<string[]>(() => BANCOS.filter((b) => misBancos.some((m) => mismoBanco(m, b.nombre))).map((b) => b.nombre));
  const [estado, guardar, guardando] = useActionState(accionMarcarBancos, ESTADO_INICIAL);
  const idCorreos = useId();

  // Guardados, al paso siguiente. Solo cuando cambia lo que devolvio la accion.
  const seguir = useRef(alSeguir);
  useEffect(() => {
    seguir.current = alSeguir;
  });
  useEffect(() => {
    if (estado.ok) seguir.current();
  }, [estado]);

  const alternar = (nombre: string) =>
    setMarcados((lista) => (lista.includes(nombre) ? lista.filter((n) => n !== nombre) : [...lista, nombre]));

  return (
    <form action={guardar}>
      <div className="space-y-4 px-4 py-4 text-sm">
        <fieldset className="space-y-2">
          <legend className="font-semibold">¿De qué bancos y billeteras te llegan avisos por correo?</legend>
          <p className="text-texto-tenue">Toca los tuyos. Tus cuentas y tarjetas no las escribes: Luka las reconoce con los primeros avisos.</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {BANCOS.map((banco) => {
              const marcado = marcados.includes(banco.nombre);
              return (
                <button
                  key={banco.id}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() => alternar(banco.nombre)}
                  className={`min-h-10 cursor-pointer rounded-full border px-3.5 text-[13px] font-bold transition-colors duration-150 ${
                    marcado ? "border-transparent bg-acento text-acento-tinta" : "border-borde hover:bg-superficie-tenue"
                  }`}
                >
                  {marcado ? "✓ " : ""}
                  {banco.nombre}
                </button>
              );
            })}
          </div>
          {marcados.map((nombre) => (
            <input key={nombre} type="hidden" name="banco" value={nombre} />
          ))}
          <p className="text-xs text-texto-tenue">
            ¿El tuyo no está? Reenvíale a mano sus avisos a tu dirección de Luka: también los lee.
          </p>
        </fieldset>

        {correos.length > 1 && (
          <fieldset className="space-y-2">
            <legend id={idCorreos} className="font-semibold">
              ¿A qué correo te llegan?
            </legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby={idCorreos}>
              {correos.map((c) => (
                <button
                  key={c.direccion}
                  type="button"
                  role="radio"
                  aria-checked={c.direccion === correo}
                  onClick={() => setCorreo(c.direccion)}
                  className={`min-h-10 cursor-pointer break-all rounded-full border px-3.5 text-[13px] font-bold transition-colors duration-150 ${
                    c.direccion === correo ? "border-transparent bg-acento text-acento-tinta" : "border-borde hover:bg-superficie-tenue"
                  }`}
                >
                  {c.direccion}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {estado.mensaje !== null && !estado.ok && (
          <p role="alert" className={ERROR}>
            {estado.mensaje}
          </p>
        )}
      </div>
      <Botones>
        <button type="button" onClick={alCerrar} className={SECUNDARIO}>
          Cerrar
        </button>
        <div className="ml-auto flex items-center gap-3">
          {marcados.length === 0 && <span className="text-xs text-texto-tenue">Toca al menos uno.</span>}
          <button type="submit" disabled={guardando || marcados.length === 0} className="boton-luka cursor-pointer">
            {guardando ? "Guardando…" : "Siguiente"}
          </button>
        </div>
      </Botones>
    </form>
  );
}

/** Si Gmail ya contesto: Luka dio el permiso, o hay un enlace o un codigo para darlo. */
function contesto(permiso: PermisoDeGmail | null): boolean {
  return Boolean(permiso && (permiso.aceptado || permiso.enlace || permiso.codigo));
}

function PasoReenvio({
  correo,
  direccionDeLuka,
  permisoDeGmail,
  revisaSolo,
  accionBuscarCodigo,
  accionOlvidarCodigoDeGmail,
  alVolver,
  alSeguir,
}: Props & { correo: string; alVolver: () => void; alSeguir: () => void }) {
  const [permiso, setPermiso] = useState<PermisoDeGmail | null>(permisoDeGmail);
  const [esperando, setEsperando] = useState(revisaSolo && !contesto(permisoDeGmail));
  const [buscando, iniciar] = useTransition();
  const [siguiendo, iniciarSiguiente] = useTransition();
  const [todaviaNo, setTodaviaNo] = useState(false);

  // Con el permiso ya dado en Gmail, el enlace o el codigo deja de mostrarse.
  function seguir() {
    if (!permiso?.codigo && !permiso?.enlace) return alSeguir();
    iniciarSiguiente(async () => {
      try {
        await accionOlvidarCodigoDeGmail(ESTADO_INICIAL, new FormData());
      } catch {
        // Da igual: solo se seguiria mostrando.
      }
      alSeguir();
    });
  }

  // Mientras espera a Gmail, pregunta cada pocos segundos (el buzon se revisa
  // en el servidor). Para a los cinco minutos o cuando Gmail contesta.
  useEffect(() => {
    if (!esperando) return;
    const desde = Date.now();
    let vivo = true;
    const reloj = setInterval(async () => {
      if (Date.now() - desde > HASTA_MS) {
        setEsperando(false);
        return;
      }
      try {
        const encontrado = await accionBuscarCodigo(false);
        if (vivo && contesto(encontrado)) {
          setPermiso(encontrado);
          setEsperando(false);
        }
      } catch {
        // Se intenta de nuevo en la vuelta siguiente.
      }
    }, CADA_MS);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [esperando, accionBuscarCodigo]);

  function buscar() {
    setTodaviaNo(false);
    iniciar(async () => {
      const encontrado = await accionBuscarCodigo(true);
      if (contesto(encontrado)) setPermiso(encontrado);
      else setTodaviaNo(true);
    });
  }

  return (
    <>
      <div className="space-y-4 px-4 py-4 text-sm">
        <p className="font-semibold">En Gmail, agrega tu dirección de Luka para reenviar. Hazlo en el computador: la app del celular no tiene esta opción.</p>
        <ol className="space-y-4">
          <li className="space-y-2">
            <p>
              <span className="font-bold">1.</span> Abre la configuración de reenvío de {correo}:
            </p>
            <a href={enlaceDeGmail("reenvio", correo)} target="_blank" rel="noopener noreferrer" className={SECUNDARIO}>
              Abrir Gmail en Reenvío ↗
            </a>
          </li>
          <li className="space-y-2">
            <p>
              <span className="font-bold">2.</span> Presiona «Agregar una dirección de reenvío», pega esta dirección y
              presiona «Siguiente», «Continuar» y «Aceptar». Si Gmail te pide confirmar que eres tú, hazlo.
            </p>
            <div className={PARA_COPIAR}>
              <code className="min-w-0 flex-1 break-all font-mono text-sm font-semibold">{direccionDeLuka}</code>
              <BotonCopiar texto={direccionDeLuka} descripcion="tu dirección de Luka" />
            </div>
          </li>
          <li className="space-y-2">
            <p>
              <span className="font-bold">3.</span> Gmail le pide permiso a Luka, y Luka lo da sola:
            </p>
            {permiso?.aceptado ? (
              <p role="status" className="rounded-lg border border-exito/40 bg-exito/10 px-3 py-2.5 font-semibold">
                ✓ Listo: Gmail ya puede reenviarle a Luka. Presiona «Siguiente».
              </p>
            ) : permiso?.enlace ? (
              <div role="status" className="space-y-2 rounded-lg border border-acento-canto/60 bg-durazno px-3 py-3 text-durazno-texto">
                <p className="font-semibold">Gmail pidió tu permiso. Dalo con un toque, y después presiona «Siguiente» aquí:</p>
                <a href={permiso.enlace} target="_blank" rel="noopener noreferrer" className="boton-luka inline-flex">
                  Dar el permiso ↗
                </a>
              </div>
            ) : permiso?.codigo ? (
              <div role="status" className="space-y-2 rounded-lg border border-acento-canto/60 bg-durazno px-3 py-3 text-durazno-texto">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="cifra rounded-md bg-superficie px-3 py-1.5 text-lg font-bold tracking-[0.2em] text-texto">{permiso.codigo}</code>
                  <BotonCopiar texto={permiso.codigo} descripcion="el código de Gmail" />
                </div>
                <p className="font-semibold">Pégalo en Gmail, presiona Verificar y después «Siguiente» aquí.</p>
              </div>
            ) : esperando ? (
              <p role="status" className="flex items-center gap-2 rounded-lg border border-borde bg-superficie-tenue px-3 py-2.5 text-texto-tenue">
                <span aria-hidden className="inline-block size-3 animate-pulse rounded-full bg-acento" />
                Esperando a Gmail… suele tardar menos de un minuto.
              </p>
            ) : (
              <div className="space-y-2">
                <button type="button" onClick={buscar} disabled={buscando} className={SECUNDARIO}>
                  {buscando ? "Revisando…" : "Ya la agregué: revisar"}
                </button>
                {todaviaNo && (
                  <p role="status" className="text-texto-tenue">
                    Todavía no llega lo de Gmail. Espera un momento y revisa de nuevo.
                  </p>
                )}
              </div>
            )}
          </li>
        </ol>
        <p className="text-xs leading-relaxed text-texto-tenue">
          No actives «Reenviar una copia de los mensajes entrantes»: eso le mandaría todo tu correo a Luka. Basta con el
          filtro del paso siguiente, que le pasa solo los avisos de tus bancos.
        </p>
      </div>
      <Botones>
        <button type="button" onClick={alVolver} className={SECUNDARIO}>
          Atrás
        </button>
        <button type="button" onClick={seguir} disabled={siguiendo} className="boton-luka ml-auto cursor-pointer">
          {siguiendo ? "Un momento…" : "Siguiente"}
        </button>
      </Botones>
    </>
  );
}

function PasoFiltro({
  correo,
  proveedor,
  direccionDeLuka,
  remitentes,
  alVolver,
  alTerminar,
}: Props & { correo: string; proveedor: ProveedorDeCorreo; alVolver: () => void; alTerminar: () => void }) {
  const filtro = textoDelFiltro(remitentes, proveedor);
  const guia = PASOS[proveedor];

  return (
    <>
      <div className="space-y-4 px-4 py-4 text-sm">
        {proveedor === "GMAIL" ? (
          <>
            <p className="font-semibold">Ahora el filtro: le pasa a Luka solo los avisos de tus bancos, nada más.</p>
            <ol className="space-y-4">
              <li className="space-y-2">
                <p>
                  <span className="font-bold">1.</span> Abre Gmail con el filtro ya escrito, y presiona «Crear filtro»:
                </p>
                <a href={enlaceParaCrearElFiltro(correo, remitentes)} target="_blank" rel="noopener noreferrer" className={SECUNDARIO}>
                  Crear el filtro en Gmail ↗
                </a>
              </li>
              <li>
                <p>
                  <span className="font-bold">2.</span> Marca «Reenviar a», elige tu dirección de Luka y presiona «Crear
                  filtro». Si Gmail te pide confirmar que eres tú, hazlo.
                </p>
              </li>
            </ol>
            <details className="text-xs text-texto-tenue">
              <summary className="cursor-pointer">¿No aparecieron tus bancos en «De»? Cópialos de aquí</summary>
              <div className={`mt-2 ${PARA_COPIAR}`}>
                <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-texto">{filtro}</code>
                <BotonCopiar texto={filtro} descripcion="las direcciones de tus bancos y tiendas" />
              </div>
            </details>
          </>
        ) : (
          <>
            <p className="font-semibold">
              {guia.reenviaSolo
                ? `En ${guia.nombre}, una regla que le pasa a Luka solo los avisos de tus bancos:`
                : `${guia.nombre} no reenvía solo sin pagar:`}
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              {guia.pasos.map((texto) => (
                <li key={texto}>{texto}</li>
              ))}
            </ol>
            {guia.nota && <p className="text-texto-tenue">{guia.nota}</p>}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-texto-tenue">Tu dirección de Luka</p>
              <div className={PARA_COPIAR}>
                <code className="min-w-0 flex-1 break-all font-mono text-sm font-semibold">{direccionDeLuka}</code>
                <BotonCopiar texto={direccionDeLuka} descripcion="tu dirección de Luka" />
              </div>
            </div>
            {guia.reenviaSolo && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-texto-tenue">Las direcciones de tus bancos y tiendas, una por línea</p>
                <div className={PARA_COPIAR}>
                  <code className="min-w-0 flex-1 whitespace-pre-line break-all font-mono text-[13px]">{filtro}</code>
                  <BotonCopiar texto={filtro} descripcion="las direcciones de tus bancos y tiendas" />
                </div>
              </div>
            )}
          </>
        )}
        <p className="rounded-lg bg-superficie-tenue px-3 py-2.5 text-texto-tenue">
          Listo eso, cada aviso nuevo de tus bancos llega solo a «Por revisar», y la primera vez Luka reconoce tu cuenta o
          tarjeta. Si tu banco no te avisa por correo cada compra, actívalo en su app.
        </p>
      </div>
      <Botones>
        <button type="button" onClick={alVolver} className={SECUNDARIO}>
          Atrás
        </button>
        <button type="button" onClick={alTerminar} className="boton-luka ml-auto cursor-pointer">
          Terminar
        </button>
      </Botones>
    </>
  );
}
