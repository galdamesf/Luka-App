-- Ajustes de la app: por ahora, el dia en que empieza el mes de gastos.
--
-- Una sola fila, la de id 'app'. Sin fila, la app usa el mes calendario
-- (dia 1), asi que no hace falta insertarla aqui.

CREATE TABLE "ajustes" (
    "id" VARCHAR(20) NOT NULL DEFAULT 'app',
    "dia_inicio_mes" INTEGER NOT NULL DEFAULT 1,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ajustes_pkey" PRIMARY KEY ("id")
);

-- Una sola fila: dos ajustes distintos no sabrian cual manda.
ALTER TABLE "ajustes"
  ADD CONSTRAINT "ajustes_una_sola_fila" CHECK ("id" = 'app');

-- Un dia que no existe en ningun mes no es un dia de inicio.
ALTER TABLE "ajustes"
  ADD CONSTRAINT "ajustes_dia_inicio_valido" CHECK ("dia_inicio_mes" BETWEEN 1 AND 31);
