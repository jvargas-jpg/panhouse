// Manual del Especialista: recordatorio de solicitudes de Lanzamiento.
// Hito habilitante != solicitud != proceso activo.
export function gateLanzamiento(servicio: string, subtipo: string | null, cap4Enviado: boolean, tripaEnviada: boolean, disenadorId: string | null) {
  const habilitado = servicio === 'EF' || servicio === 'EEC' || servicio === 'CR' && subtipo === 'Capítulo' ? cap4Enviado
    : servicio === 'EET' || servicio === 'CR' && subtipo === 'Tripa' ? tripaEnviada : servicio === 'SE' ? !!disenadorId : false;
  return { desbloqueado: habilitado, motivo: habilitado ? 'Hito editorial alcanzado' : servicio === 'SE' ? 'Se habilita al asignar Diseño'
    : servicio === 'EF' || servicio === 'EEC' || subtipo === 'Capítulo' ? 'Se habilita al enviar el capítulo 4 para feedback'
    : servicio === 'EET' || subtipo === 'Tripa' ? 'Se habilita al enviar la tripa completa para feedback' : 'RRPP debe definir el servicio antes de activar Lanzamiento' };
}
