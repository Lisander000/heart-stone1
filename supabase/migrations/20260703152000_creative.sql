-- Creative category — four trackers. Only raw fields stored; the app renders console grids.
-- All optional-friendly (defaults) so rows can be created incrementally.

-- 1) Creative Concepts
CREATE TABLE public.creative_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT, angle TEXT, format TEXT, hook TEXT,
  status TEXT DEFAULT 'idea', owner TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Ad Copies
CREATE TABLE public.ad_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  headline TEXT, primary_text TEXT, angle TEXT, platform TEXT DEFAULT 'meta',
  concept TEXT, status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Creative Testing Tracker
CREATE TABLE public.creative_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  creative TEXT, platform TEXT DEFAULT 'meta',
  spend NUMERIC DEFAULT 0, impressions INTEGER DEFAULT 0,
  ctr NUMERIC DEFAULT 0, cpa NUMERIC DEFAULT 0, roas NUMERIC DEFAULT 0,
  verdict TEXT DEFAULT 'testing', launched DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) UGC Tracker / Approval
CREATE TABLE public.ugc_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  creator TEXT, deliverable TEXT, brief TEXT, due DATE, link TEXT,
  status TEXT DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for all four
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['creative_concepts','ad_copies','creative_tests','ugc_items'] LOOP
    EXECUTE format('CREATE INDEX %I ON public.%I(user_id, created_at DESC)', t||'_user_idx', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "sel_own" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "ins_own" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "upd_own" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "del_own" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;
