# Documento 04 — Mapa de Campos Duplicados y Fuentes de Verdad
**Sistema:** PanHouse Gestor Editorial  
**Fecha:** Octubre 2026  
**Principio Rector:** **UN DATO = UNA FUENTE DE VERDAD**

Las matrices de Excel y formularios históricos guardaban copias redundantes de los mismos datos. Este documento identifica cada campo duplicado, localiza dónde aparecía en las hojas de cálculo y define cuál es su **Entidad Canónica Única** en la base de datos PostgreSQL, garantizando que el resto de las vistas lo consulten mediante relaciones (`JOIN`) y no volviendo a almacenarlo.

---

## 1. Tabla de Dispersión y Desduplicación

| Concepto de Negocio | Fuentes donde aparecía repetido | Problema Operativo del Pasado | Entidad Canónica Definitiva | Campo Canónico en PostgreSQL | Modo de Consumo en Vistas / Matrices |
|---|---|---|---|---|---|
| **Nombre del Autor** | • Ficha PED-FOR-001 (Datos de Ingreso)<br>• Matriz IA (columna Autores)<br>• Matriz RRPP (columna Autor)<br>• Matriz Editores (columna Autores)<br>• Seguimiento Corrección (columna Autor) | Se tipeaba a mano en 5 hojas. Si había un error ortográfico en una, no coincidía en los reportes. | `autores` | `autores.nombre` | Proyección vía `JOIN autores ON proyectos.autor_id = autores.id` o tabla de coautoría `proyectos_autores`. |
| **Nombre Artístico** | • Ficha PED-FOR-001 (Datos de Ingreso)<br>• Título en matrices informales | A veces se usaba el nombre real y otras el artístico, desalineando registros. | `autores` | `autores.nombre_artistico` | Se lee desde `autores`. |
| **País / Nacionalidad** | • Ficha PED-FOR-001 (Datos de Ingreso)<br>• Matriz RRPP (Nacionalidad, País donde reside) | Comercial y RRPP llenaban países por separado. | `autores` | `autores.pais`<br>`autores.nacionalidad` | Se lee desde `autores`. |
| **Datos de Contacto (Email, Teléfono, Redes)** | • Ficha PED-FOR-001 (Datos de Ingreso)<br>• Drive / Chats informales | Especialistas y RRPP tenían listas paralelas de teléfonos y correos. | `autores` | `autores.email`<br>`autores.telefono`<br>`autores.redes_sociales` | Se lee desde `autores`. Cualquier actualización en el CRM beneficia a todo el escuadrón. |
| **Perfil / Categoría del Cliente (Estándar vs. VIP)** | • Ficha PED-FOR-001 (Perfil servicio)<br>• Matriz IA (Relevancia del autor)<br>• CRM Comercial | Se duplicaba a nivel de autor y a nivel de proyecto. | `autores` | `autores.categoria` (`'Estándar'` \| `'VIP'`) | Atributo del cliente en `autores`. El proyecto hereda la categoría del autor. |
| **Tipo de Servicio (`EF`, `EEC`, `EET`, `SE`, `CR`)** | • Ficha PED-FOR-001 (Tipo de proyecto)<br>• Matriz IA (Tipo de Servicio)<br>• Matriz Editores (Tipo de Servicio)<br>• Matriz RRPP (Servicio adquirido)<br>• Seguimiento Corrección (Tipo de servicio) | Duplicado en 5 lugares. En unas decía "GHOST", en otras "Ghostwriter", en otras "EF". | `servicios` / `proyectos` | `proyectos.servicio_id` -> `servicios.codigo` | Catálogo maestro único `servicios`. Cada matriz lee el nombre legible y código vía `JOIN`. |
| **Unidad de Negocio** | • Ficha PED-FOR-001<br>• Matriz IA (columna Unidad)<br>• Matriz RRPP<br>• Seguimiento Corrección (columna Unidad) | Se escribía "Maxwell", "ILC", "PanHouse", "Academia Origen" en 4 hojas distintas. | `unidades` / `proyectos` | `proyectos.unidad_id` -> `unidades.id` | Proyección vía `JOIN proyectos.unidad_id = unidades.id`. |
| **Presupuesto (`Plata`, `Oro`, `Platinium`)** | • Ficha PED-FOR-001 (Datos de ingreso)<br>• Matriz IA (columna Presupuesto)<br>• Contratos comerciales | Se anotaba en la venta y luego se volvía a escribir en la ficha. | `presupuestos` / `proyectos` | `proyectos.presupuesto_id` | Proyección vía `JOIN presupuestos`. |
| **Fecha de Ingreso (Firma de Contrato)** | • Ficha PED-FOR-001 (Fecha de ingreso)<br>• Matriz IA (Fecha de inicio)<br>• Matriz RRPP (Fecha de Ingreso) | Si se modificaba en una hoja, los días de ejecución en las otras daban cálculos divergentes. | `proyectos` | `proyectos.fecha_programada_inicio` | **Dato maestro único en `proyectos`**. Toda vista de RRPP, IA y Cronograma lee esta fecha. |
| **Fecha de Cierre Proyectada** | • Ficha PED-FOR-001 (Fecha cierre)<br>• Matriz IA (Fecha fin proyectada)<br>• Matriz RRPP (Fecha de cierre) | Se escribía manualmente en Excel a pesar de ser un cálculo derivado. | Derivado (`proyectos` + `servicios`) | Derivado: `fecha_inicio + plazo_dias` (o persistido en `fecha_fin_proyectada`) | Se calcula automáticamente al fijarse `fecha_programada_inicio` y el subtipo en RRPP. |
| **Asignación de Especialista** | • Ficha PED-FOR-001 (Equipo editorial: Coordinador)<br>• Matriz IA (Coordinador / Especialista)<br>• Matriz Editores (Coordinador)<br>• Matriz RRPP (Especialista Responsable)<br>• Seguimiento Corrección (Especialista) | Se escribía el nombre ("Sthephania", "Andreina", "Mariángely") 5 veces. | `proyectos` | `proyectos.especialista_id` -> `usuarios.id` | **Una sola asignación formal por Jefatura.** Todas las vistas leen `usuarios.nombre` del especialista asignado. |
| **Asignación de Editor** | • Ficha PED-FOR-001 (Equipo editorial: Editor)<br>• Matriz IA (columna Editor)<br>• Matriz Editores (columna Editor) | Jefatura de Edición y Especialista duplicaban el registro del editor. | `proyectos` | `proyectos.editor_id` -> `usuarios.id` | Asignado una vez por `jefe_edicion`. La Ficha y la Matriz IA lo leen de `proyectos.editor_id`. |
| **Asignación de Diseñador** | • Ficha PED-FOR-001 (Equipo editorial: Diseñador)<br>• Matriz IA (Diseñador gráfico)<br>• Ficha Diseño (Diseñador) | Repetido en 3 lugares. | `proyectos` | `proyectos.disenador_id` -> `usuarios.id` | Asignado por el Especialista en `proyectos.disenador_id`. |
| **Asignación de Corrector** | • Ficha PED-FOR-001 (Equipo editorial: Corrector)<br>• Matriz IA (columna Corrector)<br>• Seguimiento Corrección (Analista) | Repetido en 3 lugares con nombres freelance distintos. | `proyectos` / `seguimiento_fases` | `proyectos.corrector_id` | Asignación contractual única. |
| **Título y Subtítulo Tentativo** | • Ficha PED-FOR-001 (Posible título)<br>• Matriz RRPP (Título tentativo)<br>• Matriz IA | Se anotaban variantes en la ficha y en RRPP. | `fichas_trazabilidad` | `fichas_trazabilidad.posible_titulo_libro` | Una sola fuente hasta el hito de título definitivo. |
| **Título y Subtítulo Definitivo** | • Ficha Diseño (Nombre del libro / Subtítulo)<br>• Ficha Calidad (Criterios importantes)<br>• Ficha Impresión (Título definitivo)<br>• Matriz IA (Título del libro) | Se transcribía a mano cuando el autor lo definía, con riesgo de erratas. | `proyectos` / `fichas_trazabilidad` | Centralizado en campo formal de proyecto/ficha | Al aprobarse el título formal, todas las pestañas de Diseño, Calidad, Impresión y Matriz IA proyectan el mismo string exacto. |
| **Condiciones Contractuales (Capítulos / Páginas)** | • Ficha PED-FOR-001 (Capítulos y páginas)<br>• Matriz IA (Capítulos adicionales / Notas) | Comercial lo llenaba en ficha y Jefatura lo reescribía en notas de la matriz. | `fichas_trazabilidad` | `capitulos_pactados`<br>`paginas_pactadas`<br>`criterio_extra`<br>`condiciones_especiales` | Comercial es el único que lo define al crear/configurar contrato. |
| **Contrato Firmado** | • Ficha Trazabilidad (Datos de ingreso)<br>• Matriz IA (¿Contrato Firmado?)<br>• Matriz RRPP (Contrato firmado y enviado) | 3 booleans independientes desincronizados. | `proyectos` | `proyectos.contrato_firmado` | Boolean único en `proyectos`. RRPP y Matriz IA lo leen directamente. |

---

## 2. Impacto Arquitectónico de la Desduplicación

1. **Eliminación de Trabajo Manual:**
   - La Jefa de Área ya no necesita tipear los datos del autor ni del servicio en la Matriz IA: la vista de Jefatura se alimenta directamente de `SELECT ... FROM proyectos JOIN autores ... JOIN servicios ...`.
2. **Cero Desincronización:**
   - Si un autor cambia de teléfono o país, se actualiza en su ficha de cliente y se refleja de inmediato en Comercial, RRPP y el Command Center del Especialista.
3. **Integridad Referencial:**
   - Al usar IDs foráneos (`UUID`) hacia catálogos (`servicios`, `unidades`, `presupuestos`), es imposible que existan inconsistencias sintácticas (ej. `"GHOST"`, `"Ghostwriter"`, `"escritura fantasma"` son todas el mismo servicio con código `EF`).
