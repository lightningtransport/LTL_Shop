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
  /** PC-2: the last purchase line of this part ("$24.10 · Oct 6 · FleetPride"), voided purchases left out. */
  lastPaid: { unitCostCents: number; invoiceDate: string; vendorName: string } | null;
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

// ── PC-2: purchases ──────────────────────────────────────────────────────────────────────────────────────────

/** D-PC8: "INV 88412093" and "inv-88412093" are the same invoice number. */
export function normalizeInvoiceNumber(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** "2", "1.5", "0.25" as hundredths (quantity is Decimal(10,2)). Not a positive amount with two decimals: undefined. */
export function parseQuantityToHundredths(value: string | number): number | undefined {
  const text = String(value).trim().replace(/,/g, '');
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(text);
  if (!match) return undefined;
  const hundredths = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return hundredths > 0 && hundredths < 10_000_000_000 ? hundredths : undefined;
}

/** Quantity × unit cost, rounded to the cent. The API recomputes it; the screen only shows it. */
export function lineTotalCents(quantityHundredths: number, unitCostCents: number): number {
  return Math.round((quantityHundredths * unitCostCents) / 100);
}

export const INVOICE_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'] as const;
export const INVOICE_FILE_MAX_BYTES = 10 * 1024 * 1024;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid date');

export const adminPurchaseLineSchema = z.object({
  partId: z.string().uuid().nullable().optional(),
  /** "Other (not in catalog)": its description. With a part, the part's name is copied. */
  description: z.string().trim().max(200).optional(),
  quantity: z.union([z.string(), z.number()]).refine((value) => parseQuantityToHundredths(value) !== undefined, 'Quantity must be more than 0, with at most 2 decimals'),
  unitCostCents: moneyCents,
  truckId: z.string().uuid().nullable().optional(),
}).refine((line) => Boolean(line.partId || line.description?.trim()), { message: 'Pick a part or describe it', path: ['description'] });

export const adminSavePurchaseSchema = z.object({
  vendorId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(60),
  invoiceDate: isoDate,
  taxCents: moneyCents.default(0),
  freightCents: moneyCents.default(0),
  notes: optionalText(1000),
  lines: z.array(adminPurchaseLineSchema).min(1).max(100),
  attachmentId: z.string().uuid().nullable().optional(),
  /** What the screen shows as the total; a save whose total does not match is refused (A57). */
  expectedTotalCents: z.number().int().optional(),
});

export const adminVoidSchema = z.object({ reason: z.string().trim().min(1).max(300) });

export const adminPurchasesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  vendorId: z.string().uuid().optional(),
  /** A Truck id, or `none` for "No truck · shop stock". */
  truckId: z.union([z.string().uuid(), z.literal('none')]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  noFile: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
});

export const adminInvoiceCheckQuerySchema = z.object({
  vendorId: z.string().uuid(),
  number: z.string().trim().min(1).max(60),
  excludeId: z.string().uuid().optional(),
});

export const adminRequestAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: z.enum(INVOICE_FILE_TYPES),
  sizeBytes: z.number().int().min(1).max(INVOICE_FILE_MAX_BYTES),
});

export type AdminPurchaseLineInput = z.input<typeof adminPurchaseLineSchema>;
export type AdminSavePurchaseInput = z.input<typeof adminSavePurchaseSchema>;
export type AdminRequestAttachmentInput = z.input<typeof adminRequestAttachmentSchema>;

export interface AdminTruckRefDto {
  id: string;
  truckNumber: string;
}

export interface AdminPurchaseSummaryDto {
  id: string;
  vendor: { id: string; name: string };
  invoiceNumber: string;
  invoiceDate: string;
  lineCount: number;
  trucks: AdminTruckRefDto[];
  hasNoTruckLines: boolean;
  totalCents: number;
  hasFile: boolean;
  voidedAt: string | null;
}

export interface AdminPurchaseListDto {
  items: AdminPurchaseSummaryDto[];
  /** Over the filtered purchases that are not voided. */
  totals: { count: number; totalCents: number; noTruckCents: number };
}

export interface AdminPurchaseLineDto {
  id: string;
  partId: string | null;
  description: string;
  partNumber: string | null;
  quantity: string;
  unitCostCents: number;
  lineTotalCents: number;
  truck: AdminTruckRefDto | null;
}

export interface AdminAttachmentDto {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface AdminPurchaseDetailDto extends AdminPurchaseSummaryDto {
  subtotalCents: number;
  taxCents: number;
  freightCents: number;
  notes: string | null;
  lines: AdminPurchaseLineDto[];
  /** D-PC2: each truck's lines plus its share of tax and freight; what the Truck's costs show. */
  truckShares: Array<AdminTruckRefDto & { amountCents: number }>;
  noTruckCents: number;
  attachment: AdminAttachmentDto | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  voidedBy: { id: string; name: string } | null;
  voidReason: string | null;
}

/** 409 DUPLICATE_INVOICE and the invoice check: the record that already has that number. */
export interface AdminInvoiceMatchDto {
  exists: boolean;
  kind?: 'part_purchase' | 'outside_repair';
  id?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalCents?: number;
  vendorName?: string;
}

/** The cost each part was last paid to a vendor (D-PC6: a new purchase starts from it). */
export interface AdminLastPaidDto {
  partId: string;
  unitCostCents: number;
  invoiceDate: string;
  vendorId: string;
  vendorName: string;
}

export interface AdminPurchaseFormDataDto {
  trucks: Array<AdminTruckRefDto & { make: string | null; model: string | null }>;
  lastPaid: AdminLastPaidDto[];
  filesEnabled: boolean;
}

export interface AdminAttachmentUploadDto {
  id: string;
  uploadUrl: string;
}

// ── The Truck cost ledger's split (D-PC2), shared so New purchase shows what the API will write ─────────────

export type TruckGroup = { truckId: string | null; baseCents: number };

/**
 * D-PC2: tax and freight are shared among the invoice's groups (each truck, and "no truck") in proportion to their
 * lines, whole cents only; the cents left go one by one to the biggest groups. The shares always add up to `extra`.
 */
export function allocateExtra(groups: TruckGroup[], extraCents: number): Map<string | null, number> {
  const shares = new Map<string | null, number>(groups.map((group) => [group.truckId, 0]));
  if (!extraCents || !groups.length) return shares;
  const subtotal = groups.reduce((sum, group) => sum + group.baseCents, 0);
  const ordered = [...groups].sort((left, right) => right.baseCents - left.baseCents);
  if (subtotal === 0) {
    shares.set(ordered[0].truckId, extraCents);
    return shares;
  }
  let given = 0;
  for (const group of groups) {
    const share = Math.floor((extraCents * group.baseCents) / subtotal);
    shares.set(group.truckId, share);
    given += share;
  }
  for (let index = 0; given < extraCents; index = (index + 1) % ordered.length, given += 1) {
    shares.set(ordered[index].truckId, shares.get(ordered[index].truckId)! + 1);
  }
  return shares;
}

/** Lines grouped by truck (null = no truck), each group with its share of tax and freight. */
export function truckAmounts(lines: Array<{ truckId: string | null; lineTotalCents: number }>, extraCents: number) {
  const bases = new Map<string | null, number>();
  for (const line of lines) bases.set(line.truckId, (bases.get(line.truckId) ?? 0) + line.lineTotalCents);
  const groups = [...bases.entries()].map(([truckId, baseCents]) => ({ truckId, baseCents }));
  const extra = allocateExtra(groups, extraCents);
  return groups.map((group) => ({ truckId: group.truckId, amountCents: group.baseCents + (extra.get(group.truckId) ?? 0) }));
}


// ── PC-3: outside repairs ────────────────────────────────────────────────────────────────────────────────────

export const adminSaveOutsideRepairSchema = z.object({
  truckId: z.string().uuid(),
  vendorId: z.string().uuid(),
  invoiceNumber: z.string().trim().min(1).max(60),
  invoiceDate: isoDate,
  description: z.string().trim().min(1).max(500),
  amountCents: moneyCents,
  /** The Job sent to an external shop (out now, or back within 90 days). Null = not tied to a Job. */
  workOrderJobId: z.string().uuid().nullable().optional(),
  notes: optionalText(1000),
  attachmentId: z.string().uuid().nullable().optional(),
});

export const adminOutsideRepairsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  vendorId: z.string().uuid().optional(),
  truckId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  noFile: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
});

export const adminExternalJobsQuerySchema = z.object({ truckId: z.string().uuid() });

export type AdminSaveOutsideRepairInput = z.input<typeof adminSaveOutsideRepairSchema>;

/** A Job that went to an external shop: still out, or back within 90 days. */
export interface AdminExternalJobDto {
  jobId: string;
  displayName: string;
  workOrderId: string;
  workOrderDisplayId: string;
  kind: 'part' | 'truck' | null;
  sentAt: string | null;
  returnedAt: string | null;
  /** Still at the external shop. */
  out: boolean;
}

export interface AdminOutsideRepairSummaryDto {
  id: string;
  truck: AdminTruckRefDto;
  vendor: { id: string; name: string };
  invoiceNumber: string;
  invoiceDate: string;
  description: string;
  amountCents: number;
  job: { id: string; displayName: string; workOrderId: string; workOrderDisplayId: string; kind: 'part' | 'truck' | null } | null;
  hasFile: boolean;
  voidedAt: string | null;
}

export interface AdminOutsideRepairListDto {
  items: AdminOutsideRepairSummaryDto[];
  totals: { count: number; totalCents: number };
}

export interface AdminOutsideRepairDetailDto extends AdminOutsideRepairSummaryDto {
  notes: string | null;
  attachment: AdminAttachmentDto | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  voidedBy: { id: string; name: string } | null;
  voidReason: string | null;
}

/** On the admin Work Order: the outside invoices tied to a Job (Manager and System Admin only). */
export interface AdminJobOutsideInvoiceDto {
  id: string;
  amountCents: number;
  vendorName: string;
}

// ── PC-4: Truck → Costs ──────────────────────────────────────────────────────────────────────────────────────

export const adminTruckCostsQuerySchema = z.object({ from: isoDate.optional(), to: isoDate.optional() });

export interface AdminTruckCostEntryDto {
  id: string;
  occurredOn: string;
  kind: 'part_purchase' | 'outside_repair' | 'labor' | 'internal_invoice';
  amountCents: number;
  description: string;
  sourceType: string;
  sourceId: string;
  workOrder: { id: string; displayId: string } | null;
  /** A reversal row: `voided` when its record was voided, `corrected` when it was edited. */
  reversal: 'voided' | 'corrected' | null;
}

export interface AdminTruckCostsDto {
  truck: AdminTruckRefDto;
  from: string | null;
  to: string | null;
  totals: { partsCents: number; outsideCents: number; totalCents: number };
  /** One per month with costs, oldest first ("2026-10"). */
  months: Array<{ month: string; partsCents: number; outsideCents: number }>;
  entries: AdminTruckCostEntryDto[];
  /** D18 / D21: hours on closed sessions of this truck's Work Orders in the period. No rate yet, so no amount. */
  laborHours: number;
}
