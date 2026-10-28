-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA', 'OTRO');

-- CreateTable
CREATE TABLE "categorias" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "icono" VARCHAR(40) NOT NULL,
    "esencial" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos" (
    "id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" VARCHAR(120) NOT NULL,
    "monto" INTEGER NOT NULL,
    "medio_pago" "MedioPago" NOT NULL DEFAULT 'DEBITO',
    "notas" VARCHAR(500),
    "categoria_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_nombre_key" ON "categorias"("nombre");

-- CreateIndex
CREATE INDEX "categorias_activa_orden_idx" ON "categorias"("activa", "orden");

-- CreateIndex
CREATE INDEX "gastos_fecha_idx" ON "gastos"("fecha");

-- CreateIndex
CREATE INDEX "gastos_categoria_id_fecha_idx" ON "gastos"("categoria_id", "fecha");

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
