-- Ahorros del mes.
--
-- Varios por mes si hace falta. No tienen categoria: no son un gasto, son
-- plata que se aparta.

CREATE TABLE "ahorros" (
    "id" TEXT NOT NULL,
    "mes" DATE NOT NULL,
    "monto" INTEGER NOT NULL,
    "nota" VARCHAR(120),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ahorros_pkey" PRIMARY KEY ("id")
);

-- Para armar el mes y el total acumulado: "que se ahorro hasta octubre".
CREATE INDEX "ahorros_mes_idx" ON "ahorros"("mes");

-- Un ahorro de cero o negativo no es un ahorro.
ALTER TABLE "ahorros"
  ADD CONSTRAINT "ahorros_monto_positivo" CHECK ("monto" > 0);

-- El mes siempre es el dia 1: el ahorro pertenece a un mes, no a un dia.
ALTER TABLE "ahorros"
  ADD CONSTRAINT "ahorros_mes_dia_uno" CHECK (EXTRACT(DAY FROM "mes") = 1);
