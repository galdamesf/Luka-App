import { renderSVG } from "uqr";

/**
 * Un codigo QR como SVG, para dibujarlo en el servidor (la clave de la app
 * no pasa por ningun servicio de afuera). Negro sobre blanco siempre, tambien
 * en el tema oscuro: las camaras leen mejor asi. Con bordes nitidos: sin eso,
 * el navegador suaviza las uniones entre cuadritos y quedan rayas grises.
 */
export function qrEnSvg(texto: string): string {
  const svg = renderSVG(texto, { ecc: "M", border: 2, pixelSize: 6, whiteColor: "#FFFFFF", blackColor: "#000000" });
  return svg.replace("<svg ", '<svg shape-rendering="crispEdges" ');
}
