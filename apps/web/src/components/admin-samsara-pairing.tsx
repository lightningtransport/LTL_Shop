'use client';

import Link from 'next/link';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import type {
  SamsaraOdometerDto,
  SamsaraPairedTruckDto,
  SamsaraPairingMethod,
  SamsaraPairingWarning,
  SamsaraTruckRefDto,
  SamsaraUnpairedReason,
  SamsaraUnpairedTruckDto,
  SamsaraVehicleRefDto,
} from '@ltl-shop/shared';
import { useDocumentTitle } from './admin-breadcrumb';
import { Badge, Button, DataTable, InlineAlert, LoadFailure, PageHeader, PageSkeleton, SectionCard } from './ui';
import { useAdminSamsaraPairing } from '@/lib/admin-data';
import { fillPlaceholders } from '@/lib/admin-next-step';
import type { AdminLocale, AdminMessages } from '@/lib/admin-messages';

const METHOD_KEY: Record<SamsaraPairingMethod, keyof AdminMessages> = {
  samsara_id: 'samsaraMethodSamsaraId',
  vin: 'samsaraMethodVin',
  number: 'samsaraMethodNumber',
};

const REASON_KEY: Record<SamsaraUnpairedReason, keyof AdminMessages> = {
  no_match: 'samsaraReasonNoMatch',
  ambiguous: 'samsaraReasonAmbiguous',
  shared: 'samsaraReasonShared',
};

const WARNING_KEY: Record<SamsaraPairingWarning, keyof AdminMessages> = {
  stale_samsara_id: 'samsaraWarnStaleId',
  vin_mismatch: 'samsaraWarnVinMismatch',
};

/**
 * D35 / S-1 (OPEN_ISSUES §1w): Setup → Samsara. Shows which Samsara vehicles are our trucks before anything syncs:
 * totals, the matched trucks with how they matched, and the two "left over" lists. Nothing here writes.
 */
export function AdminSamsaraPairing({ locale, messages }: { locale: AdminLocale; messages: AdminMessages }) {
  useDocumentTitle(messages.samsaraTitle);
  const { data, error, isLoading, isValidating, mutate } = useAdminSamsaraPairing();
  const text = (key: keyof AdminMessages) => String(messages[key]);

  if (isLoading && !data) return <PageSkeleton label={messages.samsaraTitle} />;
  if (error || !data) return <LoadFailure message={messages.samsaraLoadFailed} retryLabel={messages.retry} onRetry={() => void mutate()} />;

  const numberLocale = locale === 'es' ? 'es-US' : 'en-US';
  const checkedAt = new Date(data.checkedAt).toLocaleTimeString(numberLocale, { hour: 'numeric', minute: '2-digit' });
  const refresh = (
    <Button type="button" variant="secondary" size="sm" disabled={isValidating} onClick={() => void mutate()}>
      <RefreshCw aria-hidden="true" className={isValidating ? 'animate-spin' : undefined} />
      {messages.samsaraRefresh}
    </Button>
  );
  const header = (
    <PageHeader title={messages.samsaraTitle} subtitle={messages.samsaraSubtitle} meta={fillPlaceholders(messages.samsaraCheckedAt, { time: checkedAt })} actions={refresh} />
  );

  if (data.status !== 'ok' || !data.summary) {
    const message = data.status === 'not_configured' ? messages.samsaraNotConfigured : data.status === 'unauthorized' ? messages.samsaraUnauthorized : messages.samsaraUnavailable;
    return (
      <div className="space-y-6">
        {header}
        {data.status === 'not_configured' ? (
          <p className="rounded-xl border bg-card px-4 py-3 text-sm" data-testid="samsara-status">{message}</p>
        ) : (
          <InlineAlert data-testid="samsara-status">{message}</InlineAlert>
        )}
      </div>
    );
  }

  const { summary } = data;
  const stats = [
    { label: messages.samsaraStatVehicles, value: summary.samsaraVehicles },
    { label: messages.samsaraStatTrucks, value: summary.trucks },
    { label: messages.samsaraStatPaired, value: summary.paired, sub: fillPlaceholders(messages.samsaraPairedBy, { id: String(summary.pairedBy.samsara_id), vin: String(summary.pairedBy.vin), number: String(summary.pairedBy.number) }) },
    { label: messages.samsaraStatUnpairedTrucks, value: summary.unpairedTrucks },
    { label: messages.samsaraStatUnpairedVehicles, value: summary.unpairedVehicles },
  ];

  const truckCell = (truck: { id: string; truckNumber: string }) => (
    <Link href={`/admin/trucks/${truck.id}`} className="font-medium text-primary hover:underline">{truck.truckNumber}</Link>
  );
  const vinCell = (vin: string | null) => (vin ? <span className="font-mono text-xs">{vin}</span> : <span className="text-muted-foreground">—</span>);
  const miles = (value: number) => fillPlaceholders(messages.samsaraMiles, { miles: value.toLocaleString(numberLocale) });
  // S1-6: who owns the truck, and the company under it when they differ.
  const ownerCell = (truck: SamsaraTruckRefDto) => truck.owner || truck.company ? (
    <span className="flex flex-col">
      <span>{truck.owner ?? truck.company}</span>
      {truck.owner && truck.company && truck.company !== truck.owner ? <span className="text-xs text-muted-foreground">{truck.company}</span> : null}
    </span>
  ) : <span className="text-muted-foreground">—</span>;
  const samsaraMilesLine = (odometer: SamsaraOdometerDto | null) => (odometer ? fillPlaceholders(messages.samsaraMilesSamsara, { miles: odometer.miles.toLocaleString(numberLocale) }) : null);
  // Ours (confirmed at PM, D10) first; Samsara's live reading under it as a reference (D35).
  const mileageCell = (truck: SamsaraTruckRefDto, odometer: SamsaraOdometerDto | null = null) => (
    <span className="flex flex-col whitespace-nowrap tabular-nums">
      {truck.mileage != null ? <span title={messages.samsaraMilesConfirmed}>{miles(truck.mileage)}</span> : <span className="text-muted-foreground">{messages.samsaraMilesNone}</span>}
      {samsaraMilesLine(odometer) ? <span className="text-xs text-muted-foreground">{samsaraMilesLine(odometer)}</span> : null}
    </span>
  );

  return (
    <div className="space-y-6">
      {header}

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5" data-testid="samsara-summary">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="tnum mt-1 text-2xl font-semibold">{stat.value}</dd>
            {stat.sub ? <dd className="mt-1 text-xs text-muted-foreground">{stat.sub}</dd> : null}
          </div>
        ))}
      </dl>

      {data.odometersAvailable ? null : <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">{messages.samsaraNoOdometers}</p>}

      <SectionCard title={messages.samsaraUnpairedTrucksTitle} count={data.unpairedTrucks.length}>
        {data.unpairedTrucks.length ? (
          <DataTable<SamsaraUnpairedTruckDto>
            className="md:rounded-none md:border-0"
            items={data.unpairedTrucks}
            caption={messages.samsaraUnpairedTrucksTitle}
            getKey={(row) => row.truck.id}
            getRowLabel={(row) => row.truck.truckNumber}
            columns={[
              { key: 'truck', header: messages.samsaraColTruck, primary: true, cell: (row) => truckCell(row.truck) },
              { key: 'owner', header: messages.samsaraColOwner, cell: (row) => ownerCell(row.truck) },
              { key: 'mileage', header: messages.samsaraColMileage, cell: (row) => mileageCell(row.truck) },
              { key: 'vin', header: messages.samsaraColVin, cell: (row) => vinCell(row.truck.vin) },
              { key: 'why', header: messages.samsaraColWhy, cell: (row) => text(REASON_KEY[row.reason]) },
            ]}
          />
        ) : <p className="px-4 py-3 text-sm text-muted-foreground">{messages.samsaraEmptyUnpairedTrucks}</p>}
      </SectionCard>

      <SectionCard title={messages.samsaraPairedTitle} count={data.paired.length}>
        {data.paired.length ? (
          <DataTable<SamsaraPairedTruckDto>
            className="md:rounded-none md:border-0"
            items={data.paired}
            caption={messages.samsaraPairedTitle}
            getKey={(row) => row.truck.id}
            getRowLabel={(row) => row.truck.truckNumber}
            columns={[
              { key: 'truck', header: messages.samsaraColTruck, primary: true, cell: (row) => truckCell(row.truck) },
              { key: 'owner', header: messages.samsaraColOwner, cell: (row) => ownerCell(row.truck) },
              { key: 'mileage', header: messages.samsaraColMileage, cell: (row) => mileageCell(row.truck, row.vehicle.odometer) },
              { key: 'vehicle', header: messages.samsaraColVehicle, cell: (row) => row.vehicle.name || row.vehicle.id },
              { key: 'how', header: messages.samsaraColHow, cell: (row) => <Badge variant="outline">{text(METHOD_KEY[row.method])}</Badge> },
              {
                key: 'check',
                header: messages.samsaraColCheck,
                cell: (row) => row.warnings.length ? (
                  <span className="flex flex-wrap gap-1">
                    {row.warnings.map((warning) => (
                      <Badge key={warning} variant="warning"><TriangleAlert aria-hidden="true" className="size-3.5" />{text(WARNING_KEY[warning])}</Badge>
                    ))}
                    {/* S1-5: say which VIN each side has, so the Manager can tell which one is wrong. */}
                    {row.warnings.includes('vin_mismatch') ? (
                      <span className="flex w-full flex-col font-mono text-xs" data-testid="samsara-vin-compare">
                        <span>{fillPlaceholders(messages.samsaraVinOurs, { vin: row.truck.vin ?? '—' })}</span>
                        <span className="text-muted-foreground">{fillPlaceholders(messages.samsaraVinTheirs, { vin: row.vehicle.vin ?? '—' })}</span>
                      </span>
                    ) : null}
                  </span>
                ) : <span className="text-muted-foreground">—</span>,
              },
            ]}
          />
        ) : <p className="px-4 py-3 text-sm text-muted-foreground">{messages.samsaraEmptyPaired}</p>}
      </SectionCard>

      <SectionCard title={messages.samsaraUnpairedVehiclesTitle} count={data.unpairedVehicles.length}>
        {data.unpairedVehicles.length ? (
          <DataTable<SamsaraVehicleRefDto>
            className="md:rounded-none md:border-0"
            items={data.unpairedVehicles}
            caption={messages.samsaraUnpairedVehiclesTitle}
            getKey={(row) => row.id}
            getRowLabel={(row) => row.name || row.id}
            columns={[
              { key: 'vehicle', header: messages.samsaraColVehicle, primary: true, cell: (row) => row.name || row.id },
              { key: 'mileage', header: messages.samsaraColSamsaraMileage, cell: (row) => (row.odometer ? <span className="whitespace-nowrap tabular-nums">{miles(row.odometer.miles)}</span> : <span className="text-muted-foreground">—</span>) },
              { key: 'vin', header: messages.samsaraColVin, cell: (row) => vinCell(row.vin) },
            ]}
          />
        ) : <p className="px-4 py-3 text-sm text-muted-foreground">{messages.samsaraEmptyUnpairedVehicles}</p>}
      </SectionCard>
    </div>
  );
}
