import { Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useMe } from '../auth/useAuth';
const CommandCenter=lazy(()=>import('./ProyectoCommandCenterPage').then(m=>({default:m.ProyectoCommandCenterPage})));
const Legacy=lazy(()=>import('./ProyectoDetalleLegacyPage').then(m=>({default:m.ProyectoDetalleLegacyPage})));
export function ProyectoDetallePage(){
  const {data:user,isPending}=useMe();
  if(isPending)return <p role="status">Consultando sesión…</p>;
  if(user?.rol==='validador')return <Navigate to="/" replace/>;
  return <Suspense fallback={<p role="status">Abriendo proyecto…</p>}>{user&&['especialista','jefe_area','rrpp','admin'].includes(user.rol)?<CommandCenter/>:<Legacy/>}</Suspense>;
}
