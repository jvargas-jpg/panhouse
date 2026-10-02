import type { FichaCompleta } from '../types/api';
import { CommercialReadiness } from './CommercialReadiness';
export function CommercialTraceabilitySummary({ ficha }: { ficha: FichaCompleta }) {
  return <section className="h-full overflow-y-auto p-5 sm:p-6">
    <h2 className="mb-4 text-base font-semibold text-gray-900">Resumen de la ficha</h2>
    <CommercialReadiness {...ficha} />
    <p className="mb-5 text-sm leading-6 text-gray-500">La ficha continuará siendo completada por otras áreas. La preparación comercial indica que tus datos están completos; la entrega formal se gestiona por separado.</p>
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div><dt className="text-xs text-gray-500">Capítulos pactados</dt><dd className="mt-1 font-medium">{ficha.capitulosPactados || 'Sin definir'}</dd></div>
      <div><dt className="text-xs text-gray-500">Páginas pactadas</dt><dd className="mt-1 font-medium">{ficha.paginasPactadas || 'Sin definir'}</dd></div>
    </dl>
  </section>;
}
