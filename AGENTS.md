# AGENTS.md

# Sistema de Exámenes de Colocación CBA

> Documento maestro para cualquier agente de IA o desarrollador que participe en este proyecto.

---

# Información General

**Proyecto:**
Sistema de Exámenes de Colocación CBA

**Tipo de Proyecto**
Proyecto de Pasantía

**Institución**
Centro Boliviano Americano (CBA)

**Área Responsable**
Área Académica

**Supervisor Técnico**
Área de Sistemas

**Objetivo General**

Desarrollar una aplicación web que permita administrar y rendir exámenes de colocación para determinar automáticamente el nivel de inglés de nuevos estudiantes.

---

# Objetivos del Sistema

El sistema debe permitir:

- Registrar estudiantes.
- Administrar preguntas.
- Administrar niveles.
- Configurar el examen.
- Rendir exámenes en línea.
- Calcular automáticamente el nivel.
- Mostrar resultados inmediatos.
- Mantener historial de evaluaciones.
- Generar reportes.
- Mostrar estadísticas.

---

# Alcance

Incluye

- Módulo Estudiante
- Módulo Administrador
- Gestión de preguntas
- Gestión de niveles
- Configuración del examen
- Reportes
- Dashboard
- Base de datos
- Documentación técnica

No incluye

- Sistemas de pagos
- Integraciones externas
- SSO institucional

---

# Reglas de Negocio

- Un estudiante solo puede rendir un examen por día.
- El examen tendrá tiempo límite configurable.
- Las preguntas serán aleatorias.
- El nivel será calculado automáticamente.
- Los resultados históricos nunca podrán modificarse.
- Todas las validaciones críticas deben realizarse en el backend.

---

# Requerimientos Funcionales

## Módulo Estudiante

- Registro de estudiante.
- Validaciones obligatorias.
- Inicio de examen.
- Temporizador.
- Auto envío cuando termina el tiempo.
- Resultado inmediato.

---

## Módulo Administrador

- Login seguro.
- Gestión completa de preguntas (CRUD).
- Gestión de niveles.
- Configuración del examen.
- Dashboard.
- Reportes CSV.
- Reportes Excel.

---

# Requerimientos No Funcionales

- Responsive.
- Tiempo de respuesta menor a 2 segundos.
- Soporte mínimo para 30 estudiantes simultáneos.
- Validaciones Backend.
- Backup diario.

---

# Entregables

- Modelo Entidad Relación (ERD)
- Modelo Relacional
- Script SQL
- Base de datos implementada
- Código fuente
- Manual Técnico
- Manual de Usuario
- Presentación Final

---

# Arquitectura del Proyecto

Se seguirá una arquitectura Frontend + BaaS (Backend as a Service).

Frontend (React + Supabase SDK)
    ↓
Supabase (PostgreSQL + RLS + Edge Functions)
    ↓
Base de Datos

No hay un servidor REST intermedio. El frontend consume Supabase directamente mediante su SDK oficial.

La lógica de negocio se implementa según el tipo de regla:

| Regla | Implementación |
|---|---|
| Control de acceso y autorización | Row Level Security (RLS) |
| Reglas de negocio críticas (ej: no modificar históricos) | Triggers SQL |
| Cálculos y operaciones complejas (ej: calcular nivel) | Funciones SQL |
| Validaciones de integridad | Constraints y funciones SQL |
| Configuración dinámica del examen | Tablas en Base de Datos |
| Lógica de UI y temporizador | Frontend (React) |
| Reportes CSV / Excel | Frontend con librerías |
| Lógica compleja fuera de SQL (opcional) | Supabase Edge Functions |

---

# Tecnologías del Proyecto

## Control de versiones

- Git
- GitHub

Se trabajará mediante ramas.

main
develop
feature/*

Nunca desarrollar directamente sobre main.

---

## Base de Datos

Supabase

Se utilizará PostgreSQL administrado por Supabase.

La base de datos deberá cumplir como mínimo:

- Tercera Forma Normal (3FN)
- Claves Primarias
- Claves Foráneas
- Restricciones
- Índices donde sean necesarios

---

## Backend

Supabase (BaaS)

Se utiliza Supabase como Backend as a Service. No hay una API REST independiente.

Incluye:
- **Base de datos**: PostgreSQL administrado
- **Autenticación**: Supabase Auth (email/contraseña, manejo de sesiones)
- **Autorización**: Row Level Security (RLS) a nivel de fila
- **Reglas de negocio**: Funciones SQL y triggers
- **Lógica adicional**: Edge Functions (opcional)
- **Archivos**: Supabase Storage (si se requiere)

Toda validación crítica se ejecuta mediante RLS policies, funciones SQL y constraints de base de datos.

---

## Frontend

React + Vite + TypeScript + Tailwind CSS

- **React 19+** con TypeScript
- **Vite** como build tool
- **Tailwind CSS** para estilos
- **Supabase SDK** (@supabase/supabase-js) para conectar con backend
- **Atomic Design** para organizar componentes (atoms, molecules, organisms, screens)
- **Responsive** obligatorio, mobile-first

---

# Diseño de Base de Datos

Antes de escribir código se deberá completar:

- Análisis del negocio.
- Modelo Conceptual.
- Modelo Entidad Relación.
- Modelo Relacional.
- Diccionario de Datos.
- Script SQL.

No se programará ninguna funcionalidad sin una base de datos previamente diseñada.

---

# Principios de Desarrollo

Siempre priorizar:

- Código limpio.
- Modularidad.
- Escalabilidad.
- Bajo acoplamiento.
- Alta cohesión.
- Reutilización.
- Seguridad.

---

# Seguridad

Implementar como mínimo:

- Contraseñas cifradas.
- Validación Backend.
- Protección contra SQL Injection.
- Protección XSS.
- Manejo seguro de sesiones.
- Auditoría de acciones administrativas.

---

# Reportes

El sistema deberá permitir exportar:

- CSV
- Excel

Y mostrar estadísticas mediante Dashboard.

---

# Flujo de Desarrollo

1. Análisis
2. Casos de Uso
3. Diseño ER
4. Modelo Relacional
5. Base de Datos
6. Backend (Supabase — RLS policies, funciones SQL, triggers)
7. Frontend (React + Vite + Atomic Design)
8. Testing
9. Documentación
10. Presentación

No alterar este orden sin justificación.

---

# Convenciones

- Todo el código deberá documentarse.
- Los nombres de tablas estarán en singular.
- Los nombres de columnas estarán en snake_case.
- Las claves primarias serán id.
- Las claves foráneas seguirán el formato tabla_id.

Ejemplo

student
question
exam
result

student_id
exam_id
question_id

---

# Documentación Obligatoria

Mantener actualizados:

README.md

ERD

Modelo Relacional

Diccionario de Datos

API

Manual Técnico

Manual de Usuario

---

# README

El README deberá incluir:

- Descripción del proyecto.
- Tecnologías.
- Instalación.
- Configuración.
- Variables de entorno.
- Estructura del proyecto.
- Capturas del sistema.
- Guía para desarrolladores.

---

# Filosofía del Proyecto

Este proyecto debe desarrollarse con estándares profesionales, pensando en que pueda evolucionar en el futuro y convertirse en el sistema oficial del Centro Boliviano Americano.

Cada decisión técnica deberá priorizar la mantenibilidad, escalabilidad, seguridad y claridad del código antes que soluciones rápidas o temporales.
