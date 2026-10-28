-- Un gasto de cero o negativo no es un gasto.
--
-- Esta restriccion va en su propia migracion porque Prisma no modela CHECK
-- constraints en schema.prisma. Al quedar dentro del historial de migraciones,
-- forma parte del esquema esperado y `migrate dev` no la reporta como drift.
--
-- La validacion de entrada tambien ocurre en la capa de dominio con Zod, pero
-- esta es la que no se puede saltar: aplica a cualquier escritura, incluso a un
-- INSERT hecho a mano desde psql.
ALTER TABLE "gastos"
  ADD CONSTRAINT "gastos_monto_positivo" CHECK ("monto" > 0);
