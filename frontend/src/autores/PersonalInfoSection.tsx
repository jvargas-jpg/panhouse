import type { CategoriaCliente } from '../types/api';
import { PAISES } from './paises';
import { SelectorMultipleNacionalidades } from './SelectorMultipleNacionalidades';

const LABEL_CLASS = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500';
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

export function PersonalInfoSection({
  nombre,
  nombreArtistico,
  categoria,
  pais,
  nacionalidad,
  fechaNacimiento,
  onCambiar,
}: {
  nombre: string;
  nombreArtistico: string;
  categoria: CategoriaCliente;
  pais: string;
  nacionalidad: string[];
  fechaNacimiento: string;
  onCambiar: (cambios: {
    nombre?: string;
    nombreArtistico?: string;
    categoria?: CategoriaCliente;
    pais?: string;
    nacionalidad?: string[];
    fechaNacimiento?: string;
  }) => void;
}) {
  return (
    <div>
      <h4 className="mb-5 text-sm font-semibold text-gray-900">Información personal</h4>
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="autor-nombre" className={LABEL_CLASS}>
            Nombre completo <span className="text-red-400">*</span>
          </label>
          <input
            id="autor-nombre"
            type="text"
            required
            value={nombre}
            onChange={(event) => onCambiar({ nombre: event.target.value })}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="autor-nombre-artistico" className={LABEL_CLASS}>
            Nombre artístico
          </label>
          <input
            id="autor-nombre-artistico"
            type="text"
            value={nombreArtistico}
            onChange={(event) => onCambiar({ nombreArtistico: event.target.value })}
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="autor-categoria" className={LABEL_CLASS}>
            Categoría
          </label>
          <select
            id="autor-categoria"
            value={categoria}
            onChange={(event) => onCambiar({ categoria: event.target.value as CategoriaCliente })}
            className={INPUT_CLASS}
          >
            <option value="Estándar">Estándar</option>
            <option value="VIP">VIP</option>
          </select>
        </div>

        <div>
          <label htmlFor="autor-pais" className={LABEL_CLASS}>
            País de ubicación
          </label>
          <select id="autor-pais" value={pais} onChange={(event) => onCambiar({ pais: event.target.value })} className={INPUT_CLASS}>
            <option value="">Sin definir</option>
            {PAISES.map((nombrePais) => (
              <option key={nombrePais} value={nombrePais}>
                {nombrePais}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="autor-nacionalidad" className={LABEL_CLASS}>
            Nacionalidad
          </label>
          <SelectorMultipleNacionalidades value={nacionalidad} onChange={(nacionalidades) => onCambiar({ nacionalidad: nacionalidades })} />
        </div>

        <div>
          <label htmlFor="autor-fecha-nacimiento" className={LABEL_CLASS}>
            Fecha de nacimiento
          </label>
          <input
            id="autor-fecha-nacimiento"
            type="date"
            value={fechaNacimiento}
            onChange={(event) => onCambiar({ fechaNacimiento: event.target.value })}
            className={INPUT_CLASS}
          />
        </div>
      </div>
    </div>
  );
}
