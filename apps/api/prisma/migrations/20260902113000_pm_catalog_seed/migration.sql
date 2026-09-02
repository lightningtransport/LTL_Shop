ALTER TABLE "part_categories" ADD COLUMN IF NOT EXISTS "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "part_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "part_fitments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pm_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pm_service_parts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "truck_mileage_adjustments" ENABLE ROW LEVEL SECURITY;

UPDATE "users"
SET "pm_authorized" = true
WHERE "active" = true AND lower("name") = 'daniel';

WITH categories("slug", "name", "sort_order", "aliases") AS (
  VALUES
    ('oil-filter-1-unit', 'Oil Filter 1 Unit', 0, ARRAY[]::TEXT[]),
    ('oil-filter-2-unit', 'Oil Filter 2 Unit', 1, ARRAY[]::TEXT[]),
    ('fuel-filter', 'Fuel Filter', 2, ARRAY[]::TEXT[]),
    ('paper-fuel-filter', 'Paper Fuel Filter', 3, ARRAY['Papel Fuel Filter']),
    ('cabin-air-filter', 'Cabin Air Filter', 4, ARRAY[]::TEXT[]),
    ('desiccant-filter', 'Desiccant Filter', 5, ARRAY[]::TEXT[]),
    ('engine-air-filter', 'Engine Air Filter', 6, ARRAY[]::TEXT[]),
    ('wiper-blades', 'Wiper Blades', 7, ARRAY[]::TEXT[]),
    ('coolant-filter', 'Coolant Filter', 8, ARRAY[]::TEXT[])
)
INSERT INTO "part_categories" ("id", "slug", "name", "sort_order", "aliases", "updated_at")
SELECT gen_random_uuid(), "slug", "name", "sort_order", "aliases", CURRENT_TIMESTAMP FROM categories
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name", "sort_order" = EXCLUDED."sort_order", "aliases" = EXCLUDED."aliases", "active" = true, "updated_at" = CURRENT_TIMESTAMP;

WITH items("category", "part_number", "display_name") AS (
  VALUES
    ('Oil Filter 1 Unit','2234788','PETERBILT Oil Filter Paccar'),
    ('Oil Filter 1 Unit','5575298','PETERBILT Oil Filter Cummins'),
    ('Oil Filter 1 Unit','B40145','PETERBILT Oil Filter Cummins'),
    ('Oil Filter 1 Unit','WIX WL10107','PETERBILT Oil Filter Cummins'),
    ('Oil Filter 1 Unit','WIX WL10341','PETERBILT Oil Filter'),
    ('Fuel Filter','2323323','PETERBILT Fuel Filter Paccar'),
    ('Fuel Filter','2242964','PETERBILT Fuel Filter Paccar'),
    ('Fuel Filter','5575143','PETERBILT Fuel Filter Cummins'),
    ('Fuel Filter','BF46129','PETERBILT Fuel Filter Cummins'),
    ('Fuel Filter','WIX WF10755','Large PETERBILT Fuel Filter Premium'),
    ('Fuel Filter','WIX WF10755','Short PETERBILT Fuel Filter Premium'),
    ('Fuel Filter','WF10515','PETERBILT Fuel Filter Cummins'),
    ('Paper Fuel Filter','K37-1021','PETERBILT Paper Fuel Filter'),
    ('Paper Fuel Filter','PF46236','PETERBILT Paper Fuel Filter'),
    ('Paper Fuel Filter','L9765FXL','LUBER-FINER Fuel Filter PETERBILT'),
    ('Paper Fuel Filter','WF10005','Paper Fuel Filter PETERBILT - Volvo'),
    ('Paper Fuel Filter','WF10566','PETERBILT Paper Filter'),
    ('Paper Fuel Filter','P550851','Paper Fuel Filter PETERBILT - Volvo'),
    ('Cabin Air Filter','PA30093','PETERBILT Cabin Air Filter'),
    ('Cabin Air Filter','CY08221P','PETERBILT Air Cabin Filter'),
    ('Cabin Air Filter','WIX-24479','PETERBILT Air Cabin Filter'),
    ('Desiccant Filter','21620181','Desiccant and Oil Separator'),
    ('Desiccant Filter','23099526','Desiccant Filter'),
    ('Desiccant Filter','85115361','Desiccant Filter'),
    ('Desiccant Filter','P584764','PETERBILT DONALDSON'),
    ('Desiccant Filter','5009041PG','PETERBILT BENDIX'),
    ('Desiccant Filter','BENP584764','Air Dryer Filter'),
    ('Desiccant Filter','WAB4324219222','Air Dryer Filter'),
    ('Desiccant Filter','WAB4329012382','Air Dryer Filter'),
    ('Desiccant Filter','WIX 24374','Desiccant Filter'),
    ('Engine Air Filter','21715813','FILTER AIR C/P VN'),
    ('Engine Air Filter','LAF9201','Air Filter'),
    ('Engine Air Filter','D37-1061','PETERBILT Engine Air Filter'),
    ('Engine Air Filter','25100042','Mack Engine Air Filter'),
    ('Engine Air Filter','WX49126','Engine Air Filter'),
    ('Engine Air Filter','WBX42808','Mack Engine Air Filter'),
    ('Engine Air Filter','DTP 03-42776-010','Freightliner Engine Air Filter Detroit'),
    ('Wiper Blades','MV31520B','WIPER BLADES'),
    ('Wiper Blades','MV31522B','Wiper Blades'),
    ('Wiper Blades','MV31524B','Wipers'),
    ('Wiper Blades','ANC31-22','Wiper Blades'),
    ('Coolant Filter','21937327','COOLANT FILTER'),
    ('Coolant Filter','LFW5141','FILTER COOLANT'),
    ('Coolant Filter','DBC4086','FILTER COOLANT')
)
INSERT INTO "parts" ("id", "category_id", "part_number", "display_name", "updated_at")
SELECT gen_random_uuid(), c."id", i."part_number", i."display_name", CURRENT_TIMESTAMP
FROM items i JOIN "part_categories" c ON c."name" = i."category"
ON CONFLICT ("category_id", "part_number", "display_name") DO UPDATE SET "active" = true, "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "parts" ("id", "category_id", "part_number", "display_name", "updated_at")
SELECT gen_random_uuid(), destination."id", part."part_number", part."display_name", CURRENT_TIMESTAMP
FROM "parts" part
JOIN "part_categories" source ON source."id" = part."category_id" AND source."slug" = 'oil-filter-1-unit'
JOIN "part_categories" destination ON destination."slug" = 'oil-filter-2-unit'
ON CONFLICT ("category_id", "part_number", "display_name") DO UPDATE SET "active" = true, "updated_at" = CURRENT_TIMESTAMP;

DELETE FROM "part_fitments"
WHERE "part_id" IN (
  SELECT part."id" FROM "parts" part JOIN "part_categories" category ON category."id" = part."category_id"
  WHERE category."slug" IN ('oil-filter-1-unit','oil-filter-2-unit','fuel-filter','paper-fuel-filter','cabin-air-filter','desiccant-filter','engine-air-filter','wiper-blades','coolant-filter')
);

WITH fitments("category", "part_number", "make") AS (
  VALUES
    ('Oil Filter 1 Unit','2234788','Peterbilt'),('Oil Filter 1 Unit','5575298','Peterbilt'),('Oil Filter 1 Unit','B40145','Peterbilt'),('Oil Filter 1 Unit','WIX WL10107','Peterbilt'),('Oil Filter 1 Unit','WIX WL10341','Peterbilt'),
    ('Oil Filter 2 Unit','2234788','Peterbilt'),('Oil Filter 2 Unit','5575298','Peterbilt'),('Oil Filter 2 Unit','B40145','Peterbilt'),('Oil Filter 2 Unit','WIX WL10107','Peterbilt'),('Oil Filter 2 Unit','WIX WL10341','Peterbilt'),
    ('Fuel Filter','2323323','Peterbilt'),('Fuel Filter','2242964','Peterbilt'),('Fuel Filter','5575143','Peterbilt'),('Fuel Filter','BF46129','Peterbilt'),('Fuel Filter','WIX WF10755','Peterbilt'),('Fuel Filter','WF10515','Peterbilt'),
    ('Paper Fuel Filter','K37-1021','Peterbilt'),('Paper Fuel Filter','PF46236','Peterbilt'),('Paper Fuel Filter','L9765FXL','Peterbilt'),('Paper Fuel Filter','WF10005','Peterbilt'),('Paper Fuel Filter','WF10005','Volvo'),('Paper Fuel Filter','WF10566','Peterbilt'),('Paper Fuel Filter','P550851','Peterbilt'),('Paper Fuel Filter','P550851','Volvo'),
    ('Cabin Air Filter','PA30093','Peterbilt'),('Cabin Air Filter','CY08221P','Peterbilt'),('Cabin Air Filter','WIX-24479','Peterbilt'),
    ('Desiccant Filter','P584764','Peterbilt'),('Desiccant Filter','5009041PG','Peterbilt'),
    ('Engine Air Filter','21715813','Volvo'),('Engine Air Filter','D37-1061','Peterbilt'),('Engine Air Filter','25100042','Mack'),('Engine Air Filter','WBX42808','Mack'),('Engine Air Filter','DTP 03-42776-010','Freightliner')
)
INSERT INTO "part_fitments" ("id", "part_id", "make")
SELECT gen_random_uuid(), part."id", fitment."make"
FROM fitments fitment
JOIN "part_categories" category ON category."name" = fitment."category"
JOIN "parts" part ON part."category_id" = category."id" AND part."part_number" = fitment."part_number";
