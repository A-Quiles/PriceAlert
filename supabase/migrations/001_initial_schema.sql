-- ============================================================
-- PriceAlert — Supabase Initial Schema
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                TEXT          NOT NULL,
  full_name            TEXT,
  avatar_url           TEXT,
  email_notifications  BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/update their own profile
CREATE POLICY "profiles_select_own"  ON public.profiles FOR SELECT  USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own"  ON public.profiles FOR INSERT  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON public.profiles FOR UPDATE  USING (auth.uid() = id);

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. TRACKED PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tracked_products (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT          NOT NULL,
  url             TEXT          NOT NULL,
  asin            TEXT          NOT NULL,
  image_url       TEXT,
  current_price   NUMERIC(10,2),
  original_price  NUMERIC(10,2),
  currency        CHAR(3)       NOT NULL DEFAULT 'EUR',
  availability    TEXT          NOT NULL DEFAULT 'unknown'
                    CHECK (availability IN ('in_stock', 'out_of_stock', 'unknown')),
  alert_threshold NUMERIC(10,2),
  alert_enabled   BOOLEAN       NOT NULL DEFAULT TRUE,
  last_checked    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Index for fast per-user queries
CREATE INDEX IF NOT EXISTS idx_tracked_products_user_id
  ON public.tracked_products(user_id);

-- Index for cron job queries on alert_enabled products
CREATE INDEX IF NOT EXISTS idx_tracked_products_alert_enabled
  ON public.tracked_products(alert_enabled, last_checked);

ALTER TABLE public.tracked_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_own" ON public.tracked_products FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "products_insert_own" ON public.tracked_products FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products_update_own" ON public.tracked_products FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "products_delete_own" ON public.tracked_products FOR DELETE  USING (auth.uid() = user_id);

-- Service role bypass (for cron job)
CREATE POLICY "products_service_role_all"
  ON public.tracked_products
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 3. PRICE HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.price_history (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID          NOT NULL REFERENCES public.tracked_products(id) ON DELETE CASCADE,
  price        NUMERIC(10,2) NOT NULL,
  currency     CHAR(3)       NOT NULL DEFAULT 'EUR',
  availability TEXT          NOT NULL DEFAULT 'unknown'
                 CHECK (availability IN ('in_stock', 'out_of_stock', 'unknown')),
  recorded_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_id
  ON public.price_history(product_id, recorded_at DESC);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Users can read price history for their products
CREATE POLICY "price_history_select_own"
  ON public.price_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tracked_products tp
      WHERE tp.id = price_history.product_id
        AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY "price_history_insert_own"
  ON public.price_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tracked_products tp
      WHERE tp.id = price_history.product_id
        AND tp.user_id = auth.uid()
    )
  );

-- Service role bypass (for cron job)
CREATE POLICY "price_history_service_role_all"
  ON public.price_history
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 4. ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id      UUID          NOT NULL REFERENCES public.tracked_products(id) ON DELETE CASCADE,
  threshold_price NUMERIC(10,2) NOT NULL,
  triggered       BOOLEAN       NOT NULL DEFAULT FALSE,
  triggered_at    TIMESTAMPTZ,
  trigger_price   NUMERIC(10,2),
  sent_email      BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user_id
  ON public.alerts(user_id);

CREATE INDEX IF NOT EXISTS idx_alerts_product_id
  ON public.alerts(product_id);

CREATE INDEX IF NOT EXISTS idx_alerts_triggered
  ON public.alerts(triggered, sent_email);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_select_own" ON public.alerts FOR SELECT  USING (auth.uid() = user_id);
CREATE POLICY "alerts_insert_own" ON public.alerts FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alerts_update_own" ON public.alerts FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "alerts_delete_own" ON public.alerts FOR DELETE  USING (auth.uid() = user_id);

-- Service role bypass (for cron job)
CREATE POLICY "alerts_service_role_all"
  ON public.alerts
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 5. UTILITY: Updated_at auto-update trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.tracked_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 6. VIEW: Product stats per user (optional, for dashboard)
-- ============================================================
CREATE OR REPLACE VIEW public.user_product_stats AS
SELECT
  tp.user_id,
  COUNT(DISTINCT tp.id)                          AS total_products,
  COUNT(DISTINCT tp.id) FILTER (WHERE tp.alert_enabled) AS active_alerts,
  COUNT(DISTINCT a.id) FILTER (WHERE a.triggered)        AS triggered_alerts,
  ROUND(AVG(tp.original_price - tp.current_price)
    FILTER (WHERE tp.original_price IS NOT NULL AND tp.current_price IS NOT NULL), 2) AS avg_savings
FROM public.tracked_products tp
LEFT JOIN public.alerts a ON a.product_id = tp.id
GROUP BY tp.user_id;
