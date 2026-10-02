import { PLATAFORMAS_REDES_SOCIALES, type FilaRedSocial, type PlataformaRedSocial } from './redesSocialesForm';

const ICONO_CERRAR = 'M6 18L18 6M6 6l12 12';

// Lista dinámica (una fila por red que el usuario decide agregar) en vez
// de los seis inputs fijos de antes — ver redesSocialesForm.ts para el
// mapeo hacia/desde el objeto plano que sigue mandando el payload sin
// cambios. Cada plataforma solo puede usarse una vez: el <select> de
// cada fila oculta las que ya están en otra fila (opcionesPara), y el
// botón "+ Añadir" desaparece cuando las 6 ya están en uso.
export function SocialNetworksSection({ filas, onChange }: { filas: FilaRedSocial[]; onChange: (filas: FilaRedSocial[]) => void }) {
  const plataformasUsadas = new Set(filas.map((f) => f.plataforma));
  const hayDisponibles = plataformasUsadas.size < PLATAFORMAS_REDES_SOCIALES.length;

  function agregarFila() {
    const disponible = PLATAFORMAS_REDES_SOCIALES.find((p) => !plataformasUsadas.has(p.id));
    if (!disponible) return;
    onChange([...filas, { id: crypto.randomUUID(), plataforma: disponible.id, valor: '' }]);
  }

  function actualizarFila(id: string, cambios: Partial<FilaRedSocial>) {
    onChange(filas.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  function quitarFila(id: string) {
    onChange(filas.filter((f) => f.id !== id));
  }

  function opcionesPara(plataformaActual: PlataformaRedSocial) {
    return PLATAFORMAS_REDES_SOCIALES.filter((p) => p.id === plataformaActual || !plataformasUsadas.has(p.id));
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Redes sociales</h4>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Opcional</span>
      </div>

      {filas.length > 0 && (
        <div className="mb-4 space-y-2.5">
          {filas.map((fila) => {
            const plataforma = PLATAFORMAS_REDES_SOCIALES.find((p) => p.id === fila.plataforma)!;
            return (
              <div key={fila.id} className="flex gap-2">
                <select
                  aria-label="Red social"
                  value={fila.plataforma}
                  onChange={(event) => actualizarFila(fila.id, { plataforma: event.target.value as PlataformaRedSocial })}
                  className="w-32 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40 sm:w-36"
                >
                  {opcionesPara(fila.plataforma).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.etiqueta}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label={`Usuario de ${plataforma.etiqueta}`}
                  placeholder={plataforma.placeholder ?? 'usuario'}
                  value={fila.valor}
                  onChange={(event) => actualizarFila(fila.id, { valor: event.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40"
                />
                <button
                  type="button"
                  onClick={() => quitarFila(fila.id)}
                  aria-label={`Quitar ${plataforma.etiqueta}`}
                  className="flex w-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={ICONO_CERRAR} />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {hayDisponibles && (
        <button
          type="button"
          onClick={agregarFila}
          className="rounded-lg border border-dashed border-gray-300 px-3.5 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-dorado hover:text-dorado focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorado/40"
        >
          + Añadir red social
        </button>
      )}
    </div>
  );
}
