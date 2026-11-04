-- El hogar pasa a ser obligatorio: se quita el valor por omision.
--
-- Hasta ahora cada tabla ponia 'hogar-inicial' si no se decia otra cosa, para
-- que el codigo de antes de los hogares siguiera funcionando. Ya todo el
-- codigo pasa el hogar de quien mira, asi que el valor por omision sobra y es
-- un riesgo: un dato guardado sin hogar caeria callado en «Mi hogar». Sin el,
-- la base rechaza la fila.
--
-- Las filas que ya existen no cambian: solo se quita el valor por omision.

ALTER TABLE "categorias" ALTER COLUMN "hogar_id" DROP DEFAULT;
ALTER TABLE "gastos" ALTER COLUMN "hogar_id" DROP DEFAULT;
ALTER TABLE "sueldos" ALTER COLUMN "hogar_id" DROP DEFAULT;
ALTER TABLE "deudas" ALTER COLUMN "hogar_id" DROP DEFAULT;
ALTER TABLE "cuentas" ALTER COLUMN "hogar_id" DROP DEFAULT;
ALTER TABLE "presupuestos" ALTER COLUMN "hogar_id" DROP DEFAULT;
ALTER TABLE "ahorros" ALTER COLUMN "hogar_id" DROP DEFAULT;
ALTER TABLE "ajustes" ALTER COLUMN "hogar_id" DROP DEFAULT;

-- Una cuenta solo puede usar una categoria de su hogar, igual que los gastos
-- y los presupuestos: la llave va por la categoria y el hogar juntos.
ALTER TABLE "cuentas" DROP CONSTRAINT "cuentas_categoria_id_fkey";
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_categoria_id_hogar_id_fkey" FOREIGN KEY ("categoria_id", "hogar_id") REFERENCES "categorias"("id", "hogar_id") ON DELETE RESTRICT ON UPDATE CASCADE;
