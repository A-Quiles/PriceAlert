-- ============================================================
-- PriceAlert — Migration 002: Subscription & Plan support
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Add subscription columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan                    TEXT        NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'premium')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT        UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT        UNIQUE;

-- Index to quickly look up profile by Stripe customer ID (used in webhooks)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON public.profiles(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- Allow the service role (webhook) to update plan without RLS restrictions
-- (already bypassed by SECURITY DEFINER or service_role key — no extra policy needed)

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('plan', 'stripe_customer_id', 'stripe_subscription_id')
ORDER BY column_name;
