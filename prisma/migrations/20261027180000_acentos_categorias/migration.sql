-- Corrige los acentos de tres categorias base.
--
-- Por que una migracion y no el seed: el seed hace upsert por `nombre`, asi
-- que al cambiar el nombre crearia una categoria nueva y dejaria la vieja
-- huerfana, con los gastos colgando de ella. Renombrar es lo correcto.
--
-- El NOT EXISTS evita chocar con el indice unico de `nombre` si alguien ya
-- tiene la version acentuada.

UPDATE "categorias" SET "nombre" = 'Internet y teléfono'
WHERE "nombre" = 'Internet y telefono'
  AND NOT EXISTS (SELECT 1 FROM "categorias" c WHERE c."nombre" = 'Internet y teléfono');

UPDATE "categorias" SET "nombre" = 'Educación'
WHERE "nombre" = 'Educacion'
  AND NOT EXISTS (SELECT 1 FROM "categorias" c WHERE c."nombre" = 'Educación');

UPDATE "categorias" SET "nombre" = 'Entretención'
WHERE "nombre" = 'Entretencion'
  AND NOT EXISTS (SELECT 1 FROM "categorias" c WHERE c."nombre" = 'Entretención');
