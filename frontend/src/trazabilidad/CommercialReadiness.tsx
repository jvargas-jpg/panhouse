import type { PreparacionComercial } from '../types/api';
import { resumenFaltantes } from './preparacionComercial';
export function CommercialReadiness({ listoParaRrpp, faltantesComercial }: PreparacionComercial) {
  return <div role="status" className={`mb-5 rounded-lg border p-3 text-xs leading-5 ${listoParaRrpp ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
    <p className="font-semibold">{listoParaRrpp ? 'Ingreso comercial completo' : 'Información pendiente'}</p>
    <p>{listoParaRrpp ? 'Este proyecto ya cuenta con la información requerida por Comercial y está listo para RRPP.' : 'Completa los datos requeridos antes de que el proyecto quede listo para RRPP.'}</p>
    {!listoParaRrpp && <p className="mt-1">Falta completar: {resumenFaltantes(faltantesComercial)}</p>}
  </div>;
}
