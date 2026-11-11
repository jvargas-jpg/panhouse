import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { authorPost } from './authorPortalApi';
import './authorPortal.css';
export function AuthorCredentials({reset=false}:{reset?:boolean}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[token]=useState(()=>window.location.hash.slice(1));
 const mutation=useMutation({mutationFn:()=>authorPost(reset?'/credentials/reset':'/credentials/activate',reset?{email}:{token,password})});
 return <main className="ap-auth"><h1 className="text-2xl font-bold">{reset?'Recuperar acceso':'Activa tu acceso a PanHouse'}</h1><p className="my-4">{reset?'Si tienes una cuenta activa, recibirás un enlace para establecer una contraseña.':'Establece una contraseña de al menos 12 caracteres.'}</p>{mutation.isSuccess?<p role="status">{reset?'Revisa tu correo. Si existe una cuenta activa, encontrarás las instrucciones.':'Tu acceso está listo. Ya puedes iniciar sesión.'}</p>:<form className="ap-form" onSubmit={e=>{e.preventDefault();mutation.mutate();}}>{reset?<label className="ap-field">Correo<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>:<label className="ap-field">Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={200} required value={password} onChange={e=>setPassword(e.target.value)}/></label>}<button className="ap-primary" disabled={mutation.isPending}>{mutation.isPending?'Procesando…':reset?'Enviar instrucciones':'Guardar contraseña'}</button>{mutation.isError&&<p role="alert">{mutation.error.message}</p>}</form>}<Link className="mt-6 block underline" to="/login">Volver a iniciar sesión</Link></main>;
}
