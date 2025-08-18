-- Promote existing user to admin
-- This script promotes Andrew Sandy (einsteinelite05@gmail.com) to admin_chairperson

UPDATE users 
SET role = 'admin_chairperson', 
    updated_at = CURRENT_TIMESTAMP
WHERE email = 'einsteinelite05@gmail.com' 
  AND is_active = true;

-- Verify the update
SELECT id, full_name, email, role, updated_at 
FROM users 
WHERE email = 'einsteinelite05@gmail.com';
