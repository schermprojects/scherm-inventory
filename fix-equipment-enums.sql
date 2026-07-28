UPDATE equipment
SET condition = 'NEW'
WHERE condition::text = 'GOOD';

UPDATE equipment
SET condition = 'DAMAGED'
WHERE condition::text = 'REGULAR';

UPDATE equipment
SET status = 'UNAVAILABLE'
WHERE status::text = 'MAINTENANCE';