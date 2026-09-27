'use client';

import { MechanicMode } from '@ltl-shop/shared';
import { MechanicCompletedPage } from '@/components/mechanic-completed-page';

export default function Page() {
  return <MechanicCompletedPage mode={MechanicMode.PM} />;
}
