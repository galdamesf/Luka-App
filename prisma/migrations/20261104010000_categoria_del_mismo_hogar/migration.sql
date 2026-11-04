-- Un gasto o un presupuesto solo puede usar una categoria de SU hogar.
--
-- Antes la llave foranea miraba solo la categoria: un gasto del hogar A con
-- la categoria del hogar B pasaba sin problema. Ahora la llave va por la
-- categoria y el hogar juntos, asi que la base lo rechaza aunque el codigo
-- se equivoque.
--
-- Hoy todo esta en el hogar inicial, asi que todas las filas ya cumplen.

-- Para que la llave pueda apuntar a (categoria, hogar), ese par tiene que ser
-- unico. Lo es siempre (el id ya es unico); Postgres igual pide el indice.
CREATE UNIQUE INDEX "categorias_id_hogar_id_key" ON "categorias"("id", "hogar_id");

-- Gastos: misma regla de antes (no se borra una categoria con gastos), ahora
-- por los dos campos.
ALTER TABLE "gastos" DROP CONSTRAINT "gastos_categoria_id_fkey";
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_categoria_id_hogar_id_fkey" FOREIGN KEY ("categoria_id", "hogar_id") REFERENCES "categorias"("id", "hogar_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Presupuestos: misma regla de antes (se van con su categoria), por los dos campos.
ALTER TABLE "presupuestos" DROP CONSTRAINT "presupuestos_categoria_id_fkey";
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_categoria_id_hogar_id_fkey" FOREIGN KEY ("categoria_id", "hogar_id") REFERENCES "categorias"("id", "hogar_id") ON DELETE CASCADE ON UPDATE CASCADE;
