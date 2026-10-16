-- D45 / ST-2 (LTR-222): the catalog has repair parts and tires, not only the PM. Additive: every existing category
-- stays a PM category, every existing part keeps its fields.
CREATE TYPE "part_kind" AS ENUM ('pm', 'repair', 'tire');
CREATE TYPE "tire_type" AS ENUM ('new', 'recap');

ALTER TABLE "part_categories" ADD COLUMN "kind" "part_kind" NOT NULL DEFAULT 'pm';

ALTER TABLE "parts" ADD COLUMN "tire_size" TEXT,
ADD COLUMN "tire_type" "tire_type",
ADD COLUMN "min_stock" INTEGER;

-- Two categories to start with; the Manager can add more from Parts.
INSERT INTO "part_categories" ("id", "slug", "name", "sort_order", "aliases", "kind", "updated_at")
VALUES
  (gen_random_uuid(), 'repair-parts', 'Repair parts', 100, ARRAY['repuestos']::TEXT[], 'repair', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'tires', 'Tires', 200, ARRAY['llantas', 'cauchos']::TEXT[], 'tire', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
