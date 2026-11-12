import { getDocumentProxy } from 'unpdf';

/**
 * Texto del PDF con el mismo formato que el nodo "Extract from File" de n8n,
 * del que dependen los parsers de extractos: los fragmentos se concatenan sin
 * separador y se inserta un salto de línea cada vez que cambia la coordenada Y.
 * Las páginas se unen con una línea en blanco.
 */
export async function extraerTextoPdf(contenido: Buffer): Promise<string> {
  const documento = await getDocumentProxy(new Uint8Array(contenido));
  const paginas: string[] = [];

  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero);
    const { items } = await pagina.getTextContent();

    let ultimaY: number | undefined;
    const partes: string[] = [];
    for (const item of items) {
      if (!('str' in item)) continue;
      const y = item.transform[5];
      partes.push(ultimaY === y || !ultimaY ? item.str : `\n${item.str}`);
      ultimaY = y;
    }
    paginas.push(partes.join(''));
  }

  return paginas.join('\n\n');
}
