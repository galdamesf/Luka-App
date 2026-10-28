-- Registro de las cuotas de deuda que SI se pagaron.
--
-- Las cuotas no se guardan por adelantado: se calculan a partir del mes de la
-- primera cuota mas el total. Aqui queda registro unicamente de la pagada,
-- con el dia exacto y el gasto que genero.

CREATE TABLE "cuotas_pagadas" (
    "id" TEXT NOT NULL,
    "deuda_id" TEXT NOT NULL,
    "mes" DATE NOT NULL,
    "pagada_en" DATE NOT NULL,
    "monto" INTEGER NOT NULL,
    "gasto_id" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuotas_pagadas_pkey" PRIMARY KEY ("id")
);

-- Una cuota se paga una sola vez. Sin esto, dos clics seguidos en "pagar"
-- dejarian dos registros y el mes contaria la cuota dos veces.
CREATE UNIQUE INDEX "cuotas_pagadas_deuda_id_mes_key"
  ON "cuotas_pagadas"("deuda_id", "mes");

-- Un gasto pertenece a lo mas a una cuota.
CREATE UNIQUE INDEX "cuotas_pagadas_gasto_id_key"
  ON "cuotas_pagadas"("gasto_id");

-- Para armar el mes: "que cuotas se pagaron en octubre".
CREATE INDEX "cuotas_pagadas_mes_idx" ON "cuotas_pagadas"("mes");

-- Al borrar la deuda se va su historial de pagos con ella. Las deudas en la
-- aplicacion se desactivan, no se borran, asi que esto es una red de
-- seguridad y no el camino normal.
ALTER TABLE "cuotas_pagadas"
  ADD CONSTRAINT "cuotas_pagadas_deuda_id_fkey"
  FOREIGN KEY ("deuda_id") REFERENCES "deudas"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Si se borra el gasto a mano, la cuota queda pagada pero sin gasto. Es un
-- estado valido, el mismo criterio que se uso en cuentas.
ALTER TABLE "cuotas_pagadas"
  ADD CONSTRAINT "cuotas_pagadas_gasto_id_fkey"
  FOREIGN KEY ("gasto_id") REFERENCES "gastos"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Pagar cero o menos no es pagar.
ALTER TABLE "cuotas_pagadas"
  ADD CONSTRAINT "cuotas_pagadas_monto_positivo" CHECK ("monto" > 0);

-- El mes siempre es el dia 1: la cuota pertenece a un mes, no a un dia.
ALTER TABLE "cuotas_pagadas"
  ADD CONSTRAINT "cuotas_pagadas_mes_dia_uno" CHECK (EXTRACT(DAY FROM "mes") = 1);
