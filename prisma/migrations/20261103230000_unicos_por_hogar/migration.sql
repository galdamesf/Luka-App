-- Lo que era unico en toda la base pasa a ser unico dentro de cada hogar.
--
-- Con un solo hogar daba lo mismo; con varios, dos hogares tienen que poder
-- tener cada uno su «Supermercado», su sueldo de noviembre y su cuenta de la
-- luz del mismo mes. Dentro de un hogar se siguen sin repetir.
--
-- Los ajustes dejan de ser una sola fila (la de id 'app') y pasan a ser una
-- por hogar, con el hogar como llave. La fila que habia se queda: ya era del
-- hogar inicial.

-- Categorias: el nombre, unico por hogar. El indice nuevo empieza por el
-- hogar, asi que tambien sirve para buscar las categorias de un hogar y el
-- indice suelto por hogar sobra.
DROP INDEX "categorias_nombre_key";
DROP INDEX "categorias_hogar_id_idx";
CREATE UNIQUE INDEX "categorias_hogar_id_nombre_key" ON "categorias"("hogar_id", "nombre");

-- Sueldos: uno por mes en cada hogar. Igual que arriba, el indice suelto sobra.
DROP INDEX "sueldos_vigente_desde_key";
DROP INDEX "sueldos_hogar_id_idx";
CREATE UNIQUE INDEX "sueldos_hogar_id_vigente_desde_key" ON "sueldos"("hogar_id", "vigente_desde");

-- Cuentas: el mismo nombre no se repite en el mismo mes del mismo hogar.
DROP INDEX "cuentas_nombre_mes_key";
CREATE UNIQUE INDEX "cuentas_hogar_id_nombre_mes_key" ON "cuentas"("hogar_id", "nombre", "mes");

-- Ajustes: la regla de "una sola fila" ya no corre, y el hogar pasa a ser la
-- llave (antes era un indice unico aparte). La columna id ya no hace falta.
ALTER TABLE "ajustes" DROP CONSTRAINT "ajustes_una_sola_fila";
DROP INDEX "ajustes_hogar_id_key";
ALTER TABLE "ajustes" DROP CONSTRAINT "ajustes_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "ajustes_pkey" PRIMARY KEY ("hogar_id");
