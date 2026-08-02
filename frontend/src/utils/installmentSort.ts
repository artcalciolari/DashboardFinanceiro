/** Comparadores de ordenação das seções de parcelamentos. */

type Dated = { effectiveDate: string };
type Described = { description: string };
type Cancelled = { cancelledAt?: string | null };

export function compareOngoingInstallments(
  a: { next?: Dated; group: Described },
  b: { next?: Dated; group: Described }
): number {
  const nextA = a.next ? new Date(a.next.effectiveDate).getTime() : Number.POSITIVE_INFINITY;
  const nextB = b.next ? new Date(b.next.effectiveDate).getTime() : Number.POSITIVE_INFINITY;
  return nextA - nextB || a.group.description.localeCompare(b.group.description);
}

export function compareFinishedInstallments(
  a: { last?: Dated; group: Described },
  b: { last?: Dated; group: Described }
): number {
  const lastA = a.last ? new Date(a.last.effectiveDate).getTime() : 0;
  const lastB = b.last ? new Date(b.last.effectiveDate).getTime() : 0;
  return lastB - lastA || a.group.description.localeCompare(b.group.description);
}

export function compareCancelledInstallments(
  a: { group: Described & Cancelled },
  b: { group: Described & Cancelled }
): number {
  const cancelledA = a.group.cancelledAt ? new Date(a.group.cancelledAt).getTime() : 0;
  const cancelledB = b.group.cancelledAt ? new Date(b.group.cancelledAt).getTime() : 0;
  return cancelledB - cancelledA || a.group.description.localeCompare(b.group.description);
}
