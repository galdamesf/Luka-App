-- El sueldo pasa a ser de cada persona del hogar: lo que entra al hogar en un
-- mes es la suma de los sueldos de todos. Ver src/dominio/sueldos.ts.

-- Columnas nuevas: de quien es, y hasta cuando rige (solo en el sueldo
-- cerrado de alguien que salio del hogar).
ALTER TABLE "sueldos" ADD COLUMN     "miembro_id" TEXT,
ADD COLUMN     "vigente_hasta" DATE;

-- El sueldo de antes, con todo su historial, queda como sueldo del dueno de
-- cada hogar. Los informes de los meses pasados no cambian: el total es el
-- mismo. Si «Mi hogar» todavia no tiene dueno (nadie ha entrado desde que
-- llegaron los hogares), su sueldo queda sin miembro y lo recibe su dueno la
-- primera vez que entra (registrarEntrada, en src/datos/hogares.ts).
UPDATE "sueldos" AS s
SET "miembro_id" = m."id"
FROM "miembros" AS m
WHERE m."hogar_id" = s."hogar_id" AND m."rol" = 'DUENO';

-- Uno por mes por persona, en vez de uno por mes por hogar.
DROP INDEX "sueldos_hogar_id_vigente_desde_key";

-- CreateIndex
CREATE UNIQUE INDEX "miembros_id_hogar_id_key" ON "miembros"("id", "hogar_id");

-- CreateIndex
CREATE INDEX "sueldos_hogar_id_idx" ON "sueldos"("hogar_id");

-- CreateIndex
CREATE UNIQUE INDEX "sueldos_miembro_id_vigente_desde_key" ON "sueldos"("miembro_id", "vigente_desde");

-- AddForeignKey
ALTER TABLE "sueldos" ADD CONSTRAINT "sueldos_miembro_id_hogar_id_fkey" FOREIGN KEY ("miembro_id", "hogar_id") REFERENCES "miembros"("id", "hogar_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Un sueldo cerrado (con su ultimo mes) es el de alguien que ya salio: no
-- tiene miembro. Y a un miembro no se le puede borrar mientras tenga un
-- sueldo abierto (la llave de arriba, con RESTRICT): primero se cierra.
ALTER TABLE "sueldos"
  ADD CONSTRAINT "sueldos_cerrado_sin_miembro"
  CHECK ("vigente_hasta" IS NULL OR "miembro_id" IS NULL);

-- El ultimo mes tambien es el primer dia de un mes, y no antes del primero.
ALTER TABLE "sueldos"
  ADD CONSTRAINT "sueldos_vigente_hasta_dia_uno"
  CHECK ("vigente_hasta" IS NULL OR EXTRACT(DAY FROM "vigente_hasta") = 1);

ALTER TABLE "sueldos"
  ADD CONSTRAINT "sueldos_hasta_no_antes_de_desde"
  CHECK ("vigente_hasta" IS NULL OR "vigente_hasta" >= "vigente_desde");
