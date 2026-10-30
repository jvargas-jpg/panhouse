import type { ReactNode } from 'react';
import { Dialog } from '../design-system/Dialog';

/** Compatibility API for the existing forms; the shared native dialog owns focus and Escape. */
export function Modal({titulo,subtitulo,onClose,children,ancho='md'}:{
  titulo:string;subtitulo?:string;onClose:()=>void;children:ReactNode;ancho?:'md'|'proyecto'|'3xl'|'4xl';
}){
  return <Dialog title={titulo} subtitle={subtitulo} onClose={onClose} className={`ph-form-dialog ph-form-dialog-${ancho}`}>
    <div className="flex min-h-0 flex-1 flex-col">{children}</div>
  </Dialog>;
}
