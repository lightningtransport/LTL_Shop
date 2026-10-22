/** LTR-277 §9: an old reason saved as "Merged into Air & Brake System (LTR-24)" shows without the ticket id. */
export function withoutTicketId(reason: string) {
  return reason.replace(/\s*\(LTR-\d+\)\s*$/, '');
}
