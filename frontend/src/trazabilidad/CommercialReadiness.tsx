import type { PreparacionComercial } from '../types/api';
import { resumenFaltantes } from './preparacionComercial';
export function CommercialReadiness({ listoParaRrpp, faltantesComercial, notificadoRrpp = false, rrppEnviadoAt }: PreparacionComercial & { notificadoRrpp?: boolean; rrppEnviadoAt?: string | null }) {
  return <div role="status" className={`mb-5 rounded-lg border p-3 text-xs leading-5 ${notificadoRrpp || listoParaRrpp ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
    <p className="font-semibold">{notificadoRrpp ? '✓ Proyecto enviado a RRPP' : listoParaRrpp ? '✓ Ingreso comercial completo' : 'Información pendiente'}</p>
    <p>{notificadoRrpp ? 'RRPP ya recibió este proyecto para continuar el flujo editorial.' : listoParaRrpp ? 'Este proyecto ya cuenta con la información requerida por Comercial y está listo para RRPP.' : 'Completa los datos requeridos antes de que el proyecto quede listo para RRPP.'}</p>
    {notificadoRrpp && rrppEnviadoAt && <p className="mt-1">Enviado el {new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(rrppEnviadoAt))}</p>}
    {!notificadoRrpp && !listoParaRrpp && <p className="mt-1">Falta completar: {resumenFaltantes(faltantesComercial)}</p>}
  </div>;
}
