-- UGC studio — two boards: Tracker (creator database) + Approval (approved collabs).
-- Replaces the earlier single ugc_items table. Checkboxes are booleans.

DROP TABLE IF EXISTS public.ugc_items CASCADE;

-- 1) Tracker — creator database & outreach
CREATE TABLE public.ugc_tracker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nr TEXT,
  name TEXT, instagram TEXT, tiktok TEXT,
  size TEXT, dog_breed TEXT, content_style TEXT,
  pricing TEXT, portfolio TEXT, contact TEXT,
  location TEXT, address TEXT,
  contacted BOOLEAN DEFAULT false,
  response BOOLEAN DEFAULT false,
  collab_ok BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Approval — approved collabs, deliverables & payment
CREATE TABLE public.ugc_approval (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT, number TEXT, email TEXT, instagram TEXT,
  product_sent TEXT, tier TEXT,
  ship_date DATE,
  delivered BOOLEAN DEFAULT false,
  icp_target TEXT, angle_hook TEXT,
  deliverable_type TEXT, video_link TEXT, affiliate_code TEXT,
  post_date DATE,
  reuse TEXT, paid TEXT DEFAULT 'pending content',
  status TEXT DEFAULT 'pending',
  contract_link TEXT, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ugc_tracker','ugc_approval'] LOOP
    EXECUTE format('CREATE INDEX %I ON public.%I(user_id, created_at DESC)', t||'_user_idx', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "sel_own" ON public.%I FOR SELECT TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "ins_own" ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "upd_own" ON public.%I FOR UPDATE TO authenticated USING (auth.uid() = user_id)', t);
    EXECUTE format('CREATE POLICY "del_own" ON public.%I FOR DELETE TO authenticated USING (auth.uid() = user_id)', t);
  END LOOP;
END $$;
