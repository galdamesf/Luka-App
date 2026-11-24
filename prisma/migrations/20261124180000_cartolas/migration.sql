-- Seccion D de «Gastos que llegan solos»: la cartola del mes.
--
--   - La clave del PDF de la cartola de cada persona, por banco, cifrada.
--   - Las cartolas que Luka leyo: de que cuenta y periodo, y que paso con
--     sus filas.
--   - En cada movimiento: la cartola de donde salio, si salio de una.
--   - Lo que puede pasar con una cartola que llega al buzon.

-- AlterEnum
ALTER TYPE "ResultadoDeLlegada" ADD VALUE 'CARTOLA_LEIDA';
ALTER TYPE "ResultadoDeLlegada" ADD VALUE 'CARTOLA_SIN_CLAVE';
ALTER TYPE "ResultadoDeLlegada" ADD VALUE 'CARTOLA_NO_CUADRA';

-- AlterTable
ALTER TABLE "movimientos" ADD COLUMN     "cartola_id" TEXT;

-- CreateTable
CREATE TABLE "claves_de_cartola" (
    "id" TEXT NOT NULL,
    "miembro_id" TEXT NOT NULL,
    "banco" VARCHAR(60) NOT NULL,
    "cifrada" VARCHAR(300) NOT NULL,
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claves_de_cartola_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cartolas" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "huella" CHAR(64) NOT NULL,
    "miembro_id" TEXT,
    "cuenta_bancaria_id" TEXT,
    "banco" VARCHAR(60) NOT NULL,
    "ultimos4" CHAR(4) NOT NULL,
    "plantilla" VARCHAR(60) NOT NULL,
    "numero" INTEGER,
    "desde" DATE NOT NULL,
    "hasta" DATE NOT NULL,
    "filas" INTEGER NOT NULL,
    "nuevas" INTEGER NOT NULL,
    "ya_estaban" INTEGER NOT NULL,
    "fuera" INTEGER NOT NULL,
    "cargos" INTEGER NOT NULL,
    "abonos" INTEGER NOT NULL,
    "leida_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cartolas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "claves_de_cartola_miembro_id_banco_key" ON "claves_de_cartola"("miembro_id", "banco");

-- CreateIndex
CREATE INDEX "cartolas_hogar_id_leida_en_idx" ON "cartolas"("hogar_id", "leida_en");

-- CreateIndex
CREATE INDEX "cartolas_miembro_id_idx" ON "cartolas"("miembro_id");

-- CreateIndex
CREATE INDEX "cartolas_cuenta_bancaria_id_idx" ON "cartolas"("cuenta_bancaria_id");

-- CreateIndex
CREATE UNIQUE INDEX "cartolas_hogar_id_huella_key" ON "cartolas"("hogar_id", "huella");

-- CreateIndex
CREATE INDEX "movimientos_cartola_id_idx" ON "movimientos"("cartola_id");

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cartola_id_fkey" FOREIGN KEY ("cartola_id") REFERENCES "cartolas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claves_de_cartola" ADD CONSTRAINT "claves_de_cartola_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cartolas" ADD CONSTRAINT "cartolas_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cartolas" ADD CONSTRAINT "cartolas_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cartolas" ADD CONSTRAINT "cartolas_cuenta_bancaria_id_fkey" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "cuentas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lo que Prisma no sabe decir: las reglas que la base hace cumplir sola.

-- La clave nunca se guarda tal cual: siempre con el formato del cifrado.
ALTER TABLE "claves_de_cartola"
    ADD CONSTRAINT "claves_de_cartola_cifrada_check" CHECK ("cifrada" ~ '^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'),
    ADD CONSTRAINT "claves_de_cartola_banco_check" CHECK (length(trim("banco")) > 0);

-- Una cartola cubre un periodo, sus cuentas cuadran y sus filas se reparten
-- entre las nuevas, las que ya estaban y las que quedaron fuera.
ALTER TABLE "cartolas"
    ADD CONSTRAINT "cartolas_huella_check" CHECK ("huella" ~ '^[0-9a-f]{64}$'),
    ADD CONSTRAINT "cartolas_ultimos4_check" CHECK ("ultimos4" ~ '^[0-9]{4}$'),
    ADD CONSTRAINT "cartolas_periodo_check" CHECK ("desde" <= "hasta"),
    ADD CONSTRAINT "cartolas_filas_check" CHECK ("nuevas" >= 0 AND "ya_estaban" >= 0 AND "fuera" >= 0 AND "nuevas" + "ya_estaban" + "fuera" = "filas"),
    ADD CONSTRAINT "cartolas_montos_check" CHECK ("cargos" >= 0 AND "abonos" >= 0);
