-- Phase 6: Judge-Event Assignment Security Fix
-- This migration creates an association table to explicitly assign judges to events
-- and preserves existing behavior by assigning all current judges to all events

-- Create event_judges association table
CREATE TABLE IF NOT EXISTS event_judges (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  judge_id UUID REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (event_id, judge_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_judges_event ON event_judges(event_id);
CREATE INDEX IF NOT EXISTS idx_event_judges_judge ON event_judges(judge_id);

-- CRITICAL: Preserve existing behavior - assign all current judges to all events
-- This ensures backward compatibility and no disruption to ongoing judging
INSERT INTO event_judges (event_id, judge_id)
SELECT e.id, u.id 
FROM events e
CROSS JOIN users u
WHERE u.role = 'judge'
ON CONFLICT DO NOTHING;

-- Add RLS policies for event_judges table
ALTER TABLE event_judges ENABLE ROW LEVEL SECURITY;

-- Judges can see their own assignments
CREATE POLICY "Judges can view own assignments" ON event_judges 
FOR SELECT USING (auth.uid() = judge_id);

-- Admins can manage all assignments
CREATE POLICY "Admins can view all assignments" ON event_judges 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can insert assignments" ON event_judges 
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Admins can delete assignments" ON event_judges 
FOR DELETE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Add comment to table for documentation
COMMENT ON TABLE event_judges IS 'Association table linking judges to specific events they are allowed to score';
COMMENT ON COLUMN event_judges.event_id IS 'The event the judge is assigned to';
COMMENT ON COLUMN event_judges.judge_id IS 'The judge assigned to the event';
COMMENT ON COLUMN event_judges.assigned_at IS 'Timestamp when the judge was assigned to the event';