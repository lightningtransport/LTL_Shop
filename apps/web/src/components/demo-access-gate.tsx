'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { DEMO_ACCESS_HEADER, readDemoAccess, writeDemoAccess } from '@/lib/demo-access';
import { Button, Card, InlineAlert, Input, Label } from './ui';

/**
 * D39 (DP3): the published demo opens only with the code that came with the link. The API is what refuses the data
 * without it; this screen asks for it once, checks it and keeps it in the browser. English, like the demo panel.
 */
type GateState = 'checking' | 'locked' | 'open' | 'offline';

async function checkCode(code: string): Promise<'ok' | 'wrong' | 'offline'> {
  try {
    const response = await fetch(`${API_URL}/api/dev/demo/access`, { headers: { [DEMO_ACCESS_HEADER]: code }, cache: 'no-store' });
    if (response.ok) return 'ok';
    return response.status === 401 ? 'wrong' : 'offline';
  } catch {
    return 'offline';
  }
}

export function DemoAccessGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = readDemoAccess();
    if (!saved) {
      setState('locked');
      return;
    }
    void checkCode(saved).then((result) => {
      if (result === 'ok') setState('open');
      else if (result === 'offline') setState('offline');
      else {
        // The code changed since this browser last opened the demo.
        writeDemoAccess(null);
        setState('locked');
      }
    });
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const typed = code.trim();
    if (!typed) return;
    setBusy(true);
    setError(null);
    const result = await checkCode(typed);
    setBusy(false);
    if (result === 'ok') {
      writeDemoAccess(typed);
      setState('open');
    } else {
      setError(result === 'wrong' ? 'That code does not open this demo. Check the message the link came with.' : 'The demo is not answering right now. Try again in a minute.');
    }
  }

  if (state === 'open') return <>{children}</>;

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Lightning Shop · Demo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A day at a truck shop, step by step: the screen lights up what to tap. The data is made up and resets every night.
          </p>
        </div>
        {state === 'checking' ? <p className="text-sm text-muted-foreground" role="status">Opening the demo…</p> : null}
        {state === 'offline' ? (
          <>
            <InlineAlert>The demo is not answering right now. Try again in a minute.</InlineAlert>
            <Button className="w-full" onClick={() => window.location.reload()}>Try again</Button>
          </>
        ) : null}
        {state === 'locked' ? (
          <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
            <div>
              <Label htmlFor="demo-access-code">Access code</Label>
              <Input
                id="demo-access-code"
                className="mt-2"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">It came with the link to this demo.</p>
            </div>
            {error ? <InlineAlert>{error}</InlineAlert> : null}
            <Button className="w-full" type="submit" disabled={busy || !code.trim()}>
              {busy ? 'Checking…' : 'Open the demo'}
            </Button>
          </form>
        ) : null}
      </Card>
    </main>
  );
}
