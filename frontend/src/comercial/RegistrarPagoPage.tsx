import { Dialog as SharedDialog } from '../design-system/Dialog';
import { StatusBadge } from '../design-system/components';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { CrmSidebarLayout } from '../layout/CrmSidebarLayout';
import { ComercialSidebarNav } from './ComercialSidebarNav';
import { fetchFinancialDetail, fetchFinancialProjects, paymentAction, paymentKeys, type FinancialDetail, type FinancialProject } from './financialApi';
import { METODOS_PAGO, ROLES_CONFIRMACION_PAGOS, ROLES_LECTURA_PAGOS, ROLES_REGISTRO_PAGOS } from '../../../shared/pagos';
import './pagos.css';
import { ContractFinancialFields } from './ContractFinancialFields';

export const paymentMoney = (value: string | null, currency: string | null) => value == null ? '—' : currency
  ? new Intl.NumberFormat('es-VE', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 }).format(Number(value))
  : new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(Number(value));
const date = (v: string | null) => v ? new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(v)) : '—';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
const has = (roles: readonly string[], role?: string) => !!role && roles.includes(role);
function PaymentIcon({ index }: { index: number }) {
  const paths = ['M6 5c0-3 12-3 12 0s-12 3-12 0zm0 0v14c0 3 12 3 12 0V5M6 10c0 3 12 3 12 0M6 15c0 3 12 3 12 0', 'M12 8v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0', 'M5 12l4 4L19 6', 'M7 10V6a5 5 0 0110 0v4M6 10h12v11H6zM12 14v3'];
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={paths[index]} strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function Badge({children}:{children:string}){return <StatusBadge>{children}</StatusBadge>;}
function Progress({ value }: { value: string | null }) {
  return <div className="pay-progress"><span>{value == null ? 'Sin porcentaje' : `${Number(value).toLocaleString('es')}%`}</span><div role="progressbar" aria-label="Porcentaje del contrato pagado" aria-valuenow={value == null ? undefined : Math.min(Number(value),100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(Number(value ?? 0),100)}%` }}/></div></div>;
}
export function PaymentDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <SharedDialog title={title} onClose={onClose} className="pay-dialog">{children}</SharedDialog>;}
function Failure({ error, retry }: { error: unknown; retry: () => void }) {
  return <div className="pay-message" role="alert"><p>{error instanceof Error ? error.message : 'No se pudo consultar la información.'}</p><button className="pay-secondary" onClick={retry}>Reintentar</button></div>;
}

function RegisterPayment({ initial, admin, onClose, onDone }: { initial?: FinancialProject; admin: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [search,setSearch] = useState(''), [selected,setSelected] = useState(initial ?? null);
  const [amount,setAmount] = useState(''), [currency,setCurrency] = useState(initial?.currency ?? 'USD');
  const [paidAt,setPaidAt] = useState(today()), [method,setMethod] = useState<string>(METODOS_PAGO[0]);
  const [reference,setReference] = useState(''), [receipt,setReceipt] = useState(''), [notes,setNotes] = useState(''), [reason,setReason] = useState('');
  const key = useRef(crypto.randomUUID()), locked = useRef(false);
  const options = useQuery({ queryKey: ['payments','selector',search], queryFn: () => fetchFinancialProjects(new URLSearchParams({ search, pageSize: '8' }).toString()), enabled: !selected });
  const mutation = useMutation({ mutationFn: () => paymentAction('', { proyectoId: selected!.id, monto: amount, moneda: selected!.currency ?? currency,
    fechaPago: paidAt, metodoPago: method, referencia: reference || null, comprobanteUrl: receipt || null, notas: notes || null,
    idempotencyKey: key.current, ...(admin ? { motivoAdministrativo: reason } : {}) }), onSuccess: async () => { await onDone(); onClose(); }, onSettled: () => { locked.current = false; } });
  const close = () => { if (!mutation.isPending) onClose(); };
  return <PaymentDialog title="Registrar pago" onClose={close}><form onSubmit={e => { e.preventDefault(); if (locked.current || !selected) return; locked.current = true; mutation.mutate(); }}>
    <p className="pay-muted">Registra únicamente pagos recibidos. Quedarán confirmados por Comercial y sumarán al pagado del proyecto.</p><fieldset disabled={mutation.isPending}>
    <label>Proyecto {selected ? <div className="pay-chosen"><div><strong>{selected.proyecto}</strong><small>{selected.autor} · #{selected.codigo}</small></div><button type="button" onClick={() => setSelected(null)}>Cambiar</button></div> : <><input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar autor, proyecto o código…"/><div className="pay-options">{options.isPending ? <p role="status">Buscando proyectos…</p> : options.isError ? <Failure error={options.error} retry={() => options.refetch()}/> : options.data?.items.length ? options.data.items.map(p => <button type="button" key={p.id} onClick={() => { setSelected(p); setCurrency(p.currency ?? 'USD'); }}><strong>{p.proyecto}</strong><small>{p.autor} · #{p.codigo} · {p.servicio}</small></button>) : <p>No hay proyectos accesibles.</p>}</div></>}</label>
    <div className="pay-form-grid"><label>Monto<input type="number" required min="0.01" max="9999999999.99" step="0.01" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}/></label>
    <label>Moneda<input required minLength={3} maxLength={3} pattern="[A-Z]{3}" value={selected?.currency ?? currency} disabled={!!selected?.currency} onChange={e => setCurrency(e.target.value.toUpperCase())}/></label>
    <label>Fecha del pago<input type="date" required max={today()} value={paidAt} onChange={e => setPaidAt(e.target.value)}/></label>
    <label>Método<select aria-label="Método" value={method} onChange={e => setMethod(e.target.value)}>{METODOS_PAGO.map(m => <option key={m}>{m}</option>)}</select></label></div>
    {!selected?.currency && <p className="pay-muted">USD es la moneda predeterminada del registro actual. Verifica la moneda real del contrato.</p>}
    <label>Referencia (opcional)<input maxLength={160} value={reference} onChange={e => setReference(e.target.value)}/></label>
    <label>Comprobante de Drive (opcional)<input type="url" maxLength={1500} placeholder="https://drive.google.com/file/d/…/view" value={receipt} onChange={e => setReceipt(e.target.value)}/><small>Archivo del Drive de este proyecto. PDF, PNG o JPG, hasta 5 MB.</small></label>
    <label>Notas (opcional)<textarea rows={2} maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)}/></label>
    {admin && <label>Motivo administrativo<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></label>}</fieldset>
    {mutation.isError && <p role="alert" className="pay-error">{mutation.error.message}</p>}
    <footer><button type="button" className="pay-secondary" disabled={mutation.isPending} onClick={close}>Cancelar</button><button className="pay-primary" disabled={!selected || mutation.isPending}>{mutation.isPending ? 'Registrando…' : 'Registrar pago'}</button></footer>
  </form></PaymentDialog>;
}

type Action = { kind: 'Verificado' | 'Rechazado' | 'Anulado' | 'solvencia'; id: string; detail?: FinancialDetail };
function ActionDialog({ action, admin, onClose, onDone, onRefresh }: { action: Action; admin: boolean; onClose: () => void; onDone: () => Promise<void>; onRefresh: () => Promise<void> }) {
  const [reason,setReason] = useState(''), [status,setStatus] = useState(action.detail?.solvencyStatus ?? 'Pendiente'), [gate,setGate] = useState(action.detail?.gateRequired ?? false);
  const title = action.kind === 'solvencia' ? 'Revisar solvencia' : action.kind === 'Anulado' ? 'Anular pago' : action.kind === 'Rechazado' ? 'Rechazar pago' : 'Confirmar pago';
  const mutation = useMutation({ mutationFn: () => action.kind === 'solvencia' ? paymentAction(`/proyectos/${action.id}/solvencia`, { estado: status, gateRequired: gate, motivo: reason, expectedUpdatedAt: action.detail!.revision }, 'PATCH')
    : action.kind === 'Anulado' ? paymentAction(`/${action.id}/anular`, { motivo: reason, ...(admin ? { motivoAdministrativo: reason } : {}) })
    : paymentAction(`/${action.id}/verificar`, { estatus: action.kind, motivoRechazo: reason || null, ...(admin ? { motivoAdministrativo: reason } : {}) }, 'PATCH'),
    onSuccess: async () => { await onDone(); onClose(); }, onError: async () => { await onRefresh(); } });
  return <PaymentDialog title={title} onClose={() => { if (!mutation.isPending) onClose(); }}><form onSubmit={e => { e.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}><fieldset disabled={mutation.isPending}>
    <p>{action.kind === 'Anulado' ? 'El abono permanecerá en el historial y dejará de sumar al pago confirmado.' : action.kind === 'Verificado' ? 'Confirma que el abono fue recibido y sus datos son correctos.' : action.kind === 'solvencia' ? 'La solvencia es una decisión administrativa independiente del porcentaje pagado.' : 'Registra por qué no puede verificarse este abono.'}</p>
    {action.kind === 'solvencia' && <><label>Solvencia<select aria-label="Solvencia" value={status} onChange={e => setStatus(e.target.value)}><option>Pendiente</option><option>Solvente</option><option>No solvente</option></select></label><label className="pay-check"><input type="checkbox" checked={gate} onChange={e => setGate(e.target.checked)}/>Requerir solvencia para paquete final y publicación</label></>}
    <label>Motivo{action.kind === 'Verificado' && !admin ? ' (opcional)' : ''}<textarea required={admin || action.kind !== 'Verificado'} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></label></fieldset>
    {mutation.isError && <p role="alert" className="pay-error">{mutation.error.message}</p>}<footer><button type="button" className="pay-secondary" disabled={mutation.isPending} onClick={onClose}>Cancelar</button><button className="pay-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando…' : title}</button></footer></form></PaymentDialog>;
}

function ProjectDetail({ id, canRegister, canConfirm, canManageContract, onContract, onRegister, onAction }: { id: string; canRegister: boolean; canConfirm: boolean; canManageContract:boolean; onContract:()=>void; onRegister: (p: FinancialProject) => void; onAction: (a: Action) => void }) {
  const [page,setPage] = useState(1);
  const q = useQuery({ queryKey: paymentKeys.detail(id,page), queryFn: () => fetchFinancialDetail(id,page) });
  useEffect(() => setPage(1), [id]);
  if (q.isPending) return <p className="pay-message" role="status">Consultando detalle…</p>;
  if (q.isError) return <Failure error={q.error} retry={() => q.refetch()}/>;
  const p = q.data, active = !['retirado','culminado'].includes(p.estado);
  return <><div className="pay-detail-title"><h2>Detalle del proyecto</h2><strong>{p.proyecto}</strong>{p.autor !== p.proyecto && <p>{p.autor}</p>}<small>#{p.codigo} · {p.servicio}{p.currency ? ` · ${p.currency}` : ''}</small></div>
    <div className="pay-summary">{[['Monto contractual',p.contractAmount],['Pagado confirmado',p.confirmedPaid],['Pendiente',p.pendingAmount],['Cobrado',p.paidPercentage == null ? null : `${Number(p.paidPercentage).toLocaleString('es')}%`]].map(([label,value],i) => <div key={label}><small>{label}</small><strong>{i === 3 ? value ?? '—' : paymentMoney(value,p.currency)}</strong></div>)}</div>
    {canManageContract && <button className="pay-text-button" onClick={onContract}>{p.contractAmount==null?'Definir monto total':'Editar monto total'}</button>}
    {p.contractAmount == null && <p className="pay-notice">Falta registrar el monto total del proyecto para calcular el saldo y el porcentaje.</p>}
    {p.currencyMismatch && <p className="pay-error">Hay monedas incompatibles. Revisa los abonos antes de calcular totales.</p>}
    {p.paymentStatus === 'Sobrepago' && <p className="pay-error">Revisar sobrepago: el total confirmado supera el contrato.</p>}
    <section><h3>Avance de pago</h3><Progress value={p.paidPercentage}/></section>
    <section><h3>Estado administrativo</h3><dl className="pay-admin-state"><div><dt>Estado de pago</dt><dd><Badge>{p.paymentStatus}</Badge></dd></div><div><dt>Solvencia</dt><dd><Badge>{p.solvencyStatus}</Badge></dd></div>{p.gateRequired && <div><dt>Gate de solvencia</dt><dd><Badge>{p.financialGateStatus}</Badge></dd></div>}</dl>
    {p.financialNotes && <p className="pay-muted">{p.financialNotes}</p>}{p.solvencyBy && <small className="pay-muted">Revisado por {p.solvencyBy} · {date(p.solvencyAt)}</small>}
    {canConfirm && <button className="pay-text-button" onClick={() => onAction({ kind: 'solvencia', id, detail: p })}>Revisar solvencia</button>}</section>
    <section><h3>Historial de abonos <small>({p.historyTotal})</small></h3>{p.payments.length ? <div className="pay-history">{p.payments.map(payment => <details key={payment.id} className={payment.estatus === 'Anulado' ? 'pay-voided' : ''}><summary><span>{date(payment.fechaPago)}<small>{payment.metodoPago}</small></span><strong>{paymentMoney(payment.monto,payment.moneda)}<small>{payment.moneda}</small></strong><Badge>{payment.estatus === 'Pendiente de verificación' ? 'Por confirmar' : payment.estatus}</Badge></summary>
      <dl><div><dt>Referencia</dt><dd>{payment.referencia || 'Sin referencia'}</dd></div><div><dt>Registrado por</dt><dd>{payment.registradoPor ?? 'Sin responsable histórico'} · {date(payment.registradoEn)}</dd></div>{payment.confirmadoPor && <div><dt>Confirmado por</dt><dd>{payment.confirmadoPor} · {date(payment.confirmadoEn)}</dd></div>}<div><dt>Origen</dt><dd>{payment.origen === 'MIGRATED' ? 'Registro histórico' : payment.origen === 'EXTERNAL_PORTAL' ? 'Portal externo' : 'Registro interno'}</dd></div></dl>
      {payment.notas && <p>{payment.notas}</p>}{payment.motivoRechazo && <p>Rechazo: {payment.motivoRechazo}</p>}{payment.motivoAnulacion && <p>Anulado por {payment.anuladoPor ?? '—'} · {date(payment.anuladoEn)}: {payment.motivoAnulacion}</p>}
      {payment.tieneComprobante && <a className="pay-text-button" href={`/api/pagos/${payment.id}/comprobante`} target="_blank" rel="noreferrer">Abrir comprobante</a>}
      {canConfirm && payment.estatus !== 'Anulado' && <div className="pay-history-actions">{payment.estatus === 'Pendiente de verificación' && <><button onClick={() => onAction({ kind: 'Verificado', id: payment.id })}>Confirmar</button><button onClick={() => onAction({ kind: 'Rechazado', id: payment.id })}>Rechazar</button></>}<button onClick={() => onAction({ kind: 'Anulado', id: payment.id })}>Anular pago</button></div>}</details>)}</div> : <div className="pay-empty"><p>Aún no hay abonos registrados.</p>{canRegister && active && <button className="pay-text-button" onClick={() => onRegister(p)}>Registrar primer pago</button>}</div>}
    {p.historyTotal > 20 && <div className="pay-pagination"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>{page} / {Math.ceil(p.historyTotal / 20)}</span><button disabled={page * 20 >= p.historyTotal} onClick={() => setPage(page + 1)}>Siguiente</button></div>}</section>
    {p.auditSummary.length > 0 && <details className="pay-audit"><summary>Actividad administrativa</summary>{p.auditSummary.map((a,i) => <p key={i}>{a.accion.replaceAll('_',' ').toLowerCase()} · {a.actor ?? 'Sin responsable histórico'} · {date(a.fecha)}</p>)}</details>}
    <footer className="pay-detail-actions">{canRegister && active && <button className="pay-primary" onClick={() => onRegister(p)}>＋ Registrar pago</button>}<Link className="pay-secondary" to={`/proyectos/${id}`}>Ver proyecto</Link></footer>
  </>;
}

export function RegistrarPagoPage() {
  const { data: user } = useMe(), client = useQueryClient();
  const [params,setParams] = useSearchParams(), [search,setSearch] = useState(params.get('search') ?? '');
  const [register,setRegister] = useState<{ initial?: FinancialProject } | null>(params.get('registrar') ? {} : null), [action,setAction] = useState<Action | null>(null);
  const [contractId,setContractId]=useState<string|null>(params.has('contrato')?params.get('project'):null),[contractBusy,setContractBusy]=useState(false);
  const [compact,setCompact] = useState(() => window.innerWidth < 1350), [drawer,setDrawer] = useState(false), [toast,setToast] = useState('');
  const access = has(ROLES_LECTURA_PAGOS,user?.rol), canRegister = has(ROLES_REGISTRO_PAGOS,user?.rol), canConfirm = has(ROLES_CONFIRMACION_PAGOS,user?.rol);
  const canManageContract=has(['comercial','direccion','admin'],user?.rol);
  const filters = new URLSearchParams(params); filters.delete('project'); filters.delete('registrar');
  filters.delete('contrato');
  const q = useQuery({ queryKey: paymentKeys.list(filters.toString()), queryFn: () => fetchFinancialProjects(filters.toString()), enabled: access });
  const selected = params.get('project') ?? q.data?.items[0]?.id;
  const update = (key: string, value: string) => setParams(p => { value ? p.set(key,value) : p.delete(key); p.delete('page'); p.delete('project'); return p; }, { replace: true });
  useEffect(() => { const t = setTimeout(() => { if (search !== (params.get('search') ?? '')) update('search',search); },300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { const media = window.matchMedia('(max-width:1349px)'); const change = () => setCompact(media.matches); media.addEventListener('change',change); return () => media.removeEventListener('change',change); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''),4000); return () => clearTimeout(t); }, [toast]);
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: paymentKeys.all }),client.invalidateQueries({ queryKey: ['pagos'] }),client.invalidateQueries({ queryKey: ['proyectos'] })]); };
  const done = async () => { await refresh(); setToast('Operación guardada. Información actualizada.'); };
  const closeRegister = () => { setRegister(null); if (params.has('registrar')) setParams(p => { p.delete('registrar'); return p; }, { replace: true }); };
  const detail = selected ? <ProjectDetail key={selected} id={selected} canRegister={canRegister} canConfirm={canConfirm} canManageContract={canManageContract} onContract={()=>setContractId(selected)} onRegister={p => setRegister({ initial: p })} onAction={setAction}/> : <p className="pay-message">Selecciona un proyecto para consultar sus abonos.</p>;
  const closeContract=()=>{if(contractBusy)return;setContractId(null);setParams(p=>{p.delete('contrato');return p;},{replace:true});};
  if (user && !access) return <p role="alert">No tienes acceso al módulo de pagos.</p>;
  const kpis = q.data?.kpis;
  const cards = [
    { label:'Proyectos con saldo',value:kpis?.conSaldo,text:'Requieren seguimiento',index:0 },
    ...(kpis?.porConfirmar ? [{ label:'Pagos por confirmar',value:kpis.porConfirmar,text:'Revisión de registros anteriores',index:1 }] : []),
    { label:'Solventes',value:kpis?.solventes,text:'Aprobación de Comercial',index:2 },
    { label:'Bloqueados por pago',value:kpis?.bloqueados,text:'Gate activo en el proceso',index:3 },
  ];
  return <CrmSidebarLayout   nav={<ComercialSidebarNav activo="pagos"/>} contentMaxWidth="max-w-[1600px]" contentClassName="pay-page" overlays={<>
    {register && canRegister && <RegisterPayment initial={register.initial} admin={user?.rol === 'admin'} onClose={closeRegister} onDone={done}/>}
    {action && <ActionDialog action={action} admin={user?.rol === 'admin'} onClose={() => setAction(null)} onDone={done} onRefresh={refresh}/>}
    {contractId && canManageContract && <PaymentDialog title="Monto total del proyecto" onClose={closeContract}><ContractFinancialFields id={contractId} initialEdit onBusyChange={setContractBusy} onSaved={()=>{setContractId(null);setParams(p=>{p.delete('contrato');return p;},{replace:true});setToast('Monto total actualizado. Saldo y porcentaje recalculados.');}}/></PaymentDialog>}
    {compact && drawer && selected && <PaymentDialog title="Detalle del proyecto" onClose={() => setDrawer(false)}><div className="pay-mobile-detail">{detail}</div></PaymentDialog>}
    {toast && <div className="pay-toast" role="status">{toast}</div>}
  </>}>
    <header className="pay-page-header"><div><h1>Pagos</h1><p>Registro temporal de abonos y estado administrativo de los proyectos editoriales.</p></div>{canRegister && <button className="pay-primary" onClick={() => setRegister({})}>＋ Registrar pago</button>}</header>
    <div className={'pay-kpis ' + (cards.length === 3 ? 'pay-kpis-three' : '')}>{cards.map(k => <article key={k.label}><span className={'pay-kpi-icon ' + (k.index === 3 ? 'pay-kpi-red' : '')} aria-hidden="true"><PaymentIcon index={k.index}/></span><h2>{k.label}</h2><strong>{k.value ?? '—'}</strong><p>{k.text}</p></article>)}</div>
    <section className="pay-filter-panel" aria-label="Filtros de pagos"><div className="pay-tabs" role="tablist" aria-label="Estado financiero" onKeyDown={e => { const tabs = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')]; const current = tabs.indexOf(document.activeElement as HTMLButtonElement); const next = e.key === 'ArrowRight' ? (current + 1) % tabs.length : e.key === 'ArrowLeft' ? (current - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1; if (next >= 0) { e.preventDefault(); tabs[next].focus(); tabs[next].click(); } }}>{[['todos','Todos'],['saldo','Con saldo'],['pendientes','Por confirmar'],['solventes','Solventes'],['bloqueados','Bloqueados']].map(([key,label]) => <button key={key} role="tab" aria-selected={(params.get('tab') ?? 'todos') === key} onClick={() => update('tab',key)}>{label}</button>)}</div>
    <div className="pay-filters"><label className="pay-search"><span className="sr-only">Buscar autor, proyecto o código</span><input placeholder="Buscar autor, proyecto o código…" value={search} onChange={e => setSearch(e.target.value)}/></label><label>Servicio<select value={params.get('service') ?? ''} onChange={e => update('service',e.target.value)}><option value="">Todos</option>{q.data?.servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label><label>Estado<select value={params.get('paymentStatus') ?? ''} onChange={e => update('paymentStatus',e.target.value)}><option value="">Todos</option>{['Sin monto contractual','Sin pagos','Parcial','Pagado','Sobrepago','Revisar moneda'].map(s => <option key={s}>{s}</option>)}</select></label><label>Último pago desde<input aria-label="Último pago desde" type="date" value={params.get('dateFrom') ?? ''} onChange={e => update('dateFrom',e.target.value)}/></label><label>Hasta<input aria-label="Último pago hasta" type="date" value={params.get('dateTo') ?? ''} onChange={e => update('dateTo',e.target.value)}/></label></div>
    <div className="pay-filter-extra"><label className="pay-check"><input type="checkbox" checked={params.get('includeInactive') === 'true'} onChange={e => update('includeInactive',e.target.checked ? 'true' : '')}/>Incluir culminados y retirados</label><label>Ordenar<select aria-label="Ordenar proyectos" value={params.get('sort') ?? 'attention'} onChange={e => update('sort',e.target.value)}><option value="attention">Requieren atención</option><option value="recent">Último pago</option></select></label></div></section>
    <div className="pay-master-detail"><section className="pay-projects"><header><h2>Estado de pagos por proyecto</h2><p>Montos, abonos confirmados y solvencia operativa por proyecto.</p></header>
      {q.isPending ? <p role="status" className="pay-message">Consultando proyectos…</p> : q.isError ? <Failure error={q.error} retry={() => q.refetch()}/> : !q.data.items.length ? <div className="pay-empty"><h3>No hay proyectos para estos filtros.</h3><button className="pay-secondary" onClick={() => { setSearch(''); setParams({}); }}>Limpiar filtros</button></div> : <>
      <div className="pay-table-wrap"><table><thead><tr>{['Proyecto / Autor','Servicio','Contrato','Pagado','Pendiente','%','Solvencia','Último pago','Acción'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{q.data.items.map(p => <tr key={p.id} className={selected === p.id ? 'pay-selected' : ''} onClick={() => { setParams(prev => { prev.set('project',p.id); return prev; }, { replace: true }); if (compact) setDrawer(true); }}>
        <td><strong>{p.proyecto}</strong><small>{p.autor}</small><small>#{p.codigo}{p.currency ? ` · ${p.currency}` : ''}</small></td><td>{p.servicio}</td><td>{p.contractAmount == null ? <span className="pay-muted">Sin monto contractual</span> : paymentMoney(p.contractAmount,p.currency)}</td><td>{paymentMoney(p.confirmedPaid,p.currency)}</td><td>{paymentMoney(p.pendingAmount,p.currency)}</td><td><Progress value={p.paidPercentage}/>{p.paymentStatus === 'Sobrepago' && <Badge>Sobrepago</Badge>}</td><td><Badge>{p.solvencyStatus}</Badge>{p.gateAffectingWorkflow && <small className="pay-error">Gate bloqueado</small>}{p.pendingPayments > 0 && <small>{p.pendingPayments} por confirmar</small>}</td><td>{date(p.lastPayment)}</td><td><button className="pay-secondary" aria-label={`Ver detalle de ${p.proyecto}`} aria-pressed={selected === p.id}>Ver detalle</button></td>
      </tr>)}</tbody></table></div>
      <div className="pay-project-cards">{q.data.items.map(p => <button key={p.id} className="pay-project-card" onClick={() => { setParams(prev => { prev.set('project',p.id); return prev; }, { replace: true }); setDrawer(true); }}><strong>{p.proyecto}</strong><small>{p.autor} · #{p.codigo} · {p.servicio}{p.currency ? ` · ${p.currency}` : ''}</small><dl><div><dt>Contrato</dt><dd>{p.contractAmount == null ? 'Sin monto contractual' : paymentMoney(p.contractAmount,p.currency)}</dd></div><div><dt>Pagado</dt><dd>{paymentMoney(p.confirmedPaid,p.currency)}</dd></div><div><dt>Pendiente</dt><dd>{paymentMoney(p.pendingAmount,p.currency)}</dd></div><div><dt>Último pago</dt><dd>{date(p.lastPayment)}</dd></div></dl><Progress value={p.paidPercentage}/><Badge>{p.solvencyStatus}</Badge>{p.pendingPayments > 0 && <small>{p.pendingPayments} por confirmar</small>}</button>)}</div>
      </>}
      {q.data && <footer className="pay-pagination"><span>{q.data.total ? `${(q.data.page - 1) * q.data.pageSize + 1}–${Math.min(q.data.page * q.data.pageSize,q.data.total)}` : '0'} de {q.data.total} proyectos</span><div><button aria-label="Página anterior" disabled={q.data.page <= 1} onClick={() => setParams(p => { p.set('page',String(q.data!.page - 1)); return p; })}>‹</button><span aria-live="polite">{q.data.page} / {Math.max(1,Math.ceil(q.data.total / q.data.pageSize))}</span><button aria-label="Página siguiente" disabled={q.data.page * q.data.pageSize >= q.data.total} onClick={() => setParams(p => { p.set('page',String(q.data!.page + 1)); return p; })}>›</button></div></footer>}
    </section>{!compact && <aside className="pay-detail" aria-label="Detalle del proyecto">{detail}</aside>}</div>
  </CrmSidebarLayout>;
}
