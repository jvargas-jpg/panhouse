import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchFinancialDetail, paymentAction, paymentKeys } from './financialApi';

export function ContractFinancialFields({ id, initialEdit=false, onSaved, onBusyChange }: {
  id:string; initialEdit?:boolean; onSaved?:()=>void; onBusyChange?:(busy:boolean)=>void;
}) {
  const client=useQueryClient(),initialized=useRef(false);
  const [edit,setEdit]=useState(false),[amount,setAmount]=useState(''),[currency,setCurrency]=useState('USD'),[reason,setReason]=useState(''),[revision,setRevision]=useState('');
  const q=useQuery({ queryKey:paymentKeys.detail(id),queryFn:()=>fetchFinancialDetail(id) });
  function beginEdit() {
    if(!q.data)return;
    setAmount(q.data.contractAmount ?? '');setCurrency(q.data.currency ?? 'USD');setReason('');setRevision(q.data.revision);setEdit(true);
  }
  useEffect(()=>{ if(initialEdit && q.data && !initialized.current){initialized.current=true;beginEdit();} },[initialEdit,q.data]);
  const mutation=useMutation({ mutationFn:()=>paymentAction(`/proyectos/${id}/contrato`,{ monto:amount,moneda:currency,motivo:reason,expectedUpdatedAt:revision },'PATCH'),
    onSuccess:async()=>{await client.invalidateQueries({queryKey:paymentKeys.all});setEdit(false);onSaved?.();},
    onError:async()=>{await q.refetch();},
  });
  useEffect(()=>{onBusyChange?.(mutation.isPending);return()=>onBusyChange?.(false);},[mutation.isPending,onBusyChange]);
  const input='mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:ring-2 focus:ring-dorado';
  return <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 text-sm"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-gray-900">Monto total del proyecto</h3><p className="mt-1 text-xs text-gray-500">{q.isPending?'Consultando…':q.isError?'No se pudo consultar el monto total.':q.data.contractAmount==null?'Sin monto total registrado.':`${new Intl.NumberFormat('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(q.data.contractAmount))} ${q.data.currency}`}</p></div>{q.data && !edit && <button className="text-xs font-medium text-amber-700 underline" onClick={()=>{mutation.reset();beginEdit();}}>{q.data.contractAmount==null?'Definir monto total':'Editar monto total'}</button>}</div>
    {q.isError && <button onClick={()=>q.refetch()} className="mt-2 underline">Reintentar</button>}
    {q.data && edit && <form className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();if(!mutation.isPending)mutation.mutate();}}><p className="text-xs text-gray-500">Indica el importe acordado por todo el proyecto. El saldo y el porcentaje pagado se recalcularán con los abonos confirmados. La modificación quedará auditada y requerirá revisar la solvencia.</p><fieldset disabled={mutation.isPending}><div className="grid grid-cols-2 gap-3"><label>Monto total<input className={input} required type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Moneda del proyecto<input className={input} required pattern="[A-Z]{3}" maxLength={3} value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())}/></label></div><label className="mt-3 block">Motivo / referencia contractual<textarea className={input} required maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label></fieldset>
    {mutation.isError && <p role="alert" className="text-xs text-red-700">{mutation.error.message} Si el proyecto cambió, cancela y vuelve a abrir la edición para cargar los datos actuales.</p>}
    <div className="flex gap-3"><button className="rounded-lg bg-dorado px-4 py-2 font-semibold" disabled={mutation.isPending}>{mutation.isPending?'Guardando…':'Guardar monto total'}</button><button type="button" disabled={mutation.isPending} onClick={()=>setEdit(false)}>Cancelar</button></div></form>}
    {!onSaved && <Link to={`/comercial/pagos?project=${id}`} className="mt-4 inline-block text-xs text-amber-700 underline">Consultar abonos y solvencia</Link>}</section>;
}
