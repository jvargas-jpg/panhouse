// Estado del traspaso Comercial → RRPP → Jefatura, derivado de
// notificadoRrpp/notificadoJefatura (proyectos, ya existían para la
// cascada de notificaciones — ver BotonNotificarTransicion.tsx y
// notificarRrppProyectoBase/notificarJefaturaFichaCompletada en
// server/helpers/proyectos.ts). Deliberadamente NO es una columna nueva
// en la base de datos: proyectos.estado ya existe con otro significado
// (operativo — en_proceso/retrasado/etc., ver estado.ts), y agregar un
// segundo campo con el mismo nombre no es posible en la misma tabla;
// esto es puramente una etiqueta calculada para la UI a partir de datos
// que ya se persisten.
//
// 'En Producción' (antes acá) renombrado a 'Pendiente Jefatura' a
// pedido explícito del negocio — más preciso: notificadoJefatura=true
// solo significa que RRPP mandó el proyecto y jefatura todavía no lo
// asignó a un especialista (Escuadrón de Producción); "En Producción"
// sugería que el trabajo ya había arrancado, cuando en realidad sigue
// esperando esa asignación.
export type EstadoTraspaso = 'Borrador' | 'Pendiente RRPP' | 'Pendiente Jefatura';

export function calcularEstadoTraspaso(notificadoRrpp: boolean, notificadoJefatura: boolean): EstadoTraspaso {
  if (notificadoJefatura) return 'Pendiente Jefatura';
  if (notificadoRrpp) return 'Pendiente RRPP';
  return 'Borrador';
}

export const ESTADO_TRASPASO_CLASE: Record<EstadoTraspaso, string> = {
  Borrador: 'bg-gray-100 text-gray-700',
  'Pendiente RRPP': 'bg-blue-100 text-blue-800',
  'Pendiente Jefatura': 'bg-amber-100 text-amber-800',
};
