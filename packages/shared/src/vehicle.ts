/**
 * LTR-113: truck makes the shop sees, spelled the way the Shop shows them. Make and
 * Model decide which parts fit a truck (`partFitsTruck`) and fill the Parts catalog's
 * make filter, so "FREIGHTLINER", "Freightliner" and a swapped "CASCADIA / Freightliner"
 * must all end up as one make.
 */
export const KNOWN_TRUCK_MAKES = [
  'Freightliner',
  'Kenworth',
  'Peterbilt',
  'Volvo',
  'Mack',
  'International',
  'Western Star',
  'Navistar',
  'Sterling',
  'Hino',
  'Isuzu',
  'Mitsubishi Fuso',
  'Ford',
  'Chevrolet',
  'GMC',
  'Ram',
] as const;

function clean(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}

function knownMake(value: string | null): string | null {
  if (!value) return null;
  const key = value.toLocaleLowerCase('en-US');
  return KNOWN_TRUCK_MAKES.find((make) => make.toLocaleLowerCase('en-US') === key) ?? null;
}

/** "Mack Anthem" → Mack + "Anthem". The longest make wins ("Western Star" before a shorter one). */
function splitMakePrefix(value: string): { make: string; rest: string } | null {
  const key = value.toLocaleLowerCase('en-US');
  const make = [...KNOWN_TRUCK_MAKES]
    .sort((a, b) => b.length - a.length)
    .find((candidate) => key.startsWith(`${candidate.toLocaleLowerCase('en-US')} `));
  if (!make) return null;
  const rest = value.slice(make.length).trim();
  return rest ? { make, rest } : null;
}

/**
 * LTR-113: one rule for every way Make and Model reach a truck (Ninox import, Samsara
 * connect, the Shop's truck form):
 * - a known make is spelled one way ("FREIGHTLINER" → "Freightliner");
 * - swapped fields are put back (Make "CASCADIA", Model "Freightliner" → Freightliner / CASCADIA);
 * - a Make that holds both ("Mack Anthem") is split when Model is empty or says the same.
 * Anything it does not recognise stays as typed (only extra spaces go).
 */
export function normalizeMakeModel(
  makeInput: string | null | undefined,
  modelInput: string | null | undefined,
): { make: string | null; model: string | null } {
  let make = clean(makeInput);
  let model = clean(modelInput);

  if (!knownMake(make) && knownMake(model)) [make, model] = [model, make];

  const known = knownMake(make);
  if (known) return { make: known, model };

  if (make) {
    const split = splitMakePrefix(make);
    if (split && (!model || model.toLocaleLowerCase('en-US') === split.rest.toLocaleLowerCase('en-US'))) {
      return { make: split.make, model: model ?? split.rest };
    }
  }
  return { make, model };
}
