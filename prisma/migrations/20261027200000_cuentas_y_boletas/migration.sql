-- AlterTable
ALTER TABLE "gastos" ADD COLUMN     "boleta_archivo" VARCHAR(255);

-- CreateTable
CREATE TABLE "cuentas" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "monto" INTEGER NOT NULL,
    "mes" DATE NOT NULL,
    "dia_vencimiento" INTEGER,
    "categoria_id" TEXT NOT NULL,
    "pagada_en" DATE,
    "gasto_id" TEXT,
    "mensual" BOOLEAN NOT NULL DEFAULT false,
    "boleta_archivo" VARCHAR(255),
    "nota" VARCHAR(500),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_gasto_id_key" ON "cuentas"("gasto_id");

-- CreateIndex
CREATE INDEX "cuentas_mes_pagada_en_idx" ON "cuentas"("mes", "pagada_en");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_nombre_mes_key" ON "cuentas"("nombre", "mes");

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_gasto_id_fkey" FOREIGN KEY ("gasto_id") REFERENCES "gastos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
