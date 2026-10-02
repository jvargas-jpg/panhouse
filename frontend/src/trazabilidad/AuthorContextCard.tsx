import type { AutorConPerfil } from '../types/api';
import { CategoriaBadge } from '../autores/CategoriaBadge';

export function AuthorContextCard({ autores }: { autores: AutorConPerfil[] }) {
  if (!autores.length) return null;
  return <div aria-label="Contexto de autoría" className="mb-4 border-b border-gray-100 pb-3">
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{autores.length === 1 ? 'Autor' : 'Autores'}</p>
    <div className="flex flex-wrap gap-x-8 gap-y-3">{autores.map((autor) => <div key={autor.id} className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dorado/10 text-[11px] font-semibold text-amber-800">{autor.nombre.trim().split(/\s+/).slice(0, 2).map((v) => v[0]).join('').toLocaleUpperCase('es')}</span>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-words text-sm font-semibold text-gray-900">{autor.nombre}</p><CategoriaBadge categoria={autor.categoria} /></div>
        <p className="mt-0.5 break-words text-xs leading-5 text-gray-500">{[autor.nombreArtistico ? `Nombre artístico: ${autor.nombreArtistico}` : null, autor.pais].filter(Boolean).join(' · ')}</p>
      </div>
    </div>)}</div>
  </div>;
}
