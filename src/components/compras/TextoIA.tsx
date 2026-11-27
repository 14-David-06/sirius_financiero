import type { ReactNode } from 'react';

/** **negrita** y *cursiva* dentro de una línea. React escapa el texto, no se inyecta HTML. */
function enLinea(texto: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((parte, i) => {
    if (/^\*\*[^*]+\*\*$/.test(parte)) {
      return <strong key={i} className="font-semibold text-slate-100">{parte.slice(2, -2)}</strong>;
    }
    if (/^\*[^*\s][^*]*\*$/.test(parte)) {
      return <em key={i} className="text-slate-400">{parte.slice(1, -1)}</em>;
    }
    return parte;
  });
}

/**
 * La interpretación de la IA llega en Markdown sencillo (negritas, viñetas, títulos).
 * Se convierte a elementos en vez de mostrar los asteriscos y guiones tal cual.
 */
export default function TextoIA({ texto }: { texto: string }) {
  const bloques: ReactNode[] = [];
  let lista: string[] = [];

  const cerrarLista = () => {
    if (lista.length === 0) return;
    const elementos = lista;
    bloques.push(
      <ul key={`lista-${bloques.length}`} className="list-disc space-y-1 pl-5 marker:text-slate-500">
        {elementos.map((elemento, i) => (
          <li key={i}>{enLinea(elemento)}</li>
        ))}
      </ul>
    );
    lista = [];
  };

  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    const vineta = limpia.match(/^[-•*]\s+(.*)$/);
    if (vineta) {
      lista.push(vineta[1]);
      continue;
    }
    cerrarLista();
    if (!limpia) continue;
    const titulo = limpia.match(/^#{1,4}\s+(.*)$/);
    bloques.push(
      <p key={`p-${bloques.length}`} className={titulo ? 'pt-1 font-semibold text-slate-100' : undefined}>
        {enLinea(titulo ? titulo[1] : limpia)}
      </p>
    );
  }
  cerrarLista();

  return <div className="space-y-2 text-sm leading-relaxed text-slate-300">{bloques}</div>;
}
