'use client';

import { useEffect, useState } from 'react';

/**
 * Stage MG-2 (UX-6-007, Q10): whether the phone has a connection. SWR already revalidates when it comes
 * back; this only decides when to show the single "Offline" notice.
 */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
