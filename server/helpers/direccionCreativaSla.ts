// Manual del Especialista §4.1.1 ("El especialista lo envía al autor
// con un plazo de aprobación de máximo 1 día") y §4.1.2 ("se envían al
// autor con un plazo de aprobación o feedback de máximo 1 día") — el
// mismo plazo de 1 día aplica tanto a la aprobación del brief como a la
// de los conceptos.
//
// PENDIENTE_CONFIRMACION_NEGOCIO_DIRECCION_CREATIVA_SLA: el Manual no
// aclara si ese día es hábil o continuo (a diferencia de Corrección,
// que sí dice "continuos" explícitamente) — a propósito, esta ronda NO
// calcula un `dueAt` proyectado con esa ambigüedad sin resolver (ver
// master prompt 5C §22, "no convertir automáticamente"). Se expone solo
// como referencia textual en la UI; la urgencia real se muestra como
// antigüedad transcurrida (ahora - fecha de envío), nunca como un
// vencimiento proyectado que fingiría una precisión que la fuente no
// confirma. Si el negocio aclara hábil/continuo más adelante, este
// comentario y esta constante son el único lugar a actualizar.
export const SLA_APROBACION_AUTOR_DIAS_REFERENCIA = 1;
