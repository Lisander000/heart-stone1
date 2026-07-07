-- Creative Studio — Angles / Concepts / Hooks (3-in-1 board).
-- Replaces the earlier creative_concepts schema with the studio schema.

DROP TABLE IF EXISTS public.creative_concepts CASCADE;

CREATE TABLE public.creative_angles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT,                    -- AN001, AN002…
  angle TEXT, core TEXT, icp TEXT,
  funnel TEXT, awareness TEXT, pain_desire TEXT,
  status TEXT DEFAULT 'waiting_for_feedback',
  performance TEXT DEFAULT 'untested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.creative_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT,                    -- CC001…
  format TEXT DEFAULT 'video', creator TEXT, inspo TEXT, angle_id TEXT,
  status TEXT DEFAULT 'waiting_for_feedback',
  performance TEXT DEFAULT 'untested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.creative_hooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT,                    -- H001…
  text TEXT, category TEXT, concept_id TEXT, angle_id TEXT,
  status TEXT DEFAULT 'waiting_for_feedback',
  performance TEXT DEFAULT 'untested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['creative_angles','creative_concepts','creative_hooks'] LOOP
    EXECUTE format('CREATE INDEX %I ON public.%I(user_id, created_at DESC)', t||'_user_idx', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "sel_own" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "ins_own" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "upd_own" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "del_own" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;
