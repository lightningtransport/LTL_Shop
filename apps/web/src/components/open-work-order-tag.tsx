import { Badge } from './ui';

/** LTR-140: a search result says the Truck already has an open Work Order. */
export function OpenWorkOrderTag({ label }: { label: string }) {
  return (
    <Badge variant="warning" className="shrink-0" data-testid="truck-open-work-order">
      {label}
    </Badge>
  );
}
