import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchFinancialDetail, paymentAction, paymentKeys } from './financialApi';
import { MONEDAS, MONEDA_POR_DEFECTO } from '../shared/monedas';

export function ContractFinancialFields({ id, initialEdit=false, onSaved, onBusyChange }: {
  id:string; initialEdit?:boolean; onSaved?:()=>void; onBusyChange?:(busy:boolean)=>void;
}) {
  const client=useQueryClient(),initialized=useRef(false);
  const [edit,setEdit]=useState(false),[amount,setAmount]=useState(''),[currency,setCurrency]=useState(MONEDA_POR_DEFECTO),[reason,setReason]=useState(''),[revision,setRevision]=useState('');
  const q=useQuery({ queryKey:paymentKeys.detail(id),queryFn:()=>fetchFinancialDetail(id) });
  function beginEdit() {
    if(!q.data)return;
    setAmount(q.data.contractAmount ?? '');setCurrency(q.data.currency ?? MONEDA_POR_DEFECTO);setReason('');setRevision(q.data.revision);setEdit(true);
  }
  useEffect(()=>{ if(initialEdit && q.data && !initialized.current){initialized.current=true;beginEdit();} },[initialEdit,q.data]);
  const mutation=useMutation({ mutationFn:()=>paymentAction(`/proyectos/${id}/contrato`,{ monto:amount,moneda:currency,motivo:reason,expectedUpdatedAt:revision },'PATCH'),
    onSuccess:async()=>{await client.invalidateQueries({queryKey:paymentKeys.all});setEdit(false);onSaved?.();},
    onError:async()=>{await q.refetch();},
  });
  useEffect(()=>{onBusyChange?.(mutation.isPending);return()=>onBusyChange?.(false);},[mutation.isPending,onBusyChange]);
  const input='mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:ring-2 focus:ring-dorado';
  const money=(value:string|null,currencyCode:string|null)=>value==null||currencyCode==null?'Sin monto contractual':`${new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value))} ${currencyCode}`;
  return <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 text-sm">
    {q.isPending && <p className="text-xs text-gray-500">Consultando…</p>}
    {q.isError && <div><p className="text-xs text-red-700">No se pudo consultar el resumen financiero.</p><button onClick={()=>q.refetch()} className="mt-1 text-xs font-medium underline">Reintentar</button></div>}
    {q.data && !edit && <><dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><dt className="text-[11px] text-gray-500">Monto contractual</dt><dd className="mt-0.5 font-medium text-gray-900">{money(q.data.contractAmount,q.data.currency)}</dd></div><div><dt className="text-[11px] text-gray-500">Pagado confirmado</dt><dd className="mt-0.5 font-medium text-gray-900">{money(q.data.confirmedPaid,q.data.currency)}</dd></div><div><dt className="text-[11px] text-gray-500">Pendiente</dt><dd className="mt-0.5 font-medium text-gray-900">{money(q.data.pendingAmount,q.data.currency)}</dd></div><div><dt className="text-[11px] text-gray-500">Pagado</dt><dd className="mt-0.5 font-medium text-gray-900">{q.data.paidPercentage==null?'—':`${Number(q.data.paidPercentage).toLocaleString('es')}%`}</dd></div></dl>
    <p className="mt-3 text-xs text-gray-500">Estado administrativo: <span className="font-medium text-gray-700">{q.data.solvencyStatus}</span></p>
    <button className="mt-3 text-xs font-medium text-amber-700 underline" onClick={()=>{mutation.reset();beginEdit();}}>{q.data.contractAmount==null?'Definir monto total':'Editar monto total'}</button></>}
    {q.data && edit && <form className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();if(!mutation.isPending)mutation.mutate();}}><p className="text-xs text-gray-500">Indica el importe acordado por todo el proyecto. El saldo y el porcentaje pagado se recalcularán con los abonos confirmados. La modificación quedará auditada y requerirá revisar la solvencia.</p><fieldset disabled={mutation.isPending}><div className="grid grid-cols-2 gap-3"><label>Monto total<input className={input} required type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Moneda del proyecto<select className={input} required value={currency} onChange={e=>setCurrency(e.target.value)}>{MONEDAS.map(m=><option key={m.code} value={m.code}>{m.label}</option>)}</select></label></div><label className="mt-3 block">Motivo / referencia contractual<textarea className={input} required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label></fieldset>
    {mutation.isError && <p role="alert" className="text-xs text-red-700">{mutation.error.message} Si el proyecto cambió, cancela y vuelve a abrir la edición para cargar los datos actuales.</p>}
    <div className="flex gap-3"><button className="rounded-lg bg-dorado px-4 py-2 font-semibold" disabled={mutation.isPending}>{mutation.isPending?'Guardando…':'Guardar monto total'}</button><button type="button" disabled={mutation.isPending} onClick={()=>setEdit(false)}>Cancelar</button></div></form>}
    {!onSaved && <Link to={`/comercial/pagos?project=${id}`} className="mt-4 inline-block text-xs text-amber-700 underline">Ver pagos</Link>}</section>;
}
