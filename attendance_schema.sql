-- Majestic GYM Attendance Schema
-- Run this in your Supabase SQL Editor

CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  check_in_method TEXT DEFAULT 'qr_scan' -- 'qr_scan' or 'manual'
);

ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated staff to manage attendance"
ON attendance FOR ALL
TO authenticated
USING (true) WITH CHECK (true);

-- Index for fast member-based attendance lookups
CREATE INDEX idx_attendance_member_id ON attendance(member_id);
CREATE INDEX idx_attendance_checked_in_at ON attendance(checked_in_at DESC);
