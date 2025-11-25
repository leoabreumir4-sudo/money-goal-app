-- Check events table structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;

-- Check if sortOrder column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'events' AND column_name = 'sortOrder';

-- Count total events by user
SELECT 
    "userId",
    COUNT(*) as total_events,
    COUNT(CASE WHEN "isSelected" = 1 THEN 1 END) as selected_events,
    COUNT(CASE WHEN "isDefault" = 1 THEN 1 END) as default_events
FROM events
GROUP BY "userId";

-- Check sample events data
SELECT 
    id,
    "userId",
    name,
    month,
    "isSelected",
    "isDefault",
    "sortOrder",
    "createdDate"
FROM events
ORDER BY month, "sortOrder"
LIMIT 20;

-- Check for NULL or invalid data
SELECT 
    COUNT(*) as total_rows,
    COUNT(CASE WHEN id IS NULL THEN 1 END) as null_id,
    COUNT(CASE WHEN "userId" IS NULL THEN 1 END) as null_userId,
    COUNT(CASE WHEN name IS NULL THEN 1 END) as null_name,
    COUNT(CASE WHEN month IS NULL THEN 1 END) as null_month,
    COUNT(CASE WHEN "sortOrder" IS NULL THEN 1 END) as null_sortOrder
FROM events;
