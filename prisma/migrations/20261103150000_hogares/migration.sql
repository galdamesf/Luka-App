-- Hogares: los datos de la plata pasan a ser de un hogar, no de una persona.
--
-- Cada persona entra con su Google y es miembro de un hogar. Un hogar puede
-- tener una o varias personas, y todas ven y anotan lo mismo.
--
-- Esta migracion solo AGREGA (la etapa de "expandir"): todo lo que ya existe
-- queda en el hogar inicial, de id 'hogar-inicial', y cada tabla trae ese
-- hogar por omision. Asi el codigo de hoy, que todavia no pasa el hogar al
-- guardar, sigue funcionando igual. Cuando todo el codigo pase el hogar, una
-- migracion posterior quita el valor por omision.
--
-- Antes de aplicarla: npm run db:respaldo

-- CreateEnum
CREATE TYPE "RolMiembro" AS ENUM ('DUENO', 'MIEMBRO');

-- CreateTable
CREATE TABLE "hogares" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hogares_pkey" PRIMARY KEY ("id")
);

-- Un hogar sin nombre no se puede mostrar ni elegir.
ALTER TABLE "hogares"
  ADD CONSTRAINT "hogares_nombre_no_vacio" CHECK (btrim("nombre") <> '');

-- El hogar inicial: el de los datos que existian antes de los hogares. Tiene
-- que existir antes de las llaves foraneas de abajo, porque todas las filas
-- de hoy van a apuntar a el.
INSERT INTO "hogares" ("id", "nombre") VALUES ('hogar-inicial', 'Mi hogar');

-- CreateTable
CREATE TABLE "miembros" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "correo" VARCHAR(254) NOT NULL,
    "nombre" VARCHAR(120),
    "rol" "RolMiembro" NOT NULL DEFAULT 'MIEMBRO',
    "invitado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entro_en" TIMESTAMP(3),

    CONSTRAINT "miembros_pkey" PRIMARY KEY ("id")
);

-- Cada persona esta en un solo hogar: su correo aparece una sola vez.
CREATE UNIQUE INDEX "miembros_correo_key" ON "miembros"("correo");

-- Para listar los miembros de un hogar.
CREATE INDEX "miembros_hogar_id_idx" ON "miembros"("hogar_id");

-- El correo se guarda en minusculas y sin espacios, como lo compara la
-- entrada: si no, 'Ana@Gmail.com' y 'ana@gmail.com' serian dos personas.
ALTER TABLE "miembros"
  ADD CONSTRAINT "miembros_correo_normalizado"
  CHECK ("correo" = lower(btrim("correo")) AND "correo" LIKE '_%@_%');

-- Las tablas de la plata: cada fila es de un hogar. Las filas de hoy quedan
-- en el hogar inicial por el valor por omision.

-- AlterTable
ALTER TABLE "categorias" ADD COLUMN     "hogar_id" TEXT NOT NULL DEFAULT 'hogar-inicial';

-- AlterTable
-- `anotado_por_id` queda vacio en lo de hoy: no se sabe quien lo anoto.
ALTER TABLE "gastos" ADD COLUMN     "anotado_por_id" TEXT,
ADD COLUMN     "hogar_id" TEXT NOT NULL DEFAULT 'hogar-inicial';

-- AlterTable
ALTER TABLE "sueldos" ADD COLUMN     "hogar_id" TEXT NOT NULL DEFAULT 'hogar-inicial';

-- AlterTable
ALTER TABLE "deudas" ADD COLUMN     "hogar_id" TEXT NOT NULL DEFAULT 'hogar-inicial';

-- AlterTable
ALTER TABLE "cuentas" ADD COLUMN     "hogar_id" TEXT NOT NULL DEFAULT 'hogar-inicial';

-- AlterTable
ALTER TABLE "presupuestos" ADD COLUMN     "hogar_id" TEXT NOT NULL DEFAULT 'hogar-inicial';

-- AlterTable
ALTER TABLE "ahorros" ADD COLUMN     "hogar_id" TEXT NOT NULL DEFAULT 'hogar-inicial';

-- AlterTable
-- Un juego de ajustes por hogar (el indice unico de abajo).
ALTER TABLE "ajustes" ADD COLUMN     "hogar_id" TEXT NOT NULL DEFAULT 'hogar-inicial';

-- Indices para leer lo de un hogar: casi todo se lee por hogar y mes.

-- CreateIndex
CREATE INDEX "categorias_hogar_id_idx" ON "categorias"("hogar_id");

-- CreateIndex
CREATE INDEX "gastos_hogar_id_fecha_idx" ON "gastos"("hogar_id", "fecha");

-- CreateIndex
CREATE INDEX "sueldos_hogar_id_idx" ON "sueldos"("hogar_id");

-- CreateIndex
CREATE INDEX "deudas_hogar_id_idx" ON "deudas"("hogar_id");

-- CreateIndex
CREATE INDEX "cuentas_hogar_id_mes_idx" ON "cuentas"("hogar_id", "mes");

-- CreateIndex
CREATE INDEX "presupuestos_hogar_id_mes_idx" ON "presupuestos"("hogar_id", "mes");

-- CreateIndex
CREATE INDEX "ahorros_hogar_id_mes_idx" ON "ahorros"("hogar_id", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "ajustes_hogar_id_key" ON "ajustes"("hogar_id");

-- Llaves foraneas.
--
-- Miembros: si el hogar se borra, sus miembros se van con el (CASCADE).
-- Datos de la plata: RESTRICT, un hogar con datos no se borra de un tiron;
-- borrar un hogar sera una accion propia que primero vacia lo suyo.
-- Gastos: si quien lo anoto deja de ser miembro, el gasto se queda en el
-- hogar y solo pierde el "anotado por" (SET NULL).

-- AddForeignKey
ALTER TABLE "miembros" ADD CONSTRAINT "miembros_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_anotado_por_id_fkey" FOREIGN KEY ("anotado_por_id") REFERENCES "miembros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sueldos" ADD CONSTRAINT "sueldos_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deudas" ADD CONSTRAINT "deudas_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas" ADD CONSTRAINT "cuentas_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presupuestos" ADD CONSTRAINT "presupuestos_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ahorros" ADD CONSTRAINT "ahorros_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes" ADD CONSTRAINT "ajustes_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
