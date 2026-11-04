-- La verificacion en dos pasos: despues de Google, un codigo de 6 digitos de
-- la app de autenticacion del celular (Google Authenticator u otra).
--
-- - dos_pasos: la app de cada persona. Su clave va cifrada con
--   CLAVE_DOS_PASOS (src/lib/dos-pasos.ts), nunca a la vista.
-- - codigos_de_respaldo: por si se pierde el celular. Solo su huella.
-- - sesiones_verificadas: las sesiones que ya pusieron el codigo.
--
-- Las tres se van con el miembro. Son tablas nuevas: no tocan ninguna fila
-- que ya exista. Desde esta migracion, todos configuran la app al entrar.


-- CreateTable
CREATE TABLE "dos_pasos" (
    "miembro_id" TEXT NOT NULL,
    "clave_cifrada" VARCHAR(200) NOT NULL,
    "confirmado_en" TIMESTAMP(3),
    "ultimo_paso" INTEGER,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dos_pasos_pkey" PRIMARY KEY ("miembro_id")
);

-- CreateTable
CREATE TABLE "codigos_de_respaldo" (
    "id" TEXT NOT NULL,
    "miembro_id" TEXT NOT NULL,
    "huella" CHAR(64) NOT NULL,
    "usado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigos_de_respaldo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones_verificadas" (
    "id" CHAR(32) NOT NULL,
    "miembro_id" TEXT NOT NULL,
    "verificada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sesiones_verificadas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "codigos_de_respaldo_miembro_id_huella_key" ON "codigos_de_respaldo"("miembro_id", "huella");

-- CreateIndex
CREATE INDEX "sesiones_verificadas_miembro_id_idx" ON "sesiones_verificadas"("miembro_id");

-- AddForeignKey
ALTER TABLE "dos_pasos" ADD CONSTRAINT "dos_pasos_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_de_respaldo" ADD CONSTRAINT "codigos_de_respaldo_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones_verificadas" ADD CONSTRAINT "sesiones_verificadas_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Lo que la base asegura por su cuenta.
ALTER TABLE "dos_pasos" ADD CONSTRAINT "dos_pasos_intentos_check" CHECK ("intentos" >= 0);
ALTER TABLE "dos_pasos" ADD CONSTRAINT "dos_pasos_ultimo_paso_check" CHECK ("ultimo_paso" IS NULL OR "ultimo_paso" >= 0);
ALTER TABLE "dos_pasos" ADD CONSTRAINT "dos_pasos_clave_check" CHECK ("clave_cifrada" LIKE 'v1.%');
ALTER TABLE "codigos_de_respaldo" ADD CONSTRAINT "codigos_de_respaldo_huella_check" CHECK ("huella" ~ '^[0-9a-f]{64}$');
ALTER TABLE "sesiones_verificadas" ADD CONSTRAINT "sesiones_verificadas_id_check" CHECK ("id" ~ '^[0-9a-f]{32}$');
ALTER TABLE "sesiones_verificadas" ADD CONSTRAINT "sesiones_verificadas_vence_check" CHECK ("expira_en" > "verificada_en");
