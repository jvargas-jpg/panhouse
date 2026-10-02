import { useNavigate } from 'react-router-dom';
import type { ProyectoPendienteSeccion1 } from '../types/api';
import { CrearProyectoModalForm } from './CrearProyectoModalForm';
import { Modal } from './Modal';

export function ProjectModal({ proyectoEnEdicion, onClose, onGuardado }: { proyectoEnEdicion: ProyectoPendienteSeccion1 | null; onClose: () => void; onGuardado: (mensaje: string) => void }) {
  const navigate = useNavigate();
  return <Modal titulo={proyectoEnEdicion ? 'Editar proyecto' : 'Crear nuevo proyecto'} subtitulo={proyectoEnEdicion ? 'Actualiza los datos iniciales del proyecto.' : 'Registra los datos iniciales. Después completarás la información comercial de la ficha.'} ancho="proyecto" onClose={onClose}>
    <CrearProyectoModalForm proyectoEnEdicion={proyectoEnEdicion} onCancelar={onClose} onGuardado={onGuardado} onCreado={(id) => { onGuardado('Proyecto creado exitosamente'); navigate(`/proyectos/${id}/ficha-trazabilidad`); }} />
  </Modal>;
}
