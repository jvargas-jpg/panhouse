# Continuación de la guía editorial — 13 de noviembre de 2026

## Estado de entrega

Se retomó el trabajo local en `C:\Users\PC\Documents\Panhouse`, desde el commit `a04dbea`, con el árbol de trabajo inicialmente limpio. La implementación de la otra PC ya estaba guardada principalmente en `339f2d7`; no se reconstruyó desde cero. Los cambios de esta continuación permanecen locales, sin commit ni despliegue.

**La definición completa de terminado del encargo original aún no está cumplida.** Falta el recorrido visual integral de Escritura Fantasma y la validación con entregas reales de proveedores. Computer Use detuvo el intento de QA porque no pudo determinar con suficiente confianza la URL activa de Chrome en Windows. No se obtuvieron capturas ni se declara aprobado el QA visual.

## Arquitectura anterior y auditoría

La aplicación conserva Fastify, Drizzle/PostgreSQL y React/React Query. El dominio se apoya en `work_items`, `project_assignments`, `solicitudes_area`, capítulos, correcciones, direcciones creativas, versiones de Diseño y rondas de Calidad. La Ficha y el Command Center agregan esos datos; Drive y la auditoría registran entregas y decisiones.

Se revisaron HomePage, App, navegación por rol, Panel de Jefatura, Proyectos, Seguimiento, Mi trabajo, Mis proyectos, Solicitudes, objetivos, Command Center, Ficha viva, preparación, gates, configuración de servicio/fases/pasos, asignaciones, solicitudes de Editor/Validador, entregas editoriales, detección de Drive, versiones de Diseño, aprobación del Autor y solvencia.

La base recuperada ya tenía el portafolio y la guía, pero presentaba problemas concretos:

- El paso actual dependía de `canOperate`, por lo que podía diferir al cambiar de rol.
- El portafolio cargaba un Command Center completo por proyecto y ordenaba las acciones después de paginar.
- La pantalla clasificaba como espera cualquier proyecto sin acción, incluidos los bloqueados.
- La guía ocultaba operaciones existentes de títulos y del Portal del Autor.
- Los objetivos conservaban enlaces internos a Seguimiento.
- La solicitud de Validador de cubierta no aparecía en la bandeja del Especialista.
- Los requisitos de convergencia podían aceptar evidencias de versiones o intervenciones anteriores.
- El formulario de Paquete Final enviaba un cuerpo sin el contenedor `datos` que exige la API.
- Una liberación bloqueada por solvencia podía devolver 500 en vez de un conflicto de dominio.

## Pantallas consolidadas y rutas

Jefatura conserva Inicio, Proyectos, Asignaciones y carga, Decisiones e Indicadores. Seguimiento no tiene una segunda entrada operativa. Objetivos del mes pertenece a Indicadores.

El Especialista conserva Inicio, Proyectos, Solicitudes y Objetivos del mes. Mi trabajo y Mis proyectos son entradas de compatibilidad hacia Proyectos. El Inicio distingue acciones inmediatas, esperas de terceros y otros bloqueos.

| Ruta anterior | Destino vigente |
| --- | --- |
| `/?vista=seguimiento` | `/?vista=proyectos` |
| `/?vista=seguimiento&proyecto=<id>` | `/proyectos/<id>` |
| `/?vista=seguimiento&subvista=objetivos` | `/?vista=indicadores&subvista=objetivos` |
| `/?vista=mi-trabajo` / `/?vista=mis-proyectos` | `/?vista=proyectos` |
| Entradas anteriores con `proyectoId` o `proyecto` válido | Guía del proyecto, conservando los parámetros restantes |
| `/proyectos`, para Especialista/Jefatura | Portafolio del rol |
| `/proyectos/<id>/operacion` | La misma guía del proyecto |
| `/proyectos/<id>/ficha-trazabilidad`, para ambos roles | Información del proyecto |

No se borraron rutas de dominio ni componentes históricos que todavía pueden servir de adaptadores. Se retiró el renderizado muerto de Seguimiento en el Panel de Jefatura. Comercial, RRPP, Edición y otros roles mantienen sus entradas propias.

## Nuevo flujo de Jefatura y del Especialista

El portafolio muestra autor/libro, responsable, posición, esperas, riesgo y siguiente hito. El proyecto abre la guía; Información del proyecto, Equipo e Historial quedan como superficies secundarias.

Jefatura recibe la misma posición, caminos, requisitos y responsables que el Especialista. Sus capacidades de operación están deshabilitadas; conserva las asignaciones de Validador y los enlaces a decisiones/asignación que le corresponden.

El Especialista empieza por preparación, con requisitos del paso actual. Puede solicitar Editor desde Edición, ver la espera de Jefatura de Edición y trabajar otro camino. Cuando existe asignación o entrega, la proyección cambia al releer los hechos. Puede regresar a preparación; antes de iniciar procesos posteriores puede corregir sus datos. Después, los cambios sensibles quedan bloqueados con advertencia tanto en interfaz como en servidor.

Se restituyó el registro de títulos dentro de Edición/Creativa y el acceso contextual a documentos/aprobaciones del Autor. Las operaciones existentes conservan sus validaciones.

## Modelo de Guided Workflow y selector

`projectGuide` y `guideProcesses` son proyecciones de lectura. No se agregó una tabla de estados de guía, una máquina de workflow paralela ni una migración de esquema.

`requiresAction` describe una necesidad editorial independiente del rol que consulta. `canOperate` y `canContinue` describen capacidades del actor. La selección del paso principal ya no depende de que el observador tenga permiso de operarlo.

El selector distingue disponible, en curso, esperando tercero, bloqueado y completado. Los caminos usan la configuración activa del servicio y conservan trabajos existentes. La preparación de registros históricos no invalida silenciosamente procesos posteriores.

`POST /api/proyectos/:id/workflow/continue` vuelve a obtener la guía y verifica sus requisitos en backend. No acepta un `canContinue` enviado por el cliente ni marca procesos como terminados: orienta hacia una operación disponible.

Las lecturas de hechos se agrupan en una consulta con agregados correlacionados y decodificación con el esquema Drizzle. El portafolio reutiliza esa proyección, prepara las prioridades antes de paginar y no realiza una llamada al Command Center por cada fila. Las pruebas verifican que el número de consultas no crezca con proyectos/intervenciones adicionales.

## Gates y convergencia

Creativa utiliza el código canónico del servicio y el gate existente de títulos/momento editorial. Diseño distingue las condiciones de muestra/cubierta y las de diagramación completa. Corrección conserva las operaciones y excepciones existentes; no se impuso una dependencia universal de Edición a servicios que no la tienen.

Paquete Final deriva sus requisitos de `servicio_fases`; usa carpetas persistidas como compatibilidad si no hay configuración. Sin definición suficiente permanece bloqueado. Se evalúan la intervención vigente de Corrección, el concepto y sus aprobaciones/recursos, la versión vigente de diagramación, aprobación del Autor, Revisión Final y cubierta vigente cuando aplican. Una evidencia anterior no basta para aprobar una nueva versión.

Preparar el paquete y liberarlo son operaciones distintas. La preparación editorial puede completarse sin solvencia; la liberación requiere paquete preparado y gate financiero satisfecho. El bloqueo devuelve 409 con explicación. Se conserva la autoridad administrativa que ya existe: Comercial confirma solvencia y Cobranzas verifica pagos.

## Solicitudes, Drive e historial

La bandeja sigue siendo una proyección de solicitudes nativas, no un CRUD universal. Se incorporó el contexto de Validador de cubierta y los resultados derivados de asignación, inicio de revisión y comentarios enviados a Diseño. Se conservan proyecto, proceso, trabajo de origen, destinatario e historial.

La detección de entregas editoriales sigue llamando al comando canónico de entrega, que actualiza capítulo/trabajo, auditoría y notificación. Correlaciona proyecto, carpeta persistida, trabajo, actor, asignación y tipo de entregable; no usa el nombre como autoridad. Las cargas nuevas incluyen `panhouseCycle`, ligado a la entrega previa, para evitar reutilizar metadatos de una ronda anterior de feedback. La compatibilidad por contribuidor solo aplica si no existe metadata contradictoria y hay una única intervención candidata.

Corrección mantiene el detector de Word e informe técnico por carpeta y metadata; Diseño/Calidad conserva la detección de nuevas versiones y los intercambios del Validador. No se contactó Drive real ni se enviaron correos externos durante esta continuación.

El historial se conserva en los eventos de dominio. No se añadió una obligación de escribir manualmente un historial después de cada acción.

## Ficha, permisos y migración

No se copiaron datos históricos ni se eliminaron campos. La guía lee hechos canónicos y usa los comandos existentes para escribir. Los formularios heredados de Edición/Corrección/Creativa/Diseño/Calidad permanecen como adaptadores durante la migración.

Las comprobaciones de acceso continúan en servidor. El historial vigente de asignaciones prevalece sobre claves antiguas. La reutilización del proyecto ya autorizado evita lecturas duplicadas dentro del Command Center; las rutas públicas de Validaciones siguen verificando su propio ámbito. No se habilitó a Jefatura para rellenar formularios del Especialista ni a proveedores externos para iniciar sesión.

## Verificación y evidencias

- Builds de backend y frontend: aprobados. Vite conserva su advertencia de tamaño del bundle principal.
- Regresión focalizada amplia: **161 pruebas de backend aprobadas** en 10 archivos. La aserción de navegación que falló por el orden de atributos HTML se corrigió; el último pase de guía/interfaz terminó con **15/15 aprobadas**, incluyendo la nueva edición segura de preparación. Ver `../evidencias/guia-proyectos/tests.txt` y `tests-final.txt`. Los conteos de ambos pases se solapan y no deben sumarse. Incluyen cascada de ingreso, roles, IDOR, asignaciones, solicitudes, capítulo entregado por Drive, espera de Autor, preparación histórica, convergencia por servicio, solvencia, Calidad y cubierta.
- Prueba HTTP con PostgreSQL real: aprobada en dos proyectos y dos roles; confirma estado compartido, coincidencia portafolio/guía y espera de Editor. Ver `http-smoke.txt`.
- Se añadió `tests/projectGuide.test.ts`, pruebas de representación/navegación en `frontend/src/proyectos/projectGuide.test.tsx` y cobertura de guía/outbox en `tests/validaciones.test.ts`.
- La revisión heredada de trazabilidad terminó con **131 aprobadas y 27 fallidas**, principalmente por expectativas de login de Diseñador externo y permisos amplios anteriores del Validador. Se registra separadamente en `legacy-trazabilidad.txt`; no se declara que toda la suite histórica esté verde ni se debilitaron los permisos para hacerla pasar.
- QA visual: bloqueado por Computer Use. Las pruebas de representación no sustituyen la revisión de escritorio/móvil.
- `git diff --stat`, `git status --short` y comprobación de espacios se guardan en el mismo directorio de evidencias. El stat habitual no incluye archivos nuevos sin seguimiento; no se modificó el índice.

## Brechas que siguen abiertas

1. Completar el recorrido manual EF de principio a fin, incluyendo estructura, extracciones, todas las ramas, revisión del Autor y Paquete Final. Los escenarios automáticos cubren tramos reales, pero no equivalen a ese recorrido visual completo.
2. Validar escritorio y móvil, foco/scroll al cambiar de camino y presentación de proyectos reales. No hay capturas aprobadas de esta continuación.
3. Probar entregas externas reales con los permisos vigentes de Drive. Los archivos de Corrección necesitan metadata correlacionable; no se adivina el trabajo a partir de un nombre de archivo ambiguo.
4. Migrar los adaptadores nativos restantes a formularios más específicos por paso. Algunas operaciones todavía abren su sección nativa, con más información de la deseable para la guía final.
5. Definir una operación respaldada para solicitar revisión administrativa a Comercial/Cobranzas. Hoy se explica el bloqueo y se conserva la autoridad existente; no se inventó una solicitud ni un booleano editable del Especialista.
6. Mantener en solo lectura los cambios sensibles anteriores mientras no exista una operación segura de invalidación downstream. También falta completar la eliminación progresiva de controles macro manuales de la Ficha donde aún coexisten con operaciones canónicas.
7. Actualizar los tests históricos que esperan acceso de roles externos retirados y permisos amplios anteriores del Validador, conservando las restricciones vigentes.

## Reproducción local de QA

`scripts/project-guide-qa-server.ts` crea exclusivamente una base local nueva llamada `panhouse_guide_preview`; si ya existe se niega a sobrescribirla. Expone fixtures en 3017, sin workers ni integraciones externas. El frontend QA usa 5177 y `VITE_API_PROXY_TARGET=http://127.0.0.1:3017`. Las rutas de sesión de prueba solo existen en ese ejecutable local; no se registran en el servidor de producto.

`node scripts/project-guide-http-smoke.mjs` comprueba ese servidor por HTTP. La base de desarrollo y los datos diarios no fueron modificados.
