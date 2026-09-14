-- LTR-24: align Job Catalog to Cristian's 15 categories + discrete jobs.
-- Idempotent. Remaps CURRENT names; does not delete Work Orders or catalog jobs.
-- CRITICAL: job_categories.name for PM stays exactly 'PM' (API/UI detection).

CREATE TEMP TABLE catalog_target_categories (
  name TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL,
  legacy_names TEXT[] NOT NULL
) ON COMMIT DROP;

INSERT INTO catalog_target_categories (name, sort_order, legacy_names) VALUES
  ('PM', 0, ARRAY[]::TEXT[]),
  ('Inspection', 1, ARRAY[]::TEXT[]),
  ('Engine & Emissions', 2, ARRAY['Engine']::TEXT[]),
  ('Fuel System', 3, ARRAY[]::TEXT[]),
  ('Cooling System', 4, ARRAY[]::TEXT[]),
  ('Electrical & Starting', 5, ARRAY['Electrical']::TEXT[]),
  ('Air & Brake System', 6, ARRAY['Brakes', 'Air System']::TEXT[]),
  ('Suspension & Steering', 7, ARRAY['Suspension', 'Alignment']::TEXT[]),
  ('Transmission & Drivetrain', 8, ARRAY['Transmission']::TEXT[]),
  ('Tires & Wheels', 9, ARRAY['Tires']::TEXT[]),
  ('HVAC / A/C', 10, ARRAY[]::TEXT[]),
  ('Cab, Body & Glass', 11, ARRAY[]::TEXT[]),
  ('Trailer', 12, ARRAY[]::TEXT[]),
  ('Road Service & Towing', 13, ARRAY[]::TEXT[]),
  ('Other', 14, ARRAY[]::TEXT[]);

DO $$
DECLARE
  target RECORD;
  winner_id UUID;
  loser_ids UUID[];
BEGIN
  FOR target IN SELECT * FROM catalog_target_categories ORDER BY sort_order LOOP
    SELECT id INTO winner_id
    FROM job_categories
    WHERE name = target.name OR name = ANY(target.legacy_names)
    ORDER BY CASE WHEN name = target.name THEN 0 ELSE 1 END, created_at
    LIMIT 1;

    IF winner_id IS NULL THEN
      INSERT INTO job_categories (id, name, status, sort_order, created_at, updated_at)
      VALUES (gen_random_uuid(), target.name, 'active', target.sort_order, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id INTO winner_id;
    ELSE
      UPDATE job_categories
      SET name = target.name,
          status = 'active',
          sort_order = target.sort_order,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = winner_id;
    END IF;

    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO loser_ids
    FROM job_categories
    WHERE id <> winner_id
      AND (name = target.name OR name = ANY(target.legacy_names));

    IF array_length(loser_ids, 1) IS NOT NULL THEN
      UPDATE work_orders
      SET primary_category_id = winner_id, updated_at = CURRENT_TIMESTAMP
      WHERE primary_category_id = ANY(loser_ids);

      UPDATE work_order_jobs
      SET category_id = winner_id
      WHERE category_id = ANY(loser_ids);

      UPDATE catalog_jobs
      SET category_id = winner_id, updated_at = CURRENT_TIMESTAMP
      WHERE category_id = ANY(loser_ids);

      UPDATE job_categories
      SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY(loser_ids);
    END IF;
  END LOOP;
END $$;

UPDATE catalog_jobs job
SET category_id = category.id, status = 'active', updated_at = CURRENT_TIMESTAMP
FROM job_categories category
WHERE job.display_name = 'Cooling System'
  AND category.name = 'Cooling System'
  AND job.category_id <> category.id;

CREATE TEMP TABLE catalog_target_jobs (
  category TEXT NOT NULL,
  display_name TEXT NOT NULL,
  aliases TEXT[] NOT NULL
) ON COMMIT DROP;

INSERT INTO catalog_target_jobs (category, display_name, aliases) VALUES
  ('PM', 'PM A Service', ARRAY['PM A', 'servicio PM A']),
  ('PM', 'PM B Service', ARRAY['PM B', 'servicio PM B']),
  ('PM', 'Oil Change', ARRAY['oil', 'cambio de aceite']),
  ('PM', 'Filter Service', ARRAY['filters', 'filtros']),
  ('PM', 'Lubrication', ARRAY['lube', 'lubricación', 'lubricacion']),
  ('PM', 'Scheduled Maintenance', ARRAY['mantenimiento programado']),
  ('Inspection', 'DOT Inspection', ARRAY['DOT', 'inspección DOT', 'inspeccion DOT']),
  ('Inspection', 'Annual Inspection', ARRAY['inspección anual', 'inspeccion anual']),
  ('Inspection', 'General Inspection', ARRAY['revisión general', 'revision general']),
  ('Engine & Emissions', 'Engine Repair', ARRAY['motor', 'engine']),
  ('Engine & Emissions', 'EGR Service', ARRAY['EGR']),
  ('Engine & Emissions', 'Turbo Inspect', ARRAY['turbo']),
  ('Engine & Emissions', 'Derate Diagnose', ARRAY['derate']),
  ('Engine & Emissions', 'Engine Leak Repair', ARRAY['oil leak', 'engine leak', 'fuga de aceite']),
  ('Engine & Emissions', 'Seal Replacement', ARRAY['seals', 'sellos']),
  ('Engine & Emissions', 'DPF/DEF Service', ARRAY['DPF', 'DEF', 'DPF DEF']),
  ('Fuel System', 'Fuel Tank', ARRAY['tanque de combustible']),
  ('Fuel System', 'Fuel Lines', ARRAY['líneas de combustible', 'lineas de combustible']),
  ('Fuel System', 'Fuel Filters', ARRAY['filtro de combustible']),
  ('Fuel System', 'Fuel Leak', ARRAY['fuga de combustible']),
  ('Cooling System', 'Cooling System', ARRAY['cooling', 'sistema de enfriamiento']),
  ('Cooling System', 'Coolant Service', ARRAY['coolant', 'refrigerante']),
  ('Cooling System', 'Radiator', ARRAY['radiador']),
  ('Cooling System', 'Expansion Tank', ARRAY['tanque de expansión', 'tanque de expansion']),
  ('Cooling System', 'Cooling Hoses', ARRAY['mangueras de enfriamiento']),
  ('Electrical & Starting', 'Battery', ARRAY['batería', 'bateria']),
  ('Electrical & Starting', 'Alternator', ARRAY['alternador']),
  ('Electrical & Starting', 'Starter', ARRAY['marcha', 'arrancador']),
  ('Electrical & Starting', 'Wiring', ARRAY['cableado']),
  ('Electrical & Starting', 'Lights', ARRAY['luces']),
  ('Electrical & Starting', 'ABS Electrical', ARRAY['ABS']),
  ('Electrical & Starting', 'ABS Sensor Replacement', ARRAY['ABS sensor']),
  ('Electrical & Starting', 'Truck Won''t Start', ARRAY['no start', 'no arranca']),
  ('Air & Brake System', 'Brake Inspection', ARRAY['brakes', 'frenos']),
  ('Air & Brake System', 'Brake Chambers', ARRAY['chambers', 'cámaras de freno', 'camaras de freno']),
  ('Air & Brake System', 'Inspect Air System', ARRAY['air system']),
  ('Air & Brake System', 'Replace Air Hose', ARRAY['air hose']),
  ('Air & Brake System', 'Air Lines', ARRAY['líneas de aire', 'lineas de aire']),
  ('Air & Brake System', 'Air Leak', ARRAY['fuga de aire']),
  ('Air & Brake System', 'Air Dryer', ARRAY['secador de aire']),
  ('Air & Brake System', 'Valves', ARRAY['válvulas', 'valvulas']),
  ('Suspension & Steering', 'Suspension Inspection', ARRAY['suspension inspect', 'inspect suspension', 'suspensión', 'suspension']),
  ('Suspension & Steering', '3 in 1', ARRAY['3in1', '3-in-1', '3 in one', 'three in one']),
  ('Suspension & Steering', 'Air Bag Replacement', ARRAY['air bags', 'airbags', 'bolsas de aire']),
  ('Suspension & Steering', 'Shock Replacement', ARRAY['shocks', 'amortiguadores']),
  ('Suspension & Steering', 'Leveling Valve', ARRAY['leveling']),
  ('Suspension & Steering', 'Torque Rod', ARRAY[]::TEXT[]),
  ('Suspension & Steering', 'Axle', ARRAY['eje']),
  ('Suspension & Steering', 'Alignment', ARRAY['alineación', 'alineacion']),
  ('Suspension & Steering', 'Steering', ARRAY['dirección', 'direccion']),
  ('Transmission & Drivetrain', 'Transmission', ARRAY['transmisión', 'transmision']),
  ('Transmission & Drivetrain', 'Clutch', ARRAY['clutching', 'embrague']),
  ('Transmission & Drivetrain', 'Differential', ARRAY['diferencial']),
  ('Transmission & Drivetrain', 'Driveshaft', ARRAY['cardán', 'cardan']),
  ('Transmission & Drivetrain', 'Axle Shaft', ARRAY['flecha']),
  ('Transmission & Drivetrain', '5th Wheel', ARRAY['fifth wheel', 'quinta rueda']),
  ('Tires & Wheels', 'Tires', ARRAY['llantas']),
  ('Tires & Wheels', 'Rims', ARRAY['rines']),
  ('Tires & Wheels', 'Flat Repair', ARRAY['flats', 'ponchadura']),
  ('Tires & Wheels', 'Tire Rotation', ARRAY['rotación', 'rotacion']),
  ('Tires & Wheels', 'Tire Mounting', ARRAY['mounting', 'montaje']),
  ('Tires & Wheels', 'Hubs', ARRAY['mazas']),
  ('Tires & Wheels', 'Wheel Seals', ARRAY['retén de rueda', 'reten de rueda']),
  ('HVAC / A/C', 'A/C', ARRAY['AC', 'aire acondicionado']),
  ('HVAC / A/C', 'Heater', ARRAY['heater', 'calefacción', 'calefaccion']),
  ('HVAC / A/C', 'Blower Motor', ARRAY['blower']),
  ('HVAC / A/C', 'Climate System', ARRAY['clima']),
  ('Cab, Body & Glass', 'Windshield', ARRAY['parabrisas']),
  ('Cab, Body & Glass', 'Mirrors', ARRAY['espejos']),
  ('Cab, Body & Glass', 'Doors', ARRAY['puertas']),
  ('Cab, Body & Glass', 'Body Work', ARRAY['carrocería', 'carroceria']),
  ('Cab, Body & Glass', 'Wipers', ARRAY['limpiaparabrisas']),
  ('Cab, Body & Glass', 'Mudflaps', ARRAY['loderas']),
  ('Trailer', 'Trailer Repair', ARRAY['trailer', 'reparación de trailer', 'reparacion de trailer']),
  ('Road Service & Towing', 'Road Service', ARRAY['servicio en ruta']),
  ('Road Service & Towing', 'Towing', ARRAY['grúa', 'grua']),
  ('Road Service & Towing', 'Winch Out', ARRAY['winch']),
  ('Road Service & Towing', 'Lockout', ARRAY['llaves', 'lock out']),
  ('Other', 'Uncategorized', ARRAY['other', 'otro']);

INSERT INTO catalog_jobs (id, category_id, display_name, status, created_at, updated_at)
SELECT gen_random_uuid(), category.id, target.display_name, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM catalog_target_jobs target
JOIN job_categories category ON category.name = target.category
WHERE NOT EXISTS (
  SELECT 1
  FROM catalog_jobs job
  WHERE job.category_id = category.id
    AND job.display_name = target.display_name
);

UPDATE catalog_jobs job
SET status = 'active', updated_at = CURRENT_TIMESTAMP
FROM catalog_target_jobs target
JOIN job_categories category ON category.name = target.category
WHERE job.category_id = category.id
  AND job.display_name = target.display_name
  AND job.status <> 'active';

CREATE TEMP TABLE catalog_target_aliases (
  category TEXT NOT NULL,
  display_name TEXT NOT NULL,
  alias_text TEXT NOT NULL,
  alias_norm TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO catalog_target_aliases (category, display_name, alias_text, alias_norm)
SELECT DISTINCT ON (lower(regexp_replace(alias.alias_text, '[^a-zA-Z0-9]', '', 'g')))
  target.category,
  target.display_name,
  alias.alias_text,
  lower(regexp_replace(alias.alias_text, '[^a-zA-Z0-9]', '', 'g'))
FROM catalog_target_jobs target
CROSS JOIN LATERAL unnest(array_prepend(target.display_name, target.aliases)) AS alias(alias_text)
ORDER BY lower(regexp_replace(alias.alias_text, '[^a-zA-Z0-9]', '', 'g')), alias.alias_text;

INSERT INTO job_aliases (id, catalog_job_id, alias_text, alias_norm)
SELECT gen_random_uuid(), job.id, alias.alias_text, alias.alias_norm
FROM catalog_target_aliases alias
JOIN job_categories category ON category.name = alias.category
JOIN catalog_jobs job ON job.category_id = category.id AND job.display_name = alias.display_name
ON CONFLICT (alias_norm) DO UPDATE
SET alias_text = EXCLUDED.alias_text,
    catalog_job_id = EXCLUDED.catalog_job_id;
