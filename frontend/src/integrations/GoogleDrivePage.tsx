import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { apiFetch } from '../lib/api';

interface TestResult {success:boolean;checkedAt:string;cleanedUp:boolean;rootId:string|null;rootName:string|null;childId:string|null;errorCode:string|null;cleanupErrorCode:string|null}
interface DriveStatus {configured:boolean;connected:boolean;status:string;health:string;accountEmail:string|null;scope:string[];connectedAt:string|null;lastValidatedAt:string|null;lastTestResult:TestResult|null;projectsRoot?:{folderId:string|null;url:string|null;ready:boolean}}
const key = ['integrations','google-drive'];
const messages:Record<string,string> = {
  INVALID_STATE:'La autorización expiró o ya fue utilizada. Inicia la conexión de nuevo.',
  OAUTH_DENIED:'No se autorizó Google Drive. Puedes volver a conectarlo cuando lo necesites.',
  REFRESH_TOKEN_REQUIRED:'Google no entregó una credencial offline utilizable. Conecta de nuevo y concede el consentimiento.',
  REAUTH_REQUIRED:'La credencial fue revocada o expiró. Conecta Google Drive de nuevo.',
  INVALID_CLIENT:'Google rechazó el cliente OAuth. Revisa la configuración del servidor.',
  REDIRECT_MISMATCH:'El callback no coincide con el registrado en Google Cloud.',
  SCOPE_MISMATCH:'Google no concedió exclusivamente el permiso drive.file solicitado.',
  STALE_ATTEMPT:'La integración cambió durante la autorización. Inicia una conexión nueva.',
};
const date = (value:string|null) => value ? new Date(value).toLocaleString('es-VE') : 'Sin verificar';
export function GoogleDrivePage() {
  const {data:user,isPending:loadingUser} = useMe();
  const [search,setSearch] = useSearchParams();
  const [notice,setNotice] = useState<{error:boolean;text:string}|null>(null);
  const client = useQueryClient();
  const status = useQuery({queryKey:key,queryFn:()=>apiFetch<DriveStatus>('/integrations/google-drive/status'),enabled:user?.rol==='direccion'});
  const refresh = () => client.invalidateQueries({queryKey:key});
  useEffect(()=>{
    const error = search.get('googleDriveError'), connected = search.get('googleDrive') === 'connected';
    if (!error && !connected) return;
    setNotice({error:!!error,text:error?(messages[error] ?? 'No se pudo conectar Google Drive. Revisa la configuración e inicia de nuevo.'):'Google Drive conectado correctamente.'});
    search.delete('googleDrive');search.delete('googleDriveError');setSearch(search,{replace:true});
    void client.invalidateQueries({queryKey:key});
  },[search,setSearch,client]);
  const onError = (error:Error)=>setNotice({error:true,text:error.message});
  const projectsRoot=useMutation({mutationFn:()=>apiFetch('/integrations/google-drive/projects-root',{method:'POST',body:'{}'}),onSuccess:async()=>{setNotice({error:false,text:'Carpeta de proyectos DEV configurada correctamente.'});await refresh();},onError});
  const connect = useMutation({mutationFn:()=>apiFetch<{authorizationUrl:string}>('/integrations/google-drive/connect',{method:'POST',body:'{}'}),
    onSuccess:data=>window.location.assign(data.authorizationUrl),onError});
  const test = useMutation({mutationFn:()=>apiFetch<TestResult>('/integrations/google-drive/test',{method:'POST',body:'{}'}),
    onSuccess:async result=>{setNotice({error:!result.success,text:result.success?'Conexión verificada: carpeta y subcarpeta creadas, listadas y eliminadas correctamente.':
      `${messages[result.errorCode ?? ''] ?? 'No se pudo completar la prueba.'} ${result.cleanedUp?'La carpeta de prueba se limpió.':'La limpieza no está confirmada. Repite la prueba para recuperarla.'}`});await refresh();},onError});
  const disconnect = useMutation({mutationFn:()=>apiFetch<{warningCode:string|null}>('/integrations/google-drive/disconnect',{method:'POST',body:'{}'}),
    onSuccess:async result=>{setNotice({error:!!result.warningCode,text:result.warningCode?'Conexión eliminada de PanHouse. Google no confirmó la revocación; revoca también el acceso desde tu cuenta de Google.':'Google Drive desconectado correctamente.'});await refresh();},onError});
  if (loadingUser) return <p role="status">Cargando configuración…</p>;
  if (user?.rol!=='direccion') return <div role="alert"><h1 className="text-xl font-semibold">Acceso restringido</h1><p>Esta integración corporativa es administrada por Dirección.</p><Link to="/" className="underline">Volver al inicio</Link></div>;
  const data = status.data, pending = connect.isPending || test.isPending || disconnect.isPending || projectsRoot.isPending;
  const button = 'rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50';
  return <section className="space-y-6 pb-10">
    <div><p className="mb-2 text-sm text-tinta/60">Configuración / Integraciones</p><h1 className="text-2xl font-bold text-tinta">Google Drive</h1>
      <p className="mt-2 text-sm text-tinta/70">Conexión corporativa de PanHouse para gestionar sus archivos en Google Drive.</p></div>
    {notice && <p role={notice.error?'alert':'status'} className={`rounded-lg border p-4 text-sm ${notice.error?'border-amber-300 bg-amber-50 text-amber-900':'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{notice.text}</p>}
    {status.isPending && <p role="status">Consultando conexión…</p>}
    {status.error && <p role="alert">{status.error.message}</p>}
    {data && <div className="rounded-xl border border-tinta/10 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Conexión de la organización</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${data.connected?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-700'}`}>{data.connected?'Conectado':'No conectado'}</span></div>
      <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
        <div><dt className="text-tinta/60">Cuenta corporativa</dt><dd className="mt-1 break-all font-medium">{data.accountEmail ?? 'Sin cuenta conectada'}</dd></div>
        <div><dt className="text-tinta/60">Permiso</dt><dd className="mt-1 font-medium">Acceso a archivos gestionados por PanHouse</dd><dd className="mt-1 text-xs text-tinta/60">drive.file</dd></div>
        <div><dt className="text-tinta/60">Última verificación con Google</dt><dd className="mt-1 font-medium">{date(data.lastValidatedAt)}</dd></div>
        <div><dt className="text-tinta/60">Salud de la conexión</dt><dd className="mt-1 font-medium">{!data.configured?'Configuración pendiente':data.health==='healthy'?'Verificada con Google':data.health==='unverified'?'Sin verificación':messages[data.health] ?? 'Requiere revisión. Ejecuta una prueba de conexión.'}</dd></div>
      </dl>
      {!data.configured && <p role="alert" className="mt-5 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Google Drive integration is not configured. Completa las variables de Google y la clave de cifrado en el servidor.</p>}
      <div className="mt-7 flex flex-wrap gap-3 border-t border-tinta/10 pt-5">
        <button className={`${button} bg-tinta text-white`} disabled={!data.configured || pending} onClick={()=>{setNotice(null);connect.mutate();}}>{connect.isPending?'Abriendo Google…':data.connected?'Reconectar Google Drive':'Conectar Google Drive'}</button>
        <button className={`${button} border border-tinta/20 text-tinta`} disabled={!data.connected || pending} onClick={()=>{setNotice(null);test.mutate();}}>{test.isPending?'Probando y limpiando…':'Probar conexión'}</button>
        <button className={`${button} border border-red-200 text-red-700`} disabled={data.status==='disconnected' || data.status==='not_configured' || pending} onClick={()=>{if(window.confirm('¿Desconectar el Google Drive corporativo? PanHouse perderá el acceso. Los archivos de Drive se conservarán.'))disconnect.mutate();}}>Desconectar</button>
      </div>
      <p className="mt-3 text-xs leading-5 text-tinta/60">La prueba crea una carpeta temporal PANHOUSE_API_TEST y una subcarpeta «Prueba API», verifica su listado y metadata, y las elimina al terminar.</p>
    </div>}
    {data&&<div className="rounded-xl border border-tinta/10 bg-white p-5 text-sm"><h2 className="font-semibold">Raíz documental de proyectos · DEV</h2>
      <p className="mt-2 text-tinta/70">PANHOUSE - PROYECTOS EDITORIALES - DEV</p><p className="mt-2">{data.projectsRoot?.ready?'Configurada. Los nuevos espacios se crearán dentro de esta carpeta.':'Pendiente. Dirección debe configurar esta raíz antes de crear espacios de proyectos.'}</p>
      <div className="mt-4 flex flex-wrap gap-3">{data.projectsRoot?.ready&&data.projectsRoot.url?<a className={`${button} border border-tinta/20`} href={data.projectsRoot.url} target="_blank" rel="noopener noreferrer">Abrir raíz DEV ↗</a>:
        <button className={`${button} bg-tinta text-white`} disabled={!data.connected||pending} onClick={()=>projectsRoot.mutate()}>{projectsRoot.isPending?'Configurando raíz…':'Configurar raíz DEV'}</button>}</div>
      <p className="mt-4 text-xs text-tinta/60">Acceso compartido con Especialistas: PENDIENTE_VALIDACION.</p>
    </div>}
    {data?.lastTestResult && <div className="rounded-xl border border-tinta/10 bg-white p-5 text-sm"><h2 className="font-semibold">Última prueba de Drive</h2>
      <p className="mt-2">{date(data.lastTestResult.checkedAt)} · {data.lastTestResult.success?'Correcta':'Fallida'} · {data.lastTestResult.cleanedUp?'Limpieza confirmada':'Limpieza pendiente'}</p>
      {data.lastTestResult.rootName && <p className="mt-2 break-all text-tinta/70">{data.lastTestResult.rootName}</p>}
      {data.lastTestResult.rootId && <p className="mt-1 break-all text-xs text-tinta/60">ID de prueba: {data.lastTestResult.rootId}</p>}
    </div>}
  </section>;
}
