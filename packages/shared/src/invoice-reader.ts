import { normalizeCatalogText } from './catalog';

/**
 * D45 / ST-6 (LTR-226, P30): reads the text lines of a supplier's PDF invoice and **proposes** what New purchase
 * needs. Nothing is saved: the Manager checks every field. Pure, so each supplier's layout can be tested apart.
 *
 * - **Vendor:** the active vendor whose name appears in the text (the longest one wins).
 * - **Invoice # and date:** next to "Invoice" / "Date" words; the date accepts 10/06/2026, 2026-10-06, Oct 6, 2026.
 * - **Lines:** a text line that ends in quantity, unit price and amount (quantity × price = amount, to the cent),
 *   or in quantity and amount. A catalog part number found on the line picks that part.
 * - **Tax, freight, total:** the amounts after those words.
 */

export type InvoiceReaderContext = {
  vendors: Array<{ id: string; name: string }>;
  parts: Array<{ id: string; partNumber: string | null; displayName: string }>;
};

export type InvoiceProposalLine = {
  description: string;
  partId: string | null;
  partNumber: string | null;
  /** "2", "5.5". */
  quantity: string;
  unitCostCents: number;
};

export type InvoiceProposal = {
  vendorId: string | null;
  invoiceNumber: string | null;
  /** YYYY-MM-DD. */
  invoiceDate: string | null;
  lines: InvoiceProposalLine[];
  taxCents: number | null;
  freightCents: number | null;
  totalCents: number | null;
};

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONEY = /\(?-?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})|\(?-?\$?\s?\d+(?:\.\d{1,2})?/g;
const compact = (value: string) => normalizeCatalogText(value).replace(/[^a-z0-9]/g, '');

/** "1,234.50" → 123450; "$12" → 1200. */
export function moneyToCents(raw: string): number | null {
  const negative = /^\(|-/.test(raw.trim());
  const digits = raw.replace(/[^0-9.]/g, '');
  if (!digits || !/\d/.test(digits)) return null;
  const value = Math.round(Number(digits) * 100);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1) return null;
  return date.toISOString().slice(0, 10);
}

function findDate(text: string): string | null {
  let match = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (match) return isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (match) return isoDate(Number(match[3]), Number(match[1]), Number(match[2]));
  match = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (match) return isoDate(Number(match[3]), MONTHS[match[1].toLowerCase()], Number(match[2]));
  return null;
}

/** The amount on the same line after a label ("Sales tax ... 4.37"), the last one on the line. */
function amountAfter(lines: string[], label: RegExp, skip?: RegExp): number | null {
  for (const line of lines) {
    if (!label.test(line) || (skip && skip.test(line))) continue;
    const amounts = [...line.slice(line.search(label)).matchAll(MONEY)].map((match) => moneyToCents(match[0])).filter((value): value is number => value !== null);
    if (amounts.length) return amounts[amounts.length - 1];
  }
  return null;
}

function quantityText(raw: string) {
  const value = Number(raw.replace(/,/g, ''));
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/** A product line: description, then quantity, [unit price], amount at the end. */
function readLine(line: string, parts: InvoiceReaderContext['parts']): InvoiceProposalLine | null {
  if (/\b(sub\s*total|total|tax|freight|shipping|balance|amount due|payment|invoice|page)\b/i.test(line)) return null;
  const tokens = line.trim().split(/\s+/);
  const numbers: Array<{ index: number; raw: string }> = [];
  for (let index = tokens.length - 1; index >= 0 && numbers.length < 3; index -= 1) {
    if (/^\(?-?\$?\d{1,3}(,\d{3})*(\.\d{1,4})?\)?$|^\(?-?\$?\d+(\.\d{1,4})?\)?$/.test(tokens[index])) numbers.unshift({ index, raw: tokens[index] });
    else break;
  }
  if (numbers.length < 2) return null;
  const amount = moneyToCents(numbers[numbers.length - 1].raw);
  if (amount === null || amount <= 0) return null;
  let quantity: number | null = null;
  let unit: number | null = null;
  if (numbers.length === 3) {
    const qty = Number(numbers[0].raw.replace(/[$,()]/g, ''));
    const price = moneyToCents(numbers[1].raw);
    if (qty > 0 && price !== null && Math.abs(Math.round(qty * price) - amount) <= 1) {
      quantity = qty;
      unit = price;
    }
  }
  if (quantity === null) {
    // Quantity and amount only: the unit price is the amount over the quantity.
    const qty = Number(numbers[numbers.length - 2].raw.replace(/[$,()]/g, ''));
    if (!(qty > 0) || !Number.isFinite(qty) || qty > 10000 || numbers[numbers.length - 2].raw.includes('.') && numbers[numbers.length - 2].raw.split('.')[1].length === 2 && qty > 50) return null;
    quantity = qty;
    unit = Math.round(amount / qty);
    if (Math.abs(Math.round(qty * unit) - amount) > 1) return null;
  }
  const description = tokens.slice(0, numbers[0].index).join(' ').trim();
  if (!description || !/[a-z]/i.test(description)) return null;
  const words = description.split(/\s+/).map(compact).filter(Boolean);
  const part = parts.find((item) => item.partNumber && compact(item.partNumber).length >= 3 && words.includes(compact(item.partNumber)))
    ?? parts.find((item) => item.partNumber && compact(item.partNumber).length >= 5 && compact(description).includes(compact(item.partNumber)));
  return {
    description: description.slice(0, 200),
    partId: part?.id ?? null,
    partNumber: part?.partNumber ?? null,
    quantity: quantityText(String(quantity)),
    unitCostCents: unit!,
  };
}

export function readInvoiceLines(textLines: string[], context: InvoiceReaderContext): InvoiceProposal {
  const lines = textLines.map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const all = compact(lines.join(' '));

  const vendor = [...context.vendors]
    .filter((item) => compact(item.name).length >= 3 && all.includes(compact(item.name)))
    .sort((left, right) => compact(right.name).length - compact(left.name).length)[0] ?? null;

  let invoiceNumber: string | null = null;
  for (const line of lines) {
    const match = line.match(/\binv(?:oice)?\.?\s*(?:#|no\.?|num(?:ber)?)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i);
    if (match && /\d/.test(match[1]) && !/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(match[1])) {
      invoiceNumber = match[1];
      break;
    }
  }

  const dateLine = lines.find((line) => /\b(invoice\s*date|date)\b/i.test(line) && findDate(line));
  const invoiceDate = dateLine ? findDate(dateLine) : (lines.map(findDate).find(Boolean) ?? null);

  const proposalLines = lines.map((line) => readLine(line, context.parts)).filter((line): line is InvoiceProposalLine => line !== null);

  return {
    vendorId: vendor?.id ?? null,
    invoiceNumber,
    invoiceDate,
    lines: proposalLines,
    taxCents: amountAfter(lines, /\b(sales\s*)?tax\b/i),
    freightCents: amountAfter(lines, /\b(freight|shipping)\b/i),
    totalCents: amountAfter(lines, /\b(invoice\s*total|total\s*due|amount\s*due|balance\s*due|total)\b/i, /\bsub\s*total\b/i),
  };
}
