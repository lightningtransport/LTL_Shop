'use client';

import { useEffect, useState } from 'react';

/** Stage 8 (mockups): phones (< 640px, Tailwind `sm`) get bottom sheets instead of popovers. False on the server. */
export function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return phone;
}
