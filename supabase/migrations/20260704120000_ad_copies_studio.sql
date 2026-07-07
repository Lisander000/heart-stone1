-- Ad Copies Studio — one table per awareness stage.
-- Replaces the earlier single ad_copies table.

DROP TABLE IF EXISTS public.ad_copies CASCADE;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ad_copies_most_aware','ad_copies_product_aware','ad_copies_solution_aware',
    'ad_copies_problem_aware','ad_copies_unaware'
  ] LOOP
    EXECUTE format($f$
      CREATE TABLE public.%I (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        code TEXT,                 -- AC-MSA001 …
        english TEXT, dutch TEXT,
        angle_id TEXT, concept_id TEXT, hook_id TEXT,
        status TEXT DEFAULT 'waiting_for_feedback',
        performance TEXT DEFAULT 'untested',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )$f$, t);
    EXECUTE format('CREATE INDEX %I ON public.%I(user_id, created_at DESC)', t||'_user_idx', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "sel_own" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "ins_own" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "upd_own" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "del_own" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;
