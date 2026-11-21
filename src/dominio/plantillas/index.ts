import { PLANTILLAS_BANCOESTADO } from "./bancoestado";
import { PLANTILLAS_BSALE } from "./bsale";
import { PLANTILLAS_CONSORCIO } from "./consorcio";
import { PLANTILLAS_LIDER } from "./lider";
import type { Plantilla } from "./motor";
import { PLANTILLAS_SANTANDER } from "./santander";

export { calzaRemitente, leerConPlantillas, sacarCampo } from "./motor";
export type { Campo, Plantilla, PlantillaDeDescarte, PlantillaDeLectura, ResultadoDePlantillas } from "./motor";

/**
 * Las plantillas escritas a mano, en orden: la primera que calza decide. Para
 * agregar un banco o una tienda: un archivo como santander.ts, sus ejemplos en
 * tests/fixtures/comprobantes/<remitente>/ y su caso en tests/unit/plantillas.test.ts.
 */
export const PLANTILLAS: readonly Plantilla[] = [
  ...PLANTILLAS_SANTANDER,
  ...PLANTILLAS_CONSORCIO,
  ...PLANTILLAS_BANCOESTADO,
  ...PLANTILLAS_LIDER,
  ...PLANTILLAS_BSALE,
];
