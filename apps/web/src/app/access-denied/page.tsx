'use client';

import { AppHeaderActions, AuthBrandHeader } from '@/components/ui/composites';
import { Card } from '@/components/ui/card';

export default function AccessDeniedPage() {
  return (
    <div>
      <div className="mb-4 flex justify-end"><AppHeaderActions /></div>
      <AuthBrandHeader
        title="Shop access unavailable"
        subtitle="Your account is active, but it does not have access to a Shop workspace. Contact a Shop administrator."
      />
      <Card className="text-sm text-muted-foreground">
        No operational data was opened. You can sign out from the profile menu and use another account.
      </Card>
    </div>
  );
}
