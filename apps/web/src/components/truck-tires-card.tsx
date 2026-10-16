'use client';

import { TIRE_POSITIONS, TireReadingStatus, type TirePosition } from '@ltl-shop/shared';
import { ArrowDown, ArrowUp, CircleDot } from 'lucide-react';
import { inspectionCopy, type InspectionLocale } from '@/lib/inspection-copy';
import { useTruckInspection } from '@/lib/inspection-data';
import { cn } from '@/lib/utils';
import { MiniTires } from './inspection-sheet';
import { CountChip, SectionCard } from './ui';

const TEXT: Record<string, string> = {
  [TireReadingStatus.WATCH]: 'text-warning-foreground dark:text-warning',
  [TireReadingStatus.FIX]: 'text-destructive-text',
};

/**
 * D41 / J21: the Truck's tires — this visit's reading from the inspection (or the last one of an earlier visit),
 * and how much each tire to watch or fix changed since the reading before.
 */
export function TruckTiresCard({ truckId, locale }: { truckId: string; locale: InspectionLocale }) {
  const copy = inspectionCopy(locale);
  const { data } = useTruckInspection('admin', truckId);
  if (!data) return null;
  const current = data.inspection?.tires ?? [];
  const tires = current.length ? current : data.previousTires;
  const previous = current.length ? new Map(data.previousTires.map((tire) => [tire.position, tire])) : new Map();
  const at = (position: TirePosition) => tires.find((tire) => tire.position === position);
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric' });
  const flagged = TIRE_POSITIONS.map(at).filter((tire) => tire && tire.status !== TireReadingStatus.OK);
  const ok = tires.filter((tire) => tire.status === TireReadingStatus.OK).length;
  const firstPrevious = data.previousTires[0];
  return (
    <SectionCard title={<><CircleDot aria-hidden="true" className="size-4" />{copy.tiresCard}</>} action={tires.length ? <CountChip>{copy.tiresOk(ok)}</CountChip> : null} data-testid="truck-tires">
      {tires.length ? (
        <>
          <MiniTires copy={copy} statusOf={(position) => at(position)?.status ?? null} psiOf={(position) => at(position)?.psi ?? null} />
          {flagged.length ? (
            <ul className="mx-4 space-y-1.5 border-t pt-3">
              {flagged.map((tire) => {
                const before = previous.get(tire!.position);
                const delta = before ? tire!.psi - before.psi : 0;
                return (
                  <li key={tire!.position} className="flex items-center justify-between gap-2">
                    <span><span className="font-medium">{tire!.position}</span> <span className="text-muted-foreground">{tire!.psi} PSI · {tire!.tread}/32</span></span>
                    {before && delta ? (
                      <span className={cn('tnum inline-flex items-center gap-1 text-xs', TEXT[tire!.status])}>
                        {delta < 0 ? <ArrowDown aria-hidden="true" className="size-3.5" /> : <ArrowUp aria-hidden="true" className="size-3.5" />}
                        {copy.sinceLast(delta, date(before.readAt))}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <p className="px-4 pb-4 pt-3 text-xs text-muted-foreground">
            {data.inspection
              ? copy.checkedBy(date(data.inspection.inspectedAt), data.inspection.inspectedBy.name, firstPrevious ? date(firstPrevious.readAt) : null)
              : copy.earlierVisit(date(tires[0].readAt))}
          </p>
        </>
      ) : <p className="p-4 text-muted-foreground">{copy.noTireReadings}</p>}
      {/* D45 / ST-4: what each position has mounted, from the tires taken from stock for it. */}
      {data.installedTires?.length ? (
        <div className="mx-4 mb-4 border-t pt-3" data-testid="truck-installed-tires">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{copy.installedTitle}</p>
          <ul className="space-y-1">
            {TIRE_POSITIONS.map((position) => data.installedTires!.find((tire) => tire.position === position)).filter(Boolean).map((tire) => (
              <li key={tire!.position} className="flex items-center justify-between gap-2">
                <span className="font-medium">{tire!.position}</span>
                <span className="text-muted-foreground">{copy.installedLine(tire!.tireType, tire!.tireSize, date(tire!.installedAt), tire!.workOrderDisplayId)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SectionCard>
  );
}
