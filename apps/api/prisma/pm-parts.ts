import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type PmPartFitment = { make: string | null; model: string | null };
export type CanonicalPmPart = {
  sourceId: number;
  category: string;
  partNumber: string;
  displayName: string;
  fitments: PmPartFitment[];
};

export const PM_PART_CATEGORIES = [
  { source: 'Oil Filter 1', name: 'Oil Filter 1 Unit', slug: 'oil-filter-1-unit', aliases: ['Oil Filter 1'] },
  { source: 'Oil Filter 2', name: 'Oil Filter 2 Unit', slug: 'oil-filter-2-unit', aliases: ['Oil Filter 2'] },
  { source: 'Fuel Filters', name: 'Fuel Filter', slug: 'fuel-filter', aliases: ['Fuel Filters'] },
  { source: 'Papel Fuel Filter', name: 'Paper Fuel Filter', slug: 'paper-fuel-filter', aliases: ['Papel Fuel Filter'] },
  { source: 'Cabin Air Filter', name: 'Cabin Air Filter', slug: 'cabin-air-filter', aliases: [] },
  { source: 'Air Dryer Filter', name: 'Desiccant Filter', slug: 'desiccant-filter', aliases: ['Air Dryer Filter'] },
  { source: 'Engine Air Filter', name: 'Engine Air Filter', slug: 'engine-air-filter', aliases: [] },
  { source: 'Wiper Blades', name: 'Wiper Blades', slug: 'wiper-blades', aliases: [] },
  { source: 'Coolant Filter', name: 'Coolant Filter', slug: 'coolant-filter', aliases: [] },
] as const;

const categoryBySource = new Map<string, (typeof PM_PART_CATEGORIES)[number]>(
  PM_PART_CATEGORIES.map((category) => [category.source, category]),
);
const fixturePath = resolve(__dirname, '../test/fixtures/pm-parts.csv');

function normalizeTitle(value: string) {
  const titled = value
    .replace(/\bpepel\b/gi, 'Paper')
    .replace(/\bpapel\b/gi, 'Paper')
    .replace(/\bmac(?=\s)/gi, 'Mack')
    .replace(/\bdesc\.?\b/gi, 'Desiccant')
    .replace(/\bsepartr\b/gi, 'Separator')
    .replace(/\bwipers blades\b/gi, 'Wiper Blades')
    .replace(/^wipers$/i, 'Wiper Blades')
    .replace(/\bdesiccant\.\s*/gi, 'Desiccant ')
    .replace(/\bfilter\s*,\s*fuel\s*,\s*secondary\s*,\s*(us\d+)\s*,\s*(us\d+)\b/gi, 'Fuel Filter, Secondary, $1, $2')
    .replace(/\(1unit\)/gi, '(1 Unit)')
    .replace(/\bfilter\s+filter\b/gi, 'Filter')
    .replace(/\s+/g, ' ')
    .trim();

  const words = titled.toLocaleLowerCase('en-US').replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  return words
    .replace(/\bPETERBILT\b/gi, 'Peterbilt')
    .replace(/\bVOLVO\b/gi, 'Volvo')
    .replace(/\bFREIGHTLINER\b/gi, 'Freightliner')
    .replace(/\bMACK\b/gi, 'Mack')
    .replace(/\bPACCAR\b/gi, 'Paccar')
    .replace(/\bCUMMINS\b/gi, 'Cummins')
    .replace(/\bLUBER[ -]?FINER\b/gi, 'Luber-Finer')
    .replace(/\bFLEETGUARD\b/gi, 'Fleetguard')
    .replace(/\bWIX\b/gi, 'WIX')
    .replace(/\bDONALDSON\b/gi, 'Donaldson')
    .replace(/\bBENDIX\b/gi, 'Bendix')
    .replace(/\bDETROIT\b/gi, 'Detroit')
    .replace(/\bMP7\b/gi, 'MP7')
    .replace(/\bEPA\b/gi, 'EPA')
    .replace(/\bVN\b/gi, 'VN')
    .replace(/\bUS(17|21)\b/gi, 'US$1')
    .replace(/\bF\/W\b/gi, 'F/W')
    .replace(/\bA\/C\b/gi, 'A/C');
}

function inferFitments(partNumber: string, displayName: string): PmPartFitment[] {
  const text = `${partNumber} ${displayName}`.toLowerCase();
  const makes = [
    ['Peterbilt', /peterbilt/],
    ['Volvo', /volvo/],
    ['Mack', /\bmack\b|\bmac\s/],
    ['Freightliner', /freightliner/],
  ] as const;
  return makes.filter(([, pattern]) => pattern.test(text)).map(([make]) => ({
    make,
    // Cascadia-specific parts must not be offered to every Freightliner.
    model: make === 'Freightliner' && /cascadia/.test(text) ? 'Cascadia' : null,
  }));
}

/** The fixture is the versioned source of truth for both tests and local seed data. */
export function loadCanonicalPmParts(): CanonicalPmPart[] {
  const canonical = new Map<string, CanonicalPmPart>();
  for (const line of readFileSync(fixturePath, 'utf8')
    .split(/\r?\n/)
    .slice(2)
    .filter(Boolean)) {
      const [id, partNumber, description, sourceCategory, listed, active = ''] = line.split('|');
      if (listed !== '1' || active.trim().toLowerCase() === 'no') continue;
      const category = categoryBySource.get(sourceCategory.trim());
      if (!category) throw new Error(`Unknown PM part category: ${sourceCategory}`);
      const displayName = normalizeTitle(description);
      // L9765FXL is duplicated once as generic and once as Peterbilt.  The
      // material is one part, so merge its explicit compatibility instead of
      // presenting two indistinguishable choices.
      const semanticKey = partNumber.trim().toUpperCase() === 'L9765FXL'
        ? `${category.name}|l9765fxl`
        : `${category.name}|${partNumber.trim().toLowerCase()}|${displayName.toLowerCase()}`;
      const incoming: CanonicalPmPart = {
        sourceId: Number(id),
        category: category.name,
        partNumber: partNumber.trim(),
        displayName,
        fitments: inferFitments(partNumber.trim(), displayName),
      };
      const existing = canonical.get(semanticKey);
      if (!existing) {
        canonical.set(semanticKey, incoming);
      } else {
        const fitments = [...existing.fitments, ...incoming.fitments].filter(
          (fitment, index, values) => values.findIndex((value) =>
            value.make === fitment.make && value.model === fitment.model,
          ) === index,
        );
        canonical.set(semanticKey, {
          ...existing,
          fitments,
        });
      }
    }
  return [...canonical.values()];
}
