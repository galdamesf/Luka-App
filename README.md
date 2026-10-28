# Control de gastos

App para llevar los gastos mensuales del hogar. Next.js 15 + TypeScript +
Tailwind 4, con los datos en PostgreSQL.

## Lo que necesitas

- Node 20 o superior (probado con 22)
- Docker, para levantar Postgres

## Para echarlo a andar

```bash
npm install

cp .env.example .env        # ya viene apuntando al Postgres de docker
npm run db:up               # levanta Postgres en el puerto 5433
npm run db:migrate          # crea las tablas
npm run db:seed             # carga las 13 categorias base
npm run dev                 # http://localhost:3000
```

El puerto es **5433**, no 5432, para no chocar con un Postgres que ya tengas
instalado en la maquina.

**Docker Desktop tiene que estar corriendo** antes de `npm run db:up`. Si la
migracion falla con `P1001: Can't reach database server`, es eso: no hay Postgres
escuchando. `docker compose ps` te dice si el contenedor quedo `healthy`.

## Comandos

| Comando | Para que |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de produccion |
| `npm run typecheck` | Revisa los tipos sin compilar |
| `npm run test` | Todos los tests |
| `npm run test:unit` | Solo logica pura: rapido, sin base de datos |
| `npm run test:db` | Solo integracion contra Postgres |
| `npm run db:up` / `db:down` | Prende y apaga Postgres (`up` espera a que quede sano) |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Carga o actualiza las categorias base |
| `npm run db:studio` | Explorador visual de la base |
| `npm run db:reset` | Borra todo y vuelve a migrar y sembrar |

Los tests van separados en dos proyectos a proposito: mientras trabajas en una
seccion corres solo la que toca con `test:unit` o `test:db`, en vez de la suite
completa.

Los tests de integracion **no tocan tu base de trabajo**. Usan
`control_gastos_test`, que se crea sola la primera vez, y truncan las tablas
entre tests.

## Decisiones que conviene saber

**Los montos son enteros.** El peso chileno no tiene decimales, asi que `monto`
es `Int` en pesos. Ademas evita arrastrar `Decimal`, que no serializa directo
entre servidor y cliente en Next.js. Hay un `CHECK (monto > 0)` en la base: un
gasto de cero no es un gasto.

**Las fechas son `DATE`, sin hora.** Esto trae una trampa real: en Chile
(UTC−3) la medianoche UTC del 1 de octubre cae el 30 de septiembre. Si formateas
con `getDate()` el dia se corre uno hacia atras. Por eso todo pasa por
`src/lib/fecha.ts`, que construye y lee siempre en UTC. Hay un test que deja el
error a la vista: `isoDesdeFecha` da `2026-10-01` donde los metodos locales dan
`2026-09-30`.

**Los rangos de mes son semiabiertos**, `[desde, hasta)`. Asi la consulta es
`fecha >= 2026-10-01 AND fecha < 2026-11-01` y no hay que calcular el ultimo dia
del mes ni preocuparse de febrero.

**Las categorias no se borran, se desactivan.** La llave foranea es
`ON DELETE RESTRICT`, asi que una categoria con gastos no se puede eliminar y
queda historia consistente. Para sacarla de la vista se pone `activa = false`.

**`SUM` de un mes vacio devuelve `NULL`, no 0.** La capa de dominio lo
normaliza; si consultas la base a mano, tenlo presente.

**El dominio no conoce Prisma.** `src/dominio/` recibe datos planos y devuelve
datos planos. Eso permite probar toda la logica de calculo y validacion sin
levantar Postgres, y es lo que hace que `test:unit` corra en un segundo.

**Las funciones de `src/datos/` reciben el cliente por parametro**, con el
singleton por omision. Asi los tests de integracion le pasan el cliente que
apunta a la base `_test` y nunca tocan la base de trabajo.

**El informe se reparte por bloques de siete dias, no por semanas de
calendario.** "Primeros siete dias, segundos siete" se alinea con como llega y
se gasta la plata, y no cambia de forma segun en que dia de la semana caiga
el 1.

**Cuando no hay con que comparar, la variacion es `null`, no cero ni infinito.**
Un mes anterior sin gastos no significa que subiste un 100%: significa que no
hay comparacion, y la interfaz lo dice asi.

**La tabla de gastos del informe es de solo lectura.** El boton de eliminar
solo se dibuja cuando se le pasa una accion: ofrecer un boton que no hace lo
que dice es peor que no ofrecerlo.

**Una cuenta pagada se convierte en gasto, en una transaccion.** Al marcarla
pagada se crea el Gasto con la fecha real de pago y la categoria de la cuenta,
y las dos cosas quedan o no queda ninguna. Asi se anota una sola vez y el total
del mes cuadra solo. El monto se puede corregir al pagar: la cuenta de la luz
nunca llega igual a lo presupuestado.

El gasto queda en el mes en que se **pago**, no en el mes de la cuenta. Una
cuenta de septiembre pagada en octubre sale en los gastos de octubre, que es
cuando salio la plata.

**Las cuentas mensuales se regeneran al abrir el mes.** Se copian las del mes
anterior marcadas `mensual`, con el monto que de verdad se pago, que es mejor
referencia que el original. Es idempotente gracias al indice unico
`(nombre, mes)`: recargar la pagina o tener dos pestanas abiertas no duplica
nada.

**Las fotos de boletas van en `boletas/`, fuera del repositorio.** Tres reglas
que importan porque eso recibe archivos de afuera: el nombre lo genera el
servidor y el del navegador no se usa ni para derivarlo; antes de guardar se
miran los primeros bytes, porque el tipo declarado se puede mentir; y al
servir, el nombre pedido tiene que calzar con el patron exacto que generamos.

Para respaldar hace falta copiar `boletas/` ademas de la base. Si borras esa
carpeta, las fotos se pierden aunque la base siga intacta.

**El sueldo se guarda por vigencia, no como un monto editable.** Cada vez que
cambia se agrega una fila con el mes desde el que rige, y para un mes dado vale
la mas reciente que no sea posterior. Asi un aumento en marzo no reescribe lo
que ganabas en febrero, y el historial de meses viejos sigue siendo cierto.

**Las deudas guardan el mes de la PRIMERA cuota, no "cuotas pagadas".** Las dos
cosas son equivalentes, pero el mes no se pone viejo: en noviembre la app sola
sabe que vas una cuota mas adelante, sin que tengas que marcar nada cada mes.
El costo es que asume que las cuotas se pagan al dia, que para planificar el mes
es lo correcto: la cuota te la van a cobrar igual.

**Una cuota NO se registra tambien como gasto.** Las cuotas se calculan aparte
desde las deudas; si ademas la anotas como gasto, se cuenta dos veces.

**Los colores de categoria tienen que rendir en los dos modos.** La misma
barra se dibuja sobre fondo claro y sobre fondo oscuro, asi que cada color
necesita 3:1 contra ambos. Eso obliga a una banda de luminancia estrecha (mas o
menos 0.15 a 0.30), que descarta tanto los tonos 700 como los 400. Hay un test
que lo verifica categoria por categoria.

**La tabla de gastos se renderiza dos veces**: tarjetas en celular, tabla en
escritorio. La alternativa era scroll horizontal, y ahi el monto —lo que uno
viene a mirar— queda fuera de pantalla. La version oculta usa `display:none`,
asi que el lector de pantalla tampoco la anuncia dos veces.

**Un archivo `"use server"` solo puede exportar funciones async.** Por eso el
tipo y el estado inicial del formulario viven en `src/dominio/formulario.ts` y
no junto a las acciones: exportar una constante desde ahi rompe el build.

**El promedio diario del mes en curso divide por dias transcurridos**, no por
los del mes completo: dividir $300.000 por 31 un dia 5 daria una cifra sin
sentido. El resumen expone `diasConsiderados` para poder explicarlo en pantalla.

## Sobre las dependencias

`npm audit` deja **3 avisos altos** que no se pueden cerrar hoy, y es a
proposito:

`deepmerge-ts` -> `@prisma/config` -> `prisma`. El aviso es agotamiento de pila
al combinar objetos recursivos
([GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)). Se
corrige en deepmerge-ts 8, pero `@prisma/config` lo fija exacto en 7.1.5 y
Prisma solo lo sube en la version 8, que esta en release candidate.

Se deja asi porque en la practica el riesgo es nulo: lo unico que `@prisma/config`
combina es nuestro propio `prisma.config.ts`, que es un objeto plano y no viene
de ninguna parte externa. Ademas `prisma` es dependencia de desarrollo, no entra
al bundle de la app. Forzar el salto de major sobre una dependencia pineada
agrega mas riesgo del que saca.

Lo que si se arreglo:

- **zod 4.6.7** en vez de 3.x. El aviso de agotamiento de memoria al validar
  colecciones grandes si importa, porque zod valida entrada del usuario. Salio
  gratis porque todavia no hay codigo que lo use.
- **vitest 5** en vez de 2. Cierra las dos criticas (servidor de la UI y
  `tinypool`).
- **postcss forzado a 8.5.x** con `overrides`. Next 15.5.28 fija internamente
  postcss 8.4.31, que es vulnerable; el override lo sube en todo el arbol.

El `package-lock.json` no viene en el repo a proposito: se genero en Linux y le
faltaban los binarios opcionales de Apple Silicon. Lo crea tu `npm install`.

## Estructura

```
prisma/
  schema.prisma      Modelos: Categoria, Gasto, enum MedioPago
  seed.ts            13 categorias base, idempotente (upsert por nombre)
src/
  app/
    acciones/        Server Actions (crear y eliminar gastos)
  componentes/       Interfaz. Los de presentacion reciben datos planos
    iconos.ts        Trazados SVG como datos (sin dependencia de iconos)
    Icono.tsx        Los dibuja
  dominio/           Logica pura: no importa Prisma, se prueba sin base de datos
    esquemas.ts      Validacion con Zod y mensajes en espanol
    resumen.ts       Agregacion mensual por categoria
    balance.ts       Secuencia del mes y calculo de cuotas
    cuentas.ts       Cuentas por pagar: vencimientos y regeneracion mensual
    informe.ts       Comparacion entre meses, medios de pago y reparto semanal
    categorias-base.ts  Las 13 categorias y su paleta
    formulario.ts    Tipos del estado de los formularios
  datos/             Acceso a Prisma. Recibe el cliente por parametro
    gastos.ts
    categorias.ts
  lib/
    prisma.ts        Cliente singleton, para no agotar el pool en dev
    fecha.ts         Helpers de fecha UTC y rangos de mes
    dinero.ts        Formateo y parseo de pesos
    env.ts           Carga de .env (Prisma y Vitest no lo hacen solos)
    url-db.ts        Deriva la URL de la base de pruebas
    contraste.ts     Calculo de contraste WCAG, usado por los tests del tema
    boletas.ts       Guardado seguro de las fotos de boletas
tests/
  unit/              Logica pura
  db/                Integracion contra Postgres
```

## Estado

- [x] Seccion 1: base, esquema, migracion y seed
- [x] Seccion 2: API y logica de dominio
- [x] Seccion 3: interfaz del dashboard
- [x] Seccion 4: sueldo, deudas en cuotas y balance mensual
- [x] Seccion 5: cuentas por pagar y fotos de boletas
- [x] Seccion 6: navbar e informe mensual
- [ ] Seccion 7: login con Google y autoria
- [ ] Seccion 8: despliegue (y mover las boletas a object storage)
- [ ] Seccion 9: resumen diario por correo
- [ ] Mas adelante: presupuestos por categoria
