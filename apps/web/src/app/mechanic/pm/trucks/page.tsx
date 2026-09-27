'use client';

import { MechanicMode } from '@ltl-shop/shared';
import { MechanicTrucksPage } from '@/components/mechanic-trucks-page';

export default function Page() {
  return <MechanicTrucksPage mode={MechanicMode.PM} />;
}
