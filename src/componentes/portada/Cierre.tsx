import Link from "next/link";
import { Luka } from "@/componentes/Luka";

/**
 * El cierre de la portada: la ultima invitacion a entrar, sobre el mismo azul
 * nocturno del pie de la app (--pie, oscuro en los dos temas). Luka ya termino
 * el paseo y esta echado. Aqui tambien vive la unica letra chica de la pagina:
 * las cifras de arriba son un mes de ejemplo, y eso se dice.
 */
export function Cierre() {
  return (
    <footer className="bg-pie text-pie-texto">
      <div className="mx-auto w-full max-w-[1080px] px-[clamp(20px,4vw,56px)] py-[clamp(34px,5vw,64px)]">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-6">
          <Luka pose="echado" descripcion={null} className="h-16 w-auto sm:h-20" />
          <div className="min-w-[230px] flex-1">
            <h2 className="font-marca text-[clamp(1.4rem,2.6vw,1.9rem)] leading-none font-extrabold tracking-[-0.03em]">
              Hasta acá llega el paseo
            </h2>
            <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-pie-texto/75">
              Con tu cuenta de Google. Todo vive en tu computador, en una base
              de datos local.
            </p>
          </div>
          <Link href="/ingresar" className="btn-luka btn-luka-acento">
            Iniciar sesión
          </Link>
        </div>
        <p className="mt-9 border-t border-pie-texto/15 pt-5 text-xs text-pie-texto/60">
          Luka · Control de gastos mensuales · Las cifras de esta página son de
          ejemplo.
        </p>
      </div>
    </footer>
  );
}
