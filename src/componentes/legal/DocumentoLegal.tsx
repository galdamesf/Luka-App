import Link from "next/link";
import { Luka } from "@/componentes/Luka";
import {
  ACTUALIZADO,
  RESPONSABLE,
  RUTAS_LEGALES,
  type BloqueLegal,
  type DocumentoLegal as Documento,
} from "@/dominio/legal";

/**
 * Una pagina legal (privacidad o terminos): publica, con o sin sesion, con su
 * propio marco sencillo (Luka arriba, el indice, las secciones y el enlace al
 * otro documento), como /ingresar. El contenido vive en src/dominio/legal.ts.
 *
 * El correo de contacto, donde aparezca en el texto, es un enlace mailto.
 */
function ConCorreo({ texto }: { texto: string }) {
  const partes = texto.split(RESPONSABLE.correo);
  return (
    <>
      {partes.map((parte, i) => (
        <span key={i}>
          {parte}
          {i < partes.length - 1 && (
            <a href={`mailto:${RESPONSABLE.correo}`} className="font-semibold [overflow-wrap:anywhere] enlace-luka">
              {RESPONSABLE.correo}
            </a>
          )}
        </span>
      ))}
    </>
  );
}

function Bloque({ bloque }: { bloque: BloqueLegal }) {
  if (bloque.tipo === "parrafo") {
    return (
      <p className="text-[15px] leading-relaxed text-texto-tenue">
        <ConCorreo texto={bloque.texto} />
      </p>
    );
  }
  return (
    <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-texto-tenue marker:text-texto-tenue">
      {bloque.items.map((item) => (
        <li key={item}>
          <ConCorreo texto={item} />
        </li>
      ))}
    </ul>
  );
}

export function DocumentoLegal({ documento, otro }: { documento: Documento; otro: "privacidad" | "terminos" }) {
  const otroTexto = otro === "privacidad" ? "Política de privacidad" : "Términos de uso";

  return (
    <div className="min-h-svh bg-fondo text-texto">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 pt-6">
        <Link href="/" className="inline-flex items-center gap-2 rounded-lg font-marca text-lg font-extrabold tracking-tight">
          <Luka pose="rastreando" descripcion={null} className="h-9 w-auto" />
          Luka
        </Link>
        <Link href="/" className="text-sm font-semibold text-texto-tenue underline-offset-4 hover:underline">
          Volver a Luka
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-10 pb-16">
        <p className="cifra text-xs tracking-[0.08em] text-texto-tenue uppercase">Actualizado el {ACTUALIZADO}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{documento.titulo}</h1>
        <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-texto-tenue">{documento.resumen}</p>

        <nav aria-label="En esta página" className="mt-8 rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
          <p className="text-sm font-bold">En esta página</p>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {documento.secciones.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-texto-tenue underline-offset-4 hover:text-texto hover:underline">
                  <span className="cifra mr-1.5 text-texto-tenue opacity-70">{String(i + 1).padStart(2, "0")}</span>
                  {s.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {documento.secciones.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`titulo-${s.id}`} className="scroll-mt-6 space-y-3">
              <h2 id={`titulo-${s.id}`} className="text-xl font-bold tracking-tight">
                <span className="cifra mr-2 text-base text-texto-tenue opacity-70">{String(i + 1).padStart(2, "0")}</span>
                {s.titulo}
              </h2>
              {s.bloques.map((b, j) => (
                <Bloque key={j} bloque={b} />
              ))}
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-borde pt-6 text-sm text-texto-tenue">
          Ver también: <Link href={RUTAS_LEGALES[otro]} className="font-semibold enlace-luka">{otroTexto}</Link>
        </p>
      </main>
    </div>
  );
}
