import { RrppHandoffAction } from '../../comercial/RrppHandoffAction';
import { ContractFinancialFields } from '../../comercial/ContractFinancialFields';
import type { ChangeEvent, ReactNode } from 'react';
import type { EjecucionServicio, EstadoProyecto, FaltanteComercial, PresupuestoServicio } from '../../types/api';
import { conValorLegacyIncluido } from '../../proyectos/campos';
import { SelectorMultipleCondicionesEspeciales } from '../../proyectos/SelectorMultipleCondicionesEspeciales';
import { CommercialReadiness } from '../CommercialReadiness';
import { AuthorContextCard } from '../AuthorContextCard';
import { FALTANTES_COMERCIAL } from '../preparacionComercial';
import { useProjectIntake, OPCIONES_CAPITULOS, OPCIONES_PAGINAS, type ProjectIntakeProps } from './useProjectIntake';

const INPUT = 'min-h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors focus:border-dorado focus:outline-none focus:ring-2 focus:ring-dorado/30';
function Field({ id, label, children, help }: { id: string; label: string; children: ReactNode; help?: string }) {
  return <div className="min-w-0"><label htmlFor={id} className="mb-1.5 block text-xs font-medium text-gray-600">{label}</label>{children}{help && <p className="mt-1 text-[11px] leading-4 text-gray-500">{help}</p>}</div>;
}
function Block({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="mb-5 border-b border-gray-100 pb-5 last:mb-0 last:border-0 last:pb-0"><legend className="mb-3 text-sm font-semibold text-gray-900">{title}</legend>{children}</fieldset>;
}
function Card({ id, title, children, className = '' }: { id?: string; title: string; children: ReactNode; className?: string }) {
  return <section id={id} className={`scroll-mt-4 rounded-lg border border-gray-200 p-4 sm:p-5 ${className}`}><h3 className="mb-3 text-sm font-semibold text-gray-900">{title}</h3>{children}</section>;
}
// Estado mínimo "dónde está el proyecto" después del handoff — Comercial
// no necesita saber qué hace cada área, solo en qué tramo general está.
// Todo derivado de columnas reales (notificadoJefatura/especialistaId/
// estado), nunca de un modelo paralelo inventado.
const ESTADO_MACRO: Partial<Record<EstadoProyecto, string>> = { pausado: 'Pausado', stand_by: 'En stand-by', culminado: 'Culminado', retirado: 'Retirado' };
function estadoActual({ notificadoJefatura, especialistaAsignado, estado }: Pick<ProjectIntakeProps, 'notificadoJefatura' | 'especialistaAsignado' | 'estado'>): string {
  if (estado && ESTADO_MACRO[estado]) return ESTADO_MACRO[estado]!;
  if (!notificadoJefatura) return 'En RRPP';
  if (!especialistaAsignado) return 'En Jefatura';
  return 'En producción editorial';
}
const ORDEN_CAMPOS_COMERCIALES = Object.keys(FALTANTES_COMERCIAL) as FaltanteComercial[];

export function ProjectIntakeSection(props: ProjectIntakeProps) {
  const f = useProjectIntake(props);
  const puedeEnviar = props.puedeNotificarRrpp && !props.notificadoRrpp && props.ficha.listoParaRrpp && !f.cambiosPendientes;
  function change<T extends string>(set: (value: T) => void, reset: () => void) {
    return (event: ChangeEvent<HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement>) => { set(event.target.value as T); reset(); };
  }
  const fechaCierre = f.ingresoFechaCierre ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(f.ingresoFechaCierre)) : 'Pendiente';
  return <form aria-label="Resumen comercial" onSubmit={f.handleGuardarBorrador} className="flex h-full min-h-0 flex-col">
    <div className="shrink-0 border-b border-gray-100 px-5 py-3 sm:px-6">
      <h2 className="text-base font-semibold text-gray-900">Resumen comercial</h2><p className="mt-1 text-xs leading-5 text-gray-500">Qué vendiste, qué falta completar y si el proyecto está listo para RRPP.</p>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
      <CommercialReadiness {...props.ficha} notificadoRrpp={props.notificadoRrpp} rrppEnviadoAt={props.rrppEnviadoAt} />
      <AuthorContextCard autores={props.autores} />
      {f.catalogosQuery.isError && <div role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">No se pudo cargar el catálogo de servicios. <button type="button" onClick={() => { void f.catalogosQuery.refetch(); }} className="font-semibold underline">Reintentar</button></div>}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card id="informacion-comercial" title="Información comercial">
          <Block title="Datos del proyecto">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Field id="proyecto-servicio" label="Tipo de servicio"><select id="proyecto-servicio" required value={f.servicioCodigo} onChange={change(f.setServicioCodigo, f.mutacionServicio.reset)} className={INPUT}>
                {!f.catalogosQuery.data?.servicios.some((s) => s.codigo === props.servicio.codigo) && <option value={props.servicio.codigo}>{props.servicio.codigo} — {props.servicio.nombre}</option>}
                {f.catalogosQuery.data?.servicios.map((s) => <option key={s.id} value={s.codigo}>{s.codigo} — {s.nombre}</option>)}
              </select></Field>
              <Field id="ingreso-fecha-ingreso" label="Fecha de ingreso"><input id="ingreso-fecha-ingreso" type="date" value={f.ingresoFechaIngreso} onChange={change(f.setIngresoFechaIngreso, f.mutacion.reset)} className={INPUT} /></Field>
              {f.servicioCodigo !== 'CR' && <div><p className="mb-1.5 text-xs font-medium text-gray-600">Fecha de cierre estimada</p><p className="py-2 text-sm font-semibold text-gray-900">{fechaCierre}</p><p className="text-[11px] text-gray-500">Calculada según fecha de ingreso y servicio.</p></div>}
            </div>
          </Block>
          {f.servicioCodigo === 'CR' && <Block title="Definido por RRPP"><dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs font-medium text-gray-600">Especificación de Crudo</dt><dd className="mt-2 text-sm font-semibold text-gray-900">{f.ingresoServicioSubtipoCrudo ? `Crudo ${f.ingresoServicioSubtipoCrudo}` : 'Pendiente de RRPP'}</dd>{!f.ingresoServicioSubtipoCrudo && <p className="mt-1 text-xs leading-5 text-gray-500">RRPP definirá si el proyecto corresponde a Crudo Tripa o Crudo Capítulo.</p>}</div>
            <div><dt className="text-xs font-medium text-gray-600">Fecha de cierre estimada</dt><dd className="mt-2 text-sm font-semibold text-gray-900">{f.ingresoServicioSubtipoCrudo ? fechaCierre : 'Pendiente de RRPP'}</dd>{!f.ingresoServicioSubtipoCrudo && <p className="mt-1 text-xs leading-5 text-gray-500">Se calculará cuando RRPP defina la modalidad del servicio.</p>}</div>
          </dl></Block>}
          <Block title="Especificaciones comerciales"><div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Field id="ingreso-servicio-ejecucion" label="Ejecución"><select id="ingreso-servicio-ejecucion" value={f.ingresoServicioEjecucion} onChange={change<EjecucionServicio>(f.setIngresoServicioEjecucion, f.mutacion.reset)} className={INPUT}><option>Normal</option><option>Express</option></select></Field>
            <Field id="ingreso-servicio-alianza" label="Alianza comercial"><select id="ingreso-servicio-alianza" value={f.ingresoServicioAlianza ? 'Sí' : 'No'} onChange={(e) => { f.setIngresoServicioAlianza(e.target.value === 'Sí'); f.mutacion.reset(); }} className={INPUT}><option>No</option><option>Sí</option></select></Field>
            <Field id="ingreso-servicio-presupuesto" label="Presupuesto del servicio (opcional)" help="El presupuesto inicial se define al crear el proyecto."><select id="ingreso-servicio-presupuesto" value={f.ingresoServicioPresupuesto} onChange={change<PresupuestoServicio | ''>(f.setIngresoServicioPresupuesto, f.mutacion.reset)} className={INPUT}><option value="">Sin definir</option><option>Plata</option><option>Oro</option><option>Platinium</option></select></Field>
              {f.ingresoServicioEjecucion === 'Express' && <Field id="ingreso-tiempo-expres-meses" label="Tiempo Exprés (meses)"><input id="ingreso-tiempo-expres-meses" type="number" min={1} required value={f.ingresoTiempoExpresMeses} onChange={change(f.setIngresoTiempoExpresMeses, f.mutacion.reset)} className={INPUT} /></Field>}
          </div></Block>
          <Block title="Condiciones contractuales"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id="capitulos-pactados" label="Cantidad de capítulos pactados" help="Según lo acordado en contrato."><select id="capitulos-pactados" value={f.capitulosPactados} onChange={change(f.setCapitulosPactados, f.mutacionContrato.reset)} className={INPUT}><option value="">Sin definir</option>{conValorLegacyIncluido(OPCIONES_CAPITULOS, f.capitulosPactados).map((v) => <option key={v}>{v}</option>)}</select></Field>
            <Field id="paginas-pactadas" label="Páginas / hojas pactadas" help="Según lo acordado en contrato."><select id="paginas-pactadas" value={f.paginasPactadas} onChange={change(f.setPaginasPactadas, f.mutacionContrato.reset)} className={INPUT}><option value="">Sin definir</option>{conValorLegacyIncluido(OPCIONES_PAGINAS, f.paginasPactadas).map((v) => <option key={v}>{v}</option>)}</select></Field>
            <Field id="criterio-extra" label="Criterio extra (opcional)"><textarea id="criterio-extra" rows={2} value={f.criterioExtra} onChange={change(f.setCriterioExtra, f.mutacionContrato.reset)} className={INPUT} /></Field>
            <Field id="condiciones-especiales" label="Condiciones especiales (opcional)"><SelectorMultipleCondicionesEspeciales value={f.condicionesEspeciales} onChange={(v) => { f.setCondicionesEspeciales(v); f.mutacionContrato.reset(); }} /></Field>
          </div></Block>
          <Block title="Observaciones del ingreso"><Field id="ingreso-observaciones" label="Observaciones del ingreso (opcional)"><textarea id="ingreso-observaciones" rows={3} value={f.ingresoObservaciones} onChange={change(f.setIngresoObservaciones, f.mutacion.reset)} className={INPUT} /></Field></Block>
        </Card>
        <Card title="Pagos"><ContractFinancialFields id={props.proyectoId} /></Card>
      </div>
      <Card title="Entrega a RRPP" className="mt-5">
        <ul className="space-y-1.5 text-sm">
          {ORDEN_CAMPOS_COMERCIALES.map((campo) => {
            const falta = props.ficha.faltantesComercial.includes(campo);
            return <li key={campo} className={falta ? 'text-amber-800' : 'text-green-700'}><span aria-hidden="true">{falta ? '○' : '✓'}</span> {FALTANTES_COMERCIAL[campo]}</li>;
          })}
        </ul>
        {props.notificadoRrpp ? <div className="mt-4 rounded-md bg-green-50 p-3 text-xs leading-5 text-green-800">
          <p className="font-semibold">Entregado a RRPP</p>
          {props.rrppEnviadoAt && <p className="mt-1">Enviado el {new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(props.rrppEnviadoAt))}.</p>}
          <p className="mt-1">RRPP continuará con el diagnóstico inicial del proyecto. La responsabilidad principal ya pasó a su equipo.</p>
          <p className="mt-2 font-medium">Estado actual: {estadoActual(props)}</p>
        </div> : <div className="mt-4">
          {!props.ficha.listoParaRrpp && <p className="mb-2 text-xs text-amber-800">Completa los datos marcados arriba antes de enviar a RRPP.</p>}
          {props.ficha.listoParaRrpp && f.cambiosPendientes && <p className="mb-2 text-xs text-amber-800">Guarda los cambios antes de enviar a RRPP.</p>}
          <RrppHandoffAction proyectoId={props.proyectoId} disponible={puedeEnviar} disabled={f.guardando || !!props.actualizando} />
        </div>}
      </Card>
    </div>
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white px-5 py-3 sm:px-6">
      <div className="min-w-0 flex-1 text-xs"><p className="text-gray-500">{f.cambiosPendientes ? 'Cambios sin guardar' : 'Guardado manual'}</p>{f.guardadoOk && <p role="status" className="mt-1 text-green-700">Cambios guardados.</p>}{f.huboError && <p role="alert" className="mt-1 break-words text-red-700">No se pudo guardar{f.errorMensaje ? `: ${f.errorMensaje}` : '.'}</p>}</div>
      <button type="submit" disabled={f.guardando || f.catalogosQuery.isLoading} className="min-h-11 shrink-0 rounded-lg bg-dorado px-4 py-2.5 text-sm font-semibold text-tinta transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 disabled:opacity-60">{f.guardando ? 'Guardando…' : 'Guardar cambios'}</button>
    </footer>
  </form>;
}
