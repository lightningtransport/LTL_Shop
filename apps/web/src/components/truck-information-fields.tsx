import type { TruckDto } from '@ltl-shop/shared';
import type { AdminLocale } from '@/lib/admin-messages';
import { TRUCK_INFORMATION_COPY } from '@/lib/truck-information-copy';
import { formatIsoDate, formatMileage } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  truckInformationFieldClass,
  truckInformationGridClass,
  truckInformationLongFieldClass,
} from './truck-information-layout';

type TruckInformationTruck = Pick<
  TruckDto,
  'make' | 'model' | 'year' | 'mileage' | 'company' | 'owner' | 'vin' | 'location' | 'locationUpdatedOn'
>;

export function TruckInformationFields({
  truck,
  locale,
}: {
  truck: TruckInformationTruck;
  locale: AdminLocale;
}) {
  const messages = TRUCK_INFORMATION_COPY[locale];
  return (
    <div className={truckInformationGridClass}>
      <Info label={messages.make} value={truck.make} />
      <Info label={messages.model} value={truck.model} />
      <Info label={messages.year} value={truck.year?.toString()} />
      <Info label={messages.mileage} value={formatMileage(truck.mileage)} />
      <Info label={messages.company} value={truck.company} />
      <Info label={messages.owner} value={truck.owner} />
      <Info
        label={messages.vin}
        value={truck.vin}
        className={truckInformationLongFieldClass}
        valueClassName="break-all"
      />
      <Info
        label={messages.lastReportedLocation}
        value={truck.location}
        className={truckInformationLongFieldClass}
        valueClassName="break-words"
      />
      <Info
        label={messages.locationUpdatedOn}
        value={formatIsoDate(truck.locationUpdatedOn, locale)}
        className={truckInformationLongFieldClass}
      />
    </div>
  );
}

function Info({
  label,
  value,
  className,
  valueClassName,
}: {
  label: string;
  value?: string | null;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn(truckInformationFieldClass, className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('font-medium', valueClassName)} title={value || undefined}>
        {value || '—'}
      </p>
    </div>
  );
}
