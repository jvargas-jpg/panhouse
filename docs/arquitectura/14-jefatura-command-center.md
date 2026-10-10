# Inicio de Jefatura: decisión y supervisión operativa

Inicio responde «¿qué necesita mi decisión o atención hoy?». Sustituye el branch
`jefe_area` de HomePage, comparte CrmSidebarLayout y TopBar y no construye Indicadores.

## Fuentes y baseline

Baseline `c7c7289`: git limpio y typechecks de backend/frontend correctos. Se inspeccionaron
proyectos, servicios, pausas, cronograma, alertas, assignments, work_items, audit_logs,
notificaciones, intake/handoff RRPP y los documentos de arquitectura/auditoría.
`fuentes-negocio/` no está disponible en este checkout. La Matriz IA CSV conservada
en `panhouse_antigua/referencia/` evidencia servicios, fechas, GAP, responsables y
procesos simultáneos. Los manuales, ficha y PPT originales mencionados no están
disponibles aquí; no se reemplazan por reglas inferidas de ejemplos del prompt.
También se leyeron las hojas y fórmulas de `IA Matriz Proyectos - Panhouse -
PED-FOR-002.xlsx` y `TIEMPOS POR ETAPA PROCESO.xlsx` del checkout antiguo.
La Matriz conserva BDD-IA, instructivo, culminados, pausados e indicadores 2025.
El GAP observado (`TODAY()-K2`) es positivo cuando se sobrepasa el objetivo;
la duración observada (`TODAY()-J2`) es una magnitud distinta. No se tradujo
el margen del helper de alertas a un supuesto GAP con signo inverso.

## Snapshot operativo (no indicadores históricos)

- **Por asignar:** proyecto activo formalmente enviado (`notificadoJefatura`), sin
  especialista ni assignment de especialista activo. RRPP listo no equivale a enviado.
- **Solicitudes:** work_items pendientes de Dirección Creativa con intervención real
  existente y sin líder asignado. Su asignación pertenece a Jefatura en el backend
  actual. No suma notificaciones ni solicitudes de Editor. No se inventan solicitudes
  de pausa, excepciones ni escalaciones donde el dominio no las modela.
- **En riesgo:** proyectos del ámbito de Jefatura (enviados o con especialista)
  con alerta central (`evaluarRiesgo`: vencido o 80% del plazo operativo consumido,
  descontando pausas), estado macro retrasado, work_item abierto bloqueado o vencido.
  El vencimiento usa el SLA fijado de Corrección (`evaluarPlazoCorreccion`),
  Diseño/Calidad (`plazoDiseno`), o la fecha pautada del work_item como fallback.
  Diseño respeta la última entrega; Calidad respeta su revisión. Las horas se
  conservan y se muestran en Caracas. Un SLA sin fecha fijada sigue desconocido.
  Es una definición compartida backend, no un score frontend. Se muestran causas.
- **Express:** candidatos con fecha deseada anterior al compromiso estándar del
  catálogo, junto con confirmados. Cada uno distingue «Posible Express»,
  «Express confirmado» o «Prioridad normal» y explica ambas fechas y compresión.

## Carga y recomendación

Se conserva `calcularCarga` y ESTADOS_ACTIVOS: en_proceso, retrasado, stand_by y
pausado. La suma lee `servicios.pesoComplejidad`. Se elimina el N+1 del listado de
carga mediante lecturas por lotes. Solo especialistas activos son candidatos.
Inicio y Asignaciones usan el mismo snapshot. No existen máximos de capacidad ni
umbrales aprobados; se muestran puntos ponderados, cantidad, composición, Express
confirmados y riesgos, sin porcentajes, etiquetas arbitrarias ni multiplicadores.

Orden determinista: carga ascendente, riesgos ascendentes, Express confirmados
ascendentes, nombre e ID para estabilidad. Se explica el criterio real que distingue
al candidato; no se afirma experiencia, compatibilidad o disponibilidad no registrada.
Jefatura puede elegir otra persona. La recomendación se deriva y no se persiste.

## Express

`calcularCronograma` sigue siendo fuente de fecha estándar: inicio programado y
plazos del catálogo; para Sello, compromiso comercial y no meta interna. Fecha
deseada: `proyectos.fechaDeseadaAutor`, con fallback a la ficha RRPP
`fechaDeseadaCulminacion`. La fecha de inicio real continúa usándose en alertas.

Una decisión explícita guarda estado, actor, momento, motivo opcional y snapshot
de fechas en el proyecto, con audit inmutable anterior/nuevo y compresión. Si las
fechas cambian, la decisión deja de aplicar y vuelve a requerir revisión. Mantener
prioridad normal no borra el deseo del autor. Confirmar no altera plazo, peso ni
fecha comprometida. La mutación bloquea la fila y verifica handoff/proyecto activo.

## Asignación y ownership

Se reutiliza `asignarEspecialista`: transacción, FK, asignarConHistorial, cierre de
assignment anterior, audit, notificación individual y work_item completado. Se
añade bloqueo de proyecto y validación de usuario activo con rol especialista.
El endpoint de Jefatura exige handoff y conserva idempotencia y reasignación.
La primera asignación conserva el contrato de iniciar Producción; repetir o
reasignar conserva el estado actual y no reanuda pausados ni elimina retrasos.
Jefatura supervisa todos los proyectos recibidos: jefeAreaId no es una restricción
de lectura en el modelo vigente. RBAC exclusivo jefe_area, UUID validado, 404 para
inexistente y 409 para no enviado/cerrado/candidato inválido.

Solicitudes de Editor pertenecen a jefe_edicion; Corrección/Diseño a especialista;
el dashboard las etiqueta como supervisión y enlaza al expediente sin ejecutar
acciones ajenas. No introduce permisos de edición, aprobación creativa o Calidad.
La revisión creativa usa usuarios activos y el endpoint existente de asignación
de líder; después invalida el snapshot y la ficha. No ejecuta brief, conceptos ni
aprobaciones. Se corrigió una excepción antigua en las rutas inicio/entrega de
Corrección que autorizaba a jefe_area: ahora Jefatura solo consulta seguimiento,
sin alterar el permiso del corrector ni la representación freelance del especialista.
Seguimiento preserva múltiples work_items simultáneos y responsables actuales.
Actividad usa un endpoint independiente, máximo cinco eventos audit reconocidos,
texto humano y ninguna exposición de JSON, secretos o IDs técnicos.

## Interfaz y navegación

Cuatro KPIs, bandeja con cuatro tabs, capacidad compacta, seguimiento prioritario,
solicitudes recientes y actividad. Drawer de candidatos con comparación, fechas y
confirmación humana; móvil a pantalla completa y acción sticky. Navegación: Inicio,
Asignaciones y carga, Proyectos, Seguimiento, Solicitudes, Indicadores. Seguimiento
completo existente se conserva; Solicitudes se limita a la misma vista previa e
Indicadores tiene estado explícito pendiente, sin gráficos nuevos.

## Gaps conservados

Magnitud de pesos aún provisional según catálogo/documentación; no modificada.
Catálogo local verificado: EF 4/180 días, EEC 3/150, EET 2/150, CR 3/150;
SE 1, meta interna 60 y compromiso comercial 90. Los números se leen de BD;
estos valores documentan la consulta, no son constantes del recomendador.
Crudo Tripa tiene discrepancia entre cálculo documental de ingreso y catálogo;
Inicio reutiliza cronograma central y lo informa sin inventar otra duración.
La Matriz contiene GAP, pero no existe helper central respaldado para GAP en el
código actual: no se calcula ni se cambia signo. Días efectivos reutilizan
calcularDuracionEfectivaDias, no cálculo en React. No hay capacidad máxima,
competencias por servicio ni solicitudes genéricas confirmadas.

## Validación

Tests de handoff, cola, carga/composición, recomendación frente a cantidad,
riesgo/pausas/paralelismo, solicitudes/ownership, Express y decisiones obsoletas,
RBAC/IDOR, asignación/reasignación, historial, audit y notificaciones. Revisión visual
en 1440×900 (dos iteraciones), 768×1024 y 375×812.

### Resultado final de pruebas y compilación

La corrida completa de `npm test` cubrió **54 archivos y 1.015 casos**:
1.010 pasaron y cinco fallaron. Se inició antes de terminar los ajustes de
SLA, conservación del estado pausado y permiso de ejecución de Corrección;
ese proceso conservó el comportamiento anterior en cuatro casos de Jefatura.
El quinto fue un timeout de 30 segundos del hook de preparación de Calidad.

Con el código final estable se abrió un proceso nuevo y se repitieron los
ocho archivos afectados: **202/202 pruebas correctas**, incluidos **23/23**
casos de Jefatura y **15/15** de Calidad. Los cinco fallos iniciales pasaron,
sin modificar expectativas, eliminar casos ni aumentar los timeouts. El
resultado final combina la corrida completa y esta reejecución; no quedan
fallos pendientes.

Comando de reejecución:

```text
npm test -- tests/jefatura.test.ts tests/proyectos.routes.test.ts tests/proyectos.test.ts tests/correcciones.test.ts tests/assignments.test.ts tests/carga.test.ts tests/calidad.test.ts tests/workflowCore.test.ts
```

Backend: `npm run typecheck` y `npm run build` correctos. Frontend:
`npm run build` correcto, con comprobación TypeScript incluida. Vite informa
que el bundle principal supera 500 kB; la compilación termina correctamente.
La migración 0074 es aditiva y quedó aplicada a la base local y a las bases
aisladas de validación; no se conectó ni se modificó producción.

### Autoauditoría visual y pruebas de flujo

Las capturas están en `evidencia-jefatura/`. `desktop-1.jpg` mostró una columna
de capacidad que empujaba el seguimiento debajo del primer pantallazo y dejaba
espacio vacío bajo la bandeja. Se separaron las columnas: bandeja y seguimiento
a la izquierda, capacidad y solicitudes a la derecha. Se ajustaron tamaños de
texto y espaciado; `desktop-2.jpg` muestra el seguimiento dentro del primer
pantallazo. Se conservan las dos capturas para revisar la iteración.

`tablet.jpg` verifica navegación compacta, KPIs 2×2, tabla y composición apilada
en 768×1024. `mobile.jpg` verifica tarjetas por proyecto y navegación accesible
en 375×812. El ancho de documento y body coincide con el viewport: 375 px;
en tablet coincide con 768 px. No hay desbordamiento horizontal de la página.
Se compactó la TopBar para evitar el salto de línea del botón de salida.

`drawer-mobile.jpg` mide un dialog de 375×812, origen (0,0), footer en y=812:
la asignación permanece visible mientras se desplaza la comparación.
`express-mobile.jpg` comprueba estándar, deseada, compresión y ambas decisiones.
El aviso flotante se desplazó sobre el footer para no tapar las acciones.

Se usó `panhouse_jefatura_preview`, una base local separada: nunca se agregaron
proyectos de QA al entorno de desarrollo. El script reproducible es
`scripts/jefatura-preview.ts`; comprueba host local, crea exclusivamente ese
nombre, migra y reinicia solo sus fixtures ficticios. `PREVIEW_REUSE_DATA=true`
permite revisar el estado sin volver a sembrar. API de QA 3002, Vite 5174 con
`VITE_API_PROXY_TARGET=http://localhost:3002`. Credenciales de QA son ficticias.
Para futuras sesiones se debe iniciar Vite con `--host 127.0.0.1 --port 5174`
y abrir `http://127.0.0.1:5174`: así la cookie de QA tiene host distinto de la
sesión de desarrollo en localhost. La sesión local de Jefatura quedó restaurada.

En navegador se confirmó Express, se eligió manualmente a Mateo frente a Camila
recomendada y después se reasignó a Camila. Se verificaron carga, FK visible,
salida de la cola y actividad. Se mantuvo prioridad normal para Sofía, sin borrar
su fecha deseada. Después, Mateo (4 proyectos / 6 puntos) resultó recomendado
frente a Camila (2 / 7): `recommendation-mobile.jpg`. La última asignación dejó
Por asignar=0 con mensaje de bandeja vacía. Se asignó el líder creativo Julia:
Solicitudes pasó de 1 a 0 y Edición permaneció visible solo para supervisión.
Se bloqueó temporalmente solo la consulta de actividad en el navegador: el error
quedó en su sección y los cuatro KPIs y la bandeja continuaron disponibles. Se
restauró la red y Reintentar recuperó los eventos; el estado final no tiene bloqueos.
Los estados sin snapshot muestran datos no disponibles, distintos de cero o de
una cola vacía. `desktop-final.jpg` documenta la revisión final de localhost.

### Mapa del reporte solicitado

| Apartado | Resultado |
|---|---|
| A | Baseline limpio `c7c7289`; typechecks iniciales correctos; inspección de helpers, ownership y fuentes disponibles. |
| B | Reemplazo de PanelJefaturaPage en el branch jefe_area de HomePage; shell y TopBar compartidos. |
| C | Logo real, sidebar azul marino, seis destinos, Indicadores separado y footer «Historias que conectan». |
| D | Exactamente cuatro KPIs: Por asignar, Solicitudes, En riesgo y Express, con las definiciones del snapshot descritas arriba. |
| E | Proyectos activos formalmente enviados por RRPP; se excluyen quienes tienen FK o assignment activo de Especialista y los cerrados. |
| F | Alerta central con pausas, macro retrasado y procesos abiertos bloqueados o vencidos; SLA real con hora cuando existe. Cada proyecto explica sus causas. |
| G | Estado Express explícito, snapshots de fechas, actor, momento, motivo y audit; no cambia pesos ni plazos de catálogo. |
| H | Fecha deseada anterior al compromiso estándar comercial calculado por cronograma; se muestran ambas fechas y compresión. |
| I | Jefatura confirma Express o mantiene prioridad normal desde el drawer; el backend valida vigencia y bloquea la fila. |
| J | Carga ponderada de proyectos en_proceso, retrasado, stand_by y pausado; cantidad y composición visibles. |
| K | Pesos y plazos vigentes leídos de servicios: consulta local EF 4/180, EEC 3/150, EET 2/150, CR 3/150, SE 1 y 60/90. |
| L | Menor carga; desempate por menor riesgo, menor Express confirmado, nombre e ID. Sin asignación automática. |
| M | Razones derivadas del criterio que distingue al candidato; posibilidad de comparar y elegir otro. No inventa competencias ni disponibilidad. |
| N | Asignación reutiliza helper transaccional con validación de candidato activo y handoff formal. La primera inicia Producción según el contrato existente. |
| O | Reasignación cierra la anterior y conserva el estado macro, incluidos pausados; repetir la selección es idempotente. |
| P | project_assignments conserva historial y responsable vigente, junto con FK sincronizada. Bloqueo de proyecto evita dos asignaciones activas concurrentes. |
| Q | Audit existente para asignar/reasignar; eventos Express con anterior/nuevo, fechas y compresión. Rollback no deja eventos parciales. |
| R | Notificación individual al especialista mediante helper existente, sin broadcast ni duplicación en retries. No se usa como KPI de solicitudes. |
| S | Hasta seis proyectos prioritarios y sus work_items paralelos, responsables y vencimientos; vínculo al seguimiento completo existente. |
| T | Solicitud creativa real para asignación de líder por Jefatura. Editor y otras áreas se muestran con su dueño y acceso de supervisión. |
| U | Endpoint independiente de actividad, máximo cinco movimientos humanos reconocidos; sin JSON ni IDs técnicos en el texto. |
| V | PanelJefaturaPage, JefaturaSidebar, JefaturaCards, AssignmentCandidateDrawer, commandCenterApi y CSS aislado; TopBar compacta compartida. |
| W | GET /api/jefatura/dashboard, GET /api/jefatura/actividad, PATCH /api/jefatura/proyectos/:id/especialista, PATCH /api/jefatura/proyectos/:id/express. Snapshot hasta siete lecturas por lotes, actividad independiente; no N+1 por proyecto/persona. Revisión creativa reutiliza /api/usuarios y /api/direccion-creativa/:id/asignar. |
| X | tests/jefatura.test.ts: handoff, pesos frente a cantidad, desempates, pausados/stand-by, riesgo/pausas, paralelismo/responsables, vencimientos exactos y entregas puntuales de Corrección/Diseño/Calidad, ownership, Express, vigencia, todos los roles ajenos, IDs, idempotencia, concurrencia, rollback, reasignación pausada y actividad saneada. |
| Y | 1.015 casos en 54 archivos revisados en la corrida completa; reejecución final de los ocho archivos afectados: 202/202 correctos, incluidos 23/23 de Jefatura. Cinco fallos iniciales resueltos, según el registro de validación anterior. |
| Z | `npm run typecheck` y `npm run build` de backend correctos. Build frontend correcto (incluye su typecheck). Vite mantiene el aviso de tamaño del bundle principal, mayor de 500 kB; no impide compilar. |
| AA | Escritorio 1440×900: desktop-1, crítica del vacío y seguimiento desplazado, corrección de columnas y desktop-2. desktop-final documenta la última inspección del código final en localhost. |
| AB | Tablet 768×1024: navegación compacta, KPIs 2×2 y composición apilada; ancho del documento 768 px. |
| AC | Móvil 375×812: tarjetas, TopBar sin salto, navegación accesible, drawer de pantalla completa y acción sticky; ancho del documento 375 px. Express, recomendación y bandeja vacía ejercitados. |
| AD | Fuentes originales faltantes, pesos provisionales, discrepancia Crudo, falta de helper GAP y capacidad máxima; no se inventaron reglas. |
| AE | Commit local solicitado: `feat: build jefatura operational command center`. El identificador se entrega en el reporte final. |
