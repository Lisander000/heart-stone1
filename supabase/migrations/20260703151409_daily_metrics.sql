-- Daily Tracker — one row per calendar day per user.
-- Only raw INPUT metrics are stored; all ratios (AOV, MER, CAC, ROAS, CPM…) are computed in the app.

CREATE TABLE public.daily_metrics (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,
  date           DATE NOT NULL,
  -- revenue
  net_sales      NUMERIC NOT NULL DEFAULT 0,   -- Shopify daily net sales
  orders         INTEGER NOT NULL DEFAULT 0,
  returning_rate NUMERIC NOT NULL DEFAULT 0,   -- 0..1 returning customer rate
  -- channel split
  creator_sales  NUMERIC NOT NULL DEFAULT 0,
  bol_sales      NUMERIC NOT NULL DEFAULT 0,
  email_sales    NUMERIC NOT NULL DEFAULT 0,
  organic_sales  NUMERIC NOT NULL DEFAULT 0,
  paid_sales     NUMERIC NOT NULL DEFAULT 0,
  -- ad spend
  meta_spend     NUMERIC NOT NULL DEFAULT 0,
  google_spend   NUMERIC NOT NULL DEFAULT 0,
  -- funnel
  impressions    INTEGER NOT NULL DEFAULT 0,
  clicks         INTEGER NOT NULL DEFAULT 0,
  atc            INTEGER NOT NULL DEFAULT 0,   -- add-to-carts
  checkouts      INTEGER NOT NULL DEFAULT 0,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX daily_metrics_user_date_idx ON public.daily_metrics(user_id, date DESC);

ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own daily_metrics" ON public.daily_metrics FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own daily_metrics" ON public.daily_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own daily_metrics" ON public.daily_metrics FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own daily_metrics" ON public.daily_metrics FOR DELETE TO authenticated USING (auth.uid() = user_id);
