-- ============================================================
-- POCKET APP — Supabase Database Schema
-- Run this ENTIRE script in the Supabase SQL Editor.
-- Go to: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- ── 1. Profiles Table ──
-- Stores user financial snapshot (cash, vault, dates)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cash_on_hand BIGINT DEFAULT 0,
  emergency_vault BIGINT DEFAULT 0,
  next_income_date TEXT,
  setup_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Transactions Table ──
-- Every expense, vault withdrawal, or spending event
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount BIGINT NOT NULL,
  tier INTEGER DEFAULT 2,
  category TEXT,
  note TEXT,
  satiety_score INTEGER,
  paid_via_utang BOOLEAN DEFAULT FALSE,
  linked_utang_id TEXT,
  is_vault_withdraw BOOLEAN DEFAULT FALSE,
  vault_amount BIGINT,
  vault_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  locked_at TIMESTAMPTZ  -- set by trigger after 24 hours
);

-- ── 3. Bills Table ──
-- Upcoming bills with due dates and paid status
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  amount BIGINT NOT NULL,
  due_date TEXT NOT NULL,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Utang (Loans) Ledger ──
-- Money borrowed via the Bridge protocol
CREATE TABLE IF NOT EXISTS utang_ledger (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  label TEXT NOT NULL,
  date TEXT NOT NULL,
  amount_paid BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Income Ledger ──
-- Every micro-income or fund addition
CREATE TABLE IF NOT EXISTS income_ledger (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  label TEXT NOT NULL,
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 6. Nutrition Log (optional extension) ──
-- Tracks food spending patterns for health warnings
CREATE TABLE IF NOT EXISTS nutrition_log (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  cost BIGINT NOT NULL,
  satiety_score INTEGER NOT NULL CHECK (satiety_score BETWEEN 1 AND 5),
  date TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes for faster queries ──
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_utang_user ON utang_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_income_user ON income_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_user ON nutrition_log(user_id);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Each user can ONLY see and modify their OWN data.
-- This is the "non-corrupt" guarantee at the database level.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE utang_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_log ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/write their own profile
CREATE POLICY "Users can view own profile"    ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile"  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Transactions: users can only CRUD their own transactions
CREATE POLICY "Users can view own transactions"   ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id AND locked_at IS NULL);

-- Bills: users can only CRUD their own bills
CREATE POLICY "Users can view own bills"   ON bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bills" ON bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bills" ON bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bills" ON bills FOR DELETE USING (auth.uid() = user_id);

-- Utang: users can only CRUD their own loans
CREATE POLICY "Users can view own utang"   ON utang_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own utang" ON utang_ledger FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own utang" ON utang_ledger FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own utang" ON utang_ledger FOR DELETE USING (auth.uid() = user_id);

-- Income: users can only CRUD their own income records
CREATE POLICY "Users can view own income"   ON income_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income" ON income_ledger FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income" ON income_ledger FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income" ON income_ledger FOR DELETE USING (auth.uid() = user_id);

-- Nutrition: users can only CRUD their own nutrition logs
CREATE POLICY "Users can view own nutrition"   ON nutrition_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nutrition" ON nutrition_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nutrition" ON nutrition_log FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own nutrition" ON nutrition_log FOR DELETE USING (auth.uid() = user_id);


-- ============================================================
-- IMMUTABLE LEDGER TRIGGER
-- Auto-locks transactions 24 hours after creation.
-- Once locked, they can NOT be deleted — only reversed
-- via a "counter-transaction" (undo creates a refund entry).
-- This enforces the "non-corrupt" accountability principle.
-- ============================================================

-- Function: set locked_at timestamp 24 hours after creation
CREATE OR REPLACE FUNCTION lock_old_transactions()
RETURNS TRIGGER AS $$
BEGIN
  -- Lock transactions older than 24 hours that haven't been locked yet
  UPDATE transactions
  SET locked_at = now()
  WHERE locked_at IS NULL
    AND created_at < now() - INTERVAL '24 hours';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger: runs whenever a new transaction is inserted
-- This opportunistically locks old transactions
CREATE OR REPLACE TRIGGER trigger_lock_old_transactions
  AFTER INSERT ON transactions
  FOR EACH STATEMENT
  EXECUTE FUNCTION lock_old_transactions();
