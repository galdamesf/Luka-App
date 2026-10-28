-- Restricciones que Prisma no expresa en schema.prisma.

-- Una cuenta de cero o negativa no es una cuenta.
ALTER TABLE "cuentas"
  ADD CONSTRAINT "cuentas_monto_positivo" CHECK ("monto" > 0);

-- El mes siempre es el dia 1: la cuenta pertenece a un mes, no a un dia.
ALTER TABLE "cuentas"
  ADD CONSTRAINT "cuentas_mes_dia_uno" CHECK (EXTRACT(DAY FROM "mes") = 1);

-- El dia de vencimiento, si se indica, tiene que existir en un calendario.
ALTER TABLE "cuentas"
  ADD CONSTRAINT "cuentas_dia_vencimiento_valido"
  CHECK ("dia_vencimiento" IS NULL OR ("dia_vencimiento" >= 1 AND "dia_vencimiento" <= 31));

-- Si hay un gasto enlazado, la cuenta tiene que estar pagada. Al reves no se
-- exige: "pagada pero sin gasto" es un estado valido, el que queda cuando se
-- borra el gasto a mano.
--
-- La restriccion en las dos direcciones parecia mas prolija pero chocaba con
-- el ON DELETE SET NULL de la llave foranea: al borrar el gasto, Postgres
-- pone gasto_id en NULL y el CHECK lo rechazaba, dejando el gasto imposible
-- de borrar. La aplicacion igual devuelve la cuenta a pendiente al borrar su
-- gasto; esta restriccion solo atrapa el estado que no significa nada.
ALTER TABLE "cuentas"
  ADD CONSTRAINT "cuentas_gasto_implica_pagada"
  CHECK ("gasto_id" IS NULL OR "pagada_en" IS NOT NULL);
