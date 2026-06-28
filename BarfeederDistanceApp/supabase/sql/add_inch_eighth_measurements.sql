-- Store bar feeder setup measurements as exact 1/8-inch increments.
--
-- One inch is 8 increments:
--   10 in      -> 80
--   10 1/8 in  -> 81
--   10 1/2 in  -> 84
--
-- The existing *_mm columns remain for compatibility with earlier data.

ALTER TABLE distances
ADD COLUMN IF NOT EXISTS distance_in_eighths INT;

ALTER TABLE user_submissions
ADD COLUMN IF NOT EXISTS distance_in_eighths INT;

ALTER TABLE variations
ADD COLUMN IF NOT EXISTS variation_distance_in_eighths INT;

UPDATE distances
SET distance_in_eighths = ROUND(distance_mm * 8.0 / 25.4)::INT
WHERE distance_in_eighths IS NULL
  AND distance_mm IS NOT NULL;

UPDATE user_submissions
SET distance_in_eighths = ROUND(distance_mm * 8.0 / 25.4)::INT
WHERE distance_in_eighths IS NULL
  AND distance_mm IS NOT NULL;

UPDATE variations
SET variation_distance_in_eighths = ROUND(variation_distance_mm * 8.0 / 25.4)::INT
WHERE variation_distance_in_eighths IS NULL
  AND variation_distance_mm IS NOT NULL;

ALTER TABLE distances
DROP CONSTRAINT IF EXISTS distances_distance_in_eighths_positive;

ALTER TABLE user_submissions
DROP CONSTRAINT IF EXISTS user_submissions_distance_in_eighths_positive;

ALTER TABLE variations
DROP CONSTRAINT IF EXISTS variations_distance_in_eighths_positive;

ALTER TABLE distances
ADD CONSTRAINT distances_distance_in_eighths_positive
CHECK (distance_in_eighths IS NULL OR distance_in_eighths > 0);

ALTER TABLE user_submissions
ADD CONSTRAINT user_submissions_distance_in_eighths_positive
CHECK (distance_in_eighths IS NULL OR distance_in_eighths > 0);

ALTER TABLE variations
ADD CONSTRAINT variations_distance_in_eighths_positive
CHECK (variation_distance_in_eighths IS NULL OR variation_distance_in_eighths > 0);
