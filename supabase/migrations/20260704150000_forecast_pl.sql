-- Forecast vs Actual — full P&L, one row per user holding the Forecast and Actual
-- scenarios as JSONB. Totals/margins are derived in the app. Optional (localStorage default).

CREATE TABLE public.forecast_pl (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  forecast JSONB NOT NULL DEFAULT '{}'::jsonb,
  actual   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.forecast_pl ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sel_own" ON public.forecast_pl FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ins_own" ON public.forecast_pl FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "upd_own" ON public.forecast_pl FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "del_own" ON public.forecast_pl FOR DELETE TO authenticated USING (auth.uid() = user_id);
