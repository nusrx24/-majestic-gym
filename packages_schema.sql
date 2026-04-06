-- Majestic GYM Packages & Subscriptions Schema
-- Run this in your Supabase SQL Editor

-- 1. Create Packages (Membership Plans)
CREATE TABLE packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  duration_days INTEGER NOT NULL, -- e.g., 30 for 1 month
  stripe_price_id TEXT, -- Link to Stripe Products
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to manage packages" 
ON packages FOR ALL 
TO authenticated 
USING (true) WITH CHECK (true);

-- 2. Create Member Subscriptions (Tracking active plans)
CREATE TABLE member_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  package_id UUID REFERENCES packages(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payment_method TEXT NOT NULL, -- 'cash', 'card', 'online'
  payment_status TEXT DEFAULT 'paid',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE member_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to manage subscriptions" 
ON member_subscriptions FOR ALL 
TO authenticated 
USING (true) WITH CHECK (true);

-- 3. Insert some default dummy packages to start!
INSERT INTO packages (name, description, price, duration_days) VALUES 
('Basic Monthly', 'Standard Gym Access', 49.99, 30),
('Premium Monthly', 'Gym + Group Classes + Sauna', 79.99, 30),
('Annual VIP', 'All Access + Personal Locker', 499.99, 365);
