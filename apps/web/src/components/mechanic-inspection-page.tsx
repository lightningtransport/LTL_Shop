'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSWRConfig } from 'swr';
import { ArrowLeft } from 'lucide-react';
import { MechanicMode } from '@ltl-shop/shared';
import { useAuth } from '@/lib/auth-context';
import { inspectionCopy } from '@/lib/inspection-copy';
import { INSPECTION_QUEUE_KEY } from '@/lib/inspection-data';
import { useShopLocale } from '@/lib/locale-context';
import { replaceAppLocation } from '@/lib/session-restore';
import { useActionToast } from './action-toast';
import { InspectionSheet } from './inspection-sheet';
import { SessionSignInFallback } from './session-sign-in-fallback';
import { HomeTopBar } from './ui';

/** D41 / HU-ME7: the inspection sheet in the mechanic's workspace, opened from "To inspect". */
export function MechanicInspectionPage({ mode }: { mode: MechanicMode }) {
  const { truckId } = useParams<{ truckId: string }>();
  const { token, sessionLoading } = useAuth();
  const { messages } = useShopLocale();
  const copy = inspectionCopy(messages.locale);
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { showToast } = useActionToast();
  const home = `/mechanic/${mode === MechanicMode.PM ? 'pm' : 'standard'}`;

  useEffect(() => {
    if (!sessionLoading && !token) replaceAppLocation('/login', router);
  }, [sessionLoading, token, router]);
  if (!sessionLoading && !token) return <SessionSignInFallback />;

  return (
    <div className="pb-16 sm:pb-0">
      <HomeTopBar mode={mode} />
      <Link href={home} className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />{copy.myWork}
      </Link>
      <InspectionSheet
        mode="mechanic"
        truckId={truckId}
        locale={messages.locale}
        doneHref={home}
        // On phones My work · Trucks · Completed sit at the bottom (z-40, 56 px); the sheet's bar goes right above them.
        barClassName="bottom-[calc(3.5rem+var(--app-safe-bottom,0px))] sm:bottom-0"
        onSaved={(message) => {
          showToast('success', message);
          void mutate(INSPECTION_QUEUE_KEY);
          router.push(home);
        }}
      />
    </div>
  );
}
