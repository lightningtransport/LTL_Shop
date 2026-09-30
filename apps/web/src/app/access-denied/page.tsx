'use client';

import { AuthBrandHeader, AppHeaderActions, Card } from '@/components/ui';
import { useShopLocale } from '@/lib/locale-context';

export default function AccessDeniedPage() {
  const { messages } = useShopLocale();
  return (
    <div>
      <div className="mb-4 flex justify-end"><AppHeaderActions /></div>
      <AuthBrandHeader
        title={messages.accessDeniedTitle}
        subtitle={messages.accessDeniedSubtitle}
      />
      <Card className="text-sm text-muted-foreground">
        {messages.accessDeniedBody}
      </Card>
    </div>
  );
}
