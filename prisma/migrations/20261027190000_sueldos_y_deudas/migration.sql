-- CreateTable
CREATE TABLE "sueldos" (
    "id" TEXT NOT NULL,
    "monto" INTEGER NOT NULL,
    "vigente_desde" DATE NOT NULL,
    "nota" VARCHAR(200),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sueldos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deudas" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "monto_cuota" INTEGER NOT NULL,
    "cuotas_totales" INTEGER NOT NULL,
    "primera_cuota" DATE NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "nota" VARCHAR(200),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deudas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sueldos_vigente_desde_key" ON "sueldos"("vigente_desde");

-- CreateIndex
CREATE INDEX "deudas_activa_primera_cuota_idx" ON "deudas"("activa", "primera_cuota");
