/**
 * Un texto de la guia, con lo que va entre «comillas» resaltado: son nombres
 * de cosas que se ven en la pantalla (un boton, un titulo), y resaltados se
 * encuentran mas rapido al leer.
 */
export function TextoGuia({ texto }: { texto: string }) {
  const partes = texto.split(/(«[^»]+»)/);
  return (
    <>
      {partes.map((parte, i) =>
        parte.startsWith("«") && parte.endsWith("»") ? (
          <span key={i} className="font-semibold whitespace-nowrap text-texto">
            {parte}
          </span>
        ) : (
          parte
        ),
      )}
    </>
  );
}
