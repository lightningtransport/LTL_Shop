import type { TruckDto } from '@ltl-shop/shared';
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

type TruckInformationLabels = {
  vin: string;
  lastReportedLocation: string;
  locationUpdatedOn: string;
  locale: 'en' | 'es';
};

export function TruckInformationFields({
  truck,
  labels,
}: {
  truck: TruckInformationTruck;
  labels: TruckInformationLabels;
}) {
  return (
    <div className={truckInformationGridClass}>
      <Info label="Make" value={truck.make} />
      <Info label="Model" value={truck.model} />
      <Info label="Year" value={truck.year?.toString()} />
      <Info label="Mileage" value={formatMileage(truck.mileage)} />
      <Info label="Company" value={truck.company} />
      <Info label="Owner" value={truck.owner} />
      <Info
        label={labels.vin}
        value={truck.vin}
        className={truckInformationLongFieldClass}
        valueClassName="break-all"
      />
      <Info
        label={labels.lastReportedLocation}
        value={truck.location}
        className={truckInformationLongFieldClass}
        valueClassName="break-words"
      />
      <Info
        label={labels.locationUpdatedOn}
        value={formatIsoDate(truck.locationUpdatedOn, labels.locale)}
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
      <p className="text-[11px] uppercase tracking-wide text-shop-muted">{label}</p>
      <p className={cn('font-medium', valueClassName)} title={value || undefined}>
        {value || '—'}
      </p>
    </div>
  );
}
