-- Preserve part references while normalizing legacy display variants.
UPDATE "parts"
SET "display_name" = CASE "display_name"
  WHEN 'Filter,Fuel,Secondary,US17,US21' THEN 'Fuel Filter, Secondary, US17, US21'
  WHEN 'Desiccant. Filter Kit Fuel' THEN 'Desiccant Filter Kit Fuel'
  WHEN 'Desiccant. Filter Kit' THEN 'Desiccant Filter Kit'
  WHEN 'Oil Filter (1unit)' THEN 'Oil Filter (1 Unit)'
  WHEN 'Wipers' THEN 'Wiper Blades'
  WHEN 'Filter Air C/P Vn' THEN 'Filter Air C/P VN'
  ELSE "display_name"
END,
"updated_at" = now()
WHERE "display_name" IN (
  'Filter,Fuel,Secondary,US17,US21',
  'Desiccant. Filter Kit Fuel',
  'Desiccant. Filter Kit',
  'Oil Filter (1unit)',
  'Wipers',
  'Filter Air C/P Vn'
);
