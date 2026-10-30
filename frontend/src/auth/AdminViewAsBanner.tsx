import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useNavigate} from 'react-router-dom';
import {apiFetch} from '../lib/api';
import type {Usuario} from '../types/api';
import './adminViewAs.css';
export async function refreshIdentity(cache:ReturnType<typeof useQueryClient>){await cache.cancelQueries();cache.clear();const {user}=await apiFetch<{user:Usuario}>('/auth/me');cache.setQueryData(['auth','me'],user);return user;}
export function AdminViewAsBanner({user}:{user:Usuario}){const cache=useQueryClient(),navigate=useNavigate();const [busy,setBusy]=useState(false),[error,setError]=useState('');return <div className="admin-view-as" role="region" aria-label="Modo administrador solo lectura"><div><strong>MODO ADMINISTRADOR · SOLO LECTURA</strong><span>Viendo PanHouse como {user.nombre}</span>{error&&<span role="alert">{error}</span>}</div><button disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await apiFetch('/admin/view-as/stop',{method:'POST',body:JSON.stringify({reason:'Finalizó la inspección administrativa en solo lectura',requestKey:crypto.randomUUID()})});await refreshIdentity(cache);navigate('/admin/personas',{replace:true});}catch{setError('No se pudo salir del modo. Reintenta.');setBusy(false);}}}>{busy?'Saliendo…':'Salir de la vista'}</button></div>;}
