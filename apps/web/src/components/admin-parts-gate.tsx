'use client';

import { Lock } from 'lucide-react';
import { AdminNavLink } from './admin-nav-link';
import { Button, EmptyState } from './ui';
import { useCanShowManagerWrites } from '@/lib/admin-actor';
import type { AdminMessages } from '@/lib/admin-messages';
import { useAuth } from '@/lib/auth-context';

/**
 * PCA12 (UX-5-007): Parts & costs is money (D-PC7). An admin without the Manager pair who reaches it by URL or a
 * favorite reads why it is closed, instead of a page that looks broken because the API answered 403.
 */
export function AdminPartsGate({ messages, children }: { messages: AdminMessages; children: React.ReactNode }) {
  const { user } = useAuth();
  const allowed = useCanShowManagerWrites();
  // While the session is still loading, the page renders as usual (its own skeleton); the verdict needs the user.
  if (!user || allowed) return <>{children}</>;
  return (
    <EmptyState>
      <div className="mx-auto max-w-md space-y-3" data-testid="parts-costs-denied">
        <Lock aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
        <p className="text-base font-medium text-foreground">{messages.pcCostsDeniedTitle}</p>
        <p>{messages.pcCostsDeniedBody}</p>
        <Button asChild variant="outline"><AdminNavLink href="/admin">{messages.backToDashboard}</AdminNavLink></Button>
      </div>
    </EmptyState>
  );
}
