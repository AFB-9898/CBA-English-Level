-- ============================================================
-- Sistema de Exámenes de Colocación CBA
-- Migration: 002_seed
-- Descripción: Datos iniciales para el sistema
-- ============================================================

-- 1. Niveles de inglés (MCERL - Marco Común Europeo)
-- ============================================================
INSERT INTO level (name, min_score, max_score, description) VALUES
    ('Beginner',    0,  20, 'Principiante — No tiene conocimientos o son mínimos'),
    ('Elementary',  21, 40, 'Básico — Comprende frases y expresiones cotidianas'),
    ('Intermediate', 41, 60, 'Intermedio — Puede comunicarse en situaciones habituales'),
    ('Upper Intermediate', 61, 80, 'Intermedio Alto — Se desenvuelve con fluidez en la mayoría de situaciones'),
    ('Advanced',    81, 100, 'Avanzado — Domina el idioma con precisión y soltura');

-- 2. Configuración inicial del examen
-- ============================================================
INSERT INTO exam_config (time_limit_minutes, questions_per_exam, passing_score)
VALUES (60, 30, 41);

-- 3. Admin inicial (el usuario debe crear una cuenta en Supabase Auth
--    y luego insertar el registro aquí con el mismo ID de auth.users)
-- ============================================================
-- NOTA: Este INSERT se ejecuta DESPUÉS de crear el usuario en Supabase Auth.
-- Reemplazar 'ADMIN_AUTH_USER_ID' con el UUID real de auth.users.
--
-- Ejemplo:
-- INSERT INTO admin (id, email, full_name)
-- VALUES ('<uuid_de_auth.users>', 'admin@cba.edu.bo', 'Administrador CBA');
