-- Seccion C de «Gastos que llegan solos»: los bancos, los correos y el buzon.
--
--   - La tarjeta de prepago (Tenpo, MACH, Mercado Pago) como tipo de cuenta.
--   - Los correos donde a cada persona le llegan comprobantes, confirmados
--     con un codigo.
--   - El buzon de cada persona: su direccion de Luka, con una clave al azar.
--   - Lo que fue llegando a cada buzon, para que se vea que paso.
--   - En cada movimiento: quien lo reenvio, desde que correo, quien lo mando
--     y de que cuenta o tarjeta del hogar es.

-- AlterEnum
ALTER TYPE "TipoCuentaBancaria" ADD VALUE 'TARJETA_PREPAGO';

-- CreateEnum
CREATE TYPE "ProveedorDeCorreo" AS ENUM ('GMAIL', 'OUTLOOK', 'ICLOUD', 'YAHOO', 'OTRO');

-- CreateEnum
CREATE TYPE "ResultadoDeLlegada" AS ENUM ('NUEVO', 'REPETIDO', 'NO_ES_COMPROBANTE', 'NO_SE_PUDO_LEER', 'CARTOLA', 'SIN_CONFIRMAR', 'SIN_FIRMA', 'CONFIRMACION_DE_GMAIL');

-- AlterTable
ALTER TABLE "movimientos" ADD COLUMN     "cuenta_bancaria_id" TEXT,
ADD COLUMN     "miembro_id" TEXT,
ADD COLUMN     "reenviado_por" VARCHAR(254),
ADD COLUMN     "remitente" VARCHAR(254);

-- CreateTable
CREATE TABLE "correos_registrados" (
    "id" TEXT NOT NULL,
    "miembro_id" TEXT NOT NULL,
    "direccion" VARCHAR(254) NOT NULL,
    "proveedor" "ProveedorDeCorreo" NOT NULL,
    "confirmado_en" TIMESTAMP(3),
    "huella_del_codigo" CHAR(64),
    "codigo_pedido_en" TIMESTAMP(3),
    "codigo_vence_en" TIMESTAMP(3),
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correos_registrados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buzones" (
    "miembro_id" TEXT NOT NULL,
    "clave" VARCHAR(20) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "codigo_de_gmail" VARCHAR(12),
    "codigo_de_gmail_de" VARCHAR(254),
    "codigo_de_gmail_en" TIMESTAMP(3),

    CONSTRAINT "buzones_pkey" PRIMARY KEY ("miembro_id")
);

-- CreateTable
CREATE TABLE "llegadas_al_buzon" (
    "id" TEXT NOT NULL,
    "miembro_id" TEXT NOT NULL,
    "llego_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultado" "ResultadoDeLlegada" NOT NULL,
    "remitente" VARCHAR(254) NOT NULL,
    "detalle" VARCHAR(200),
    "movimiento_id" TEXT,

    CONSTRAINT "llegadas_al_buzon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "correos_registrados_miembro_id_direccion_key" ON "correos_registrados"("miembro_id", "direccion");

-- CreateIndex
CREATE UNIQUE INDEX "buzones_clave_key" ON "buzones"("clave");

-- CreateIndex
CREATE INDEX "llegadas_al_buzon_miembro_id_llego_en_idx" ON "llegadas_al_buzon"("miembro_id", "llego_en");

-- CreateIndex
CREATE INDEX "llegadas_al_buzon_movimiento_id_idx" ON "llegadas_al_buzon"("movimiento_id");

-- CreateIndex
CREATE INDEX "movimientos_miembro_id_idx" ON "movimientos"("miembro_id");

-- CreateIndex
CREATE INDEX "movimientos_cuenta_bancaria_id_idx" ON "movimientos"("cuenta_bancaria_id");

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cuenta_bancaria_id_fkey" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "cuentas_bancarias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correos_registrados" ADD CONSTRAINT "correos_registrados_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buzones" ADD CONSTRAINT "buzones_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llegadas_al_buzon" ADD CONSTRAINT "llegadas_al_buzon_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "llegadas_al_buzon" ADD CONSTRAINT "llegadas_al_buzon_movimiento_id_fkey" FOREIGN KEY ("movimiento_id") REFERENCES "movimientos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lo que Prisma no sabe decir: las reglas que la base hace cumplir sola.

-- Un correo en minusculas, con algo antes de la @. Un codigo pendiente
-- tiene huella y vencimiento, o ninguno de los dos.
ALTER TABLE "correos_registrados"
    ADD CONSTRAINT "correos_registrados_direccion_check" CHECK ("direccion" = lower("direccion") AND position('@' IN "direccion") > 1),
    ADD CONSTRAINT "correos_registrados_intentos_check" CHECK ("intentos" >= 0),
    ADD CONSTRAINT "correos_registrados_codigo_check" CHECK (("huella_del_codigo" IS NULL) = ("codigo_vence_en" IS NULL)),
    ADD CONSTRAINT "correos_registrados_huella_check" CHECK ("huella_del_codigo" IS NULL OR "huella_del_codigo" ~ '^[0-9a-f]{64}$');

-- La clave va en la direccion: solo minusculas y numeros. El codigo de
-- Gmail son numeros, y llega con su fecha.
ALTER TABLE "buzones"
    ADD CONSTRAINT "buzones_clave_check" CHECK ("clave" ~ '^[a-z0-9]{8,20}$'),
    ADD CONSTRAINT "buzones_codigo_de_gmail_check" CHECK ("codigo_de_gmail" IS NULL OR "codigo_de_gmail" ~ '^[0-9]{6,12}$'),
    ADD CONSTRAINT "buzones_codigo_de_gmail_en_check" CHECK (("codigo_de_gmail" IS NULL) = ("codigo_de_gmail_en" IS NULL));

ALTER TABLE "llegadas_al_buzon"
    ADD CONSTRAINT "llegadas_al_buzon_remitente_check" CHECK ("remitente" <> '');

ALTER TABLE "movimientos"
    ADD CONSTRAINT "movimientos_reenviado_por_check" CHECK ("reenviado_por" IS NULL OR "reenviado_por" = lower("reenviado_por")),
    ADD CONSTRAINT "movimientos_remitente_check" CHECK ("remitente" IS NULL OR "remitente" = lower("remitente"));
