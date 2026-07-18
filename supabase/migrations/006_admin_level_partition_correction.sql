-- Atomic full-distribution correction for versioned CEFR levels.

-- 005 inherited a strict max_score > min_score check. A complete partition
-- may contain a singleton range, so replace that inherited restriction.
ALTER TABLE public.level DROP CONSTRAINT IF EXISTS level_check;

CREATE TABLE public.level_partition_revision (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision > 0)
);

INSERT INTO public.level_partition_revision (id, revision)
VALUES (TRUE, 1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.level_partition_revision ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS level_partition_revision_select ON public.level_partition_revision;
CREATE POLICY level_partition_revision_select ON public.level_partition_revision
  FOR SELECT TO authenticated USING (TRUE);
GRANT SELECT ON public.level_partition_revision TO authenticated;

-- Direct table writes are not a valid way to mutate a complete partition.
DROP POLICY IF EXISTS "level_insert_admin" ON public.level;
DROP POLICY IF EXISTS "level_update_admin" ON public.level;
DROP POLICY IF EXISTS "level_delete_admin" ON public.level;
DROP POLICY IF EXISTS "audit_log_insert_system" ON public.audit_log;
GRANT SELECT ON public.level TO authenticated, anon;
GRANT SELECT ON public.admin, public.audit_log TO authenticated;

DROP TRIGGER IF EXISTS trg_audit_level_change ON public.level;
DROP FUNCTION IF EXISTS public.fn_audit_level_change();

DROP FUNCTION IF EXISTS public.create_level(VARCHAR, VARCHAR, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.replace_level_version(UUID, INTEGER, INTEGER, VARCHAR, TEXT);
DROP FUNCTION IF EXISTS public.deactivate_level(UUID);
DROP FUNCTION IF EXISTS public.replace_active_level_distribution(BIGINT, JSONB);
DROP FUNCTION IF EXISTS public.replace_active_level_distribution(BIGINT, JSONB, UUID);

CREATE OR REPLACE FUNCTION public.update_level_metadata(
  p_level_id UUID, p_name VARCHAR, p_description TEXT
)
RETURNS public.level
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before public.level;
  v_after public.level;
BEGIN
  IF NOT public.fn_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_before FROM public.level WHERE id = p_level_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Level not found'; END IF;
  UPDATE public.level
     SET name = p_name, description = p_description
   WHERE id = p_level_id
   RETURNING * INTO v_after;
  INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
  VALUES (auth.uid(), 'edit', 'level', v_after.id,
    jsonb_build_object('actor', auth.uid(), 'before', to_jsonb(v_before), 'after', to_jsonb(v_after)));
  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_active_level_distribution(
  p_expected_revision BIGINT, p_levels JSONB, p_deactivate_level_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_revision BIGINT;
  v_count INTEGER;
  v_expected_count INTEGER;
  v_new_revision BIGINT;
  v_target public.level;
  v_target_after public.level;
  v_target_min INTEGER;
  v_target_max INTEGER;
  v_target_width INTEGER;
  v_lower_id UUID;
  v_upper_id UUID;
  v_lower_share INTEGER;
  v_old public.level;
  v_new public.level;
BEGIN
  IF NOT public.fn_is_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_levels) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Level distribution must be a JSON array';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('level-partition', 0));
  SELECT revision INTO v_revision
    FROM public.level_partition_revision WHERE id = TRUE FOR UPDATE;
  IF p_expected_revision IS DISTINCT FROM v_revision THEN
    RAISE EXCEPTION 'Level distribution revision is stale' USING ERRCODE = '40001';
  END IF;

  -- Lock the complete active catalog before deriving a deactivation proposal.
  PERFORM 1 FROM public.level WHERE is_active ORDER BY min_score FOR UPDATE;

  DROP TABLE IF EXISTS pg_temp.level_distribution;
  CREATE TEMP TABLE level_distribution (
    id UUID NOT NULL, min_score INTEGER NOT NULL, max_score INTEGER NOT NULL
  ) ON COMMIT DROP;
  INSERT INTO level_distribution (id, min_score, max_score)
    SELECT id, min_score, max_score
    FROM jsonb_to_recordset(p_levels)
      AS input(id UUID, min_score INTEGER, max_score INTEGER);

  SELECT COUNT(*) INTO v_count FROM level_distribution;
  IF v_count = 0 OR (SELECT COUNT(DISTINCT id) FROM level_distribution) <> v_count THEN
    RAISE EXCEPTION 'Level IDs must be unique and non-empty';
  END IF;

  SELECT COUNT(*) - CASE WHEN p_deactivate_level_id IS NULL THEN 0 ELSE 1 END
    INTO v_expected_count FROM public.level WHERE is_active;
  IF p_deactivate_level_id IS NOT NULL THEN
    SELECT * INTO v_target FROM public.level
    WHERE id = p_deactivate_level_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active level to deactivate not found'; END IF;
    SELECT ordered.min_score, ordered.max_score, ordered.lower_id, ordered.upper_id
      INTO v_target_min, v_target_max, v_lower_id, v_upper_id
      FROM (
        SELECT l.min_score, l.max_score, l.id,
               lag(l.id) OVER (ORDER BY l.min_score) AS lower_id,
               lead(l.id) OVER (ORDER BY l.min_score) AS upper_id
          FROM public.level l WHERE l.is_active
      ) AS ordered
     WHERE ordered.id = p_deactivate_level_id;
    IF v_lower_id IS NULL AND v_upper_id IS NULL THEN
      RAISE EXCEPTION 'At least one active neighbor is required';
    END IF;
    v_target_width := v_target_max - v_target_min + 1;
    v_lower_share := v_target_width / 2;
  END IF;
  IF v_count <> v_expected_count
    OR EXISTS (
      SELECT 1 FROM public.level l
      WHERE l.is_active AND (p_deactivate_level_id IS NULL OR l.id <> p_deactivate_level_id)
        AND NOT EXISTS (SELECT 1 FROM level_distribution d WHERE d.id = l.id)
    ) OR EXISTS (
      SELECT 1 FROM level_distribution d
      WHERE NOT EXISTS (SELECT 1 FROM public.level l WHERE l.is_active AND l.id = d.id)
     ) THEN
    RAISE EXCEPTION 'Distribution must contain exactly the active level IDs';
  END IF;

  IF p_deactivate_level_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM level_distribution WHERE id = p_deactivate_level_id
  ) THEN
    RAISE EXCEPTION 'Deactivated level must be excluded from the distribution';
  END IF;
  IF EXISTS (SELECT 1 FROM level_distribution WHERE min_score < 0 OR max_score > 100 OR min_score > max_score)
     OR (SELECT COUNT(*) FROM level_distribution WHERE min_score = 0) <> 1
     OR (SELECT COUNT(*) FROM level_distribution WHERE max_score = 100) <> 1
     OR EXISTS (
       SELECT 1 FROM level_distribution a, level_distribution b
       WHERE a.id <> b.id AND a.min_score <= b.max_score AND b.min_score <= a.max_score
     )
     OR EXISTS (
       SELECT 1 FROM level_distribution a
       WHERE a.min_score > 0 AND NOT EXISTS (
         SELECT 1 FROM level_distribution b WHERE b.max_score = a.min_score - 1
       )
     ) THEN
    RAISE EXCEPTION 'Active levels must form a contiguous, non-overlapping 0 through 100 partition';
  END IF;

  IF p_deactivate_level_id IS NOT NULL AND EXISTS (
    SELECT 1
      FROM public.level l
      JOIN level_distribution d ON d.id = l.id
     WHERE l.id = v_lower_id
       AND (d.min_score IS DISTINCT FROM l.min_score
            OR d.max_score IS DISTINCT FROM CASE
              WHEN v_upper_id IS NULL THEN v_target_max
              ELSE l.max_score + v_lower_share
            END)
        OR l.id = v_upper_id
       AND (d.min_score IS DISTINCT FROM CASE
              WHEN v_lower_id IS NULL THEN v_target_min
              ELSE v_target_min + v_lower_share
            END
            OR d.max_score IS DISTINCT FROM l.max_score)
  ) THEN
    RAISE EXCEPTION 'Deactivation distribution does not match deterministic neighbor redistribution';
  END IF;

  IF p_deactivate_level_id IS NOT NULL THEN
    UPDATE public.level SET is_active = FALSE
     WHERE id = p_deactivate_level_id RETURNING * INTO v_target_after;
    INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'deactivate', 'level', v_target_after.id,
      jsonb_build_object('actor', auth.uid(), 'before', to_jsonb(v_target), 'after', to_jsonb(v_target_after)));
  END IF;

  FOR v_old IN
    SELECT l.* FROM public.level l
    JOIN level_distribution d ON d.id = l.id
    WHERE l.is_active AND (l.min_score, l.max_score) IS DISTINCT FROM (d.min_score, d.max_score)
    FOR UPDATE
  LOOP
    UPDATE public.level SET is_active = FALSE WHERE id = v_old.id;
    INSERT INTO public.level
      (code, name, min_score, max_score, description, version, is_active, supersedes_level_id)
    VALUES
      (v_old.code, v_old.name,
       (SELECT min_score FROM level_distribution WHERE id = v_old.id),
       (SELECT max_score FROM level_distribution WHERE id = v_old.id),
       v_old.description, v_old.version + 1, TRUE, v_old.id)
    RETURNING * INTO v_new;
    INSERT INTO public.audit_log (admin_id, action, entity, entity_id, details)
    VALUES (auth.uid(), 'new_version', 'level', v_new.id,
      jsonb_build_object('actor', auth.uid(), 'before', to_jsonb(v_old), 'after', to_jsonb(v_new)));
  END LOOP;

  v_new_revision := v_revision + 1;
  UPDATE public.level_partition_revision SET revision = v_new_revision WHERE id = TRUE;
  RETURN jsonb_build_object('revision', v_new_revision, 'deactivated_level_id', p_deactivate_level_id);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_active_level_distribution(BIGINT, JSONB, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_active_level_distribution(BIGINT, JSONB, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.update_level_metadata(UUID, VARCHAR, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_level_metadata(UUID, VARCHAR, TEXT) TO authenticated;
