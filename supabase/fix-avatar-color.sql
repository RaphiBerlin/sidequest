-- Fix avatar_color values that are missing the leading '#'
-- (inserted by old Onboarding code as 'C44829' instead of '#C44829')
UPDATE users
SET avatar_color = '#' || avatar_color
WHERE avatar_color IS NOT NULL
  AND avatar_color NOT LIKE '#%';
