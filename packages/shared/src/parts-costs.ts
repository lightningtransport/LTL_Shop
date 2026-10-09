import { z } from 'zod';

/**
 * LTR-200 / D32: Parts & costs, stage 1. Money is always whole cents (D-PC1: USD), never a float.
 * PC-1 is the part catalog (the same one the PM uses) and the vendors.
 */

/** The most a single amount can be: $10,000,000.00. */
export const MAX_MONEY_CENTS = 1_000_000_000;

/**
 * Reads what the Manager typed ("1,250.00", "$1250", "12.5") as cents. Empty is `null`; anything else that is not
 * a non-negative amount with at most two decimals is `undefined` (the form says it is not a valid amount).
 */
export function parseMoneyToCents(text: string): number | null | undefined {
  const clean = text.replace(/[\s$,]/g, '');
  if (!clean) return null;
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(clean);
  if (!match) return undefined;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents <= MAX_MONEY_CENTS ? cents : undefined;
}

function vehicleKey(value: string | null | undefined) {
  return value?.toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '') ?? '';
}

/**
 * HU-PM1: a part with no "Fits" rows serves every truck; otherwise one row must match the truck's make and/or model.
 * The PM picker and the catalog's "in an open PM" rule both use it, so they never disagree.
 */
export function partFitsTruck(
  fits: ReadonlyArray<{ make: string | null; model: string | null }>,
  truck: { make: string | null; model: string | null },
): boolean {
  if (!fits.length) return true;
  const make = vehicleKey(truck.make);
  const model = vehicleKey(truck.model);
  return fits.some((fit) => (!fit.make || vehicleKey(fit.make) === make) && (!fit.model || vehicleKey(fit.model) === model));
}

/** "$1,250.00" — cents as dollars for the screen. */
export function formatCents(cents: number, locale: 'en' | 'es' = 'en'): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

/** "1250.00" — cents as the text an input starts with. */
export function centsToInput(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
}

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();
const moneyCents = z.number().int().min(0).max(MAX_MONEY_CENTS);

/** "Fits": no rows = all trucks; each row is a make, a model, or a make and its model. */
export const adminPartFitSchema = z.object({
  make: z.string().trim().max(60).transform((value) => value || null).nullable().optional(),
  model: z.string().trim().max(60).transform((value) => value || null).nullable().optional(),
}).refine((value) => Boolean(value.make || value.model), { message: 'A make or a model' });

export const adminCreatePartSchema = z.object({
  categoryId: z.string().uuid(),
  partNumber: optionalText(80),
  displayName: z.string().trim().min(1).max(160),
  fits: z.array(adminPartFitSchema).max(20).default([]),
  unitCostCents: moneyCents.nullable().optional(),
  defaultVendorId: z.string().uuid().nullable().optional(),
});

export const adminUpdatePartSchema = z.object({
  partNumber: optionalText(80),
  displayName: z.string().trim().min(1).max(160).optional(),
  fits: z.array(adminPartFitSchema).max(20).optional(),
  unitCostCents: moneyCents.nullable().optional(),
  defaultVendorId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), { message: 'Nothing to change' });

export const adminPartsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  make: z.string().trim().max(60).optional(),
  includeInactive: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
});

export const adminCreateVendorSchema = z.object({
  name: z.string().trim().min(1).max(120),
  doesParts: z.boolean().default(true),
  doesRepairs: z.boolean().default(false),
  phone: optionalText(40),
  email: z.string().trim().max(160).email().or(z.literal('')).transform((value) => value || null).nullable().optional(),
  accountNumber: optionalText(80),
  notes: optionalText(1000),
}).refine((value) => value.doesParts || value.doesRepairs, { message: 'A vendor sells parts, does repairs, or both', path: ['doesParts'] });

export const adminUpdateVendorSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  doesParts: z.boolean().optional(),
  doesRepairs: z.boolean().optional(),
  phone: optionalText(40),
  email: z.string().trim().max(160).email().or(z.literal('')).transform((value) => value || null).nullable().optional(),
  accountNumber: optionalText(80),
  notes: optionalText(1000),
  active: z.boolean().optional(),
}).refine((value) => Object.values(value).some((field) => field !== undefined), { message: 'Nothing to change' });

export type AdminCreatePartInput = z.input<typeof adminCreatePartSchema>;
export type AdminUpdatePartInput = z.input<typeof adminUpdatePartSchema>;
export type AdminCreateVendorInput = z.input<typeof adminCreateVendorSchema>;
export type AdminUpdateVendorInput = z.input<typeof adminUpdateVendorSchema>;

export interface AdminPartFitDto {
  make: string | null;
  model: string | null;
}

/** A PM in progress that has this part picked: the part cannot be turned off or lose that truck's make (A54). */
export interface AdminPartOpenPmDto {
  workOrderId: string;
  displayId: string;
  truckId: string;
  truckNumber: string;
}

export interface AdminPartDto {
  id: string;
  categoryId: string;
  partNumber: string | null;
  displayName: string;
  active: boolean;
  source: 'seed' | 'app';
  /** D-PC6: the reference cost, set by the Manager. Null = "No cost yet". */
  unitCostCents: number | null;
  defaultVendor: { id: string; name: string } | null;
  /** Empty = all trucks. */
  fits: AdminPartFitDto[];
  usedInPmCount: number;
  lastUsedAt: string | null;
  openPms: AdminPartOpenPmDto[];
}

export interface AdminPartCategoryDto {
  id: string;
  name: string;
  parts: AdminPartDto[];
}

export interface AdminPartsCatalogDto {
  categories: AdminPartCategoryDto[];
  /** The makes the trucks have, for "Fits" and its filter. */
  truckMakes: string[];
  /** How many parts have a reference cost (first use: none). */
  costedPartCount: number;
}

export interface AdminVendorDto {
  id: string;
  name: string;
  doesParts: boolean;
  doesRepairs: boolean;
  phone: string | null;
  email: string | null;
  accountNumber: string | null;
  notes: string | null;
  active: boolean;
  /** Parts that have it as their usual vendor. */
  partCount: number;
}
