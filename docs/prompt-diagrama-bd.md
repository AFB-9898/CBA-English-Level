# Prompt para generar imagen del diagrama de base de datos

> Pegá esto en DALL-E, Midjourney, o cualquier generador de imágenes AI.

---

## Prompt (español)

```
Diagrama entidad-relación profesional de una base de datos con 10 tablas interconectadas, estilo dibujo técnico clean, colores corporativos azul marino y rojo, fondo blanco. Las tablas son rectángulos con bordes redondeados, conectadas por líneas de relación. Las tablas son:

1. estudiante (ci, nombre_completo, correo, teléfono)
2. administrador (correo, nombre_completo)
3. nivel (nombre, puntaje_mínimo, puntaje_máximo)
4. config_examen (tiempo_límite, preguntas_por_examen, puntaje_aprobación)
5. pregunta (enunciado, categoría) → relacionada con nivel
6. opcion_pregunta (texto, es_correcta, orden) → relacionada con pregunta
7. examen (puntaje, estado) → relacionado con estudiante y nivel
8. examen_pregunta → relacionada con examen y pregunta
9. respuesta_estudiante (es_correcta) → relacionada con examen, pregunta y opcion_pregunta
10. registro_auditoria (acción, entidad) → relacionada con administrador

Estilo diagrama UML profesional, letra legible, sin sombras excesivas, ideal para documentación técnica universitaria.
```

## Prompt (English — por si tu AI entiende mejor inglés)

```
Professional entity-relationship diagram of a database with 10 interconnected tables, clean technical drawing style, navy blue and red corporate colors, white background. Tables are rounded rectangle boxes connected by relationship lines:

1. estudiante (student) — ci, full_name, email, phone
2. administrador (admin) — email, full_name
3. nivel (level) — name, min_score, max_score
4. config_examen (exam_config) — time_limit, questions_per_exam, passing_score
5. pregunta (question) — text, category → linked to level
6. opcion_pregunta (question_option) — text, is_correct, order → linked to question
7. examen (exam) — score, status → linked to student and level
8. examen_pregunta (exam_question) → linked to exam and question
9. respuesta_estudiante (student_answer) — is_correct → linked to exam, question, and question_option
10. registro_auditoria (audit_log) — action, entity → linked to admin

UML diagram style, professional, legible font, clean, suitable for university technical documentation.
```
