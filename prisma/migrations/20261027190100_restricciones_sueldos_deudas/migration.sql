-- Restricciones que Prisma no sabe expresar en schema.prisma, en su propia
-- migracion para que formen parte del historial y no se vean como drift.

-- El sueldo puede ser cero (un mes sin ingresos) pero nunca negativo.
ALTER TABLE "sueldos"
  ADD CONSTRAINT "sueldos_monto_no_negativo" CHECK ("monto" >= 0);

-- Una cuota de cero o negativa no es una cuota.
ALTER TABLE "deudas"
  ADD CONSTRAINT "deudas_monto_cuota_positivo" CHECK ("monto_cuota" > 0);

-- Una deuda sin cuotas no existe; el tope evita errores de tipeo absurdos.
ALTER TABLE "deudas"
  ADD CONSTRAINT "deudas_cuotas_totales_validas"
  CHECK ("cuotas_totales" > 0 AND "cuotas_totales" <= 600);

-- El dia siempre es el primero del mes: la vigencia y las cuotas son mensuales,
-- no diarias. Esto impide que entre una fecha a media altura del mes.
ALTER TABLE "sueldos"
  ADD CONSTRAINT "sueldos_vigente_desde_dia_uno"
  CHECK (EXTRACT(DAY FROM "vigente_desde") = 1);

ALTER TABLE "deudas"
  ADD CONSTRAINT "deudas_primera_cuota_dia_uno"
  CHECK (EXTRACT(DAY FROM "primera_cuota") = 1);
