# Entrega: Operación del Especialista y handoffs de RRPP

13 de octubre de 2026. Implementación local sobre `main`, base `ac111c8`. El Especialista coordina desde su asignación; solicita Lanzamiento e Impresión y RRPP acepta y opera. La aceptación resuelve la solicitud y activa el proceso dentro de una transacción. No se hizo push.

La arquitectura, fuentes y límites están en [documento 23](../arquitectura/23-especialista-operacion-ownership.md). La evidencia automatizada completa está en [resultado Vitest](../evidencias/operacion-especialista/tests-finales-verificados.json).

| Punto | Resultado de entrega |
| --- | --- |
| A. Estado inicial | Operación mezclaba ingreso/asignación con producción, Lanzamiento se iniciaba por el hito y Especialista podía modificar controles ajenos. No existían solicitudes formales de estos handoffs. |
| B. Archivos | Backend: esquema/migración 0080, preparación, solicitudes, gates, Command Center, Ficha, trazabilidad y bandejas. Frontend: preparación, seguimiento por área, bandeja RRPP, navegación y estilos. Shared: DTO, gates y ownership. Tests y script QA aislado. El detalle completo está en `git show --stat` del commit de entrega. |
| C. Ingreso RRPP | Sale de Operación desde la proyección del backend; se conserva en contexto previo, expediente e historia. |
| D. Asignación | Sigue siendo canónica; al asignar se abre una única preparación inicial. Se verifica la asignación vigente también dentro de las mutaciones. |
| E. Preparación inicial | Recepción, revisión, primer contacto con plazo de 24 horas, reunión, grabación, transcripción, minuta, cronograma y carpeta Drive manual. Guardar sin hechos no inicia ni completa trabajo. |
| F. Drive readiness | URL real de carpeta validada y estado sin configurar/configurado. Contrato de adapter de almacenamiento preparado; OAuth y API real pendientes. No se agregó un mock operativo. |
| G. Ownership | Especialista coordina; cada departamento mantiene su ejecución. Lanzamiento e Impresión: solicita Especialista, acepta/opera RRPP; Jefatura supervisa. |
| H. Edición | Conserva intervenciones y dueño operativo; no se reemplaza por el handoff de RRPP. |
| I. Corrección | Conserva entregas, feedback y asignaciones nativas. |
| J. Creativa | Conserva dirección y feedback nativos. |
| K. Diseño | Conserva workflow y paquete final canónico; asignación activa el gate SE de Lanzamiento. |
| L. Calidad | Conserva revisión y validación nativas. |
| M. Digital | Especialista consulta; escritura del control reservada a Soporte Digital. |
| N. Lanzamiento antes/después | Antes el hito generaba planificación implícita; ahora habilita solicitar. El proceso comienza cuando RRPP acepta. |
| O. Trigger Lanzamiento | EF y CR Capítulo: feedback enviado del capítulo 4. CR Tripa: feedback enviado del manuscrito completo. SE: diseño asignado. Evaluador compartido y pruebas para cada variante. |
| P. Request Lanzamiento | Persistente, único por proyecto/tipo/business key, versionado e idempotente, con actor/fechas y auditoría. |
| Q. RRPP Lanzamiento | Bandeja de solicitudes recibidas, revisión, información adicional, respuesta del Especialista, aceptación/rechazo y continuación en módulo RRPP existente. |
| R. Impresión antes/después | Antes el Especialista no tenía handoff formal; ahora solicita coordinación y RRPP acepta/opera. Se conserva el rol downstream `impresion`. |
| S. Gate Impresión | `diseno.paqueteFinalCargado === true` en datos documentales canónicos. Habilita coordinación; no certifica solvencia ni autoriza impresión física. |
| T. Request Impresión | Usa el mismo dominio transaccional y lifecycle, con tipo propio, sin duplicar matrices. |
| U. RRPP Impresión | Tras aceptar puede editar el control canónico. Ficha y work item se sincronizan en la transacción; antes de aceptación no puede escribir. |
| V. Mi trabajo | Preparación, solicitudes habilitadas y respuestas pendientes son acciones. Enviar elimina la acción de solicitar. |
| W. Solicitudes | Seguimiento persistente de los handoffs; información y respuesta viven en la misma solicitud. Se conservan las solicitudes nativas anteriores. |
| X. Activity | Eventos humanos de preparación, envío, revisión, información, respuesta y resolución. Sin activar procesos por una mera lectura. |
| Y. Ficha | Conserva fuentes canónicas y permisos; preparación se consulta allí, cambios se realizan en su flujo propio. Impresión editable para RRPP únicamente activa o legacy activa. |
| Z. Jefatura | Supervisión y consulta de procesos, sin formularios operativos de RRPP. Confirmado en navegador. |
| AA. RBAC | Guardas en backend para preparación, requests y controles legacy; UI refleja esos permisos. |
| AB. IDOR | Tests de Especialista ajeno, reasignación, rol incorrecto y alcance de proyecto. La verificación no depende de ocultar botones. |
| AC. Migraciones | Migración aditiva 0080 aplicada: preparación, solicitudes e información adicional; índices/checks/FKs y backfill de trabajo pendiente sin inventar hechos cumplidos. |
| AD. Performance | Lecturas en lote y reutilización de datos ya cargados. Se preservan pruebas de consultas constantes con 1/15 proyectos y 40 intervenciones. |
| AE. Tests nuevos | 21 casos del nuevo dominio: gates, preparación vacía, permisos, idempotencia, preguntas/respuestas, versión obsoleta, rollback y coordinación de impresión. |
| AF. Tests totales | 1.267 pruebas aprobadas en 67 archivos, cero fallos. |
| AG. Full regression | Suite completa final ejecutada después de los últimos ajustes de preparación y permisos de Ficha; exit 0. |
| AH. Typecheck | Backend y frontend: `npm run typecheck`, exit 0. |
| AI. Builds | Backend y frontend: `npm run build`, exit 0. Vite conserva aviso de chunk mayor de 500 kB. |
| AJ. Desktop antes | Se inspeccionó la UI de desarrollo y la primera versión QA; se detectaron cards administrativas y controles ajenos. La captura inicial fue observada en herramienta, no se conservó PNG comparativo. |
| AK. Problemas visuales | Nombre repetido en cards, cabecera duplicada RRPP, descripciones repetidas e historial genérico dentro del nuevo detalle de área. |
| AL. Correcciones | Se eliminaron duplicados; detalles propios de handoff, owners claros, cards compactas y modal adaptativo. |
| AM. Desktop Especialista | 1440×900. [Captura final](../evidencias/operacion-especialista/especialista-desktop.png). Preparación primero y procesos independientes, sin ingreso/asignación. |
| AN. QA RRPP | UI real: solicitud, pedir información, respuesta, aceptación de Lanzamiento y aceptación de Impresión. Solicitudes resueltas y procesos activos. [Lanzamiento](../evidencias/operacion-especialista/rrpp-lanzamiento-resuelto.png), [control Impresión](../evidencias/operacion-especialista/rrpp-impresion.png). |
| AO. QA Jefatura | Consulta del lanzamiento resuelto sin inputs ni Guardar. [Escritorio](../evidencias/operacion-especialista/jefatura-desktop.png). |
| AP. Tablet | 768×1024, dos columnas y navegación adaptada. [Captura](../evidencias/operacion-especialista/especialista-tablet.png). |
| AQ. Mobile | 375×812, una columna; ancho del documento 375 px sin overflow horizontal. [Captura](../evidencias/operacion-especialista/especialista-mobile.png). |
| AR. Known gaps | Falta OAuth real y dominio de producción; no está el archivo IA exacto con sufijo (1); calendario laboral de las 24 horas no definido; autorización física/solvencia no se infieren; reenvío de solicitudes rechazadas requiere política explícita. Se conservan contradicciones documentales anteriores descritas en arquitectura. |
| AS. Diff stat | Disponible íntegro en `git show --stat`; incluye código, migración, tests, documentación y evidencia. Sin cambios destructivos del esquema. |
| AT. Git status | Tres archivos previos de datos demo quedan fuera de este commit: package.json, scripts/panhouse-datos-demo.ts y docs/demo/panhouse-datos-varios.json. |
| AU. Commit | Commit local `feat: align specialist operations with RRPP handoffs`; hash informado en la respuesta de entrega. Sin push. |

El QA utilizó cinco copias de proyectos existentes en una base temporal local, con cookie de sesión diferente. No creó autores/proyectos nuevos en desarrollo. Al terminar se detuvieron los dos servidores QA y se eliminó exclusivamente la base `panhouse_operacion_visual_qa`. Las sesiones de desarrollo se conservaron.
