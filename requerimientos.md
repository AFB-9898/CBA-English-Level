# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# Sistema de Exámenes de Colocación – CBA

## 1. Información General

**Nombre del Proyecto:** Sistema de Exámenes de Colocación CBA

**Tipo de Proyecto:** Desarrollo interno - Proyecto de pasantía

**Institución:** Centro Boliviano Americano (CBA)

**Responsable Funcional:** Área Académica

**Supervisor Técnico:** Área de Sistemas

**Duración estimada:** 4 semanas

---

## 2. Propósito del Sistema

Desarrollar una aplicación web que permita administrar y rendir exámenes de colocación para medir el nivel de inglés de nuevos estudiantes del CBA.

El sistema debe automatizar la evaluación, asignar nivel automáticamente, generar resultados inmediatos, mantener histórico de evaluaciones y proveer estadísticas institucionales.

---

## 3. Alcance del Proyecto

### Incluye

- Módulo Estudiante
- Módulo Administrador
- Gestión de preguntas
- Lógica de cálculo automático de nivel
- Reportes exportables
- Diseño de base de datos
- Documentación técnica

### No incluye

- Integración con sistemas académicos externos
- Plataforma de pagos
- Autenticación institucional avanzada (SSO)

---

## 4. Usuarios del Sistema

### Estudiante

Registra datos, rinde examen y visualiza resultado.

### Administrador

Gestiona preguntas, niveles, configuración y reportes.

---

# 5. Reglas de Negocio

- Cada estudiante puede rendir un examen por día.
- El sistema asigna nivel automáticamente según puntaje.
- No se deben modificar resultados históricos.
- El examen tiene tiempo límite configurable.

---

# 6. Módulo Estudiante – Requerimientos

- Registro obligatorio con validaciones.
- Inicio de examen con sesión única.
- Preguntas aleatorias.
- Temporizador visible con auto-submit.
- Resultado inmediato con nivel asignado.

---

# 7. Módulo Administrador – Requerimientos

- Login seguro con contraseña encriptada.
- CRUD completo de preguntas.
- Gestión de niveles con rangos no superpuestos.
- Configuración del examen (tiempo, preguntas, reglas).
- Reportes exportables en CSV y Excel.
- Dashboard con estadísticas básicas.

---

# 8. Requerimientos No Funcionales

- Responsive.
- Soporte mínimo 30 estudiantes simultáneos.
- Tiempo de respuesta < 2 segundos.
- Validación backend obligatoria.
- Backup diario de base de datos.

---

# 9. Diseño de Base de Datos – Entregable Obligatorio

El pasante deberá diseñar el modelo de base de datos desde cero.

## Entregables

- Diagrama Entidad-Relación (ERD).
- Script SQL de creación de tablas.
- Justificación técnica del modelo.
- Definición de claves primarias y foráneas.
- Normalización mínima 3FN.

---

# 10. Entregables Finales

- Código fuente documentado.
- Base de datos implementada.
- Manual técnico.
- Manual de usuario.
- Presentación final del sistema.

---

# 11. Cronograma Sugerido

## Semana 1

Diseño BD y validación ERD.

## Semana 2

Módulo administrador.

## Semana 3

Módulo estudiante y lógica examen.

## Semana 4

Reportes, testing y documentación.

---

# 12. Criterios de Aprobación

- Examen funcional sin errores críticos.
- Cálculo de nivel correcto.
- Gestión completa desde admin.
- Base de datos correctamente normalizada.
