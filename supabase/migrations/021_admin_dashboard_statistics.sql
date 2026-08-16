-- Dashboard data is exposed through one authorization-gated projection.

DROP POLICY IF EXISTS "exam_select_admin" ON public.exam;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_statistics()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_dashboard JSONB;
BEGIN
  PERFORM public.fn_require_capability('dashboard');

  WITH completed_exams AS MATERIALIZED (
    SELECT e.id, e.student_id, e.level_id, e.completed_at, e.score
    FROM public.exam AS e
    WHERE e.status = 'completed'
  ), visible_levels AS (
    SELECT l.id, l.name, l.min_score
    FROM public.level AS l
    WHERE l.is_active OR public.fn_has_capability('levels')
  ), totals AS (
    SELECT
      (SELECT COUNT(*) FROM public.student) AS students,
      (SELECT COUNT(*) FROM public.exam) AS exams,
      COUNT(*) FILTER (
        WHERE public.fn_cba_business_date(completed_at) = public.fn_cba_business_date(clock_timestamp())
      ) AS completed_today,
      COALESCE(ROUND(AVG(score)::NUMERIC, 1), 0) AS completed_score_average,
      COUNT(*) AS completed_count
    FROM completed_exams
  ), distribution_rows AS (
    SELECT
      l.id,
      l.name,
      l.min_score,
      COUNT(e.id) AS count,
      CASE
        WHEN totals.completed_count > 0 THEN ROUND(COUNT(e.id)::NUMERIC * 100 / totals.completed_count)::INTEGER
        ELSE 0
      END AS percentage
    FROM visible_levels AS l
    LEFT JOIN completed_exams AS e ON e.level_id = l.id
    CROSS JOIN totals
    GROUP BY l.id, l.name, l.min_score, totals.completed_count
  ), distribution AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'level_id', id,
          'name', name,
          'count', count,
          'percentage', percentage
        )
        ORDER BY min_score, id
      ),
      '[]'::JSONB
    ) AS items
    FROM distribution_rows
  ), recent_completed AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', recent.id,
          'student_full_name', recent.full_name,
          'level_name', recent.level_name,
          'score', recent.score,
          'completed_at', recent.completed_at
        )
        ORDER BY recent.completed_at DESC NULLS LAST, recent.id DESC
      ),
      '[]'::JSONB
    ) AS items
    FROM (
      SELECT
        e.id,
        s.full_name,
        CASE WHEN l.is_active OR public.fn_has_capability('levels') THEN l.name END AS level_name,
        e.score,
        e.completed_at
      FROM completed_exams AS e
      JOIN public.student AS s ON s.id = e.student_id
      LEFT JOIN public.level AS l ON l.id = e.level_id
      ORDER BY e.completed_at DESC NULLS LAST, e.id DESC
      LIMIT 10
    ) AS recent
  )
  SELECT jsonb_build_object(
    'totals', jsonb_build_object('students', totals.students, 'exams', totals.exams),
    'completed_today', totals.completed_today,
    'completed_score_average', totals.completed_score_average,
    'level_distribution', distribution.items,
    'recent_completed', recent_completed.items
  )
  INTO v_dashboard
  FROM totals
  CROSS JOIN distribution
  CROSS JOIN recent_completed;

  RETURN v_dashboard;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_statistics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_statistics() TO authenticated;
