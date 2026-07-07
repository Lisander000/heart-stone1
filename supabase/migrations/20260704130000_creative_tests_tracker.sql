-- Testing Tracker — recreated from the GB Creative Testing Tracker sheet.
-- Ad Set Name / Ad Name / Month are derived in the app (formulas), so not stored.
-- Test ID auto-sequences in the app (CTT001…). Metrics are pasted from the ad platform.

DROP TABLE IF EXISTS public.creative_tests CASCADE;

CREATE TABLE public.creative_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  test_id TEXT,                        -- CTT001 …
  batch INTEGER DEFAULT 1,
  date DATE,
  editor_name TEXT,
  product_name TEXT,
  hypothesis TEXT,
  angle_id TEXT, concept_id TEXT, hook_id TEXT, ad_copy_id TEXT,
  lp_link TEXT, ad_format TEXT, creative_link TEXT,
  status TEXT DEFAULT 'to_test',
  result TEXT,
  spent NUMERIC DEFAULT 0,
  roas NUMERIC DEFAULT 0,
  cr NUMERIC DEFAULT 0,                -- conversion rate (fraction)
  aov NUMERIC DEFAULT 0,
  ctr NUMERIC DEFAULT 0,              -- fraction
  cpm NUMERIC DEFAULT 0,
  cpc NUMERIC DEFAULT 0,
  hook_rate NUMERIC DEFAULT 0,        -- fraction
  hold_rate NUMERIC DEFAULT 0,        -- fraction
  results TEXT,
  learnings TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX creative_tests_user_idx ON public.creative_tests(user_id, created_at DESC);
ALTER TABLE public.creative_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_own" ON public.creative_tests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ins_own" ON public.creative_tests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "upd_own" ON public.creative_tests FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "del_own" ON public.creative_tests FOR DELETE TO authenticated USING (auth.uid() = user_id);
