import { EtiquetasPersonalidad } from './EtiquetasPersonalidad';

const LABEL_CLASS = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500';
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

export function AuthorProfileSection({
  personalidad,
  ocupacion,
  onCambiar,
}: {
  personalidad: string[];
  ocupacion: string;
  onCambiar: (cambios: { personalidad?: string[]; ocupacion?: string }) => void;
}) {
  return (
    <div>
      <h4 className="mb-5 text-sm font-semibold text-gray-900">Perfil del autor</h4>
      <div className="space-y-5">
        <div>
          <label htmlFor="autor-personalidad-entrada" className={LABEL_CLASS}>
            Personalidad
          </label>
          <EtiquetasPersonalidad value={personalidad} onChange={(etiquetas) => onCambiar({ personalidad: etiquetas })} />
        </div>

        <div>
          <label htmlFor="autor-ocupacion" className={LABEL_CLASS}>
            ¿A qué se dedica?
          </label>
          <textarea
            id="autor-ocupacion"
            rows={3}
            value={ocupacion}
            onChange={(event) => onCambiar({ ocupacion: event.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      </div>
    </div>
  );
}
