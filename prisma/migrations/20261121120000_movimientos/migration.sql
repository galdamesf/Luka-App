-- Los movimientos: lo que llega de los comprobantes de los bancos y las
-- tiendas, y la bandeja «Por revisar». Ver src/dominio/movimientos.ts.
--
-- - movimientos: lo que leyo el lector de cada comprobante, con lo que se
--   hizo con el (por revisar, confirmado, descartado, ignorado o juntado con
--   otro de la misma compra).
-- - cuentas_bancarias: las cuentas y tarjetas del hogar, por sus ultimos 4
--   digitos. Con ellas, una transferencia a otra cuenta del hogar es un
--   traspaso y no un gasto.
-- - reglas_de_comercio: la categoria de siempre de un comercio.
--
-- Son tablas nuevas: no tocan ninguna fila que ya exista.

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('COMPRA', 'TRANSFERENCIA', 'PAGO', 'BOLETA', 'PAGO_TARJETA', 'TRASPASO_PROPIO', 'ABONO', 'GIRO', 'CARGO');

-- CreateEnum
CREATE TYPE "Sentido" AS ENUM ('GASTO', 'INGRESO', 'NINGUNO');

-- CreateEnum
CREATE TYPE "Moneda" AS ENUM ('CLP', 'USD');

-- CreateEnum
CREATE TYPE "EstadoMovimiento" AS ENUM ('POR_REVISAR', 'CONFIRMADO', 'DESCARTADO', 'IGNORADO', 'JUNTADO');

-- CreateEnum
CREATE TYPE "DestinoMovimiento" AS ENUM ('GASTO_NUEVO', 'GASTO_EXISTENTE', 'PAGO_DE_CUENTA', 'PAGO_DE_CUOTA', 'DEUDA');

-- CreateEnum
CREATE TYPE "TipoCuentaBancaria" AS ENUM ('CUENTA_CORRIENTE', 'CUENTA_VISTA', 'CUENTA_AHORRO', 'TARJETA_CREDITO', 'TARJETA_DEBITO');

-- CreateTable
CREATE TABLE "movimientos" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "huella" CHAR(64) NOT NULL,
    "estado" "EstadoMovimiento" NOT NULL DEFAULT 'POR_REVISAR',
    "tipo" "TipoMovimiento" NOT NULL,
    "sentido" "Sentido" NOT NULL,
    "monto" INTEGER NOT NULL,
    "moneda" "Moneda" NOT NULL DEFAULT 'CLP',
    "fecha" DATE NOT NULL,
    "comercio" VARCHAR(120) NOT NULL,
    "fuente" VARCHAR(80) NOT NULL,
    "plantilla" VARCHAR(60),
    "confianza" DOUBLE PRECISION,
    "medio_pago" "MedioPago",
    "ultimos4" CHAR(4),
    "cuotas" INTEGER,
    "contraparte_nombre" VARCHAR(120),
    "contraparte_banco" VARCHAR(60),
    "contraparte_ultimos4" CHAR(4),
    "sin_detalle" BOOLEAN NOT NULL DEFAULT false,
    "reenviado_a_mano" BOOLEAN NOT NULL DEFAULT false,
    "recibido_en" TIMESTAMP(3) NOT NULL,
    "destino" "DestinoMovimiento",
    "gasto_id" TEXT,
    "deuda_id" TEXT,
    "juntado_con_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_bancarias" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "miembro_id" TEXT,
    "banco" VARCHAR(60) NOT NULL,
    "tipo" "TipoCuentaBancaria" NOT NULL,
    "ultimos4" CHAR(4) NOT NULL,
    "apodo" VARCHAR(60),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reglas_de_comercio" (
    "id" TEXT NOT NULL,
    "hogar_id" TEXT NOT NULL,
    "clave" VARCHAR(120) NOT NULL,
    "etiqueta" VARCHAR(120) NOT NULL,
    "categoria_id" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reglas_de_comercio_pkey" PRIMARY KEY ("id")
);

-- El mismo correo reenviado dos veces es un solo movimiento: el segundo
-- choca con este indice.
CREATE UNIQUE INDEX "movimientos_hogar_id_huella_key" ON "movimientos"("hogar_id", "huella");

-- Para la bandeja: lo que esta por revisar en el hogar.
CREATE INDEX "movimientos_hogar_id_estado_idx" ON "movimientos"("hogar_id", "estado");

-- Para buscar la pareja de un movimiento (la boleta y el aviso de la misma compra).
CREATE INDEX "movimientos_hogar_id_fecha_idx" ON "movimientos"("hogar_id", "fecha");

-- Para las llaves foraneas: al borrar un gasto, una deuda o un movimiento,
-- Postgres busca aqui lo que lo apunta.
CREATE INDEX "movimientos_gasto_id_idx" ON "movimientos"("gasto_id");

-- CreateIndex
CREATE INDEX "movimientos_deuda_id_idx" ON "movimientos"("deuda_id");

-- CreateIndex
CREATE INDEX "movimientos_juntado_con_id_idx" ON "movimientos"("juntado_con_id");

-- Una cuenta o tarjeta se registra una vez por hogar.
CREATE UNIQUE INDEX "cuentas_bancarias_hogar_id_banco_tipo_ultimos4_key" ON "cuentas_bancarias"("hogar_id", "banco", "tipo", "ultimos4");

-- Para reconocer un traspaso por los 4 digitos de la cuenta de destino.
CREATE INDEX "cuentas_bancarias_hogar_id_ultimos4_idx" ON "cuentas_bancarias"("hogar_id", "ultimos4");

-- Un comercio tiene una sola regla por hogar: cambiarla la reemplaza.
CREATE UNIQUE INDEX "reglas_de_comercio_hogar_id_clave_key" ON "reglas_de_comercio"("hogar_id", "clave");

-- CreateIndex
CREATE INDEX "reglas_de_comercio_categoria_id_idx" ON "reglas_de_comercio"("categoria_id");

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Si se borra el gasto, el movimiento sigue confirmado y sin gasto: no
-- vuelve a la bandeja. El mismo criterio que en cuentas y cuotas.
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_gasto_id_fkey" FOREIGN KEY ("gasto_id") REFERENCES "gastos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_deuda_id_fkey" FOREIGN KEY ("deuda_id") REFERENCES "deudas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un juntado es el eco de su principal: si el principal se fuera, se va con el.
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_juntado_con_id_fkey" FOREIGN KEY ("juntado_con_id") REFERENCES "movimientos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Si la persona sale del hogar, su cuenta queda del hogar.
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_miembro_id_fkey" FOREIGN KEY ("miembro_id") REFERENCES "miembros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reglas_de_comercio" ADD CONSTRAINT "reglas_de_comercio_hogar_id_fkey" FOREIGN KEY ("hogar_id") REFERENCES "hogares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La categoria de la regla es del mismo hogar: la llave va por los dos campos.
ALTER TABLE "reglas_de_comercio" ADD CONSTRAINT "reglas_de_comercio_categoria_id_hogar_id_fkey" FOREIGN KEY ("categoria_id", "hogar_id") REFERENCES "categorias"("id", "hogar_id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Lo que la base asegura por su cuenta.

-- Un movimiento de cero o negativo no es un movimiento: lo que entra o sale
-- lo dice `sentido`, no el signo.
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_monto_positivo" CHECK ("monto" > 0);

ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_huella_check" CHECK ("huella" ~ '^[0-9a-f]{64}$');

-- Solo los ultimos 4 digitos, nunca un numero completo.
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_ultimos4_check" CHECK ("ultimos4" IS NULL OR "ultimos4" ~ '^[0-9]{4}$');
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_contraparte_ultimos4_check" CHECK ("contraparte_ultimos4" IS NULL OR "contraparte_ultimos4" ~ '^[0-9]{4}$');
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_ultimos4_check" CHECK ("ultimos4" ~ '^[0-9]{4}$');

-- Una compra en una sola cuota no es una compra en cuotas. El tope es el de
-- las deudas (CUOTAS_MAXIMAS en src/dominio/esquemas.ts).
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_cuotas_check" CHECK ("cuotas" IS NULL OR ("cuotas" >= 2 AND "cuotas" <= 600));

ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_confianza_check" CHECK ("confianza" IS NULL OR ("confianza" >= 0 AND "confianza" <= 1));

-- Un movimiento confirmado dice como se confirmo, y solo el confirmado.
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_destino_si_confirmado" CHECK (("destino" IS NOT NULL) = ("estado" = 'CONFIRMADO'));

-- Un gasto enlazado implica confirmado. Al reves no se exige: "confirmado y
-- sin gasto" es lo que queda cuando se borra el gasto a mano (la llave lo
-- deja vacio), igual que en cuentas_gasto_implica_pagada.
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_gasto_implica_confirmado" CHECK ("gasto_id" IS NULL OR "estado" = 'CONFIRMADO');

-- Una deuda enlazada solo en lo que se confirmo como deuda.
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_deuda_si_es_deuda" CHECK ("deuda_id" IS NULL OR "destino" = 'DEUDA');

-- Juntado siempre con otro, y nunca consigo mismo. Aqui si va en las dos
-- direcciones: la llave borra el juntado en vez de dejarlo vacio.
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_juntado_con_otro" CHECK (("juntado_con_id" IS NOT NULL) = ("estado" = 'JUNTADO') AND ("juntado_con_id" IS NULL OR "juntado_con_id" <> "id"));

-- Una regla sin comercio no calzaria con nada.
ALTER TABLE "reglas_de_comercio" ADD CONSTRAINT "reglas_de_comercio_clave_no_vacia" CHECK (btrim("clave") <> '' AND btrim("etiqueta") <> '');
