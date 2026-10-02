import { EtiquetasCorreos } from './EtiquetasCorreos';
import { SelectorCodigoTelefonico } from './SelectorCodigoTelefonico';

const LABEL_CLASS = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500';
const INPUT_CLASS =
  'w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-dorado focus:bg-white focus:ring-2 focus:ring-dorado/40';

export function ContactSection({
  email,
  telefonoCodigo,
  telefonoNumero,
  onCambiar,
}: {
  email: string[];
  telefonoCodigo: string;
  telefonoNumero: string;
  onCambiar: (cambios: { email?: string[]; telefonoCodigo?: string; telefonoNumero?: string }) => void;
}) {
  return (
    <div>
      <h4 className="mb-5 text-sm font-semibold text-gray-900">Contacto</h4>
      <div className="space-y-5">
        <div>
          <label htmlFor="autor-email-entrada" className={LABEL_CLASS}>
            Correo
          </label>
          <EtiquetasCorreos value={email} onChange={(correos) => onCambiar({ email: correos })} />
        </div>

        <div>
          <label htmlFor="autor-telefono-numero" className={LABEL_CLASS}>
            Teléfono
          </label>
          <div className="flex gap-2">
            <SelectorCodigoTelefonico value={telefonoCodigo} onChange={(codigo) => onCambiar({ telefonoCodigo: codigo })} />
            <input
              id="autor-telefono-numero"
              type="tel"
              inputMode="tel"
              placeholder="424-1495423"
              value={telefonoNumero}
              onChange={(event) => {
                // Bloqueo activo: cualquier carácter que no sea dígito,
                // guion o espacio se descarta antes de llegar al estado —
                // cubre teclado, autocompletar y pegar (a diferencia de
                // interceptar onKeyDown, que solo detiene teclas
                // físicas). El "+" no aplica acá (vive en el selector de
                // código); construirTelefono limpia guiones/espacios al
                // armar el payload.
                onCambiar({ telefonoNumero: event.target.value.replace(/[^0-9\-\s]/g, '') });
              }}
              className={`${INPUT_CLASS} flex-1`}
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">Omite el 0 inicial de tu operadora</p>
        </div>
      </div>
    </div>
  );
}
