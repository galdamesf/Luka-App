"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Luka } from "@/componentes/Luka";
import { Paisaje } from "./Paisaje";

/*
 * El paseo de Luka por el paisaje del header.
 *
 * La fase del paso sale de la DISTANCIA RECORRIDA, no del reloj: mientras una
 * pata esta apoyada, su pisada se queda quieta en el mundo, porque el angulo
 * de la cadera se resuelve para que el avance del cuerpo y el barrido de la
 * pata sean el mismo numero. Por eso el perro no patina. Es el mismo principio
 * (cinematica inversa) que usan los corredores de la seccion Nosotros de la
 * tienda Vitalia.
 *
 * Unidades: las del viewBox de Luka, que mide 144 de alto. `k` convierte esas
 * unidades a pixeles segun el tamano real que tenga el dibujo en pantalla.
 */

/** De la cadera (y=236) al borde de abajo de la pisada (y=275). */
const LARGO = 39;
/** Amplitud de la cadera, en radianes. */
const THETA = (20 * Math.PI) / 180;
/** Fraccion del ciclo con la pata en el suelo. */
const APOYO = 0.62;
const SENO = Math.sin(THETA);
/** Avance por ciclo: 43 unidades. Sale de la geometria, no de probar numeros. */
const ZANCADA = (2 * LARGO * SENO) / APOYO;
/** Unidades por segundo (ciclo de 0,69 s). */
const VELOCIDAD = 62;
/** Cuanto sube la pata cuando va por el aire. */
const LEVANTA = 7;
/** El cuerpo sube y baja dos veces por ciclo. */
const BOTE = 2.2;
/** Paso lateral: trasera cercana, delantera cercana, trasera lejana, delantera lejana. */
const DESFASE = [0, 0.25, 0.5, 0.75];
/**
 * Donde se detiene a olfatear, en fraccion del ancho, y cuantos segundos.
 * Distintas en cada sentido para que la ida y la vuelta no se vean iguales.
 */
const PARADAS = {
  izq: [
    [0.62, 1.6],
    [0.3, 2.0],
  ],
  der: [
    [0.42, 1.7],
    [0.72, 1.4],
  ],
} as const;
/** Segundos para frenar y para volver a arrancar. */
const RAMPA = 0.35;
/** Margen a cada lado, en fraccion del ancho: llega hasta la esquina misma. */
const BORDE = 0.004;

const suave = (u: number) => u * u * (3 - 2 * u);

export function EscenaPaseo({ className = "" }: { className?: string }) {
  const escena = useRef<HTMLDivElement>(null);
  const perro = useRef<HTMLDivElement>(null);
  const [pausado, setPausado] = useState(false);
  const [reducido, setReducido] = useState(false);
  /** Con movimiento reducido, el boton es la forma de pedir el paseo igual. */
  const [forzado, setForzado] = useState(false);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const leer = () => setReducido(mq.matches);
    leer();
    mq.addEventListener("change", leer);
    return () => mq.removeEventListener("change", leer);
  }, []);

  const corre = !pausado && (!reducido || forzado);

  useEffect(() => {
    const caja = escena.current;
    const luka = perro.current;
    if (!caja || !luka) return;
    const svg = luka.querySelector("svg");
    if (!svg) return;

    const patas = [1, 2, 3, 4].map((n) =>
      svg.querySelector<SVGGElement>(`[data-pata="${n}"]`),
    );
    const cabeza = svg.querySelector<SVGGElement>("[data-cabeza]");
    const cola = svg.querySelector<SVGGElement>("[data-cola]");

    let k = 1;
    let ancho = 0;
    let caneva = 0;
    let x = 0;
    let recorrido = 0;
    let t = 0;
    let previo = 0;
    /** Fase de la cola, integrada: el periodo cambia al frenar y una division
     *  del reloj por ese periodo haria saltar el angulo. */
    let faseCola = 0;
    /** -1: hacia la izquierda, como mira el dibujo. +1: de vuelta. */
    let dir: -1 | 1 = -1;
    let quieto = 0;
    let girar = false;
    let pendientes: [number, number][] = [];
    /** 0..1, cuanto esta caminando: funde las patas a quietas al parar. */
    let marcha = 1;
    let visible = true;
    let cuadro = 0;

    const medir = () => {
      const r = luka.getBoundingClientRect();
      k = r.height / 144;
      ancho = r.width;
      caneva = caja.clientWidth;
    };
    const xMin = () => caneva * BORDE;
    const xMax = () => caneva * (1 - BORDE) - ancho;
    const programar = () => {
      pendientes = (dir < 0 ? PARADAS.izq : PARADAS.der).map(([f, d]) => [
        xMin() + f * (xMax() - xMin()),
        d,
      ]);
    };

    function pintar() {
      if (!luka) return;
      const fase = (recorrido / k / ZANCADA) % 1;
      const bote = marcha * BOTE * (0.5 - 0.5 * Math.cos(4 * Math.PI * fase));
      luka.style.transform = `translate3d(${x.toFixed(1)}px, ${(-bote).toFixed(2)}px, 0) scaleX(${dir < 0 ? 1 : -1})`;

      patas.forEach((pata, i) => {
        if (!pata) return;
        const ph = (fase + (DESFASE[i] ?? 0)) % 1;
        let seno: number;
        let alza: number;
        if (ph < APOYO) {
          // Apoyada: la pisada se queda quieta en el suelo.
          seno = SENO - (ph / APOYO) * 2 * SENO;
          alza = 0;
        } else {
          // En el aire: vuelve adelante y sube.
          const u = (ph - APOYO) / (1 - APOYO);
          seno = -SENO + suave(u) * 2 * SENO;
          alza = LEVANTA * Math.sin(Math.PI * u);
        }
        const ang = ((Math.asin(seno) * 180) / Math.PI) * marcha;
        pata.style.transform = `translateY(${(-alza * marcha).toFixed(2)}px) rotate(${ang.toFixed(2)}deg)`;
      });

      // Cabeza: el olfateo de siempre y, detenido, el hocico mas abajo y mas rapido.
      if (cabeza) {
        const olfateo = 3.5 * Math.sin((2 * Math.PI * t) / 2.3);
        const husmeo = (1 - marcha) * (-8 + 2.5 * Math.sin((2 * Math.PI * t) / 0.42));
        cabeza.style.transform = `rotate(${(olfateo * 0.5 + husmeo).toFixed(2)}deg)`;
      }
      if (cola) {
        cola.style.transform = `rotate(${(19 * Math.sin(2 * Math.PI * faseCola)).toFixed(2)}deg)`;
      }
    }

    function paso(ahora: number) {
      cuadro = 0;
      if (!corre || !visible) return;
      const dt = Math.min(0.05, (ahora - previo) / 1000) || 0;
      previo = ahora;
      t += dt;
      faseCola += dt / (0.4 + 0.32 * marcha); // 0,72 s caminando, 0,4 s husmeando

      if (quieto > 0) {
        quieto -= dt;
        marcha = Math.max(0, marcha - dt / RAMPA);
        // A mitad de la parada del borde se da vuelta.
        if (girar && marcha === 0) {
          dir = dir === -1 ? 1 : -1;
          girar = false;
          programar();
        }
      } else {
        marcha = Math.min(1, marcha + dt / RAMPA);
        const d = VELOCIDAD * k * dt * suave(marcha);
        x += dir * d;
        recorrido += d;
        const prox = pendientes[0];
        if (prox && ((dir < 0 && x <= prox[0]) || (dir > 0 && x >= prox[0]))) {
          quieto = prox[1];
          pendientes.shift();
        }
        if ((dir < 0 && x <= xMin()) || (dir > 0 && x >= xMax())) {
          x = dir < 0 ? xMin() : xMax();
          quieto = 0.9;
          girar = true;
        }
      }
      pintar();
      cuadro = requestAnimationFrame(paso);
    }

    /** Quieto: a mitad del paseo, olfateando. Tiene que ser un cuadro completo. */
    function congelar() {
      medir();
      x = xMin() + 0.46 * (xMax() - xMin());
      marcha = 0;
      t = 0.1;
      programar();
      pendientes.shift();
      pintar();
    }

    medir();
    if (corre) {
      // Entra por la derecha.
      x = xMax();
      marcha = 1;
      programar();
      pintar();
    } else {
      congelar();
    }

    const arranca = () => {
      if (cuadro || !corre || !visible) return;
      previo = performance.now();
      cuadro = requestAnimationFrame(paso);
    };

    // La escena puede estar oculta o sin ancho al montar: se vuelve a medir
    // cuando de verdad se ve, y el paseo parte desde la esquina derecha.
    let medido = caja.clientWidth > 50;
    const remedir = () => {
      if (medido || caja.clientWidth <= 50) return;
      medido = true;
      if (!corre) {
        congelar();
        return;
      }
      medir();
      x = xMax();
      recorrido = 0;
      marcha = 1;
      quieto = 0;
      girar = false;
      dir = -1;
      programar();
      pintar();
    };

    const tamano = new ResizeObserver(() => {
      remedir();
      const f = (x - xMin()) / (xMax() - xMin());
      medir();
      x = xMin() + f * (xMax() - xMin());
      programar();
      pintar();
    });
    tamano.observe(caja);

    // Fuera de la pantalla el bucle se detiene: no gasta bateria por nada.
    const mirilla = new IntersectionObserver(
      (entradas) => {
        const e = entradas[0];
        if (!e) return;
        visible = e.isIntersecting;
        remedir();
        if (visible) arranca();
        else {
          cancelAnimationFrame(cuadro);
          cuadro = 0;
        }
      },
      { threshold: 0.05 },
    );
    mirilla.observe(caja);

    arranca();
    return () => {
      cancelAnimationFrame(cuadro);
      tamano.disconnect();
      mirilla.disconnect();
    };
  }, [corre]);

  const alternar = useCallback(() => {
    if (reducido && !forzado) {
      setForzado(true);
      setPausado(false);
    } else {
      setPausado((p) => !p);
    }
  }, [reducido, forzado]);

  return (
    <div
      ref={escena}
      data-paseo
      data-pausado={!corre || undefined}
      className={`relative ${className}`}
    >
      <Paisaje />
      <div
        ref={perro}
        aria-hidden="true"
        className="absolute bottom-[8.9%] left-0 h-[17.8%] w-auto will-change-transform"
      >
        <Luka pose="rastreando" paseando descripcion={null} className="h-full w-auto" />
      </div>
      <button
        type="button"
        onClick={alternar}
        aria-pressed={!corre}
        className="absolute top-20 right-4 z-10 inline-flex h-10 sm:right-6 cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-durazno-texto/25 bg-durazno/85 px-3.5 text-[13px] font-semibold text-durazno-texto transition-colors hover:border-durazno-realce focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--durazno-realce)"
      >
        {corre ? (
          <svg viewBox="0 0 14 14" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
            <rect x="2" y="2" width="3.5" height="10" rx="1" />
            <rect x="8.5" y="2" width="3.5" height="10" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 14 14" aria-hidden="true" className="h-3.5 w-3.5 fill-current">
            <path d="M3 2l9 5-9 5z" />
          </svg>
        )}
        {corre ? "Pausar el paseo" : "Reanudar el paseo"}
      </button>
    </div>
  );
}
