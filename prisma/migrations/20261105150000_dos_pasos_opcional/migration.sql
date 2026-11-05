-- La verificacion en dos pasos pasa a ser opcional: cada persona elige si la
-- activa. La primera vez que entra, Luka le pregunta; despues la activa o la
-- desactiva en «Tu hogar».
--
-- decidio_dos_pasos_en: cuando eligio (al activarla o con «Ahora no»). Vacio
-- = todavia no elige, y Luka se lo pregunta al entrar.
--
-- Quien ya tiene la app configurada ya eligio: queda con la fecha en que la
-- configuro, y sigue entrando con su codigo. Los demas eligen al entrar.

-- AlterTable
ALTER TABLE "miembros" ADD COLUMN "decidio_dos_pasos_en" TIMESTAMP(3);

UPDATE "miembros" AS m
SET "decidio_dos_pasos_en" = d."confirmado_en"
FROM "dos_pasos" AS d
WHERE d."miembro_id" = m."id" AND d."confirmado_en" IS NOT NULL;
