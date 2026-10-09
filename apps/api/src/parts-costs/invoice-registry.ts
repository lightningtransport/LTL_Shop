import { BadRequestException, ConflictException } from '@nestjs/common';
import type { AdminInvoiceMatchDto } from '@ltl-shop/shared';
import type { AttachmentOwnerType, Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * LTR-200 / D32, D-PC8: one vendor + invoice number among the purchases **and** outside repairs not voided. Saving
 * takes a lock per vendor first, so two saves of the same invoice cannot both pass the check; each table's partial
 * unique index is the last net.
 */
type Db = Prisma.TransactionClient | PrismaService;
export type InvoiceKind = 'part_purchase' | 'outside_repair';

const dateOnly = (value: Date) => value.toISOString().slice(0, 10);

export async function lockVendorInvoices(tx: Prisma.TransactionClient, vendorId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${vendorId}`}))`;
}

export async function findInvoice(
  db: Db,
  vendorId: string,
  invoiceNorm: string,
  /** The record being edited (ids are unique across both tables). */
  exceptId?: string,
): Promise<AdminInvoiceMatchDto | null> {
  const notSelf = (_kind: InvoiceKind) => (exceptId ? { id: { not: exceptId } } : {});
  const select = { id: true, invoiceNumber: true, invoiceDate: true, vendor: { select: { name: true } } } as const;
  const [purchase, repair] = await Promise.all([
    db.partPurchase.findFirst({ where: { vendorId, invoiceNorm, voidedAt: null, ...notSelf('part_purchase') }, select: { ...select, totalCents: true } }),
    db.outsideRepair.findFirst({ where: { vendorId, invoiceNorm, voidedAt: null, ...notSelf('outside_repair') }, select: { ...select, amountCents: true } }),
  ]);
  if (purchase) {
    return { exists: true, kind: 'part_purchase', id: purchase.id, invoiceNumber: purchase.invoiceNumber, invoiceDate: dateOnly(purchase.invoiceDate), totalCents: purchase.totalCents, vendorName: purchase.vendor.name };
  }
  if (repair) {
    return { exists: true, kind: 'outside_repair', id: repair.id, invoiceNumber: repair.invoiceNumber, invoiceDate: dateOnly(repair.invoiceDate), totalCents: repair.amountCents, vendorName: repair.vendor.name };
  }
  return null;
}

export function duplicateInvoice(match: AdminInvoiceMatchDto | null) {
  return new ConflictException({
    code: 'DUPLICATE_INVOICE',
    message: match ? `${match.vendorName} invoice ${match.invoiceNumber} is already saved.` : 'That invoice is already saved.',
    ...(match ?? {}),
  });
}

/** Locks the vendor and refuses an invoice number already saved on a purchase or an outside repair. */
export async function assertNewInvoice(tx: Prisma.TransactionClient, vendorId: string, invoiceNorm: string, exceptId?: string) {
  await lockVendorInvoices(tx, vendorId);
  const match = await findInvoice(tx, vendorId, invoiceNorm, exceptId);
  if (match) throw duplicateInvoice(match);
}

/** Ties an uploaded file to its record; the previous file of that record is set aside (not deleted). */
export async function linkAttachment(tx: Prisma.TransactionClient, ownerType: AttachmentOwnerType, ownerId: string, attachmentId: string | null | undefined) {
  if (attachmentId === undefined) return;
  await tx.attachment.updateMany({
    where: { ownerType, ownerId, deletedAt: null, ...(attachmentId ? { id: { not: attachmentId } } : {}) },
    data: { deletedAt: new Date() },
  });
  if (!attachmentId) return;
  const linked = await tx.attachment.updateMany({
    where: { id: attachmentId, deletedAt: null, OR: [{ ownerId: null }, { ownerType, ownerId }] },
    data: { ownerType, ownerId },
  });
  if (!linked.count) throw new BadRequestException({ code: 'ATTACHMENT_NOT_FOUND', message: 'The invoice file was not found. Attach it again.' });
}

export async function currentAttachment(db: Db, ownerType: AttachmentOwnerType, ownerId: string) {
  return db.attachment.findFirst({
    where: { ownerType, ownerId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true, contentType: true, sizeBytes: true },
  });
}

export async function filedOwners(db: Db, ownerType: AttachmentOwnerType, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const rows = await db.attachment.findMany({ where: { ownerType, ownerId: { in: ids }, deletedAt: null }, select: { ownerId: true } });
  return new Set(rows.map((row) => row.ownerId!));
}
