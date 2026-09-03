-- Canonical PM parts catalog imported from apps/api/test/fixtures/pm-parts.csv.
-- Prisma remains the only migration authority for this project.
CREATE TEMP TABLE pm_catalog_categories (
  name TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  aliases TEXT[] NOT NULL,
  sort_order INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO pm_catalog_categories (name, slug, aliases, sort_order)
SELECT name, slug, aliases, "sortOrder"
FROM jsonb_to_recordset($PMC$[{"name":"Oil Filter 1 Unit","slug":"oil-filter-1-unit","aliases":["Oil Filter 1"],"sortOrder":0},{"name":"Oil Filter 2 Unit","slug":"oil-filter-2-unit","aliases":["Oil Filter 2"],"sortOrder":1},{"name":"Fuel Filter","slug":"fuel-filter","aliases":["Fuel Filters"],"sortOrder":2},{"name":"Paper Fuel Filter","slug":"paper-fuel-filter","aliases":["Papel Fuel Filter"],"sortOrder":3},{"name":"Cabin Air Filter","slug":"cabin-air-filter","aliases":[],"sortOrder":4},{"name":"Desiccant Filter","slug":"desiccant-filter","aliases":["Air Dryer Filter"],"sortOrder":5},{"name":"Engine Air Filter","slug":"engine-air-filter","aliases":[],"sortOrder":6},{"name":"Wiper Blades","slug":"wiper-blades","aliases":[],"sortOrder":7},{"name":"Coolant Filter","slug":"coolant-filter","aliases":[],"sortOrder":8}]$PMC$::jsonb)
  AS source(name TEXT, slug TEXT, aliases TEXT[], "sortOrder" INTEGER);

INSERT INTO "part_categories" (id, name, slug, "sort_order", active, "created_at", "updated_at")
SELECT gen_random_uuid(), name, slug, sort_order, true, now(), now()
FROM pm_catalog_categories
ON CONFLICT (name) DO UPDATE SET
  slug = EXCLUDED.slug,
  "sort_order" = EXCLUDED."sort_order",
  active = true,
  "updated_at" = now();

UPDATE "part_categories" category
SET active = true, "updated_at" = now()
FROM pm_catalog_categories source
WHERE category.name = ANY(source.aliases);

CREATE TEMP TABLE pm_catalog_parts (
  category TEXT NOT NULL,
  "partNumber" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  fitments JSONB NOT NULL
) ON COMMIT DROP;

INSERT INTO pm_catalog_parts (category, "partNumber", "displayName", fitments)
SELECT category, "partNumber", "displayName", fitments
FROM jsonb_to_recordset($PMP$[{"category":"Fuel Filter","partNumber":"LFF8897","displayName":"Fuel Filter 4 Micron MP7 EPA","fitments":[]},{"category":"Fuel Filter","partNumber":"LFF8059","displayName":"Fuel Filter","fitments":[]},{"category":"Fuel Filter","partNumber":"23920469","displayName":"Fuel Filter","fitments":[]},{"category":"Fuel Filter","partNumber":"23856886","displayName":"Filter,Fuel,Secondary,US17,US21","fitments":[]},{"category":"Fuel Filter","partNumber":"21380521","displayName":"Filter F/W Separator 21017305","fitments":[]},{"category":"Paper Fuel Filter","partNumber":"L9765FXL","displayName":"Luber-Finer Fuel Filter","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Paper Fuel Filter","partNumber":"21737499","displayName":"Fuel Filter Insert 2334","fitments":[]},{"category":"Paper Fuel Filter","partNumber":"20483578","displayName":"Gasket,Trans Oil Filter","fitments":[]},{"category":"Cabin Air Filter","partNumber":"CAF24000","displayName":"Cabin Air Filter","fitments":[]},{"category":"Cabin Air Filter","partNumber":"20435801","displayName":"Filter Cab A/C","fitments":[]},{"category":"Engine Air Filter","partNumber":"21715813","displayName":"Filter Air C/P Vn","fitments":[]},{"category":"Engine Air Filter","partNumber":"LAF9201","displayName":"Air Filter","fitments":[]},{"category":"Wiper Blades","partNumber":"MV31520B","displayName":"Wiper Blades","fitments":[]},{"category":"Wiper Blades","partNumber":"MV31522B","displayName":"Wiper Blades","fitments":[]},{"category":"Wiper Blades","partNumber":"MV31524B","displayName":"Wipers","fitments":[]},{"category":"Coolant Filter","partNumber":"21937327","displayName":"Coolant Filter","fitments":[]},{"category":"Coolant Filter","partNumber":"LFW5141","displayName":"Filter Coolant","fitments":[]},{"category":"Coolant Filter","partNumber":"DBC4086","displayName":"Filter Coolant","fitments":[]},{"category":"Oil Filter 2 Unit","partNumber":"23151592","displayName":"Oil Filter (2)","fitments":[]},{"category":"Oil Filter 1 Unit","partNumber":"LFP8642","displayName":"Oil Filter","fitments":[]},{"category":"Oil Filter 1 Unit","partNumber":"21707132","displayName":"Oil Filter","fitments":[]},{"category":"Oil Filter 1 Unit","partNumber":"21707135","displayName":"Mack Oil Filter","fitments":[{"make":"Mack","model":null}]},{"category":"Oil Filter 1 Unit","partNumber":"LF3654","displayName":"Fleetguard Oil Filter","fitments":[]},{"category":"Oil Filter 2 Unit","partNumber":"LFP3191","displayName":"Oil Filter (2)","fitments":[]},{"category":"Oil Filter 2 Unit","partNumber":"LFP3236","displayName":"Luber-Finer Oil Filter (2)","fitments":[]},{"category":"Oil Filter 2 Unit","partNumber":"21707133","displayName":"Volvo Long Life Oil Filter (2)","fitments":[{"make":"Volvo","model":null}]},{"category":"Oil Filter 2 Unit","partNumber":"23658092","displayName":"Volvo Long Life Oil Filter (2)","fitments":[{"make":"Volvo","model":null}]},{"category":"Oil Filter 2 Unit","partNumber":"21939298","displayName":"Luber Filter Pure Mack (2)","fitments":[{"make":"Mack","model":null}]},{"category":"Oil Filter 2 Unit","partNumber":"LF17503","displayName":"Fleetguard Oil Filter (2)","fitments":[]},{"category":"Desiccant Filter","partNumber":"21620181","displayName":"Desiccant And Oil Separator","fitments":[]},{"category":"Desiccant Filter","partNumber":"23099526","displayName":"Desiccant Filter","fitments":[]},{"category":"Oil Filter 2 Unit","partNumber":"LFP3247","displayName":"Luber-Finer Oil Filter (2)","fitments":[]},{"category":"Paper Fuel Filter","partNumber":"24009059","displayName":"Special Paper Filter","fitments":[]},{"category":"Paper Fuel Filter","partNumber":"24009058","displayName":"Special Paper Filter","fitments":[]},{"category":"Paper Fuel Filter","partNumber":"FS20313","displayName":"Fleetguard Water Separator","fitments":[]},{"category":"Fuel Filter","partNumber":"P23843839","displayName":"Fuel Filter Mack","fitments":[{"make":"Mack","model":null}]},{"category":"Oil Filter 2 Unit","partNumber":"23155587","displayName":"Mack Oil Filter (2)","fitments":[{"make":"Mack","model":null}]},{"category":"Fuel Filter","partNumber":"21380475","displayName":"Fuel Filter","fitments":[]},{"category":"Fuel Filter","partNumber":"24470880","displayName":"Mack Fuel Filter","fitments":[{"make":"Mack","model":null}]},{"category":"Fuel Filter","partNumber":"24008818","displayName":"Desiccant. Filter Kit Fuel","fitments":[]},{"category":"Fuel Filter","partNumber":"24137493","displayName":"Long Life Extra Fuel","fitments":[]},{"category":"Oil Filter 1 Unit","partNumber":"2234788","displayName":"Peterbilt Oil Filter Paccar","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Fuel Filter","partNumber":"2323323","displayName":"Peterbilt Fuel Filter Paccar","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Fuel Filter","partNumber":"2242964","displayName":"Peterbilt Fuel Filter Paccar","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Cabin Air Filter","partNumber":"PA30093","displayName":"Peterbilt Cabin Air Filter","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Cabin Air Filter","partNumber":"CY08221P","displayName":"Peterbilt Air Cabin Filter","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Engine Air Filter","partNumber":"D37-1061","displayName":"Peterbilt Engine Air Filter","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Paper Fuel Filter","partNumber":"K37-1021","displayName":"Peterbilt Paper Fuel Filter","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Paper Fuel Filter","partNumber":"PF46236","displayName":"Peterbilt Paper Fuel Filter","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Fuel Filter","partNumber":"5575143","displayName":"Peterbilt Fuel Filter Cummins","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Oil Filter 1 Unit","partNumber":"5575298","displayName":"Peterbilt Oil Filter Cummins","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Oil Filter 1 Unit","partNumber":"B40145","displayName":"Peterbilt Oil Filter Cummins","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Fuel Filter","partNumber":"24633960","displayName":"Desiccant. Filter Kit","fitments":[]},{"category":"Fuel Filter","partNumber":"BF46129","displayName":"Peterbilt Fuel Filter Cummins","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Oil Filter 1 Unit","partNumber":"WIX WL10107","displayName":"Peterbilt Oil Filter Cummins","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Fuel Filter","partNumber":"24137737","displayName":"Fuel Filter","fitments":[]},{"category":"Engine Air Filter","partNumber":"25100042","displayName":"Mack Engine Air Filter","fitments":[{"make":"Mack","model":null}]},{"category":"Desiccant Filter","partNumber":"85115361","displayName":"Desiccant Filter","fitments":[]},{"category":"Desiccant Filter","partNumber":"P584764","displayName":"Peterbilt Donaldson","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Desiccant Filter","partNumber":"5009041PG","displayName":"Peterbilt Bendix","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Cabin Air Filter","partNumber":"85151124","displayName":"Mack Cabin Air Filter","fitments":[{"make":"Mack","model":null}]},{"category":"Cabin Air Filter","partNumber":"23582260","displayName":"Volvo Cabin Air Filter","fitments":[{"make":"Volvo","model":null}]},{"category":"Cabin Air Filter","partNumber":"WIX-24479","displayName":"Peterbilt Air Cabin Filter","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Fuel Filter","partNumber":"WIX WF10447","displayName":"Fuel Filter Volvo","fitments":[{"make":"Volvo","model":null}]},{"category":"Oil Filter 2 Unit","partNumber":"WIX WL10651","displayName":"Oil Filter Volvo 2 Units","fitments":[{"make":"Volvo","model":null}]},{"category":"Cabin Air Filter","partNumber":"WX49084","displayName":"Cabin Filter Volvo","fitments":[{"make":"Volvo","model":null}]},{"category":"Wiper Blades","partNumber":"ANC31-22","displayName":"Wiper Blades","fitments":[]},{"category":"Desiccant Filter","partNumber":"BENP584764","displayName":"Air Dryer Filter","fitments":[]},{"category":"Oil Filter 2 Unit","partNumber":"WX51791","displayName":"Oil Filter (2 Units)","fitments":[]},{"category":"Oil Filter 1 Unit","partNumber":"WL10106","displayName":"Oil Filter (1unit)","fitments":[]},{"category":"Paper Fuel Filter","partNumber":"WF10005","displayName":"Paper Fuel Filter Peterbilt - Volvo","fitments":[{"make":"Peterbilt","model":null},{"make":"Volvo","model":null}]},{"category":"Desiccant Filter","partNumber":"WAB4324219222","displayName":"Air Dryer Filter","fitments":[]},{"category":"Desiccant Filter","partNumber":"WAB4329012382","displayName":"Air Dryer Filter","fitments":[]},{"category":"Fuel Filter","partNumber":"WIX 33995","displayName":"Fuel Filter","fitments":[]},{"category":"Engine Air Filter","partNumber":"WX49126","displayName":"Engine Air Filter","fitments":[]},{"category":"Engine Air Filter","partNumber":"WBX42808","displayName":"Mack Engine Air Filter","fitments":[{"make":"Mack","model":null}]},{"category":"Fuel Filter","partNumber":"WIX WF10755","displayName":"Large Peterbilt Fuel Filter Premium","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Fuel Filter","partNumber":"WIX WF10755","displayName":"Short Peterbilt Fuel Filter Premium","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Oil Filter 1 Unit","partNumber":"WIX WL10341","displayName":"Peterbilt Oil Filter","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Paper Fuel Filter","partNumber":"WF10566","displayName":"Peterbilt Paper Filter","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Oil Filter 1 Unit","partNumber":"WL10663","displayName":"Freightliner Cascadia Oil Filter 1 Unit","fitments":[{"make":"Freightliner","model":"Cascadia"}]},{"category":"Fuel Filter","partNumber":"WF10678","displayName":"Freightliner Cascadia Large Fuel Filter","fitments":[{"make":"Freightliner","model":"Cascadia"}]},{"category":"Fuel Filter","partNumber":"WF10678","displayName":"Freightliner Short Fuel Filter","fitments":[{"make":"Freightliner","model":null}]},{"category":"Paper Fuel Filter","partNumber":"A0000905251","displayName":"Freightliner Cascadia Paper Fuel","fitments":[{"make":"Freightliner","model":"Cascadia"}]},{"category":"Cabin Air Filter","partNumber":"MAHLE82019","displayName":"Freightliner Cascadia Cabin Air Filter","fitments":[{"make":"Freightliner","model":"Cascadia"}]},{"category":"Engine Air Filter","partNumber":"DTP 03-42776-010","displayName":"Freightliner Engine Air Filter Detroit","fitments":[{"make":"Freightliner","model":null}]},{"category":"Fuel Filter","partNumber":"WF10515","displayName":"Peterbilt Fuel Filter Cummins","fitments":[{"make":"Peterbilt","model":null}]},{"category":"Cabin Air Filter","partNumber":"WIX524318","displayName":"Freightliner Cascadia Cabin Air Filter","fitments":[{"make":"Freightliner","model":"Cascadia"}]},{"category":"Paper Fuel Filter","partNumber":"FS20176","displayName":"Fleetguard Water Separator","fitments":[]},{"category":"Desiccant Filter","partNumber":"WIX 24374","displayName":"Desiccant Filter","fitments":[]},{"category":"Paper Fuel Filter","partNumber":"P550851","displayName":"Paper Fuel Filter Peterbilt - Volvo","fitments":[{"make":"Peterbilt","model":null},{"make":"Volvo","model":null}]}]$PMP$::jsonb)
  AS source(category TEXT, "partNumber" TEXT, "displayName" TEXT, fitments JSONB);

INSERT INTO "parts" (id, "category_id", "part_number", "display_name", active, "created_at", "updated_at")
SELECT gen_random_uuid(), category.id, source."partNumber", source."displayName", true, now(), now()
FROM pm_catalog_parts source
JOIN "part_categories" category ON category.name = source.category
ON CONFLICT ("category_id", "part_number", "display_name") DO UPDATE SET
  active = true,
  "updated_at" = now();

UPDATE "parts" part
SET active = false, "updated_at" = now()
FROM "part_categories" category
WHERE part."category_id" = category.id
  AND category.name IN (SELECT name FROM pm_catalog_categories)
  AND NOT EXISTS (
    SELECT 1
    FROM pm_catalog_parts source
    WHERE source.category = category.name
      AND source."partNumber" = part."part_number"
      AND source."displayName" = part."display_name"
  );

DELETE FROM "part_fitments" fitment
USING "parts" part, "part_categories" category
WHERE fitment."part_id" = part.id
  AND part."category_id" = category.id
  AND category.name IN (SELECT name FROM pm_catalog_categories);

INSERT INTO "part_fitments" (id, "part_id", make, model, "created_at")
SELECT gen_random_uuid(), part.id, fitment.make, fitment.model, now()
FROM pm_catalog_parts source
JOIN "part_categories" category ON category.name = source.category
JOIN "parts" part ON part."category_id" = category.id
  AND part."part_number" = source."partNumber"
  AND part."display_name" = source."displayName"
CROSS JOIN LATERAL jsonb_to_recordset(source.fitments)
  AS fitment(make TEXT, model TEXT);
