# RRPP: Lanzamientos y eventos

Ruta: `/rrpp/lanzamientos`. Vistas: Planificación, Agenda, Publicaciones e Historial.
La selección (`proyecto`), vista (`tab`), sección del detalle (`seccion`), filtros,
página, página de reuniones adicionales (`reunionesPagina`) y período de Agenda
(`mes`, `dia`) viven en la URL.

## Fuentes contrastadas

- `fuentes-negocio/MATRIZ DE LANZAMIENTOS, EVENTOS Y PUBLICACIONES (1).xlsx`:
  `Matriz de asesorias con fechas `, encabezados A1:AH1, validaciones e históricos;
  `EVENTOS (TAREAS DE PANHOUSE)`, A1:M1 y valores de C/D/G;
  `Publicaciones en redes`, A1:I1 y validaciones C/D/H.
- `fuentes-negocio/MIREYA JOSEFINA OLIVEROS SEQUERA - FICHA DE TRAZABILIDAD.xlsx`:
  `LANZAMIENTO Y PROMOCIÓN`, A7:B25, y su instructivo. Primera/segunda reunión,
  objetivos, país de ISBN, fecha tentativa y modalidad del lanzamiento.
- `fuentes-negocio/Proceso de adiestramiento - Especialista editorial (3).docx`:
  recordatorio «Solicitud de reunión de lanzamiento y promoción»:
  Ghostwriting/Crudo capítulo, feedback capítulo 4; Crudo tripa, feedback de tripa
  completa; Sello, asignación al área de Diseño.

La Matriz se inspeccionó con Artifact Tool y lectura de sus validaciones XML.
Las fuentes se conservaron intactas. No se importaron automáticamente nombres,
fechas ambiguas ni fórmulas históricas, incluidas las referencias `#REF!`.

## Modelo canónico y activación

La migración 0072 es aditiva. Crea `rrpp_eventos` y `rrpp_publicaciones`, con FK
al proyecto, responsables FK a `usuarios`, índices y unicidad por
`(proyecto_id, client_key)`. Permite varias instancias por proyecto y distingue
reintentos de nuevos registros. No copia autor, libro ni fecha de lanzamiento.

El trabajo `lanzamiento` usa la business key estable `planificacion`.
`habilitarPlanificacionRrpp` consulta hitos canónicos y se integra en:

| Servicio vigente | Hito | Escritura que activa el gate |
| --- | --- | --- |
| EF | Capítulo 4 enviado al autor para feedback | `actualizarCapituloAutor` |
| CR / Capítulo | Mismo hito | `actualizarCapituloAutor` |
| CR / Tripa | Tripa completa enviada al autor | `actualizarSeccionEdicion.edicionFechaEnvioAutor` |
| SE | Diseñador asignado | `asignarDisenador`, incluso un retry de la asignación |

Un feedback de tripa aplicado ya registrado (`fechaFeedbackTripa`) también es
evidencia histórica para reconciliar un hito cumplido. El gate no espera ese
cierre cuando ya existe la fecha de envío al autor. La clasificación tardía de
CR reevalúa los hitos. Las transacciones bloquean proyecto antes de modificar
el hito; creación, notificación y audit ocurren juntos. El UNIQUE protege retries
concurrentes. No reinicia un trabajo avanzado.

La migración habilita proyectos con hitos existentes y planes históricos reales.
Las lecturas GET no crean trabajo ni notificaciones. No hay botón para habilitar
arbitrariamente un proyecto sin hito.

## Reuniones: una sola fuente

Primera y segunda reunión de PyL son los mismos conceptos en Ficha y Matriz.
Los campos `lanzamientoPromocionFechaPrimeraReunion` y
`lanzamientoPromocionFechaSegundaReunion` son la escritura canónica.
0072 completa vacíos desde las columnas antiguas de asesoría, sin sobrescribir
conflictos. Las columnas antiguas quedan preservadas como evidencia; sus rutas
de escritura se traducen a la fuente canónica y sus DTO leen aliases de esta.
Borrar una fecha canónica no resucita la fecha histórica.

Los nuevos flags de realización son nullable: un registro histórico se muestra
«Registrada», sin inferir realización por el paso del tiempo. Una reunión nueva
se programa con flag false; RRPP confirma su realización con fecha no futura.
Responsables nuevos usan cuentas RRPP reales. Encargados de texto/enum anteriores
siguen consultables cuando no hay FK. `ficha_lanzamiento_reuniones` conserva las
reuniones adicionales y agrega responsable FK, realización y clave de retry.

## Planificación, promoción y oportunidades

Listado paginado de 25, búsqueda por autor/coautor/código/títulos, filtros por
fase, feria y responsable. SQL prioriza acción vencida, próxima, pendiente sin
fecha y culminados. La prioridad usa fecha local de Caracas; no `updatedAt`.
Detalle: consultas acotadas por proyecto, historial de asignaciones, Ficha,
reuniones, eventos, publicaciones y auditoría pública.

Las fases mantienen el enum vigente: En asesoramiento, Esperando fecha,
En espera de lanzamiento y Culminado. Los chips normalizan solo la presentación.
Las barras son estados discretos, sin porcentajes ni SLA nuevos.

Ruta «En preparación» sin enlace, «Lista» con enlace y «Enviada» con el flag
canónico. Marcar enviada exige enlace; la operación registra un envío que RRPP
ya realizó por su canal habitual. No envía correos ni carga archivos. La fecha de
modificación proviene de audit, no de una fecha inventada.

Ferias usan campos canónicos de feria proyectada, información enviada,
participación y feria confirmada. Los eventos concretos se relacionan con Agenda.
Satisfacción conserva Bueno/Excelente/Regular, valores cualitativos de la Matriz;
se registra durante asesoría/reuniones o revisión de postventa, sin convertir a NPS
ni imponer un momento de registro que las fuentes no definen.

Venta cruzada usa las diez opciones de la validación real. Solicitar cotización
y registrar interés en Distribución notifican una vez por cambio al área receptora.
No crean operaciones, precios, contratos ni avances especializados de esas áreas.

## Agenda y Publicaciones

Agenda usa mes/calendario de teclado en escritorio y lista en móvil; consultas
de hasta 93 días, máximo 500 registros con aviso explícito para acotar filtros.
Tipos: todos los tipos históricos de la Matriz, normalización de mayúsculas,
espacios y erratas seguras, más tipos reales registrados posteriormente.
Los responsables son RRPP; el representante puede ser una cuenta interna activa
de PanHouse, sin otorgarle permisos de RRPP. Hora se almacena como hora local
del evento, separada de fecha. Estado: No iniciada/En curso/Bloqueada/Completada;
fase: Antes del evento/El mismo día/Tras el evento/Finalizado el evento.

Publicaciones: Futuro Autor y Novedades, estados Nuevo/En curso/En revisión/
Publicado/Suspendido/En pausa. Conserva aparte el estado de pieza de cada tipo
según su validación real. La fecha mostrada se consulta en Ficha: pautada por
autor, o tentativa cuando aquella falta. Detalles/notas conservan los recursos
que correspondan; no se agrega una columna de fecha de publicación sin fuente.
Listado y búsqueda paginados en SQL. Ninguna acción publica en una red externa:
RRPP registra su gestión y la publicación efectivamente realizada.

## Permisos, auditoría y límites

Todos los endpoints del workspace requieren RRPP. No heredan permisos de
Creativa, Diseño, Producción, Impresión o Distribución. Se corrigen guards antiguos:
Impresión pertenece al rol existente `impresion`; Distribución incorpora el rol
real `distribucion` (Líder de Distribución de la Ficha), sin crear cuentas ni
asignar personas. El control agregado que ya podía completar el especialista
dueño del proyecto conserva ese acceso. RRPP lee contexto y deriva oportunidades.
La UI de Ficha deshabilita edición especializada y el backend la rechaza.

`project_assignments.tipo=rrpp` mantiene asignación actual y reasignaciones.
Proyectos cerrados/suspendidos o planes cancelados son de consulta. Cada cambio
de negocio audita dentro de la transacción; retries/no-op no duplican el evento.
Historial expone una allowlist de títulos humanos, fecha, proyecto y nombre de
actor, con paginación de 30. No devuelve JSON técnico ni detalles privados.
Inicio y consulta 360 consumen los nuevos eventos, sin rediseñar sus interfaces.

Gaps conservados explícitamente:

- La Matriz tiene ferias con años y nombres históricos adicionales; el catálogo
  vigente de Ficha tiene cuatro ferias sin edición anual. No se asigna un año
  inventado ni se importa uno de forma ambigua.
- No hay importación automática de la Matriz histórica ni enlace inequívoco para
  todos sus autores. Las relaciones nuevas siempre requieren proyecto real.
- No hay integración para publicar en redes, calendar externo, enviar correos o
  subir binarios; las operaciones registran acciones y enlaces del equipo.
- Fechas/encargados históricos sin evidencia de realización o cuenta no se
  completan artificialmente. Campos antiguos se conservan sin DROP.
- Agenda implementa vista mensual y lista móvil; no ofrece una vista semanal
  redundante. Detalle muestra hasta 50 eventos en orden de fecha y 50 publicaciones
  recientes, con totales reales y aviso cuando hay más. Remite a Agenda por período
  y a la bandeja paginada para consultar el conjunto. Reuniones adicionales tienen
  paginación SQL de 25, conservada en la URL.

## Validación

Pruebas de integración sobre PostgreSQL `_test`: gates por servicio, negativos,
retry/concurrencia, Ficha compartida, fases/fechas/reuniones/ruta/ferias/satisfacción,
asignaciones, derivaciones, eventos/publicaciones 1:N, filtros/paginación,
auditoría y RBAC. Las pruebas existentes de Impresión/Distribución se actualizan
al ownership solicitado; no se eliminan sus verificaciones de estado y pertenencia.
La QA visual usa una fixture aislada, retirada al terminar, y comprueba 1440×900
y 375px, con capturas fuera del repositorio.

Validación final (9 de octubre de 2026): 60 pruebas nuevas en
`tests/rrppLanzamientos.routes.test.ts`; suite completa, 921 pruebas en 51 archivos,
todas aprobadas. Typecheck y build de backend/frontend aprobados. Vite conserva
el aviso de bundle principal mayor a 500 kB. QA visual a 1440×900 y 375×812,
sin desbordamiento horizontal; selección, recarga, ruta, registro de evento,
estado de publicación y formularios móviles comprobados. La fixture y los
scripts temporales se retiraron; la base real tiene 0 planes habilitados.
