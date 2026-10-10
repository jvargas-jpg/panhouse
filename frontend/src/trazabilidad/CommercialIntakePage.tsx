import { useParams } from 'react-router-dom';
import { useMe } from '../auth/useAuth';
import { TraceabilityWorkspace } from './TraceabilityWorkspace';

// Keep the original commercial draft and handoff workflow reachable after
// moving the shared dossier to the default traceability route.
export function CommercialIntakePage(){
  const {id}=useParams();
  const {data:user,isPending}=useMe();
  if(isPending)return <p className="p-6" role="status">Consultando sesión…</p>;
  if(user?.rol!=='comercial')return <p className="p-6" role="alert">Esta gestión corresponde a Comercial.</p>;
  return id?<TraceabilityWorkspace key={id} proyectoId={id}/>:null;
}
