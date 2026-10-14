'use client';

import { MechanicMode } from '@ltl-shop/shared';
import { MechanicInspectionPage } from '@/components/mechanic-inspection-page';

/** D41 / HU-ME7: inspect a Truck from "To inspect" (needs "Can inspect trucks"). */
export default function Page() {
  return <MechanicInspectionPage mode={MechanicMode.PM} />;
}
