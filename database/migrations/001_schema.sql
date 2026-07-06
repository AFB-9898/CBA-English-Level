-- ============================================================
-- Sistema de Exámenes de Colocación CBA
-- Migration: 001_schema
-- Descripción: Esquema completo de base de datos
-- ============================================================

-- 0. ENUMS
-- ============================================================

CREATE TYPE exam_status AS ENUM ('pending', 'in_progress', 'completed');

-- 1. TABLAS
-- ============================================================

-- 1.1 student
CREATE TABLE student (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ci          VARCHAR(20)  NOT NULL UNIQUE,
    full_name   VARCHAR(200) NOT NULL,
    email       VARCHAR(200) NOT NULL UNIQUE,
    phone       VARCHAR(20),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 1.2 admin
CREATE TABLE admin (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(200) NOT NULL UNIQUE,
    full_name   VARCHAR(200) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 1.3 level
CREATE TABLE level (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    min_score   INTEGER      NOT NULL CHECK (min_score >= 0),
    max_score   INTEGER      NOT NULL CHECK (max_score > min_score),
    description TEXT
);

-- 1.4 exam_config (singleton — una sola fila activa)
CREATE TABLE exam_config (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time_limit_minutes    INTEGER NOT NULL CHECK (time_limit_minutes > 0),
    questions_per_exam    INTEGER NOT NULL CHECK (questions_per_exam > 0),
    passing_score         INTEGER NOT NULL CHECK (passing_score >= 0 AND passing_score <= 100),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.5 question
CREATE TABLE question (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text        TEXT         NOT NULL,
    level_id    UUID         NOT NULL REFERENCES level(id) ON DELETE RESTRICT,
    category    VARCHAR(100),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 1.6 question_option
CREATE TABLE question_option (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID    NOT NULL REFERENCES question(id) ON DELETE CASCADE,
    text        TEXT    NOT NULL,
    is_correct  BOOLEAN NOT NULL DEFAULT FALSE,
    "order"     INTEGER NOT NULL CHECK ("order" >= 0),
    UNIQUE (question_id, "order")
);

-- 1.7 exam
CREATE TABLE exam (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id    UUID         NOT NULL REFERENCES student(id) ON DELETE RESTRICT,
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ,
    score         INTEGER      CHECK (score >= 0),
    level_id      UUID         REFERENCES level(id) ON DELETE RESTRICT,
    status        exam_status  NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 1.8 exam_question (relación muchos-a-muchos entre exam y question)
CREATE TABLE exam_question (
    id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id     UUID    NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
    question_id UUID    NOT NULL REFERENCES question(id) ON DELETE RESTRICT,
    "order"     INTEGER NOT NULL CHECK ("order" >= 0),
    UNIQUE (exam_id, question_id)
);

-- 1.9 student_answer
CREATE TABLE student_answer (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id           UUID    NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
    question_id       UUID    NOT NULL REFERENCES question(id) ON DELETE RESTRICT,
    selected_option_id UUID   REFERENCES question_option(id) ON DELETE RESTRICT,
    is_correct        BOOLEAN,
    answered_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (exam_id, question_id)
);

-- 1.10 audit_log
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id    UUID         REFERENCES admin(id) ON DELETE SET NULL,
    action      VARCHAR(100) NOT NULL,
    entity      VARCHAR(100) NOT NULL,
    entity_id   UUID,
    details     JSONB,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 2. ÍNDICES
-- ============================================================

CREATE INDEX idx_student_ci           ON student(ci);
CREATE INDEX idx_student_email        ON student(email);
CREATE INDEX idx_question_level_id    ON question(level_id);
CREATE INDEX idx_exam_student_id      ON exam(student_id);
CREATE INDEX idx_exam_status          ON exam(status);
CREATE INDEX idx_exam_question_exam_id   ON exam_question(exam_id);
CREATE INDEX idx_student_answer_exam_id  ON student_answer(exam_id);
CREATE INDEX idx_audit_log_admin_id      ON audit_log(admin_id);
CREATE INDEX idx_audit_log_created_at    ON audit_log(created_at DESC);

-- 3. FUNCIONES
-- ============================================================

-- 3.1 Calcular nivel según puntaje
CREATE OR REPLACE FUNCTION fn_calculate_level(p_score INTEGER)
RETURNS UUID AS $$
DECLARE
    v_level_id UUID;
BEGIN
    SELECT id INTO v_level_id
    FROM level
    WHERE p_score BETWEEN min_score AND max_score
    ORDER BY min_score ASC
    LIMIT 1;

    RETURN v_level_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3.2 Obtener preguntas aleatorias para un examen
CREATE OR REPLACE FUNCTION fn_get_random_questions(p_count INTEGER)
RETURNS TABLE (id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT q.id
    FROM question q
    ORDER BY RANDOM()
    LIMIT p_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3.3 Finalizar examen y calcular resultado
CREATE OR REPLACE FUNCTION fn_complete_exam(p_exam_id UUID)
RETURNS TABLE (score INTEGER, level_id UUID, level_name VARCHAR) AS $$
DECLARE
    v_score     INTEGER;
    v_level_id  UUID;
    v_level_name VARCHAR;
    v_total     INTEGER;
    v_correct   INTEGER;
BEGIN
    -- Contar respuestas correctas
    SELECT COUNT(*) INTO v_correct
    FROM student_answer sa
    WHERE sa.exam_id = p_exam_id AND sa.is_correct = TRUE;

    SELECT COUNT(*) INTO v_total
    FROM student_answer sa
    WHERE sa.exam_id = p_exam_id;

    -- Calcular porcentaje
    v_score := ROUND((v_correct::NUMERIC / v_total) * 100);

    -- Obtener nivel
    SELECT l.id, l.name INTO v_level_id, v_level_name
    FROM level l
    WHERE v_score BETWEEN l.min_score AND l.max_score
    ORDER BY l.min_score ASC
    LIMIT 1;

    -- Actualizar examen
    UPDATE exam
    SET score = v_score,
        level_id = v_level_id,
        completed_at = NOW(),
        status = 'completed'
    WHERE id = p_exam_id;

    RETURN QUERY SELECT v_score, v_level_id, v_level_name;
END;
$$ LANGUAGE plpgsql;

-- 4. TRIGGERS
-- ============================================================

-- 4.1 Evitar que un estudiante rinda más de un examen por día
CREATE OR REPLACE FUNCTION fn_check_daily_exam()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM exam
        WHERE student_id = NEW.student_id
          AND status = 'completed'
          AND completed_at::DATE = NOW()::DATE
    ) THEN
        RAISE EXCEPTION 'El estudiante ya rindió un examen hoy'
            USING HINT = 'Un estudiante solo puede rendir un examen por día';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_daily_exam
    BEFORE INSERT ON exam
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_daily_exam();

-- 4.2 Actualizar updated_at en question
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_question_updated_at
    BEFORE UPDATE ON question
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_exam_config_updated_at
    BEFORE UPDATE ON exam_config
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_timestamp();

-- 4.3 Auditoría automática para acciones críticas en student_answer
-- (los resultados históricos no pueden modificarse)
CREATE OR REPLACE FUNCTION fn_prevent_historical_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.exam_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM exam WHERE id = OLD.exam_id AND status = 'completed'
    ) THEN
        RAISE EXCEPTION 'No se pueden modificar respuestas de un examen completado'
            USING HINT = 'Los resultados históricos nunca pueden modificarse';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_historical_change
    BEFORE UPDATE ON student_answer
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_historical_change();

-- 4.4 Auditoría: registrar acciones admin en audit_log automáticamente
CREATE OR REPLACE FUNCTION fn_audit_admin_action()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log (admin_id, action, entity, entity_id, details)
    VALUES (
        NULLIF(current_setting('app.admin_id', TRUE), '')::UUID,
        TG_ARGV[0],
        TG_TABLE_NAME,
        NEW.id,
        jsonb_build_object('data', row_to_json(NEW))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Nota: los triggers de auditoría se aplican manualmente por operación CRUD
-- desde el frontend o Edge Functions, no automáticamente en cada tabla
-- para evitar ruido. Este es el mecanismo base.

-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE student        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin          ENABLE ROW LEVEL SECURITY;
ALTER TABLE level          ENABLE ROW LEVEL SECURITY;
ALTER TABLE question       ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_option ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam           ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_question  ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answer ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log      ENABLE ROW LEVEL SECURITY;

-- 5.1 Políticas para student
CREATE POLICY "student_select_own" ON student
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "student_insert_self" ON student
    FOR INSERT WITH CHECK (true);  -- Registro público

CREATE POLICY "student_update_own" ON student
    FOR UPDATE USING (id = auth.uid());

-- 5.2 Políticas para admin
CREATE POLICY "admin_select_own" ON admin
    FOR SELECT USING (id = auth.uid());

-- 5.3 Políticas para level (lectura para estudiantes y admins)
CREATE POLICY "level_select_all" ON level
    FOR SELECT USING (true);

CREATE POLICY "level_insert_admin" ON level
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admin));

CREATE POLICY "level_update_admin" ON level
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM admin));

CREATE POLICY "level_delete_admin" ON level
    FOR DELETE USING (auth.uid() IN (SELECT id FROM admin));

-- 5.4 Políticas para question y question_option
CREATE POLICY "question_select_all" ON question
    FOR SELECT USING (true);

CREATE POLICY "question_insert_admin" ON question
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admin));

CREATE POLICY "question_update_admin" ON question
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM admin));

CREATE POLICY "question_delete_admin" ON question
    FOR DELETE USING (auth.uid() IN (SELECT id FROM admin));

-- question_option (mismas reglas que question)
CREATE POLICY "question_option_select_all" ON question_option
    FOR SELECT USING (true);

CREATE POLICY "question_option_insert_admin" ON question_option
    FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM admin));

CREATE POLICY "question_option_update_admin" ON question_option
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM admin));

CREATE POLICY "question_option_delete_admin" ON question_option
    FOR DELETE USING (auth.uid() IN (SELECT id FROM admin));

-- 5.5 Políticas para exam
CREATE POLICY "exam_select_own" ON exam
    FOR SELECT USING (student_id = auth.uid());

CREATE POLICY "exam_select_admin" ON exam
    FOR SELECT USING (auth.uid() IN (SELECT id FROM admin));

CREATE POLICY "exam_insert_student" ON exam
    FOR INSERT WITH CHECK (student_id = auth.uid());

CREATE POLICY "exam_update_own" ON exam
    FOR UPDATE USING (student_id = auth.uid() AND status = 'in_progress');

-- 5.6 Políticas para exam_question
CREATE POLICY "exam_question_select_own" ON exam_question
    FOR SELECT USING (
        exam_id IN (SELECT id FROM exam WHERE student_id = auth.uid())
    );

CREATE POLICY "exam_question_insert_system" ON exam_question
    FOR INSERT WITH CHECK (true);  -- Solo desde funciones SQL/Edge Functions

-- 5.7 Políticas para student_answer
CREATE POLICY "student_answer_select_own" ON student_answer
    FOR SELECT USING (
        exam_id IN (SELECT id FROM exam WHERE student_id = auth.uid())
    );

CREATE POLICY "student_answer_insert_own" ON student_answer
    FOR INSERT WITH CHECK (
        exam_id IN (SELECT id FROM exam WHERE student_id = auth.uid() AND status = 'in_progress')
    );

CREATE POLICY "student_answer_update_own" ON student_answer
    FOR UPDATE USING (
        exam_id IN (SELECT id FROM exam WHERE student_id = auth.uid() AND status = 'in_progress')
    );

-- 5.8 Políticas para exam_config
CREATE POLICY "exam_config_select" ON exam_config
    FOR SELECT USING (true);

CREATE POLICY "exam_config_update_admin" ON exam_config
    FOR UPDATE USING (auth.uid() IN (SELECT id FROM admin));

-- 5.9 Políticas para audit_log
CREATE POLICY "audit_log_select_admin" ON audit_log
    FOR SELECT USING (auth.uid() IN (SELECT id FROM admin));

CREATE POLICY "audit_log_insert_system" ON audit_log
    FOR INSERT WITH CHECK (true);  -- Solo desde funciones o triggers
