-- Create enums for criteria category and team award type
CREATE TYPE criteria_category AS ENUM ('technical', 'business');
CREATE TYPE team_award_type AS ENUM ('technical', 'business', 'both');

-- Add weight and category to criteria table
ALTER TABLE criteria 
ADD COLUMN weight INTEGER NOT NULL DEFAULT 20,
ADD COLUMN category criteria_category NOT NULL DEFAULT 'technical';

-- Add constraint for weight range
ALTER TABLE criteria
ADD CONSTRAINT check_weight_range CHECK (weight >= 0 AND weight <= 100);

-- Add award_type to teams table
ALTER TABLE teams
ADD COLUMN award_type team_award_type NOT NULL DEFAULT 'both';

-- Update existing criteria to have proper categories (this is temporary, will be updated by seed)
UPDATE criteria SET category = 'technical' WHERE name IN ('Innovation', 'Technical Implementation', 'Presentation', 'Feasibility', 'Impact');
UPDATE criteria SET category = 'business' WHERE name IN ('Market Opportunity', 'Business Model', 'Team', 'Scalability', 'Pitch Quality');

-- Create indexes for better query performance
CREATE INDEX idx_criteria_category ON criteria(category);
CREATE INDEX idx_teams_award_type ON teams(award_type);