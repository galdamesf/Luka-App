-- Seccion E: conectar los correos, las cuentas que Luka reconoce sola y el
-- resumen diario por correo.

-- Una cuenta que Luka reconocio sola con un aviso que no dice si es corriente,
-- vista o de ahorro.
ALTER TYPE "TipoCuentaBancaria" ADD VALUE 'CUENTA';

-- El resumen diario por correo: si lo quiere, y el dia del ultimo que se le
-- mando.
ALTER TABLE "miembros" ADD COLUMN "resumen_diario" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "miembros" ADD COLUMN "resumen_enviado_el" DATE;

-- Los bancos que cada persona marco al conectar su correo.
CREATE TABLE "bancos_marcados" (
    "miembro_id" TEXT NOT NULL,
    "banco" VARCHAR(60) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bancos_marcados_pkey" PRIMARY KEY ("miembro_id","banco")
);

ALTER TABLE "bancos_marcados" ADD CONSTRAINT "bancos_marcados_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bancos_marcados"
    ADD CONSTRAINT "bancos_marcados_banco_check" CHECK (length(trim("banco")) > 0);
