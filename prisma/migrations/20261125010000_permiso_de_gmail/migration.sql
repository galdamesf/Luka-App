-- Gmail ya no confirma el reenvio con un codigo: manda un enlace. Si lo pidio
-- un correo confirmado de la persona, Luka lo abre sola; si no pudo, lo
-- guarda para que la persona de el permiso con un toque.

ALTER TYPE "ResultadoDeLlegada" ADD VALUE 'REENVIO_CONFIRMADO';

ALTER TABLE "buzones" ADD COLUMN "enlace_de_gmail" VARCHAR(600);

-- Solo el enlace para aceptar de Google (el de cancelar es /mail/uf-).
ALTER TABLE "buzones" ADD CONSTRAINT "buzones_enlace_de_gmail_check"
    CHECK ("enlace_de_gmail" IS NULL OR "enlace_de_gmail" ~ '^https://mail(-settings)?\.google\.com/mail/(u/[0-9]+/)?vf-[^/]+$');

-- La fecha va cuando hay algo de Gmail: un codigo o un enlace que falta, o
-- quien lo pidio, cuando Luka ya lo acepto.
UPDATE "buzones" SET "codigo_de_gmail_de" = NULL WHERE "codigo_de_gmail" IS NULL AND "codigo_de_gmail_en" IS NULL;
ALTER TABLE "buzones" DROP CONSTRAINT "buzones_codigo_de_gmail_en_check";
ALTER TABLE "buzones" ADD CONSTRAINT "buzones_codigo_de_gmail_en_check"
    CHECK (("codigo_de_gmail" IS NULL AND "enlace_de_gmail" IS NULL AND "codigo_de_gmail_de" IS NULL) = ("codigo_de_gmail_en" IS NULL));
