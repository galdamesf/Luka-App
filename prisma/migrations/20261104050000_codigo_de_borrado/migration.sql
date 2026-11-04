-- El codigo que confirma que se borra un hogar.
--
-- Para borrar un hogar, Luka manda un codigo de 6 digitos al correo del
-- dueno. Aqui se guarda su huella (HMAC-SHA256, nunca el codigo), quien lo
-- pidio, cuando vence y cuantos intentos lleva. Uno por hogar: pedir otro
-- reemplaza al anterior. Se va con el hogar y con quien lo pidio.
--
-- Es una tabla nueva: no toca ninguna fila que ya exista.

-- CreateTable
CREATE TABLE "codigos_de_borrado" (
    "hogar_id" TEXT NOT NULL,
    "miembro_id" TEXT NOT NULL,
    "huella" CHAR(64) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codigos_de_borrado_pkey" PRIMARY KEY ("hogar_id")
);

-- CreateIndex
CREATE INDEX "codigos_de_borrado_miembro_id_idx" ON "codigos_de_borrado"("miembro_id");

-- AddForeignKey
ALTER TABLE "codigos_de_borrado" ADD CONSTRAINT "codigos_de_borrado_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "codigos_de_borrado" ADD CONSTRAINT "codigos_de_borrado_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Lo que la base asegura por su cuenta.
ALTER TABLE "codigos_de_borrado" ADD CONSTRAINT "codigos_de_borrado_intentos_check" CHECK ("intentos" >= 0);
ALTER TABLE "codigos_de_borrado" ADD CONSTRAINT "codigos_de_borrado_huella_check" CHECK ("huella" ~ '^[0-9a-f]{64}$');
ALTER TABLE "codigos_de_borrado" ADD CONSTRAINT "codigos_de_borrado_vence_check" CHECK ("expira_en" > "creado_en");
