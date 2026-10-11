# Jefatura: Asignaciones y carga

Ruta: `/?vista=asignaciones`. Rediseño de la distribución editorial sobre los datos existentes, sin modificar pesos, plazos ni reglas de Express. Baseline limpio: `0233b40`. Trabajo local; sin push.

## Auditoría y fuente canónica

La revisión de la base local encontró seis proyectos activos asignados a Especialista Demo: seis puntos, todos de Sello editorial. Carlos Mendoza, Elena Torres, Laura Gil, Roberto Salazar y Sofia Vargas son personas distintas, sin proyectos activos asignados y con carga cero. Se encontraron seis assignments activos de Especialista y **ninguna discrepancia** con `proyectos.especialistaId`. El cero de esas personas era correcto: no había que repartir ni fabricar proyectos para rellenar el panel.

Se eliminó una divergencia potencial: el historial activo de proyecto prevalece sobre la FK cuando ambos difieren. Lista, capacidad de Jefatura y helper general de carga resuelven el mismo responsable: `project_assignments`, tipo Especialista, scope proyecto (`work_item_id IS NULL`), sin finalización; FK como compatibilidad de registros antiguos sin historial. La UI avisa cuando detecta una discrepancia. Las lecturas no reparan ni escriben datos. La escritura transaccional existente sincroniza historial y FK, incluso al repetir una asignación vigente.

Estados que cuentan para la carga: `en_proceso`, `retrasado`, `stand_by`, `pausado`. Culminados y retirados no cuentan. Los candidatos son usuarios activos con rol Especialista; un responsable histórico inactivo puede aparecer como filtro y responsable, pero no se recomienda como candidato.

| Servicio local | Peso vigente | Plazo vigente en días |
| --- | ---: | --- |
| Escritura fantasma (EF) | 4 | 180 |
| Edición de estilo por capítulo (EEC) | 3 | 150 |
| Edición de estilo tripa completa (EET) | 2 | 150 |
| Crudo (CR) | 3 | 150 |
| Sello editorial (SE) | 1 | 60 interno / 90 comercial |

Los nombres visibles se leen del catálogo, sin renombrarlos para imitar la imagen. Los pesos se leen de `servicios.pesoComplejidad`; no hay constantes de peso en la UI. La carga es la suma de esos pesos, no el número de proyectos. Express no multiplica el peso ni altera los plazos.

## Contrato y decisiones

- `GET /api/jefatura/asignaciones`: tabs, búsqueda, servicio, especialista, orden y página validados en backend. Por asignar exige envío formal de RRPP y ausencia de responsable. Un ingreso listo sin envío no entra. Asignados incluye responsables activos del ámbito operativo, conservando registros anteriores al handoff formal. Para esos registros la escritura exige primero el envío formal.
- Express incluye posible y confirmado, con etiquetas distintas. Una decisión normal vigente sale de ese tab. Las decisiones y fechas usan el evaluador central existente.
- En riesgo usa atención central: vencimiento, umbral operativo del 80% con pausas, macro retrasado y procesos abiertos bloqueados o vencidos. Se conservan los SLA con hora y las entregas puntuales. No se introducen umbrales de carga.
- Búsqueda insensible a mayúsculas y acentos sobre título, autores/coautores y código. Debounce de 250 ms. Contadores reflejan los filtros de búsqueda/servicio/especialista, independientemente del tab seleccionado. La capacidad sigue mostrando el equipo completo.
- Orden urgente: vencido, Express confirmado, mayor compresión, menor margen operativo; desempate por código e ID. Otros órdenes: creación reciente, mayor o menor impacto. Se pagina en backend: 20 por defecto, máximo 25; página fuera del último límite se ajusta al último resultado.
- `GET /api/jefatura/proyectos/:id/candidatos`: proyecto activo del ámbito y candidatos reales. Carga proyectada = actual + peso. Para el responsable actual, impacto 0: el proyecto ya está incluido. Se muestran composición, proyectos, riesgo, Express, estado activo y razones.
- Recomendación: carga ascendente → riesgo ascendente → Express confirmado ascendente → nombre en español → ID. La cantidad de proyectos aporta contexto. En reasignación se recomienda entre alternativas, excluyendo al responsable actual, sin impedir conservarlo ni elegir otra persona.
- `PATCH /api/jefatura/proyectos/:id/especialista`: reutiliza `asignarEspecialista` y `asignarConHistorial`. El drawer envía el responsable que estaba comparando; un cambio concurrente genera 409 antes de escribir. Un retry del mismo destino mantiene la idempotencia.
- La transacción bloquea el proyecto, valida rol/actividad/handoff, finaliza el assignment anterior, abre el nuevo, sincroniza la FK, completa el work item, audita y notifica al nuevo responsable. Reasignar conserva el estado operativo, incluidas las pausas.
- Las nuevas rutas exigen sesión y `jefe_area`; IDs/filtros malformados dan 400, proyectos fuera del ámbito o inexistentes dan 404, roles ajenos dan 403.

## Presentación y límites

Dos columnas en desktop: proyectos densos y panel de capacidad/criterios. Tabs compactos, controles alineados, iconos SVG del sistema, CTA dorado para asignar y contorno para reasignar. Título definitivo, título previo o autores como fallback; siempre código humano y autor, sin UUID visible. Las filas ordinarias miden 98 px en 1440×900; Express puede crecer a unos 109 px por el contexto adicional de compresión. Textos largos pueden crecer sin ocultar identidad ni controles.

Ver carga combina el filtro de responsable con Asignados y abre la composición por servicio. Limpiar filtros devuelve el ámbito completo. Las barras son relativas al mayor valor actual del equipo: no representan capacidad máxima ni porcentajes de ocupación. No existe una regla formal de capacidad máxima en los datos disponibles; por eso no se inventan semáforos de saturación.

La carga inicial muestra skeletons. Un error retira proyectos, recomendaciones y capacidad, muestra datos no disponibles y permite reintentar; nunca convierte un error en carga cero. Se conservan las opciones de los filtros al consultar una nueva selección. El comparador pide información vigente antes de habilitar mutaciones. Reasignación requiere un segundo paso explícito con responsable anterior → nuevo y aviso de conservación del historial. Escape, cierre por overlay y retorno del foco conservan el contrato del drawer.

Las nuevas lecturas reutilizan el snapshot central: seis consultas por lotes más una de coautoría cuando hay proyectos. La respuesta de proyectos se pagina después de calcular los agregados en servidor; **no utiliza LIMIT SQL para esos agregados**. Es un coste proporcional al conjunto activo, con número fijo de consultas y sin N+1. El test con 1 y 31 proyectos confirmó siete lecturas y respuesta de 20 con dos páginas. No se descarga el dashboard completo ni la actividad desde esta vista; el comparador se solicita al abrirlo. Inicio y las otras rutas conservan sus componentes.

## Pruebas y evidencias

Primera ejecución: **77/77 en ocho archivos**, 307,30 s. Después de mejorar la explicación de alternativas y añadir pruebas de rendimiento/ámbito, ejecución fresca de Jefatura y Asignaciones: **36/36**, 140,58 s. Resultado: **79 casos distintos aprobados**, 113 ejecuciones contando la repetición. Hay **13 tests nuevos** en `tests/jefaturaAsignaciones.test.ts`. Incluyen discrepancia historial/FK, pesos dinámicos, proyección sin doble conteo, filtros/coautoría, paginación, recomendación por peso, Express, estados activos, owner obsoleto, idempotencia, consultas constantes, ámbito y todos los roles ajenos.

Comandos:

```text
npm test -- tests/jefaturaAsignaciones.test.ts tests/jefatura.test.ts tests/carga.test.ts tests/assignments.test.ts tests/proyectos.test.ts tests/workflowCore.test.ts tests/especialistas.routes.test.ts tests/editores.routes.test.ts
npm test -- tests/jefaturaAsignaciones.test.ts tests/jefatura.test.ts
npm run typecheck
npm run build
cd frontend
npx tsc -b --pretty false
npm run build
```

Se priorizó la suite afectada; no se afirma una nueva corrida completa de los más de mil tests históricos. Los builds incluyen la compilación TypeScript. Vite conserva el aviso previo de bundle principal mayor de 500 kB; no impide compilar.

QA de navegador usa PostgreSQL local **`panhouse_jefatura_preview`**, API 3002 y Vite 5174 en `127.0.0.1`. Son datos ficticios aislados, creados por `scripts/jefatura-preview.ts`; no se modifican los proyectos de desarrollo ni producción. El script tiene guard de host local y nombre fijo, reutilización optativa y modo `PREVIEW_CLEANUP=true` para vaciar exclusivamente esa base temporal. La cookie del host de QA se mantiene separada de localhost.

Flujos comprobados: Por asignar, Asignados, Express posible/confirmado, riesgo, búsqueda vacía, filtros combinados, composición, carga cero y carga mayor. En QA se confirmó Express para un EF de peso 4; Camila pasó de 0 a 4. El comparador mostró 4 + 0 = 4 para ella y 6 + 4 = 10 para Mateo. La confirmación Camila → Mateo transfirió los puntos: Camila 0, Mateo 10, con historial conservado. Se detuvo temporalmente la API de QA para comprobar el error y la recuperación local mediante Reintentar.

La consulta directa posterior confirmó Camila con assignment cerrado y Mateo vigente, FK de Mateo, un evento de asignación y otro de reasignación, work item completado y dos avisos individuales. También se probó elegir a Valentina aunque Camila fuera recomendada. Al terminar todas las asignaciones, Por asignar quedó en cero real. Finalmente se recomendó Mateo (cinco proyectos / diez puntos) frente a Camila (cuatro / once): más proyectos, menor carga ponderada. En móvil se verificó la confirmación Valentina → Mateo y se canceló con Escape sin escribir ese cambio.

Limpieza final completada con `PREVIEW_CLEANUP=true`: cero filas en usuarios, autores, servicios, proyectos, project_assignments, work_items, audit_logs y notificaciones de la base aislada. Los servidores de QA 3002/5174 se detuvieron y su pestaña se cerró. Desarrollo sigue disponible en API 3000 y frontend 5173, con sesión de Jefatura Demo; no se alteraron sus asignaciones. Se retiraron los overrides temporales de tamaño del navegador.

| Evidencia | Qué verifica |
| --- | --- |
| [Desktop #1](../evidencias/asignaciones-carga/desktop-1.jpg) | Captura inicial 1440×900: capacidad demasiado alta, criterios fuera de vista y textos pequeños. |
| [Desktop #2](../evidencias/asignaciones-carga/desktop-2.jpg) | Reducción de filas de capacidad y mejor legibilidad. |
| [Desktop final](../evidencias/asignaciones-carga/desktop-final.jpg) | Datos de desarrollo sin mutaciones, logo y controles definitivos; cero errores de pantalla. |
| [Desktop con QA](../evidencias/asignaciones-carga/desktop-qa.jpg) | Filas densas con títulos, diferentes pesos y prioridad. Datos temporales, no valores de la referencia. |
| [Comparar](../evidencias/asignaciones-carga/comparar.jpg) | Carga actual, impacto, proyección y razones. |
| [Reasignar](../evidencias/asignaciones-carga/reasignar.jpg) | Segunda confirmación y conservación de historial. |
| [Composición](../evidencias/asignaciones-carga/composicion.jpg) | Mateo filtrado por servicio y detalle de su carga completa. |
| [Cero](../evidencias/asignaciones-carga/carga-cero.jpg) | Camila sin proyectos ni carga, distinto de datos no disponibles. |
| [Cola vacía](../evidencias/asignaciones-carga/cola-vacia.jpg) | Todos los proyectos recibidos asignados; acceso a Asignados. |
| [Sin resultados](../evidencias/asignaciones-carga/sin-resultados.jpg) | Búsqueda sin coincidencias. |
| [Riesgo](../evidencias/asignaciones-carga/riesgo.jpg) | Proyecto con causas centrales de atención. |
| [Error](../evidencias/asignaciones-carga/error-datos.jpg) | Error recuperable; capacidad desconocida y mutaciones no disponibles. |
| [Tablet](../evidencias/asignaciones-carga/tablet.jpg) | 768×1024, documento de 768 px, navegación compacta y paneles apilados. |
| [Móvil](../evidencias/asignaciones-carga/mobile.jpg) | 375×812, documento de 375 px, tarjetas y filtros sin desborde. |
| [Comparador móvil](../evidencias/asignaciones-carga/mobile-comparar.jpg) | Pantalla completa, acciones persistentes y foco restaurado. |

## Reporte A–AH

| Apartado | Resultado |
| --- | --- |
| A. Auditoría inicial | Baseline `0233b40`, git limpio, inspección de UI, catálogo, handoff, estados y helpers existentes. |
| B. Demo vs cero | Demo tiene seis proyectos/seis puntos; las otras cinco personas son distintas y tienen cero real. |
| C. Bug/corrección | No había discrepancias locales. Se unificó la prioridad historial activo → FK para impedir lecturas divergentes futuras. |
| D. Tabs | Por asignar, Asignados, Express, En riesgo, con totales filtrados del backend. |
| E. Búsqueda/filtros | Título/autor/coautor/código, servicio, especialista, cuatro órdenes y paginación. |
| F. Por asignar | Solo handoff formal sin responsable, con comparación y asignación real. |
| G. Asignados | Responsable canónico, recomendación alternativa, comparación y reasignación. |
| H. Express | Posible/confirmado/normal vigente distintos; compresión real sin multiplicar pesos. |
| I. Riesgo | Evaluación central de proyecto y procesos; causas explicadas, sin umbral nuevo. |
| J. Peso real | `servicios.pesoComplejidad`; EF4/EEC3/EET2/CR3/SE1 en catálogo local. |
| K. Impacto | Peso al cambiar de responsable; 0 para el responsable que ya incluye el proyecto. |
| L. Capacidad | Carga ponderada, cantidad, Express, riesgo y barras relativas explicadas. |
| M. Composición | Servicio, cantidad y puntos por persona desde el mismo agregado. |
| N. Recomendador | Candidatos activos, decisión humana, alternativas en reasignación. |
| O. Criterios | Carga → riesgo → Express confirmado. |
| P. Tie-breaker | Nombre en español → ID, determinista. |
| Q. Compare | Contexto, prioridad, estado, fechas, composición y proyección del backend. |
| R. Assign | Handoff/rol/actividad validados, actualización de cola y carga. |
| S. Reassign | Confirmación anterior → nuevo; guard de owner esperado y estado operativo conservado. |
| T. Historial | Cierre de anterior, nuevo vigente, FK sincronizada y retry idempotente. |
| U. Audit | Eventos existentes de asignación/reasignación/Express, transaccionales. |
| V. Notifications | Aviso individual al nuevo responsable, sin duplicados en retry. |
| W. Backend/query | Dos GET nuevos; PATCH existente ampliado; sesión y RBAC de Jefatura. |
| X. Performance | Siete lecturas con 1/31 proyectos, respuesta máxima 25; sin N+1 ni descarga del dashboard completo en esta vista. |
| Y. Tests nuevos | 13 casos de integración sobre fuentes, proyección, filtros, estados, ámbito, permisos y rendimiento. |
| Z. Total tests | 79 distintos aprobados en ocho archivos; 113 ejecuciones entre ambas corridas. Suite completa no repetida. |
| AA. Build/typecheck | Backend y frontend compilados; TypeScript validado; aviso de bundle preexistente documentado. |
| AB. Desktop #1 | Filas del equipo de 101,5 px, criterios fuera de vista, iconos genéricos y metadatos pequeños. |
| AC. Correcciones | Capacidad compacta de unos 81 px, filas ordinarias 98 px, fuentes legibles, iconos específicos, logo mayor solo en esta vista y opciones estables al filtrar. |
| AD. Desktop #2 | Jerarquía, dos columnas, controles y capacidad verificadas en 1440×900; captura final sobre datos reales y QA. |
| AE. Tablet | 768×1024 sin desborde horizontal; filas legibles y capacidad/criterios debajo. |
| AF. Mobile | 375×812, tarjetas, tabs 2×2, controles accesibles, drawer completo, footer visible y Escape/foco verificados. |
| AG. Diferencias | Sans del producto y shell compartido conservados; pesos/personas reales diferentes; títulos faltantes usan autores; barras relativas porque no hay capacidad máxima formal. |
| AH. Commit | Commit local `feat: redesign jefatura assignments and capacity`; hash entregado al usuario. Sin push. |
