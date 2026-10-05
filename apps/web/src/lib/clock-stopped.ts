import type { MyClockStoppedDto } from '@ltl-shop/shared';

/**
 * LTR-186 / D20, D21: the "tap Continue" line when the app stopped my clock on this Work Order —
 * the day close, or I started on another Truck. Null when there is nothing to say.
 */
export function clockStoppedLine(
  stopped: MyClockStoppedDto | null | undefined,
  messages: {
    dayCloseTapContinue: string;
    clockOnTruckTapContinue: (truckNumber: string) => string;
    clockSwitchedTapContinue: string;
  },
): string | null {
  if (!stopped) return null;
  if (stopped.reason === 'day_close') return messages.dayCloseTapContinue;
  if (stopped.reason === 'switched_truck') {
    const truckNumber = stopped.elsewhereWorkOrder?.truckNumber;
    return truckNumber ? messages.clockOnTruckTapContinue(truckNumber) : messages.clockSwitchedTapContinue;
  }
  return null;
}
