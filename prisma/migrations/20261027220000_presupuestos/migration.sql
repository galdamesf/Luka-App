-- Presupuesto por categoria y por mes.
--
-- Se define mes a mes: cada mes arranca vacio. No se arrastra solo como el
-- sueldo, porque un presupuesto es una decision de ese mes.

CREATE TABLE "presupuestos" (
    "id" TEXT NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "mes" DATE NOT NULL,
    "monto" INTEGER NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presupuestos_pkey" PRIMARY KEY ("id")
);

-- Un presupuesto por categoria y mes. Dos para lo mismo no significarian nada:
-- no se sabria cual manda.
CREATE UNIQUE INDEX "presupuestos_categoria_id_mes_key"
  ON "presupuestos"("categoria_id", "mes");

-- Para armar el mes: "que presupuestos hay en octubre".
CREATE INDEX "presupuestos_mes_idx" ON "presupuestos"("mes");

-- Si se borra la categoria se van sus presupuestos. Las categorias en la
-- aplicacion se desactivan, no se borran, asi que es una red de seguridad.
ALTER TABLE "presupuestos"
  ADD CONSTRAINT "presupuestos_categoria_id_fkey"
  FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Un presupuesto de cero o negativo no es un presupuesto.
ALTER TABLE "presupuestos"
  ADD CONSTRAINT "presupuestos_monto_positivo" CHECK ("monto" > 0);

-- El mes siempre es el dia 1: el presupuesto pertenece a un mes, no a un dia.
ALTER TABLE "presupuestos"
  ADD CONSTRAINT "presupuestos_mes_dia_uno" CHECK (EXTRACT(DAY FROM "mes") = 1);
