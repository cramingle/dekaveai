-- Supabase RLS (Row Level Security) Policies
-- Run these commands in the Supabase SQL editor to secure your tables

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_records ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can only read their own records
CREATE POLICY "Users can view own data" 
  ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can only update their own non-critical fields
CREATE POLICY "Users can update own non-critical data"
  ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND NOT (tokens IS DISTINCT FROM OLD.tokens));

-- Only service role can update token counts
CREATE POLICY "Only service role can update tokens"
  ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- IP tracking table policies
-- Only service role can read/write to IP tracking
CREATE POLICY "Only service role can view IP tracking"
  ON ip_tracking
  FOR SELECT
  USING (false);

CREATE POLICY "Only service role can insert IP tracking"
  ON ip_tracking
  FOR INSERT
  WITH CHECK (false);

-- Generation records table
-- Users can only view their own generation records
CREATE POLICY "Users can view own generation records"
  ON generation_records
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own generation records
CREATE POLICY "Users can insert own generation records"
  ON generation_records
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Database rate limiting triggers
-- Create a function to enforce rate limits on database insertions
CREATE OR REPLACE FUNCTION enforce_generation_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  recent_count INTEGER;
  user_tier TEXT;
BEGIN
  -- Get user's tier
  SELECT tier INTO user_tier FROM users WHERE id = NEW.user_id;
  
  -- Count recent generations (last minute)
  SELECT COUNT(*) INTO recent_count 
  FROM generation_records 
  WHERE user_id = NEW.user_id 
    AND created_at > NOW() - INTERVAL '1 minute';
  
  -- Apply tier-based rate limiting
  IF user_tier = 'free' AND recent_count >= 3 THEN
    RAISE EXCEPTION 'Rate limit exceeded for free tier (3 per minute)';
  ELSIF user_tier = 'basic' AND recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded for basic tier (5 per minute)';
  ELSIF user_tier = 'pro' AND recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded for pro tier (10 per minute)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the rate limiting trigger to the generation_records table
CREATE TRIGGER enforce_generation_rate_limit_trigger
  BEFORE INSERT ON generation_records
  FOR EACH ROW
  EXECUTE FUNCTION enforce_generation_rate_limit();

-- Index for performance (important for rate limit queries)
CREATE INDEX idx_generation_records_user_id_created_at
  ON generation_records (user_id, created_at); 