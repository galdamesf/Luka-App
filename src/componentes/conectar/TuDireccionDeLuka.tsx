import { BotonCopiar } from "@/componentes/hogar/BotonCopiar";
import { trozosDeLaDireccion } from "@/dominio/contacto";

const SECUNDARIO =
  "inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-borde px-4 text-sm font-semibold text-texto transition-colors duration-150 hover:bg-superficie-tenue";

/**
 * La direccion de Luka de la persona, para reenviarle los avisos del banco:
 * con «Copiar» y con «Guardar "Luka" en mis contactos» (el .vcf de
 * /hogar/contacto). Con el contacto guardado, reenviar es escribir «Luka» en
 * «Para».
 */
export function TuDireccionDeLuka({ direccion }: { direccion: string }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-borde bg-superficie-tenue p-2 pl-3">
        <code className="min-w-0 flex-1 font-mono text-sm font-semibold [overflow-wrap:anywhere]">
          <DireccionConCortes direccion={direccion} />
        </code>
        <BotonCopiar texto={direccion} descripcion="tu dirección de Luka" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Un enlace comun, no next/link: es una descarga, no una pagina. */}
        <a href="/hogar/contacto" className={SECUNDARIO}>
          Guardar «Luka» en mis contactos
        </a>
        <span className="text-xs text-texto-tenue">Así, al reenviar, solo escribes «Luka».</span>
      </div>
    </div>
  );
}

/**
 * En el celular la direccion no cabe en una linea: que se corte despues del
 * «+» y antes de la «@», no en medio de «gmail».
 */
function DireccionConCortes({ direccion }: { direccion: string }) {
  return (
    <>
      {trozosDeLaDireccion(direccion).map((trozo, i) => (
        <span key={i}>
          {i > 0 && <wbr />}
          {trozo}
        </span>
      ))}
    </>
  );
}
