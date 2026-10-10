# Ficha de trazabilidad viva

Fecha: 2026-10-09. Baseline: `151fbf6`. Auditoría previa al reemplazo de la interfaz.

## Evidencia y alcance

Se inspeccionó directamente la ficha PED-FOR-001, versión 2.0, revisión 1, de Mireya Oliveros, incluidas sus nueve hojas y nueve instructivos. El enlace se obtuvo de `BDD - IA!B6` en la matriz IA local. Se descargó una copia de lectura en `.git/ficha-viva-audit/ficha-original.xlsx`; no se alteró el documento de negocio ni se importaron sus datos personales a la base demo.

Fuentes contrastadas:

- [Ficha original](https://docs.google.com/spreadsheets/d/1tKGnrlouAUg8a4OY9xjwIlMo2h7Tsabnc-2dyt5us1A/edit): nueve áreas e instructivos; campos y responsables.
- `panhouse_antigua/IA Matriz Proyectos - Panhouse - PED-FOR-002.xlsx`: `BDD - IA`, encabezados e instructivo; relevancia del autor, equipo, hitos y control administrativo. Lectura de XML, sin recalcular ni modificar el XLSX.
- [RRPP](https://docs.google.com/spreadsheets/d/12ZvgWvvk-5idrsBkCnbEhwgFLllbhBR7JPpsefyyWkA/edit): encabezados de Ingresos, Asesorías, Eventos y Publicaciones.
- [Dirección creativa](https://docs.google.com/spreadsheets/d/1oeM86am71u1T7NJnrOtEwHXqGjhs5uvBTVghdmI3-Uw/edit): `GENERAL 25-26!A1:AH1`.
- [Edición](https://docs.google.com/spreadsheets/d/1GGGXyIJFJ0rBYVOAAHdTzQA1wh7snQ5UhhAt07NX0N0/edit): `Instructivo EBDD - IA!A1:AV4`.
- [Corrección](https://docs.google.com/spreadsheets/d/1QMT-XEEZ5WvxTCFba5qW3lfNudLtPV2FJmHV2NbgNNI/edit): `OCTUBRE 2026!A1:AG1`.
- [Manual del especialista](https://docs.google.com/document/d/1Q7OZuDMqHjA3jPG7pa2FRWyXhfKbYd87/edit): texto completo, especialmente §§2.3, 3, 4, 5, 6, 7 y recordatorios de activación de lanzamiento.

Los documentos 03 y 04 del repositorio sirven de antecedentes, no sustituyen esta inspección. Algunas entradas del diccionario describen columnas de criterios Amazon, muestra y paquete que no existen con esos nombres en el esquema actual. El mapa debe distinguir evidencia documental de persistencia comprobada.

## Baseline y página anterior

- Git limpio; typecheck backend y frontend: PASS.
- Tests previos: `trazabilidad`, `rbac`, `rrppIngresosView`: 23/23 PASS, tres archivos; PostgreSQL efímero en 5434, separado de PanHouse (5433) y Spark (5432).
- Proyecto demo inspeccionado: `#0F353C`, servicio SE, sesión RRPP. Ruta conservada: `/proyectos/:id/ficha-trazabilidad`.
- Capturas anteriores en `.git/ficha-viva-audit/antes-1440-*.jpg`: inicio, recorrido intermedio y final. El contenido ocupa 7.283 px; el formulario útil tiene unos 768 px de ancho dentro de una pantalla de 1.440 px.

| Bloque anterior | Decisión | Destino | Motivo |
|---|---|---|---|
| Hero negro, etiqueta violeta, autor como título | SUMMARIZE | Cabecera compacta con título del libro, código y autores | El libro debe identificarse sin consumir 260 px. |
| Perfil del autor | KEEP / SUMMARIZE | Visión general y Proyecto documental | Una referencia a `autores`; contactos por permisos, sin duplicación. |
| Proyecto — Perfil | MOVE / LINK | Comercial; datos visibles en resumen y sección Proyecto | La ficha no es otro formulario de venta. |
| Ficha Editorial RRPP | MOVE / LINK | RRPP Ingresos | Mantener los campos canónicos y su propietario. |
| Proceso de lanzamiento y promoción | SUMMARIZE / LINK | RRPP Lanzamientos, sección oficial 7 | Depender de la instancia real de planificación. |
| Notificación a Jefatura | LINK | Workspace de ingreso existente | Conservar validación e idempotencia de la transición. |
| Matriz de Ingreso RRPP completa | DEPRECATE en esta UI | RRPP Ingresos | Eliminar la copia editable, conservar persistencia y consulta documental. |
| Matriz de Asesorías completa | DEPRECATE en esta UI | RRPP Lanzamientos | Sustituir por estado, fechas, documentos y CTA. |
| Impresión / Distribución dentro de asesorías | SUMMARIZE | Áreas oficiales 8 y 9 | RRPP deriva intereses; los propietarios operan el proceso. |

La revisión parcial inicial de RBAC fue corregida al leer la ruta completa: `PATCH matriz-asesorias` **ya devuelve 403** para responsable/fecha enviada/aceptación de impresión y aceptación/responsable/contrato de distribución. La nueva implementación debe conservar y probar ese guard, no afirmar que falta. `planLanzamientoSchema.strict()` tampoco acepta esos campos operativos. El interés, la fecha de solicitud y la nota de derivación son contexto RRPP, no aceptación del proceso especializado.

## Modelo y decisiones previas al código

Se conservan las nueve áreas: Proyecto, Edición, Corrección, Diseño y diagramación, Calidad editorial, Soporte digital, Lanzamiento y promoción, Impresión, Distribución. Jefatura y Dirección creativa se consultan como procesos complementarios.

El resumen es una proyección de lectura con proyecto/autores, preparación Comercial/RRPP, equipo vigente, estados por área, acciones autorizadas y actividad reciente. El modo `?modo=completa` consulta los campos formales y el detalle por intervención, versión, ronda y reunión. No se añade un porcentaje global ni se deducen SLA nuevos.

Los campos documentales originales que no tienen columna actual tendrán un destino aditivo explícito, separado por área, en `ficha_documental_datos`. Su catálogo será cerrado en código, con nombre original, referencia de celda, tipo y propietario; no admitirá claves arbitrarias ni copias de campos ya canónicos. Las actualizaciones se combinarán dentro de una transacción y registrarán auditoría sin valores privados. La ficha completa permite completar únicamente esos campos bajo permisos de su área; los campos de los workflows existentes se editan mediante CTA al workspace correspondiente.

Los indicadores de corrección ortotipográfica deben distinguir tripa, preliminares y cubierta; un resumen libre no equivale a las casillas y observaciones originales. Las listas de calidad ya tienen destino `ficha_calidad_fases.checklist`; se reutilizan por fase/ronda, sin crear otra lista de calidad.

## Fuente única, historia y permisos

- Identidad/contacto: `autores` y `proyectos_autores`; nunca columnas nuevas de ficha para nombres, email o teléfono.
- Servicio/unidad/presupuesto contratados: FK de `proyectos`; ejecución, alianza y alcance pactado: campos comerciales existentes de `fichas_trazabilidad`.
- RRPP: campos de ingreso/editoriales existentes. La colección editorial de RRPP debe leerse del mismo campo que consume RRPP Proyectos; no elegir silenciosamente la FK histórica de Comercial.
- Fechas de reuniones: `lanzamientoPromocionFechaPrimeraReunion` / `SegundaReunion`, con normalizador ya existente; las columnas `asesoriaFecha*Reunion` son legacy y no se eliminan.
- Fechas de ingreso: la página anterior usa dos formateadores distintos y muestra un día de diferencia para el mismo valor ISO. Corregir presentación como fecha de calendario; no migrar valores para compensar zona horaria.
- Equipo: `project_assignments` activas, con FK actual de proyecto como compatibilidad; preservar asignaciones finalizadas, intervenciones paralelas y correctores externos identificados en `correcciones`.
- Historial: `audit_logs`, filtrado por proyecto, límites/paginación, nombre de actor y etiquetas humanas; no exponer detalles JSON ni métodos HTTP.
- Lectura por rol y pertenencia: especialista/editor/diseñador asignados; corrector con intervención/asignación vigente; supervisión y roles de área según su alcance. Autor no recibe expediente interno.
- RRPP no edita brief, conceptos, aceptación de cotización, operaciones de imprenta ni contrato de distribución. El checkpoint de aprobación RRPP de conceptos usa su workflow existente.
- Soporte digital: mostrar hitos y criterios; excluir el texto libre de cuenta Amazon de la proyección pública del expediente, pues puede contener credenciales históricas. No borrar su valor almacenado ni crear campos de contraseñas.

## VIP y datos legacy

`PENDIENTE_DEFINICION_PERFIL_VIP`: `PROYECTO!C15` contiene Perfil del servicio; `BDD - IA!E1` describe Relevancia del autor. Ninguna fuente inspeccionada demuestra equivalencia universal. La migración histórica `0050` hizo DROP de `ingreso_servicio_perfil`; esta tarea no puede reconstruir valores borrados sin respaldo. El nuevo destino documental conserva valores contractuales explícitos si se registran, sin copiar `autores.categoria`, sin backfill inventado y sin reinterpretar el VIP del autor.

Otros DROP históricos de 0039/0040/0043/0047/0050 se registran como antecedente; no se vuelven a ejecutar ni se modifican. Cualquier recuperación requiere un respaldo anterior o una importación independiente autorizada. Este rediseño no importa autores reales ni sus datos personales a los proyectos demo.

## Gates intactos

La planificación existe solo cuando hay `work_items(tipo=lanzamiento, business_key=planificacion)`. Para EF/CR Capítulo, el helper actual usa el envío del capítulo 4 al autor; para CR Tripa, envío/feedback de tripa; para SE, asignación de diseñador. Se representa ese hecho y el work item real; no se crean instancias por abrir la ficha, por completar un documento ni por inferir un porcentaje.

## Plan visual y validación

Shell PanHouse por rol, max-width 1.480 px, cabecera compacta, cuatro cards de estado, cuerpo 2fr + 360 px. En móvil: cabecera, estados, visión general, tu gestión, trazabilidad, equipo y actividad. Modo documental con índice y nueve acordeones; solo el seleccionado se abre. Documentos con nombre y Abrir; controles con foco, estados con texto y color.

Plan de validación establecido antes de implementar: dos ciclos críticos de escritorio 1.440×900, tablet 768×1.024, móvil 375×812, zonas media/final, proyectos con gate habilitado/no habilitado, CR/SE, datos abundantes/vacíos e interés de impresión/distribución. Roles mínimos Comercial, RRPP y Especialista. Tests de permisos, fuente única, gate, equipo/historia y nuevos destinos documentales; builds y suite completa si es viable. No push.

## Mapa campo por campo

La siguiente tabla se completa a partir de los instructivos originales. Repeticiones por capítulo, versión o ronda se conservan como instancias, no como columnas nuevas. Los estados FALTA de esta tabla describen el baseline. La verificación de implementación y el catálogo explícito posterior documentan su resolución.

| Campo original / celda | Sección original | Responsable original | Fuente canónica / destino | Tabla / entidad | Quién edita | Workspace | Nueva ficha | Clasificación | Estado |
|---|---|---|---|---|---|---|---|---|---|
| Nombre del autor (A7) | Proyecto | Comercial / RRPP | autores.nombre | autores | Comercial | Autores | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Nombre artístico (A8) | Proyecto | Comercial / RRPP | autores.nombreArtistico | autores | Comercial | Autores | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| País donde esta ubicado (A9) | Proyecto | Comercial / RRPP | autores.pais | autores | Comercial | Autores | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Nacionalidad (A10) | Proyecto | Comercial / RRPP | autores.nacionalidad | autores | Comercial | Autores | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Fecha de nacimiento (A11) | Proyecto | Comercial / RRPP | autores.fechaNacimiento | autores | Comercial | Autores | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Tipo de proyecto (A12) | Proyecto | Comercial / RRPP | proyectos.servicioId / ficha.ingresoServicioSubtipoCrudo | proyectos / fichas_trazabilidad | Comercial / RRPP | Comercial / RRPP Ingresos | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Fecha de ingreso (A13) | Proyecto | Comercial / RRPP | ficha.ingresoFechaIngreso | fichas_trazabilidad | Comercial | Comercial | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Fecha cierre del proyecto (A14) | Proyecto | Comercial / RRPP | ficha.ingresoFechaCierre | fichas_trazabilidad | Sistema | Derivado por el cálculo existente | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Especificaciones del servicio (A15) | Proyecto | Comercial / RRPP | Ejecución/alianza/presupuesto en ficha; perfil en datos.perfilServicio | fichas_trazabilidad / ficha_documental_datos | Comercial | Comercial / Ficha completa | Proyecto documental + resumen | CANÓNICO | PENDIENTE_DEFINICION_PERFIL_VIP |
| Email (A17) | Proyecto | Comercial / RRPP | autores.email | autores | Comercial | Autores | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Teléfono (A18) | Proyecto | Comercial / RRPP | autores.telefono | autores | Comercial | Autores | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Redes sociales (A19) | Proyecto | Comercial / RRPP | autores.redesSociales | autores | Comercial | Autores | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Personalidad (A21) | Proyecto | Comercial / RRPP | autores.personalidad | autores | Comercial | Autores | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| ¿Qué hace el autor y a qué se dedica? (A22) | Proyecto | Comercial / RRPP | autores.ocupacion | autores | Comercial | Autores | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Fecha deseada de culminación (A24) | Proyecto | Comercial / RRPP | ficha.fechaDeseadaCulminacion | fichas_trazabilidad | RRPP | RRPP Ingresos | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Tema general (A25) | Proyecto | Comercial / RRPP | ficha.temaGeneral | fichas_trazabilidad | RRPP | RRPP Ingresos | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Colección PanHouse (A26) | Proyecto | Comercial / RRPP | ficha.coleccionPanhouse | fichas_trazabilidad | RRPP | RRPP Ingresos | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Público objetivo (A27) | Proyecto | Comercial / RRPP | ficha.publicoSexo / publicoEdad / publicoPerfil | fichas_trazabilidad | RRPP | RRPP Ingresos | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Propósito social (A28) | Proyecto | Comercial / RRPP | ficha.propositoSocial | fichas_trazabilidad | RRPP | RRPP Ingresos | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Objetivo comercial (A29) | Proyecto | Comercial / RRPP | ficha.objetivoComercial | fichas_trazabilidad | RRPP | RRPP Ingresos | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Tono y estilo (A30) | Proyecto | Comercial / RRPP | ficha.tonoEstilo | fichas_trazabilidad | RRPP | RRPP Ingresos | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Capítulos y páginas (A31) | Proyecto | Comercial / RRPP | ficha.capitulosPactados / paginasPactadas / criterioExtra | fichas_trazabilidad | Comercial | Comercial | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Condiciones especiales (A32) | Proyecto | Comercial / RRPP | ficha.condicionesEspeciales | fichas_trazabilidad | Comercial | Comercial | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Posible título del libro (A33) | Proyecto | Comercial / RRPP | ficha.posibleTituloLibro | fichas_trazabilidad | RRPP | RRPP Ingresos | Proyecto documental + resumen | CANÓNICO | CENTRALIZADO |
| Coordinador editorial (A35) | Proyecto | Comercial / RRPP | project_assignments / FK de proyecto / correcciones | project_assignments / proyectos / correcciones | Jefatura / dueños de asignación | Workspace de asignaciones | Proyecto documental + resumen | WORKFLOW | CENTRALIZADO |
| Jefe del departamento (A36) | Proyecto | Comercial / RRPP | project_assignments / FK de proyecto / correcciones | project_assignments / proyectos / correcciones | Jefatura / dueños de asignación | Workspace de asignaciones | Proyecto documental + resumen | WORKFLOW | CENTRALIZADO |
| Editor (A37) | Proyecto | Comercial / RRPP | project_assignments / FK de proyecto / correcciones | project_assignments / proyectos / correcciones | Jefatura / dueños de asignación | Workspace de asignaciones | Proyecto documental + resumen | WORKFLOW | CENTRALIZADO |
| Corrector (A38) | Proyecto | Comercial / RRPP | project_assignments / FK de proyecto / correcciones | project_assignments / proyectos / correcciones | Jefatura / dueños de asignación | Workspace de asignaciones | Proyecto documental + resumen | WORKFLOW | CENTRALIZADO |
| Diseñador (A39) | Proyecto | Comercial / RRPP | project_assignments / FK de proyecto / correcciones | project_assignments / proyectos / correcciones | Jefatura / dueños de asignación | Workspace de asignaciones | Proyecto documental + resumen | WORKFLOW | CENTRALIZADO |
| Calidad Editorial (A40) | Proyecto | Comercial / RRPP | project_assignments / FK de proyecto / correcciones | project_assignments / proyectos / correcciones | Jefatura / dueños de asignación | Workspace de asignaciones | Proyecto documental + resumen | WORKFLOW | CENTRALIZADO |
| Editor (A7) | Edición | Coordinador editorial | editorId / project_assignments.asignadoEn | proyectos / project_assignments | Jefe de edición | Asignaciones de edición | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de asignación de proyecto (A8) | Edición | Coordinador editorial | editorId / project_assignments.asignadoEn | proyectos / project_assignments | Jefe de edición | Asignaciones de edición | Edición documental | WORKFLOW | CENTRALIZADO |
| Matriz de edición (A9) | Edición | Coordinador editorial | datos.matrizEdicionUrl | ficha_documental_datos | especialista | Ficha completa → datos documentales | Edición documental | CANÓNICO | FALTA → destino aditivo definido |
| Observaciones Generales (A10) | Edición | Coordinador editorial | ficha.edicionObservaciones | fichas_trazabilidad | Especialista | Detalle del proyecto | Edición documental | CANÓNICO | CENTRALIZADO |
| Selecciona de la lista desplegable la fase que corresponda a la entrega. (A11) | Edición | Coordinador editorial | capitulos.numero | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Link del archivo editado (A12) | Edición | Coordinador editorial | capitulos.enlaces | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de envio al autor para feedback (A13) | Edición | Coordinador editorial | capitulos.fechaEnvioAutor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega pautada para recibir el feedback (A14) | Edición | Coordinador editorial | capitulos.fechaPautadaFeedback | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega registrada del feedback (A15) | Edición | Coordinador editorial | capitulos.fechaRespuestaReal | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones del editor sobre el feedback (A16) | Edición | Coordinador editorial | capitulos.observacionesEditor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones (A17) | Edición | Coordinador editorial | capitulos.observaciones | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Selecciona de la lista desplegable la fase que corresponda a la entrega. (A18) | Edición | Coordinador editorial | capitulos.numero | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Link del archivo editado (A19) | Edición | Coordinador editorial | capitulos.enlaces | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de envío al autor para feedback (A20) | Edición | Coordinador editorial | capitulos.fechaEnvioAutor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega pautada para recibir el feedback (A21) | Edición | Coordinador editorial | capitulos.fechaPautadaFeedback | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega registrada del feedback (A22) | Edición | Coordinador editorial | capitulos.fechaRespuestaReal | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones del editor sobre el feedback (A23) | Edición | Coordinador editorial | capitulos.observacionesEditor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones (A24) | Edición | Coordinador editorial | capitulos.observaciones | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Selecciona de la lista desplegable la fase que corresponda a la entrega. (A25) | Edición | Coordinador editorial | capitulos.numero | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Link del archivo editado (A26) | Edición | Coordinador editorial | capitulos.enlaces | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de envío al autor para feedback (A27) | Edición | Coordinador editorial | capitulos.fechaEnvioAutor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega pautada para recibir el feedback (A28) | Edición | Coordinador editorial | capitulos.fechaPautadaFeedback | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega registrada del feedback (A29) | Edición | Coordinador editorial | capitulos.fechaRespuestaReal | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones del editor sobre el feedback (A30) | Edición | Coordinador editorial | capitulos.observacionesEditor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones (A31) | Edición | Coordinador editorial | capitulos.observaciones | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Selecciona de la lista desplegable la fase que corresponda a la entrega. (A32) | Edición | Coordinador editorial | capitulos.numero | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Link del archivo editado (A33) | Edición | Coordinador editorial | capitulos.enlaces | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de envío al autor para feedback (A34) | Edición | Coordinador editorial | capitulos.fechaEnvioAutor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega pautada para recibir el feedback (A35) | Edición | Coordinador editorial | capitulos.fechaPautadaFeedback | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega registrada del feedback (A36) | Edición | Coordinador editorial | capitulos.fechaRespuestaReal | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones del editor sobre el feedback (A37) | Edición | Coordinador editorial | capitulos.observacionesEditor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones (A38) | Edición | Coordinador editorial | capitulos.observaciones | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Selecciona de la lista desplegable la fase que corresponda a la entrega. (A39) | Edición | Coordinador editorial | capitulos.numero | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Link del archivo editado (A40) | Edición | Coordinador editorial | capitulos.enlaces | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de envío al autor para feedback (A41) | Edición | Coordinador editorial | capitulos.fechaEnvioAutor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega pautada para recibir el feedback (A42) | Edición | Coordinador editorial | capitulos.fechaPautadaFeedback | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega registrada del feedback (A43) | Edición | Coordinador editorial | capitulos.fechaRespuestaReal | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones del editor sobre el feedback (A44) | Edición | Coordinador editorial | capitulos.observacionesEditor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones (A45) | Edición | Coordinador editorial | capitulos.observaciones | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Selecciona de la lista desplegable la fase que corresponda a la entrega. (A46) | Edición | Coordinador editorial | capitulos.numero | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Link del archivo editado (A47) | Edición | Coordinador editorial | capitulos.enlaces | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de envío al autor para feedback (A48) | Edición | Coordinador editorial | capitulos.fechaEnvioAutor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega pautada para recibir el feedback (A49) | Edición | Coordinador editorial | capitulos.fechaPautadaFeedback | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega registrada del feedback (A50) | Edición | Coordinador editorial | capitulos.fechaRespuestaReal | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones del editor sobre el feedback (A51) | Edición | Coordinador editorial | capitulos.observacionesEditor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones (A52) | Edición | Coordinador editorial | capitulos.observaciones | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Selecciona de la lista desplegable la fase que corresponda a la entrega. (A53) | Edición | Coordinador editorial | capitulos.numero | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Link del archivo editado (A54) | Edición | Coordinador editorial | capitulos.enlaces | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de envío al autor para feedback (A55) | Edición | Coordinador editorial | capitulos.fechaEnvioAutor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega pautada para recibir el feedback (A56) | Edición | Coordinador editorial | capitulos.fechaPautadaFeedback | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega registrada del feedback (A57) | Edición | Coordinador editorial | capitulos.fechaRespuestaReal | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones del editor sobre el feedback (A58) | Edición | Coordinador editorial | capitulos.observacionesEditor | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Observaciones (A59) | Edición | Coordinador editorial | capitulos.observaciones | capitulos | Editor / Especialista, según campo | Edición y detalle del proyecto | Edición documental | WORKFLOW | CENTRALIZADO |
| Link del archivo con feedback (A61) | Edición | Coordinador editorial | datos.feedbackTripaUrl | ficha_documental_datos | especialista | Ficha completa → datos documentales | Edición documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de asignación al editor (A62) | Edición | Coordinador editorial | datos.feedbackTripaAsignacion | ficha_documental_datos | especialista | Ficha completa → datos documentales | Edición documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de entrega pautada para feedback aplicado (A63) | Edición | Coordinador editorial | datos.feedbackTripaEntregaPautada | ficha_documental_datos | especialista | Ficha completa → datos documentales | Edición documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de entrega registrada del feedback aplicado (A64) | Edición | Coordinador editorial | datos.feedbackTripaEntregaReal | ficha_documental_datos | especialista | Ficha completa → datos documentales | Edición documental | CANÓNICO | FALTA → destino aditivo definido |
| Observaciones (A65) | Edición | Coordinador editorial | datos.feedbackTripaObservaciones | ficha_documental_datos | especialista | Ficha completa → datos documentales | Edición documental | CANÓNICO | FALTA → destino aditivo definido |
| Corrector (A7) | Corrección | Corrector del proyecto | correcciones.correctorId/correctorNombre / solicitadoEn | correcciones / project_assignments | Jefatura / Especialista | Correcciones | Corrección documental | WORKFLOW | CENTRALIZADO |
| Fecha de asignación de proyecto (A8) | Corrección | Corrector del proyecto | correcciones.correctorId/correctorNombre / solicitadoEn | correcciones / project_assignments | Jefatura / Especialista | Correcciones | Corrección documental | WORKFLOW | CENTRALIZADO |
| Observaciones generales (A9) | Corrección | Corrector del proyecto | ficha.correccionObservaciones / correcciones.observaciones | fichas_trazabilidad / correcciones | Especialista / Corrector | Correcciones | Corrección documental | CANÓNICO | CENTRALIZADO |
| Sintaxis enrevesada (A15) | Corrección | Corrector del proyecto | datos.tripa_15 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Desorden sintáctico (A16) | Corrección | Corrector del proyecto | datos.tripa_16 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Coma criminal (A17) | Corrección | Corrector del proyecto | datos.tripa_17 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Observaciones de contenido (A18) | Corrección | Corrector del proyecto | datos.tripa_18 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Repetición de ideas (A19) | Corrección | Corrector del proyecto | datos.tripa_19 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Repetición de palabras y términos (A20) | Corrección | Corrector del proyecto | datos.tripa_20 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Citas sin referencias  (A21) | Corrección | Corrector del proyecto | datos.tripa_21 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Cambios inadecuados en las conjugaciones verbales (A22) | Corrección | Corrector del proyecto | datos.tripa_22 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Referencias religiosas con errores (A23) | Corrección | Corrector del proyecto | datos.tripa_23 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Usa frases destacadas (A24) | Corrección | Corrector del proyecto | datos.tripa_24 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Uso inadecuado de comillas (A25) | Corrección | Corrector del proyecto | datos.tripa_25 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Formato incorrecto de citación (A26) | Corrección | Corrector del proyecto | datos.tripa_26 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Formato incorrecto de texto (A27) | Corrección | Corrector del proyecto | datos.tripa_27 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas (A28) | Corrección | Corrector del proyecto | datos.tripa_28 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Desvío de la estructura (A29) | Corrección | Corrector del proyecto | datos.tripa_29 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Contenido repetitivo (A30) | Corrección | Corrector del proyecto | datos.tripa_30 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Subtítulo divorciado del texto (A31) | Corrección | Corrector del proyecto | datos.tripa_31 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Falta de concordancia de género y número (A32) | Corrección | Corrector del proyecto | datos.tripa_32 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Falta de cursivas en extranjerismos (A33) | Corrección | Corrector del proyecto | datos.tripa_33 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Mayúsculas o minúsculas mal empleadas (A34) | Corrección | Corrector del proyecto | datos.tripa_34 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Faltas de acentuación (A35) | Corrección | Corrector del proyecto | datos.tripa_35 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Gerundio de posterioridad (A36) | Corrección | Corrector del proyecto | datos.tripa_36 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Combinacion de cifras en letra y números (A37) | Corrección | Corrector del proyecto | datos.tripa_37 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Mayúsculas después de dos puntos (A38) | Corrección | Corrector del proyecto | datos.tripa_38 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Inconsistencia de la persona gramatical (A39) | Corrección | Corrector del proyecto | datos.tripa_39 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Coma después de pero antes de interroganción (A40) | Corrección | Corrector del proyecto | datos.tripa_40 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Coma en falsos conectores (A41) | Corrección | Corrector del proyecto | datos.tripa_41 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Mal uso de las abreviaturas (A42) | Corrección | Corrector del proyecto | datos.tripa_42 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Punto antes de la comilla de cierre (A43) | Corrección | Corrector del proyecto | datos.tripa_43 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Desdoblamiento de género (A44) | Corrección | Corrector del proyecto | datos.tripa_44 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Dequeísmo y Queísmo (A45) | Corrección | Corrector del proyecto | datos.tripa_45 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Leísmo, Laísmo y Loísmo (A46) | Corrección | Corrector del proyecto | datos.tripa_46 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Fórmula y/o (A47) | Corrección | Corrector del proyecto | datos.tripa_47 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Adjetivo relacional antepuesto (A48) | Corrección | Corrector del proyecto | datos.tripa_48 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Prefijos sin soldar (A49) | Corrección | Corrector del proyecto | datos.tripa_49 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Problemas de tipeo (A50) | Corrección | Corrector del proyecto | datos.tripa_50 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Errores ortográficos por homonimia (A51) | Corrección | Corrector del proyecto | datos.tripa_51 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Confusión de preposiciones (A52) | Corrección | Corrector del proyecto | datos.tripa_52 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Impropiedad léxica (A53) | Corrección | Corrector del proyecto | datos.tripa_53 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Ambigüedades, barbarismos y perogrulladas (A54) | Corrección | Corrector del proyecto | datos.tripa_54 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Cacofonías (A55) | Corrección | Corrector del proyecto | datos.tripa_55 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| Plagio (A56) | Corrección | Corrector del proyecto | datos.tripa_56 | ficha_documental_datos | corrector / especialista | Ficha completa → datos documentales | Corrección documental | CANÓNICO | FALTA → destino aditivo definido |
| OBSERVACIONES GENERALES DEL CONTENIDO (A57) | Corrección | Corrector del proyecto | ficha.correccionObservaciones / correcciones.observaciones | fichas_trazabilidad / correcciones | Especialista / Corrector | Correcciones | Corrección documental | CANÓNICO | CENTRALIZADO |
| Diseñador (A7) | Diseño y diagramación | Coordinador editorial | disenadorId / project_assignments.asignadoEn | proyectos / project_assignments | Jefatura | Asignaciones de diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de asignación de proyecto (A8) | Diseño y diagramación | Coordinador editorial | disenadorId / project_assignments.asignadoEn | proyectos / project_assignments | Jefatura | Asignaciones de diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Observaciones generales (A9) | Diseño y diagramación | Coordinador editorial | ficha.disenoObservaciones | fichas_trazabilidad | Especialista / Diseñador | Diseño | Diseño y diagramación documental | CANÓNICO | CENTRALIZADO |
| Brief creativo: (POR FAVOR, REVISARLA) (A10) | Diseño y diagramación | Coordinador editorial | direcciones_creativas.briefEnlace / ficha.disenoBriefCreativo legacy | direcciones_creativas / fichas_trazabilidad | Líder creativo | Dirección creativa | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de recepción de propuestas  (A12) | Diseño y diagramación | Coordinador editorial | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | Líder creativo / Especialista / Autor por campo | Creativa y Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Cantidad de propuestas recibidas (A13) | Diseño y diagramación | Coordinador editorial | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | Líder creativo / Especialista / Autor por campo | Creativa y Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de envió de propuestas al autor (A14) | Diseño y diagramación | Coordinador editorial | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | Líder creativo / Especialista / Autor por campo | Creativa y Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entregada pautada recepción feedback autor (A15) | Diseño y diagramación | Coordinador editorial | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | Líder creativo / Especialista / Autor por campo | Creativa y Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega registrada del feedback del autor (A16) | Diseño y diagramación | Coordinador editorial | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | Líder creativo / Especialista / Autor por campo | Creativa y Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Portada (colocar el link de la imagen) (A17) | Diseño y diagramación | Coordinador editorial | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | Líder creativo / Especialista / Autor por campo | Creativa y Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega de portada seleccionada con feedback aplicado (A18) | Diseño y diagramación | Coordinador editorial | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | Líder creativo / Especialista / Autor por campo | Creativa y Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de aprobación definitiva  (A19) | Diseño y diagramación | Coordinador editorial | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | Líder creativo / Especialista / Autor por campo | Creativa y Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Observaciones (A20) | Diseño y diagramación | Coordinador editorial | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | ficha_diseno_propuestas / direcciones_creativas / diseno_versiones | Líder creativo / Especialista / Autor por campo | Creativa y Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega de cubierta extendida al autor (A22) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega pautada recepción feedback autor (A23) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega registrada del feedback del autor (A24) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de envio a diseño con feedback del autor (A25) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega de cubierta extendida con feedback aplicado al autor (A26) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de aprobación por parte del autor de la cubierta extendida (A27) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| MUESTRA DE DIAGRAMACIÓN (A28) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de recepción de la muestra de diagramación por diseño (A29) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de envió de la muestra de diagramación al autor (A30) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega pautada recepción feedback muestra de diagramación por el autor (A31) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entregada registrada recepcion feedback muestra de diagramación por el autor (A32) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Cantidad de comentarios en la muestra (A33) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de envió a diseño con feedback del autor (A34) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega muestra de diagramación con feedback aplicado al autor (A35) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de aprobación por parte del autor de la muestra de diagramación definitiva (A36) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| DIAGRAMACIÓN DEFINITIVA (A37) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de entrega de tripa completa corregida a diseño (A38) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Fecha de recepción diagramación definitiva (A39) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Historial de trazabilidad de versiones (A40) | Diseño y diagramación | Coordinador editorial | disenos / diseno_versiones (envío, feedback, aprobación y versiones) | disenos / diseno_versiones | Especialista / Diseñador / Autor por campo | Diseño | Diseño y diagramación documental | WORKFLOW | CENTRALIZADO |
| Tipo de archivo (A42) | Diseño y diagramación | Coordinador editorial | datos.contenidoAdicionalTipo | ficha_documental_datos | especialista / disenador | Ficha completa → datos documentales | Diseño y diagramación documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de asignación  (A43) | Diseño y diagramación | Coordinador editorial | datos.contenidoAdicionalAsignacion | ficha_documental_datos | especialista / disenador | Ficha completa → datos documentales | Diseño y diagramación documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de entrega  (A44) | Diseño y diagramación | Coordinador editorial | datos.contenidoAdicionalEntrega | ficha_documental_datos | especialista / disenador | Ficha completa → datos documentales | Diseño y diagramación documental | CANÓNICO | FALTA → destino aditivo definido |
| Observaciones (A45) | Diseño y diagramación | Coordinador editorial | datos.contenidoAdicionalObservaciones | ficha_documental_datos | especialista / disenador | Ficha completa → datos documentales | Diseño y diagramación documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de asignación  (A47) | Diseño y diagramación | Coordinador editorial | datos.paqueteFinalAsignacion | ficha_documental_datos | especialista / disenador | Ficha completa → datos documentales | Diseño y diagramación documental | CANÓNICO | FALTA → destino aditivo definido |
| Archivos cargados en la carpeta (A48) | Diseño y diagramación | Coordinador editorial | datos.paqueteFinalArchivos | ficha_documental_datos | especialista / disenador | Ficha completa → datos documentales | Diseño y diagramación documental | CANÓNICO | FALTA → destino aditivo definido |
| Cargado (A49) | Diseño y diagramación | Coordinador editorial | datos.paqueteFinalCargado | ficha_documental_datos | especialista / disenador | Ficha completa → datos documentales | Diseño y diagramación documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de entrega de paquete (A50) | Diseño y diagramación | Coordinador editorial | datos.paqueteFinalEntrega | ficha_documental_datos | especialista / disenador | Ficha completa → datos documentales | Diseño y diagramación documental | CANÓNICO | FALTA → destino aditivo definido |
| Observaciones (A51) | Diseño y diagramación | Coordinador editorial | datos.paqueteFinalObservaciones | ficha_documental_datos | especialista / disenador | Ficha completa → datos documentales | Diseño y diagramación documental | CANÓNICO | FALTA → destino aditivo definido |
| Nombre del libro (A7) | Calidad editorial | Corrector asignado para validación | proyectos.tituloDefinitivo / subtituloDefinitivo | proyectos | Especialista | Detalle del proyecto | Calidad editorial documental | CANÓNICO | CENTRALIZADO |
| Subtitulo (A8) | Calidad editorial | Corrector asignado para validación | proyectos.tituloDefinitivo / subtituloDefinitivo | proyectos | Especialista | Detalle del proyecto | Calidad editorial documental | CANÓNICO | CENTRALIZADO |
| Requerimientos especiales del autor (A9) | Calidad editorial | Corrector asignado para validación | ficha.condicionesEspeciales / criterioExtra | fichas_trazabilidad | Comercial | Comercial | Calidad editorial documental | CANÓNICO | CENTRALIZADO |
| Fecha de asignación (A11) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Version del PDF (A12) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Nombre de quien recibe (A13) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Cantidad de páginas (A14) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Observaciones: (A15) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| LISTA DE CHEQUEO FASE 1 (A16) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| CRITERIOS IMPORTANTES (A17) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Validación de textos diagramados (A19) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Palabras cortadas (A20) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Citas (A21) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Epígrafes (A22) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Páginas de ejercicios (A23) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Portadillas (A24) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Sangría (A25) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Casita PanHouse (A26) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Logo de colección (A27) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Pagína de creditos (ISBN y Deposito legal) (A28) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Notas a pie (A29) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Títulos (A30) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Intertítulos (A31) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Viñetas (A32) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Contraste de índice con cuerpo de la tripa (A33) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Enumeración de páginas (A34) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Foliaturas (A35) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Fotografías (A36) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Tablas (A37) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Dedicatoria (A38) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Agradecimientos (A39) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Sobre el autor (A40) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Prólogo (A41) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Comentarios (A42) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Validación de datos (fechas, nombre propiosy lugares) (A43) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Archivos o textos por incorporar (A44) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Total comentarios por aplicar enviados (A45) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases: fase/ronda, asignación, versión, receptor, páginas, checklist y comentarios | ficha_calidad_fases / project_assignments | Soporte editorial | Calidad | Calidad editorial documental | WORKFLOW | CENTRALIZADO |
| Aspectos a considerar en la corrección:  Indicar cualquier detalle u observación relevante para la revisión. (A46) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases.observaciones | ficha_calidad_fases | Soporte editorial | Calidad | Calidad editorial documental | CANÓNICO | CENTRALIZADO |
| Sugerencias: Indicar en esta parte cualquier sugerencia conveniente para cuidar la calidad del texto y que hoy sea una exigencia del autor. (A52) | Calidad editorial | Corrector asignado para validación | ficha_calidad_fases.observaciones | ficha_calidad_fases | Soporte editorial | Calidad | Calidad editorial documental | CANÓNICO | CENTRALIZADO |
| Yo ____________________________ certifico que todos los ítems de la revisión final se han marcado para su corrección con éxito y cualquier error que quede es parte del 1 % de margen de error permitido por la editorial. El proceso de corrección ha llegado a su finalidad en la fase 4 de este. Cualquier fase de corrección adicional está fuera de mi injerencia por haberse realizado después de la fecha en la que envío este archivo.  Fecha de envío ___________________________  (A90) | Calidad editorial | Corrector asignado para validación | Certificación textual del instructivo: referencia, sin imponer métricas de error | Catálogo documental | Sin edición del texto normativo | Ficha completa → referencia | Calidad editorial documental | REFERENCIA | PENDIENTE_DEFINICION |
| Líder del área: (A7) | Soporte digital | Soporte digital | Equipo de Soporte Digital (rol, sin responsable fabricado) | users / project_assignments | Soporte Digital | Gestión digital | Soporte digital documental | WORKFLOW | CONDICIONAL |
| Fecha de inicio del proceso (A8) | Soporte digital | Soporte digital | ficha.digitalFechaInicio | fichas_trazabilidad | Soporte Digital | Soporte Digital | Soporte digital documental | CANÓNICO | CENTRALIZADO |
| Fecha de envío de formulario de Amazon (A10) | Soporte digital | Soporte digital | ficha.soporteDigitalFechaEnvioFormulario | fichas_trazabilidad | Soporte Digital | Soporte Digital | Soporte digital documental | CANÓNICO | CENTRALIZADO |
| Fecha de recepción de formulario de Amazon (A11) | Soporte digital | Soporte digital | datos.recepcionFormulario | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de creación de cuenta (A12) | Soporte digital | Soporte digital | datos.creacionCuenta | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Observaciones: (A13) | Soporte digital | Soporte digital | datos.observacionesRegistro | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha (A15) | Soporte digital | Soporte digital | datos.reunionCriterios | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Link de la  grabación: (A16) | Soporte digital | Soporte digital | datos.grabacionCriterios | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Tapa (A17) | Soporte digital | Soporte digital | datos.tapa | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Portada (A18) | Soporte digital | Soporte digital | datos.portada | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Papel (A19) | Soporte digital | Soporte digital | datos.papel | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Precio KDP (A20) | Soporte digital | Soporte digital | datos.precioKdp | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Precio Kindle (A21) | Soporte digital | Soporte digital | datos.precioKindle | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de Lanzamiento Amazon (A22) | Soporte digital | Soporte digital | datos.lanzamientoAmazon | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Observaciones: (A23) | Soporte digital | Soporte digital | datos.observacionesCriterios | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de prueba de archivos KDP en Amazon (A25) | Soporte digital | Soporte digital | datos.pruebaArchivos | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de carga de archivos KDP (A26) | Soporte digital | Soporte digital | datos.cargaKdp | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de carga de archivos Kindle (A27) | Soporte digital | Soporte digital | datos.cargaKindle | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha  (A29) | Soporte digital | Soporte digital | datos.induccion | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Link de la grabación: (A30) | Soporte digital | Soporte digital | datos.grabacionInduccion | ficha_documental_datos | soporte_digital | Ficha completa → datos documentales | Soporte digital documental | CANÓNICO | FALTA → destino aditivo definido |
| Observaciones generales (A31) | Soporte digital | Soporte digital | ficha.digitalObservaciones | fichas_trazabilidad | Soporte Digital | Soporte Digital | Soporte digital documental | CANÓNICO | CENTRALIZADO |
| Fecha de la 1era reunión (A7) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionFechaPrimeraReunion | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Encargado (A8) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionPrimeraResponsableId | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Título tentativo del libro (A9) | Lanzamiento y promoción | Líder de RRPP | ficha.posibleTituloLibro | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Puntos tratados (A10) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionPuntosTratadosPrimera | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Fecha de la 2da reunión (A12) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionFechaSegundaReunion | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Encargado (A13) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionSegundaResponsableId | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Acuerdos (A14) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionAcuerdosSegunda | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Objetivo comercial (A16) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionObjetivoComercial | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Participacion en ferias (A17) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionParticipacionFerias | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| ISBN (A18) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionIsbn | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Detalles:  (A19) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionDetallesProyeccion | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Fecha tentativa (A21) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionFechaTentativa | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Tipo de Lanzamiento (A22) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionTipo | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Observaciones: (A23) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionObservaciones | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Espacio para registrar cualquier otro aspecto no contemplado en los apartados anteriores. (A25) | Lanzamiento y promoción | Líder de RRPP | ficha.lanzamientoPromocionObservacionesGenerales | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Lanzamiento y promoción documental + resumen | CANÓNICO | CENTRALIZADO |
| Fecha de la reunión (A7) | Impresión | Coordinador de impresión | datos.fechaReunion | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Líder del área: (A8) | Impresión | Coordinador de impresión | ficha.impresionResponsable | fichas_trazabilidad | Impresión | Detalle del proyecto → Impresión | Impresión documental | CANÓNICO | CENTRALIZADO |
| Fecha definitiva (A10) | Impresión | Coordinador de impresión | ficha.lanzamientoPromocionFechaTentativa / detallesProyeccion | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Impresión documental | REFERENCIA | CENTRALIZADO |
| Título definitivo (A11) | Impresión | Coordinador de impresión | proyectos.tituloDefinitivo | proyectos | Especialista | Detalle del proyecto | Impresión documental | REFERENCIA | CENTRALIZADO |
| Detalles: (A12) | Impresión | Coordinador de impresión | ficha.lanzamientoPromocionFechaTentativa / detallesProyeccion | fichas_trazabilidad | RRPP | RRPP Lanzamientos | Impresión documental | REFERENCIA | CENTRALIZADO |
| Tamaño del libro (A14) | Impresión | Coordinador de impresión | datos.tamanoLibro | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Números de páginas (A15) | Impresión | Coordinador de impresión | datos.paginasImprenta | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Tipo de papel (A16) | Impresión | Coordinador de impresión | datos.tipoPapel | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Material de portada (A17) | Impresión | Coordinador de impresión | datos.materialPortada | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Color impresión papel (A18) | Impresión | Coordinador de impresión | datos.colorPapel | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Formato portada (A19) | Impresión | Coordinador de impresión | datos.formatoPortada | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Color impresión portada (A20) | Impresión | Coordinador de impresión | datos.colorPortada | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Acabado de la portada (A21) | Impresión | Coordinador de impresión | datos.acabadoPortada | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Criterios especiales de la portada (A22) | Impresión | Coordinador de impresión | datos.criteriosPortada | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Solapas (A23) | Impresión | Coordinador de impresión | datos.solapas | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Termosellado (A24) | Impresión | Coordinador de impresión | datos.termosellado | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Encuadernación (A25) | Impresión | Coordinador de impresión | datos.encuadernacion | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Cantidad de libros (A26) | Impresión | Coordinador de impresión | datos.cantidadLibros | ficha_documental_datos | impresion | Ficha completa → datos documentales | Impresión documental | CANÓNICO | FALTA → destino aditivo definido |
| Indica cualquier detalle no cotemplado en los campos anteriores o alguna novedad dentro del proceso. (A28) | Impresión | Coordinador de impresión | ficha.impresionObservaciones / impresionNotas | fichas_trazabilidad | Impresión | Detalle del proyecto → Impresión | Impresión documental | CANÓNICO | CENTRALIZADO |
| Fecha de la reunión (A7) | Distribución | Líder de distribución | datos.fechaReunion | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| Encargado (A8) | Distribución | Líder de distribución | ficha.asesoriaResponsableDistribucion / equipo por rol | fichas_trazabilidad / users | Distribución | Distribución | Distribución documental | WORKFLOW | LEGACY |
| Observaciones (A9) | Distribución | Líder de distribución | datos.observacionesReunion | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha de inicio de contrato (A11) | Distribución | Líder de distribución | datos.contratoInicio | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| Fecha fin del contrato (A12) | Distribución | Líder de distribución | datos.contratoFin | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| % de regalias (A13) | Distribución | Líder de distribución | ficha_distribucion_paises.pais / porcentajeRegalias | ficha_distribucion_paises | Distribución | Detalle del proyecto → Distribución | Distribución documental | CANÓNICO | CENTRALIZADO |
| Pais para la distribución (A14) | Distribución | Líder de distribución | ficha_distribucion_paises.pais / porcentajeRegalias | ficha_distribucion_paises | Distribución | Detalle del proyecto → Distribución | Distribución documental | CANÓNICO | CENTRALIZADO |
| Medios de distribucion (A15) | Distribución | Líder de distribución | datos.medios | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| Cantidad de ejemplares a distribuir (A16) | Distribución | Líder de distribución | datos.ejemplares | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| Detalles: (A17) | Distribución | Líder de distribución | datos.detalles | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| ISBN (A18) | Distribución | Líder de distribución | datos.isbn | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| ¿Se debe tramitar ISBN nuevo? (A19) | Distribución | Líder de distribución | datos.requiereIsbn | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| Nuevo ISBN (A20) | Distribución | Líder de distribución | datos.nuevoIsbn | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| Detalles: (A21) | Distribución | Líder de distribución | datos.detallesIsbn | ficha_documental_datos | distribucion | Ficha completa → datos documentales | Distribución documental | CANÓNICO | FALTA → destino aditivo definido |
| Espacio para registrar cualquier otro aspecto no contemplado en los apartados anteriores. (A23) | Distribución | Líder de distribución | ficha.distribucionObservaciones | fichas_trazabilidad | Distribución | Distribución | Distribución documental | CANÓNICO | CENTRALIZADO |

### Detalle de nuevos destinos (cada valor conserva su referencia original)

| Campo original / referencia | Sección | Responsable / editores | Destino único | Tipo | Estado |
|---|---|---|---|---|---|
| Perfil contractual / del proyecto (PROYECTO!C15) | proyecto | comercial | ficha_documental_datos.datos.perfilServicio | texto | PENDIENTE_DEFINICION_PERFIL_VIP |
| Observaciones sobre el equipo (PROYECTO!I34) | proyecto | especialista / jefe_area | ficha_documental_datos.datos.observacionesEquipo | texto | FALTA → incorporación aditiva |
| Matriz de edición (EDICIÓN!B9) | edicion | especialista | ficha_documental_datos.datos.matrizEdicionUrl | enlace | FALTA → incorporación aditiva |
| Archivo con feedback de tripa completa (EDICIÓN!B61) | edicion | especialista | ficha_documental_datos.datos.feedbackTripaUrl | enlace | FALTA → incorporación aditiva |
| Asignación de aplicación de feedback (EDICIÓN!B62) | edicion | especialista | ficha_documental_datos.datos.feedbackTripaAsignacion | fecha | FALTA → incorporación aditiva |
| Entrega pautada de feedback aplicado (EDICIÓN!B63) | edicion | especialista | ficha_documental_datos.datos.feedbackTripaEntregaPautada | fecha | FALTA → incorporación aditiva |
| Entrega registrada de feedback aplicado (EDICIÓN!B64) | edicion | especialista | ficha_documental_datos.datos.feedbackTripaEntregaReal | fecha | FALTA → incorporación aditiva |
| Observaciones de aplicación del feedback (EDICIÓN!B65) | edicion | especialista | ficha_documental_datos.datos.feedbackTripaObservaciones | texto | FALTA → incorporación aditiva |
| Tripa · Sintaxis enrevesada (CORRECCIÓN!B15) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_15 | booleano | FALTA → incorporación aditiva |
| Tripa · Sintaxis enrevesada · Observaciones (CORRECCIÓN!C15) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_15_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Sintaxis enrevesada (CORRECCIÓN!D15) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_15 | booleano | FALTA → incorporación aditiva |
| Preliminares · Sintaxis enrevesada · Observaciones (CORRECCIÓN!E15) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_15_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Sintaxis enrevesada (CORRECCIÓN!G15) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_15 | booleano | FALTA → incorporación aditiva |
| Cubierta · Sintaxis enrevesada · Observaciones (CORRECCIÓN!H15) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_15_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Desorden sintáctico (CORRECCIÓN!B16) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_16 | booleano | FALTA → incorporación aditiva |
| Tripa · Desorden sintáctico · Observaciones (CORRECCIÓN!C16) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_16_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Desorden sintáctico (CORRECCIÓN!D16) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_16 | booleano | FALTA → incorporación aditiva |
| Preliminares · Desorden sintáctico · Observaciones (CORRECCIÓN!E16) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_16_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Coma criminal (CORRECCIÓN!G16) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_16 | booleano | FALTA → incorporación aditiva |
| Cubierta · Coma criminal · Observaciones (CORRECCIÓN!H16) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_16_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Coma criminal (CORRECCIÓN!B17) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_17 | booleano | FALTA → incorporación aditiva |
| Tripa · Coma criminal · Observaciones (CORRECCIÓN!C17) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_17_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Coma criminal (CORRECCIÓN!D17) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_17 | booleano | FALTA → incorporación aditiva |
| Preliminares · Coma criminal · Observaciones (CORRECCIÓN!E17) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_17_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Repetición de ideas (CORRECCIÓN!G17) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_17 | booleano | FALTA → incorporación aditiva |
| Cubierta · Repetición de ideas · Observaciones (CORRECCIÓN!H17) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_17_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Observaciones de contenido (CORRECCIÓN!B18) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_18 | booleano | FALTA → incorporación aditiva |
| Tripa · Observaciones de contenido · Observaciones (CORRECCIÓN!C18) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_18_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Observaciones de contenido (CORRECCIÓN!D18) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_18 | booleano | FALTA → incorporación aditiva |
| Preliminares · Observaciones de contenido · Observaciones (CORRECCIÓN!E18) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_18_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Repetición de palabras y términos (CORRECCIÓN!G18) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_18 | booleano | FALTA → incorporación aditiva |
| Cubierta · Repetición de palabras y términos · Observaciones (CORRECCIÓN!H18) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_18_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Repetición de ideas (CORRECCIÓN!B19) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_19 | booleano | FALTA → incorporación aditiva |
| Tripa · Repetición de ideas · Observaciones (CORRECCIÓN!C19) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_19_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Repetición de ideas (CORRECCIÓN!D19) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_19 | booleano | FALTA → incorporación aditiva |
| Preliminares · Repetición de ideas · Observaciones (CORRECCIÓN!E19) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_19_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Usa frases destacadas (CORRECCIÓN!G19) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_19 | booleano | FALTA → incorporación aditiva |
| Cubierta · Usa frases destacadas · Observaciones (CORRECCIÓN!H19) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_19_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Repetición de palabras y términos (CORRECCIÓN!B20) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_20 | booleano | FALTA → incorporación aditiva |
| Tripa · Repetición de palabras y términos · Observaciones (CORRECCIÓN!C20) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_20_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Repetición de palabras y términos (CORRECCIÓN!D20) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_20 | booleano | FALTA → incorporación aditiva |
| Preliminares · Repetición de palabras y términos · Observaciones (CORRECCIÓN!E20) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_20_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Uso inadecuado de comillas (CORRECCIÓN!G20) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_20 | booleano | FALTA → incorporación aditiva |
| Cubierta · Uso inadecuado de comillas · Observaciones (CORRECCIÓN!H20) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_20_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Citas sin referencias  (CORRECCIÓN!B21) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_21 | booleano | FALTA → incorporación aditiva |
| Tripa · Citas sin referencias  · Observaciones (CORRECCIÓN!C21) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_21_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Citas sin referencias  (CORRECCIÓN!D21) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_21 | booleano | FALTA → incorporación aditiva |
| Preliminares · Citas sin referencias  · Observaciones (CORRECCIÓN!E21) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_21_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Hace cambios inadecuados en las conjugaciones verbales (CORRECCIÓN!G21) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_21 | booleano | FALTA → incorporación aditiva |
| Cubierta · Hace cambios inadecuados en las conjugaciones verbales · Observaciones (CORRECCIÓN!H21) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_21_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Cambios inadecuados en las conjugaciones verbales (CORRECCIÓN!B22) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_22 | booleano | FALTA → incorporación aditiva |
| Tripa · Cambios inadecuados en las conjugaciones verbales · Observaciones (CORRECCIÓN!C22) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_22_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Cambios inadecuados en las conjugaciones verbales (CORRECCIÓN!D22) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_22 | booleano | FALTA → incorporación aditiva |
| Preliminares · Cambios inadecuados en las conjugaciones verbales · Observaciones (CORRECCIÓN!E22) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_22_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Formato incorrecto de citación (CORRECCIÓN!G22) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_22 | booleano | FALTA → incorporación aditiva |
| Cubierta · Formato incorrecto de citación · Observaciones (CORRECCIÓN!H22) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_22_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Referencias religiosas con errores (CORRECCIÓN!B23) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_23 | booleano | FALTA → incorporación aditiva |
| Tripa · Referencias religiosas con errores · Observaciones (CORRECCIÓN!C23) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_23_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Referencias religiosas con errores (CORRECCIÓN!D23) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_23 | booleano | FALTA → incorporación aditiva |
| Preliminares · Referencias religiosas con errores · Observaciones (CORRECCIÓN!E23) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_23_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Contenido repetitivo (CORRECCIÓN!G23) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_23 | booleano | FALTA → incorporación aditiva |
| Cubierta · Contenido repetitivo · Observaciones (CORRECCIÓN!H23) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_23_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Usa frases destacadas (CORRECCIÓN!B24) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_24 | booleano | FALTA → incorporación aditiva |
| Tripa · Usa frases destacadas · Observaciones (CORRECCIÓN!C24) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_24_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Usa frases destacadas (CORRECCIÓN!D24) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_24 | booleano | FALTA → incorporación aditiva |
| Preliminares · Usa frases destacadas · Observaciones (CORRECCIÓN!E24) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_24_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Faltas de acentuación (CORRECCIÓN!G24) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_24 | booleano | FALTA → incorporación aditiva |
| Cubierta · Faltas de acentuación · Observaciones (CORRECCIÓN!H24) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_24_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Uso inadecuado de comillas (CORRECCIÓN!B25) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_25 | booleano | FALTA → incorporación aditiva |
| Tripa · Uso inadecuado de comillas · Observaciones (CORRECCIÓN!C25) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_25_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Uso inadecuado de comillas (CORRECCIÓN!D25) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_25 | booleano | FALTA → incorporación aditiva |
| Preliminares · Uso inadecuado de comillas · Observaciones (CORRECCIÓN!E25) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_25_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Falta de cursivas para palabras en otros idiomas (CORRECCIÓN!G25) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_25 | booleano | FALTA → incorporación aditiva |
| Cubierta · Falta de cursivas para palabras en otros idiomas · Observaciones (CORRECCIÓN!H25) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_25_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Formato incorrecto de citación (CORRECCIÓN!B26) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_26 | booleano | FALTA → incorporación aditiva |
| Tripa · Formato incorrecto de citación · Observaciones (CORRECCIÓN!C26) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_26_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Formato incorrecto de citación (CORRECCIÓN!D26) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_26 | booleano | FALTA → incorporación aditiva |
| Preliminares · Formato incorrecto de citación · Observaciones (CORRECCIÓN!E26) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_26_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Mayúsculas o minúsculas mal empleadas (CORRECCIÓN!G26) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_26 | booleano | FALTA → incorporación aditiva |
| Cubierta · Mayúsculas o minúsculas mal empleadas · Observaciones (CORRECCIÓN!H26) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_26_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Formato incorrecto de texto (CORRECCIÓN!B27) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_27 | booleano | FALTA → incorporación aditiva |
| Tripa · Formato incorrecto de texto · Observaciones (CORRECCIÓN!C27) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_27_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Formato incorrecto de texto (CORRECCIÓN!D27) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_27 | booleano | FALTA → incorporación aditiva |
| Preliminares · Formato incorrecto de texto · Observaciones (CORRECCIÓN!E27) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_27_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas (CORRECCIÓN!G27) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_27 | booleano | FALTA → incorporación aditiva |
| Cubierta · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas · Observaciones (CORRECCIÓN!H27) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_27_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas (CORRECCIÓN!B28) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_28 | booleano | FALTA → incorporación aditiva |
| Tripa · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas · Observaciones (CORRECCIÓN!C28) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_28_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas (CORRECCIÓN!D28) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_28 | booleano | FALTA → incorporación aditiva |
| Preliminares · Mal uso de signos de puntación: puntos, guiones, exclamación, interrogación y comas · Observaciones (CORRECCIÓN!E28) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_28_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Logo PH tapa, lomo y contraportada (CORRECCIÓN!G28) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_28 | booleano | FALTA → incorporación aditiva |
| Cubierta · Logo PH tapa, lomo y contraportada · Observaciones (CORRECCIÓN!H28) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_28_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Desvío de la estructura (CORRECCIÓN!B29) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_29 | booleano | FALTA → incorporación aditiva |
| Tripa · Desvío de la estructura · Observaciones (CORRECCIÓN!C29) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_29_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Desvío de la estructura (CORRECCIÓN!D29) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_29 | booleano | FALTA → incorporación aditiva |
| Preliminares · Desvío de la estructura · Observaciones (CORRECCIÓN!E29) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_29_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Nombre y apellido autor (CORRECCIÓN!G29) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_29 | booleano | FALTA → incorporación aditiva |
| Cubierta · Nombre y apellido autor · Observaciones (CORRECCIÓN!H29) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_29_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Contenido repetitivo (CORRECCIÓN!B30) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_30 | booleano | FALTA → incorporación aditiva |
| Tripa · Contenido repetitivo · Observaciones (CORRECCIÓN!C30) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_30_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Contenido repetitivo (CORRECCIÓN!D30) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_30 | booleano | FALTA → incorporación aditiva |
| Preliminares · Contenido repetitivo · Observaciones (CORRECCIÓN!E30) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_30_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Espacio entre palabras (CORRECCIÓN!G30) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_30 | booleano | FALTA → incorporación aditiva |
| Cubierta · Espacio entre palabras · Observaciones (CORRECCIÓN!H30) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_30_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Subtítulo divorciado del texto (CORRECCIÓN!B31) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_31 | booleano | FALTA → incorporación aditiva |
| Tripa · Subtítulo divorciado del texto · Observaciones (CORRECCIÓN!C31) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_31_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Subtítulo divorciado del texto (CORRECCIÓN!D31) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_31 | booleano | FALTA → incorporación aditiva |
| Preliminares · Subtítulo divorciado del texto · Observaciones (CORRECCIÓN!E31) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_31_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Lomo con título (CORRECCIÓN!G31) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_31 | booleano | FALTA → incorporación aditiva |
| Cubierta · Lomo con título · Observaciones (CORRECCIÓN!H31) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_31_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Falta de concordancia de género y número (CORRECCIÓN!B32) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_32 | booleano | FALTA → incorporación aditiva |
| Tripa · Falta de concordancia de género y número · Observaciones (CORRECCIÓN!C32) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_32_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Falta de concordancia de género y número (CORRECCIÓN!D32) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_32 | booleano | FALTA → incorporación aditiva |
| Preliminares · Falta de concordancia de género y número · Observaciones (CORRECCIÓN!E32) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_32_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Imágenes de calidad (CORRECCIÓN!G32) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_32 | booleano | FALTA → incorporación aditiva |
| Cubierta · Imágenes de calidad · Observaciones (CORRECCIÓN!H32) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_32_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Falta de cursivas en extranjerismos (CORRECCIÓN!B33) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_33 | booleano | FALTA → incorporación aditiva |
| Tripa · Falta de cursivas en extranjerismos · Observaciones (CORRECCIÓN!C33) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_33_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Falta de cursivas en extranjerismos (CORRECCIÓN!D33) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_33 | booleano | FALTA → incorporación aditiva |
| Preliminares · Falta de cursivas en extranjerismos · Observaciones (CORRECCIÓN!E33) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_33_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Logo del autor (CORRECCIÓN!G33) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_33 | booleano | FALTA → incorporación aditiva |
| Cubierta · Logo del autor · Observaciones (CORRECCIÓN!H33) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_33_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Mayúsculas o minúsculas mal empleadas (CORRECCIÓN!B34) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_34 | booleano | FALTA → incorporación aditiva |
| Tripa · Mayúsculas o minúsculas mal empleadas · Observaciones (CORRECCIÓN!C34) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_34_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Mayúsculas o minúsculas mal empleadas (CORRECCIÓN!D34) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_34 | booleano | FALTA → incorporación aditiva |
| Preliminares · Mayúsculas o minúsculas mal empleadas · Observaciones (CORRECCIÓN!E34) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_34_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Redes sociales autor (CORRECCIÓN!G34) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_34 | booleano | FALTA → incorporación aditiva |
| Cubierta · Redes sociales autor · Observaciones (CORRECCIÓN!H34) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_34_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Faltas de acentuación (CORRECCIÓN!B35) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_35 | booleano | FALTA → incorporación aditiva |
| Tripa · Faltas de acentuación · Observaciones (CORRECCIÓN!C35) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_35_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Faltas de acentuación (CORRECCIÓN!D35) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_35 | booleano | FALTA → incorporación aditiva |
| Preliminares · Faltas de acentuación · Observaciones (CORRECCIÓN!E35) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_35_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Título (CORRECCIÓN!G35) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_35 | booleano | FALTA → incorporación aditiva |
| Cubierta · Título · Observaciones (CORRECCIÓN!H35) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_35_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Gerundio de posterioridad (CORRECCIÓN!B36) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_36 | booleano | FALTA → incorporación aditiva |
| Tripa · Gerundio de posterioridad · Observaciones (CORRECCIÓN!C36) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_36_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Gerundio de posterioridad (CORRECCIÓN!D36) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_36 | booleano | FALTA → incorporación aditiva |
| Preliminares · Gerundio de posterioridad · Observaciones (CORRECCIÓN!E36) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_36_observaciones | texto | FALTA → incorporación aditiva |
| Cubierta · Subtítulo (CORRECCIÓN!G36) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_36 | booleano | FALTA → incorporación aditiva |
| Cubierta · Subtítulo · Observaciones (CORRECCIÓN!H36) | correccion | corrector / especialista | ficha_documental_datos.datos.cubierta_36_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Combinacion de cifras en letra y números (CORRECCIÓN!B37) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_37 | booleano | FALTA → incorporación aditiva |
| Tripa · Combinacion de cifras en letra y números · Observaciones (CORRECCIÓN!C37) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_37_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Combinacion de cifras en letra y números (CORRECCIÓN!D37) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_37 | booleano | FALTA → incorporación aditiva |
| Preliminares · Combinacion de cifras en letra y números · Observaciones (CORRECCIÓN!E37) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_37_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Mayúsculas después de dos puntos (CORRECCIÓN!B38) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_38 | booleano | FALTA → incorporación aditiva |
| Tripa · Mayúsculas después de dos puntos · Observaciones (CORRECCIÓN!C38) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_38_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Mayúsculas después de dos puntos (CORRECCIÓN!D38) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_38 | booleano | FALTA → incorporación aditiva |
| Preliminares · Mayúsculas después de dos puntos · Observaciones (CORRECCIÓN!E38) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_38_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Inconsistencia de la persona gramatical (CORRECCIÓN!B39) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_39 | booleano | FALTA → incorporación aditiva |
| Tripa · Inconsistencia de la persona gramatical · Observaciones (CORRECCIÓN!C39) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_39_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Inconsistencia de la persona gramatical (CORRECCIÓN!D39) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_39 | booleano | FALTA → incorporación aditiva |
| Preliminares · Inconsistencia de la persona gramatical · Observaciones (CORRECCIÓN!E39) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_39_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Coma después de pero antes de interroganción (CORRECCIÓN!B40) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_40 | booleano | FALTA → incorporación aditiva |
| Tripa · Coma después de pero antes de interroganción · Observaciones (CORRECCIÓN!C40) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_40_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Coma después de pero antes de interroganción (CORRECCIÓN!D40) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_40 | booleano | FALTA → incorporación aditiva |
| Preliminares · Coma después de pero antes de interroganción · Observaciones (CORRECCIÓN!E40) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_40_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Coma en falsos conectores (CORRECCIÓN!B41) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_41 | booleano | FALTA → incorporación aditiva |
| Tripa · Coma en falsos conectores · Observaciones (CORRECCIÓN!C41) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_41_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Coma en falsos conectores (CORRECCIÓN!D41) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_41 | booleano | FALTA → incorporación aditiva |
| Preliminares · Coma en falsos conectores · Observaciones (CORRECCIÓN!E41) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_41_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Mal uso de las abreviaturas (CORRECCIÓN!B42) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_42 | booleano | FALTA → incorporación aditiva |
| Tripa · Mal uso de las abreviaturas · Observaciones (CORRECCIÓN!C42) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_42_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Mal uso de las abreviaturas (CORRECCIÓN!D42) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_42 | booleano | FALTA → incorporación aditiva |
| Preliminares · Mal uso de las abreviaturas · Observaciones (CORRECCIÓN!E42) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_42_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Punto antes de la comilla de cierre (CORRECCIÓN!B43) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_43 | booleano | FALTA → incorporación aditiva |
| Tripa · Punto antes de la comilla de cierre · Observaciones (CORRECCIÓN!C43) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_43_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Punto antes de la comilla de cierre (CORRECCIÓN!D43) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_43 | booleano | FALTA → incorporación aditiva |
| Preliminares · Punto antes de la comilla de cierre · Observaciones (CORRECCIÓN!E43) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_43_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Desdoblamiento de género (CORRECCIÓN!B44) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_44 | booleano | FALTA → incorporación aditiva |
| Tripa · Desdoblamiento de género · Observaciones (CORRECCIÓN!C44) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_44_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Desdoblamiento de género (CORRECCIÓN!D44) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_44 | booleano | FALTA → incorporación aditiva |
| Preliminares · Desdoblamiento de género · Observaciones (CORRECCIÓN!E44) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_44_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Dequeísmo y Queísmo (CORRECCIÓN!B45) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_45 | booleano | FALTA → incorporación aditiva |
| Tripa · Dequeísmo y Queísmo · Observaciones (CORRECCIÓN!C45) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_45_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Dequeísmo y Queísmo (CORRECCIÓN!D45) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_45 | booleano | FALTA → incorporación aditiva |
| Preliminares · Dequeísmo y Queísmo · Observaciones (CORRECCIÓN!E45) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_45_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Leísmo, Laísmo y Loísmo (CORRECCIÓN!B46) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_46 | booleano | FALTA → incorporación aditiva |
| Tripa · Leísmo, Laísmo y Loísmo · Observaciones (CORRECCIÓN!C46) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_46_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Leísmo, Laísmo y Loísmo (CORRECCIÓN!D46) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_46 | booleano | FALTA → incorporación aditiva |
| Preliminares · Leísmo, Laísmo y Loísmo · Observaciones (CORRECCIÓN!E46) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_46_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Fórmula y/o (CORRECCIÓN!B47) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_47 | booleano | FALTA → incorporación aditiva |
| Tripa · Fórmula y/o · Observaciones (CORRECCIÓN!C47) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_47_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Fórmula y/o (CORRECCIÓN!D47) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_47 | booleano | FALTA → incorporación aditiva |
| Preliminares · Fórmula y/o · Observaciones (CORRECCIÓN!E47) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_47_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Adjetivo relacional antepuesto (CORRECCIÓN!B48) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_48 | booleano | FALTA → incorporación aditiva |
| Tripa · Adjetivo relacional antepuesto · Observaciones (CORRECCIÓN!C48) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_48_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Adjetivo relacional antepuesto (CORRECCIÓN!D48) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_48 | booleano | FALTA → incorporación aditiva |
| Preliminares · Adjetivo relacional antepuesto · Observaciones (CORRECCIÓN!E48) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_48_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Prefijos sin soldar (CORRECCIÓN!B49) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_49 | booleano | FALTA → incorporación aditiva |
| Tripa · Prefijos sin soldar · Observaciones (CORRECCIÓN!C49) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_49_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Prefijos sin soldar (CORRECCIÓN!D49) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_49 | booleano | FALTA → incorporación aditiva |
| Preliminares · Prefijos sin soldar · Observaciones (CORRECCIÓN!E49) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_49_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Problemas de tipeo (CORRECCIÓN!B50) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_50 | booleano | FALTA → incorporación aditiva |
| Tripa · Problemas de tipeo · Observaciones (CORRECCIÓN!C50) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_50_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Problemas de tipeo (CORRECCIÓN!D50) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_50 | booleano | FALTA → incorporación aditiva |
| Preliminares · Problemas de tipeo · Observaciones (CORRECCIÓN!E50) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_50_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Errores ortográficos por homonimia (CORRECCIÓN!B51) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_51 | booleano | FALTA → incorporación aditiva |
| Tripa · Errores ortográficos por homonimia · Observaciones (CORRECCIÓN!C51) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_51_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Errores ortográficos por homonimia (CORRECCIÓN!D51) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_51 | booleano | FALTA → incorporación aditiva |
| Preliminares · Errores ortográficos por homonimia · Observaciones (CORRECCIÓN!E51) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_51_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Confusión de preposiciones (CORRECCIÓN!B52) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_52 | booleano | FALTA → incorporación aditiva |
| Tripa · Confusión de preposiciones · Observaciones (CORRECCIÓN!C52) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_52_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Confusión de preposiciones (CORRECCIÓN!D52) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_52 | booleano | FALTA → incorporación aditiva |
| Preliminares · Confusión de preposiciones · Observaciones (CORRECCIÓN!E52) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_52_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Impropiedad léxica (CORRECCIÓN!B53) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_53 | booleano | FALTA → incorporación aditiva |
| Tripa · Impropiedad léxica · Observaciones (CORRECCIÓN!C53) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_53_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Impropiedad léxica (CORRECCIÓN!D53) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_53 | booleano | FALTA → incorporación aditiva |
| Preliminares · Impropiedad léxica · Observaciones (CORRECCIÓN!E53) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_53_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Ambigüedades, barbarismos y perogrulladas (CORRECCIÓN!B54) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_54 | booleano | FALTA → incorporación aditiva |
| Tripa · Ambigüedades, barbarismos y perogrulladas · Observaciones (CORRECCIÓN!C54) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_54_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Ambigüedades, barbarismos y perogrulladas (CORRECCIÓN!D54) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_54 | booleano | FALTA → incorporación aditiva |
| Preliminares · Ambigüedades, barbarismos y perogrulladas · Observaciones (CORRECCIÓN!E54) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_54_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Cacofonías (CORRECCIÓN!B55) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_55 | booleano | FALTA → incorporación aditiva |
| Tripa · Cacofonías · Observaciones (CORRECCIÓN!C55) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_55_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Cacofonías (CORRECCIÓN!D55) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_55 | booleano | FALTA → incorporación aditiva |
| Preliminares · Cacofonías · Observaciones (CORRECCIÓN!E55) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_55_observaciones | texto | FALTA → incorporación aditiva |
| Tripa · Plagio (CORRECCIÓN!B56) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_56 | booleano | FALTA → incorporación aditiva |
| Tripa · Plagio · Observaciones (CORRECCIÓN!C56) | correccion | corrector / especialista | ficha_documental_datos.datos.tripa_56_observaciones | texto | FALTA → incorporación aditiva |
| Preliminares · Plagio (CORRECCIÓN!D56) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_56 | booleano | FALTA → incorporación aditiva |
| Preliminares · Plagio · Observaciones (CORRECCIÓN!E56) | correccion | corrector / especialista | ficha_documental_datos.datos.preliminares_56_observaciones | texto | FALTA → incorporación aditiva |
| Tipo de archivo adicional (DISEÑO Y DIAGRAMACIÓN!B42) | diseno | especialista / disenador | ficha_documental_datos.datos.contenidoAdicionalTipo | texto | FALTA → incorporación aditiva |
| Asignación de contenido adicional (DISEÑO Y DIAGRAMACIÓN!B43) | diseno | especialista / disenador | ficha_documental_datos.datos.contenidoAdicionalAsignacion | fecha | FALTA → incorporación aditiva |
| Entrega de contenido adicional (DISEÑO Y DIAGRAMACIÓN!B44) | diseno | especialista / disenador | ficha_documental_datos.datos.contenidoAdicionalEntrega | fecha | FALTA → incorporación aditiva |
| Observaciones de contenido adicional (DISEÑO Y DIAGRAMACIÓN!B45) | diseno | especialista / disenador | ficha_documental_datos.datos.contenidoAdicionalObservaciones | texto | FALTA → incorporación aditiva |
| Asignación del paquete final (DISEÑO Y DIAGRAMACIÓN!B47) | diseno | especialista / disenador | ficha_documental_datos.datos.paqueteFinalAsignacion | fecha | FALTA → incorporación aditiva |
| Archivos cargados en la carpeta (DISEÑO Y DIAGRAMACIÓN!B48) | diseno | especialista / disenador | ficha_documental_datos.datos.paqueteFinalArchivos | texto | FALTA → incorporación aditiva |
| Paquete final cargado (DISEÑO Y DIAGRAMACIÓN!B49) | diseno | especialista / disenador | ficha_documental_datos.datos.paqueteFinalCargado | booleano | FALTA → incorporación aditiva |
| Entrega de paquete final (DISEÑO Y DIAGRAMACIÓN!B50) | diseno | especialista / disenador | ficha_documental_datos.datos.paqueteFinalEntrega | fecha | FALTA → incorporación aditiva |
| Observaciones del paquete final (DISEÑO Y DIAGRAMACIÓN!B51) | diseno | especialista / disenador | ficha_documental_datos.datos.paqueteFinalObservaciones | texto | FALTA → incorporación aditiva |
| Recepción de formulario Amazon (SOPORTE DIGITAL!B11) | digital | soporte_digital | ficha_documental_datos.datos.recepcionFormulario | fecha | FALTA → incorporación aditiva |
| Creación de cuenta Amazon (SOPORTE DIGITAL!B12) | digital | soporte_digital | ficha_documental_datos.datos.creacionCuenta | fecha | FALTA → incorporación aditiva |
| Observaciones de registro (SOPORTE DIGITAL!B13) | digital | soporte_digital | ficha_documental_datos.datos.observacionesRegistro | texto | FALTA → incorporación aditiva |
| Reunión de criterios Amazon (SOPORTE DIGITAL!B15) | digital | soporte_digital | ficha_documental_datos.datos.reunionCriterios | fecha | FALTA → incorporación aditiva |
| Grabación de criterios Amazon (SOPORTE DIGITAL!B16) | digital | soporte_digital | ficha_documental_datos.datos.grabacionCriterios | enlace | FALTA → incorporación aditiva |
| Tapa Amazon (SOPORTE DIGITAL!B17) | digital | soporte_digital | ficha_documental_datos.datos.tapa | texto | FALTA → incorporación aditiva |
| Portada Amazon (SOPORTE DIGITAL!B18) | digital | soporte_digital | ficha_documental_datos.datos.portada | texto | FALTA → incorporación aditiva |
| Papel Amazon (SOPORTE DIGITAL!B19) | digital | soporte_digital | ficha_documental_datos.datos.papel | texto | FALTA → incorporación aditiva |
| Precio de venta KDP acordado (SOPORTE DIGITAL!B20) | digital | soporte_digital | ficha_documental_datos.datos.precioKdp | texto | FALTA → incorporación aditiva |
| Precio de venta Kindle acordado (SOPORTE DIGITAL!B21) | digital | soporte_digital | ficha_documental_datos.datos.precioKindle | texto | FALTA → incorporación aditiva |
| Lanzamiento en Amazon acordado (SOPORTE DIGITAL!B22) | digital | soporte_digital | ficha_documental_datos.datos.lanzamientoAmazon | fecha | FALTA → incorporación aditiva |
| Observaciones de criterios Amazon (SOPORTE DIGITAL!B23) | digital | soporte_digital | ficha_documental_datos.datos.observacionesCriterios | texto | FALTA → incorporación aditiva |
| Prueba de archivos KDP en Amazon (SOPORTE DIGITAL!B25) | digital | soporte_digital | ficha_documental_datos.datos.pruebaArchivos | fecha | FALTA → incorporación aditiva |
| Carga de archivos KDP (SOPORTE DIGITAL!B26) | digital | soporte_digital | ficha_documental_datos.datos.cargaKdp | fecha | FALTA → incorporación aditiva |
| Carga de archivos Kindle (SOPORTE DIGITAL!B27) | digital | soporte_digital | ficha_documental_datos.datos.cargaKindle | fecha | FALTA → incorporación aditiva |
| Reunión de inducción Amazon (SOPORTE DIGITAL!B29) | digital | soporte_digital | ficha_documental_datos.datos.induccion | fecha | FALTA → incorporación aditiva |
| Grabación de inducción Amazon (SOPORTE DIGITAL!B30) | digital | soporte_digital | ficha_documental_datos.datos.grabacionInduccion | enlace | FALTA → incorporación aditiva |
| Reunión de impresión (IMPRESIÓN!B7) | impresion | impresion | ficha_documental_datos.datos.fechaReunion | fecha | FALTA → incorporación aditiva |
| Tamaño del libro (pulgadas) (IMPRESIÓN!B14) | impresion | impresion | ficha_documental_datos.datos.tamanoLibro | texto | FALTA → incorporación aditiva |
| Páginas del archivo de imprenta (IMPRESIÓN!B15) | impresion | impresion | ficha_documental_datos.datos.paginasImprenta | numero | FALTA → incorporación aditiva |
| Tipo de papel (IMPRESIÓN!B16) | impresion | impresion | ficha_documental_datos.datos.tipoPapel | texto | FALTA → incorporación aditiva |
| Material de portada (IMPRESIÓN!B17) | impresion | impresion | ficha_documental_datos.datos.materialPortada | texto | FALTA → incorporación aditiva |
| Color de impresión del papel (IMPRESIÓN!B18) | impresion | impresion | ficha_documental_datos.datos.colorPapel | texto | FALTA → incorporación aditiva |
| Formato de portada (IMPRESIÓN!B19) | impresion | impresion | ficha_documental_datos.datos.formatoPortada | texto | FALTA → incorporación aditiva |
| Color de impresión de portada (IMPRESIÓN!B20) | impresion | impresion | ficha_documental_datos.datos.colorPortada | texto | FALTA → incorporación aditiva |
| Acabado de portada (IMPRESIÓN!B21) | impresion | impresion | ficha_documental_datos.datos.acabadoPortada | texto | FALTA → incorporación aditiva |
| Criterios especiales de portada (IMPRESIÓN!B22) | impresion | impresion | ficha_documental_datos.datos.criteriosPortada | texto | FALTA → incorporación aditiva |
| Solapas (IMPRESIÓN!B23) | impresion | impresion | ficha_documental_datos.datos.solapas | texto | FALTA → incorporación aditiva |
| Termosellado (IMPRESIÓN!B24) | impresion | impresion | ficha_documental_datos.datos.termosellado | texto | FALTA → incorporación aditiva |
| Encuadernación (IMPRESIÓN!B25) | impresion | impresion | ficha_documental_datos.datos.encuadernacion | texto | FALTA → incorporación aditiva |
| Cantidad de libros a imprimir (IMPRESIÓN!B26) | impresion | impresion | ficha_documental_datos.datos.cantidadLibros | numero | FALTA → incorporación aditiva |
| Otro material de portada (IMPRESIÓN!E17) | impresion | impresion | ficha_documental_datos.datos.otroMaterialPortada | texto | FALTA → incorporación aditiva |
| Reunión de distribución (DISTRIBUCIÓN!B7) | distribucion | distribucion | ficha_documental_datos.datos.fechaReunion | fecha | FALTA → incorporación aditiva |
| Observaciones de reunión de distribución (DISTRIBUCIÓN!B9) | distribucion | distribucion | ficha_documental_datos.datos.observacionesReunion | texto | FALTA → incorporación aditiva |
| Inicio del contrato de distribución (DISTRIBUCIÓN!B11) | distribucion | distribucion | ficha_documental_datos.datos.contratoInicio | fecha | FALTA → incorporación aditiva |
| Fin del contrato de distribución (DISTRIBUCIÓN!B12) | distribucion | distribucion | ficha_documental_datos.datos.contratoFin | fecha | FALTA → incorporación aditiva |
| Medios de distribución (DISTRIBUCIÓN!B15) | distribucion | distribucion | ficha_documental_datos.datos.medios | texto | FALTA → incorporación aditiva |
| Ejemplares a distribuir (DISTRIBUCIÓN!B16) | distribucion | distribucion | ficha_documental_datos.datos.ejemplares | numero | FALTA → incorporación aditiva |
| Detalles de distribución (DISTRIBUCIÓN!B17) | distribucion | distribucion | ficha_documental_datos.datos.detalles | texto | FALTA → incorporación aditiva |
| ISBN para distribución (DISTRIBUCIÓN!B18) | distribucion | distribucion | ficha_documental_datos.datos.isbn | texto | FALTA → incorporación aditiva |
| ¿Se debe tramitar ISBN nuevo? (DISTRIBUCIÓN!B19) | distribucion | distribucion | ficha_documental_datos.datos.requiereIsbn | booleano | FALTA → incorporación aditiva |
| Nuevo ISBN (DISTRIBUCIÓN!B20) | distribucion | distribucion | ficha_documental_datos.datos.nuevoIsbn | texto | FALTA → incorporación aditiva |
| Detalles de gestión ISBN (DISTRIBUCIÓN!B21) | distribucion | distribucion | ficha_documental_datos.datos.detallesIsbn | texto | FALTA → incorporación aditiva |

## Verificación final de implementación

Cierre: 2026-10-10. Los 272 campos del catálogo aditivo tienen persistencia, lectura documental, edición puntual por propietario, validación de tipo y auditoría. La migración 0073 añade únicamente `ficha_documental_datos` y su FK; fue aplicada a PanHouse en 5433. No se ejecutaron DROP, seed ni importaciones de datos personales. Spark permanece fuera del alcance. El perfil contractual se puede registrar expresamente, pero su equivalencia con VIP del autor sigue pendiente de definición.

| Área | Campos aditivos implementados |
|---|---:|
| proyecto | 2 |
| edicion | 6 |
| correccion | 212 |
| diseno | 9 |
| digital | 17 |
| impresion | 15 |
| distribucion | 11 |

### Arquitectura y contratos

La ruta conserva su URL. `FichaVivaPage` compone resumen, trazabilidad, acciones del rol, equipo y actividad. `ExpedienteDocumental` carga el detalle sólo con `?modo=completa`, con índice, nueve acordeones, grupos documentales y edición individual. `FichaElements` concentra campos, enlaces, fechas de calendario, badges y listas. `useFichaViva` separa las consultas por proyecto y usuario/rol; las mutaciones existentes invalidan la proyección viva. Comercial conserva su formulario existente en `/proyectos/:id/ingreso-comercial`. Los enlaces del Especialista seleccionan el área correcta del detalle existente.

| Endpoint bajo /api/fichas-trazabilidad/:proyectoId | Contrato |
|---|---|
| GET /resumen | 29 columnas de ficha, identidad mínima de autores, agregaciones por tipo/estado y capítulos, equipo vigente, planificación real, conceptos pendientes y cinco eventos. |
| GET /expediente | Nueve áreas, fuente canónica de 152 columnas (148 de negocio; IDs/metadatos internos excluidos y cuenta Amazon protegida), catálogo suplementario, intervenciones, capítulos, diseños/versiones, fases/rondas de calidad, reuniones, eventos, publicaciones e historial del equipo. |
| GET /actividad?cursor=… | Keyset fecha/id, 20 eventos por página, actor y etiqueta humana. |
| PATCH /documental/:area | Claves cerradas, tipos primitivos, permisos por campo, merge serializado y audit de claves sin valores privados. |

Todas las lecturas validan sesión, rol y pertenencia. El resumen utiliza seis consultas secundarias concurrentes y normalmente diez consultas SQL incluyendo acceso, equipo y autores; dos consultas de compatibilidad pueden ser necesarias para autoría antigua o FK de asignación. No hay consulta por autor/intervención ni carga de textos de capítulos, checklists, versiones o historial completo. El conteo de capítulos se agrega en PostgreSQL y devuelve una fila. El detalle limita a 500 filas por colección; consulta una fila adicional para informar cualquier truncamiento. Los errores secundarios se comunican por bloque; los conteos fallidos permanecen desconocidos, no cero.

El equipo muestra assignments activas y compatibilidad de FK vigente; la historia conserva responsables anteriores y sus fechas. La reasignación A→B está probada. Los correctores sólo escriben criterios del alcance de una intervención vigente propia; una asignación de tripa no habilita preliminares ni cubierta. Se revalida dentro de la transacción. RRPP no puede escribir los campos documentales operativos de Diseño, Impresión o Distribución, ni saltar los permisos existentes de asesorías.

Lanzamiento se habilita exclusivamente con el work item de planificación existente. La card muestra su fase canónica, por ejemplo En asesoramiento, y la fecha tentativa. El enlace de gestión sólo aparece si está habilitado. La revisión de conceptos aparece sólo si hay conceptos pendientes reales. Edición No aplica para SE no genera un CTA operativo. Los macroestados libres antiguos se presentan como registro del área; sólo estados conocidos se normalizan.

Presupuesto inicial (`proyectos.presupuestoId`) y presupuesto del servicio (`fichas_trazabilidad.ingresoServicioPresupuesto`) son campos diferentes: se etiquetan expresamente y conservan sus valores. El resumen no copia contactos. El texto histórico de cuenta Amazon se conserva en BD, pero las respuestas nuevas y antiguas excluyen posibles credenciales; Soporte Digital sólo recibe un correo validado y los demás roles ven presencia. No se añadieron campos de contraseñas.

### Calidad: destino concreto por criterio

Todos los resultados están en `ficha_calidad_fases.checklist[clave].cumple` y `.observaciones`, por fase y ronda. F1 usa 26 criterios; F3 usa 24 (sin textos diagramados y datos). F2/F4 conservan cantidades de cambios pendientes/nuevos, PDF comentado, páginas, receptor y observaciones, sin inventar otra lista.

| Campo original | Clave canónica |
|---|---|
| Validación de textos diagramados | checklist.textos_diagramados |
| Palabras cortadas | checklist.palabras_cortadas |
| Citas | checklist.citas |
| Epígrafes | checklist.epigrafes |
| Páginas de ejercicios | checklist.paginas_ejercicios |
| Portadillas | checklist.portadillas |
| Sangría | checklist.sangria |
| Casita PanHouse | checklist.casita_panhouse |
| Logo de colección | checklist.logo_coleccion |
| Página de créditos | checklist.creditos |
| Notas a pie | checklist.notas_pie |
| Títulos | checklist.titulos |
| Intertítulos | checklist.intertitulos |
| Viñetas | checklist.vinetas |
| Contraste de índice | checklist.indice |
| Enumeración de páginas | checklist.paginacion |
| Foliaturas | checklist.foliaturas |
| Fotografías | checklist.fotografias |
| Tablas | checklist.tablas |
| Dedicatoria | checklist.dedicatoria |
| Agradecimientos | checklist.agradecimientos |
| Sobre el autor | checklist.sobre_autor |
| Prólogo | checklist.prologo |
| Comentarios | checklist.comentarios |
| Datos | checklist.datos |
| Textos por incorporar | checklist.textos_incorporar |

### Validación final

- Baseline: typechecks de ambos proyectos y 23 pruebas relevantes correctas.
- Suite completa: 53 archivos, 990 pruebas; 988 correctas y dos fallos en pruebas nuevas. Se detectaron acciones prematuras y exposición en la respuesta antigua de cuenta Amazon. Ambos casos fueron corregidos y reejecutados.
- Revalidación: `fichaViva.routes.test.ts` y `trazabilidad.routes.test.ts`: 178/178 correctas (20 nuevas + 158 existentes).
- Ajuste final de agregación: 21/21 pruebas nuevas correctas; incluye conteo parcial de capítulos y conservación de No iniciado para cero capítulos. Total actual del repositorio: 992 pruebas en 53 archivos. No se afirma una segunda ejecución completa de 992 pruebas: se conserva el resultado de la suite y las revalidaciones específicas.
- Backend typecheck/build y frontend typecheck/build correctos. Vite conserva la advertencia de chunks mayores de 500 kB (bundle principal aproximado 762 kB); no bloquea la compilación. No se añadieron dependencias.
- Pruebas de integración realizadas en PostgreSQL efímero 5434, separado de PanHouse/Spark. La base de trabajo conserva sus datos demo.

### Autoauditoría visual y evidencia

Las capturas sólo muestran proyectos demo. No se versionan los XLSX originales ni las exportaciones de fuentes con datos personales. Las capturas fallidas o recortadas accidentalmente se excluyen de la evidencia final. Se verificó la dimensión real del viewport y ausencia de overflow horizontal mediante lectura del DOM.

| Resolución / revisión | Problema observado | Cambio y verificación |
|---|---|---|
| 1440×900, ciclo 1 | Autor/servicio/unidad repetidos y trazabilidad demasiado alta. | Cabecera compacta, visión general sin esas repeticiones y filas de área compactas. |
| 1440×900, ciclo 2 | Labels técnicos en actividad, acciones anticipadas y diferencias de fechas. | Etiquetas humanas, CTAs condicionados por proceso real, fechas de calendario con año, fase de asesoramiento visible. Las nueve áreas caben en la vista inicial. |
| 768×1024 | Sidebar consumía 256 px y estrechaba las cards. | En esta ficha el sidebar se oculta por debajo de 1024 px; el contenido usa todo el ancho. Se recorrieron inicio, medio y final. |
| 375×812 | Riesgo de repetir la composición de escritorio en ancho móvil. | Orden cabecera→estados→visión→gestión→trazabilidad→equipo→actividad; botones y estados legibles, ancho de documento 375 px, sin overflow horizontal. Se recorrieron inicio, medio y final. |
| Comercial | Acceso al ingreso debía conservar edición y envío existentes. | CTA abre el formulario original y conserva contrato, coautoría y preparación. |
| Especialista | Debía abrir su área y respetar pertenencia. | Enlace Corrección abre fase 5 existente; expediente permite edición puntual; proyecto ajeno muestra acceso denegado. |
| RRPP | Debía consultar áreas ajenas y gestionar sus procesos reales. | Ficha rica SE con asesoramiento/intereses activos; CR sin gate/equipo ni acciones prematuras; historial paginado y áreas documentales de consulta. |

Evidencia versionada en `docs/arquitectura/evidencia-ficha-viva/`: inicio y final de escritorio, ciclos de revisión, tablet corregida y móvil inicio/medio/final, Especialista y edición puntual. El antes completo se conserva localmente en `.git/ficha-viva-audit/antes-1440-*.jpg`.

### Gaps abiertos

La semántica contractual Estándar/VIP y su relación con relevancia del autor necesita definición de negocio. Los DROP históricos no se pueden reconstruir sin respaldo; la migración actual no altera ni elimina esa historia. Los estados y matrices antiguos permanecen como consulta, sin convertirlos en nuevos gates. Las colecciones documentales superiores a 500 registros muestran truncamiento explícito; el historial de actividad sí tiene paginación. No se hizo push.
