-- Majestic GYM Core Schema (Version 1)
-- Run this in your Supabase SQL Editor

-- 1. Create the members table
CREATE TABLE members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id_string TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  blood_group TEXT,
  emergency_contact TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- 3. Create Security Policies
-- Since this is an internal staff application, we want authenticated staff to have full access
CREATE POLICY "Allow authenticated staff to read members"
ON members FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated staff to insert members"
ON members FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated staff to update members"
ON members FOR UPDATE
TO authenticated
USING (true);

-- 4. Create an Index to make the QR scanning search hyper-fast!
CREATE INDEX idx_members_id_string ON members(member_id_string);
