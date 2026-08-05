# Especificación para renderizar el diagrama de base de datos

> La fuente de verdad del esquema es `database/diagrama-uml.puml`, respaldada por las migraciones versionadas. Esta especificación describe el ERD vigente de 14 tablas y sirve solo como guía visual.

---

## Prompt vigente (español)

```
Diagrama entidad-relación profesional de una base de datos con 14 tablas interconectadas, estilo dibujo técnico limpio, colores corporativos azul marino y rojo, fondo blanco. Las tablas son rectángulos con bordes redondeados, conectadas por líneas de relación. Las tablas son:

1. estudiante (ci, nombre_completo, correo, teléfono)
2. administrador (correo, nombre_completo)
3. nivel (código, versión, puntaje_mínimo, puntaje_máximo)
4. revisión_partición_niveles (revisión singleton de rangos CEFR)
5. configuración_examen (tiempo_límite, preguntas_por_examen, puntaje_aprobación)
6. instantánea_configuración_examen → relacionada con configuración_examen y examen
7. pregunta (enunciado, categoría) → relacionada con nivel
8. opción_pregunta (texto, es_correcta, orden) → relacionada con pregunta
9. examen (puntaje, estado) → relacionado con estudiante, nivel e instantánea_configuración_examen
10. pregunta_examen → relacionada con examen y pregunta
11. opción_pregunta_examen → relacionada con pregunta_examen y opción_pregunta
12. instantánea_nivel_examen → relacionada con examen y nivel
13. respuesta_estudiante (es_correcta) → relacionada con examen, pregunta y opciones fuente e instantánea
14. registro_auditoría (acción, entidad) → relacionada con administrador

Estilo diagrama UML profesional, letra legible, sin sombras excesivas, ideal para documentación técnica universitaria.
```

## Prompt vigente (English)

```
Professional entity-relationship diagram of a database with 14 interconnected tables, clean technical drawing style, navy blue and red corporate colors, white background. Tables are rounded rectangle boxes connected by relationship lines:

1. estudiante (student) — ci, full_name, email, phone
2. administrador (admin) — email, full_name
3. nivel (level) — code, version, min_score, max_score
4. revision_particion_niveles (level_partition_revision) — singleton CEFR range revision
5. config_examen (exam_config) — time_limit, questions_per_exam, passing_score
6. instantanea_configuracion_examen (exam_config_snapshot) → linked to exam_config and exam
7. pregunta (question) — text, category → linked to level
8. opcion_pregunta (question_option) — text, is_correct, order → linked to question
9. examen (exam) — score, status → linked to student, level, and exam_config_snapshot
10. pregunta_examen (exam_question) → linked to exam and question
11. opcion_pregunta_examen (exam_question_option) → linked to exam_question and question_option
12. instantanea_nivel_examen (exam_level_snapshot) → linked to exam and level
13. respuesta_estudiante (student_answer) — is_correct → linked to exam, question, source options, and snapshot options
14. registro_auditoria (audit_log) — action, entity → linked to admin

UML diagram style, professional, legible font, clean, suitable for university technical documentation.
```
