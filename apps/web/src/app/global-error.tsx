"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import { shopLocaleFromCookieHeader, type ShopLocale } from "@/lib/shop-locale";

// LTR-170: this page replaces the root layout, so it has no locale provider and no stylesheet. It reads the
// shared locale cookie itself and keeps its own two strings and inline styles.
const COPY: Record<ShopLocale, { title: string; body: string; reload: string }> = {
  en: {
    title: "Something went wrong",
    body: "The app could not load. Your saved work has not been changed.",
    reload: "Reload",
  },
  es: {
    title: "Algo salió mal",
    body: "La app no se pudo cargar. Tu trabajo guardado no cambió.",
    reload: "Recargar",
  },
};

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const [locale] = useState<ShopLocale>(() =>
    typeof document === "undefined" ? "en" : shopLocaleFromCookieHeader(document.cookie),
  );
  const copy = COPY[locale];

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", color: "#1f2328", background: "#ffffff" }}>
        <main style={{ maxWidth: "28rem", margin: "0 auto", padding: "max(3rem, calc(env(safe-area-inset-top) + 1rem)) 1rem 2rem" }}>
          <h1 style={{ fontSize: "1.5rem", lineHeight: 1.25, margin: "0 0 0.5rem" }}>{copy.title}</h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.5, color: "#57606a", margin: "0 0 1.5rem" }}>{copy.body}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: "2.75rem",
              width: "100%",
              border: 0,
              borderRadius: "0.5rem",
              background: "#0a6cc2",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
            }}
          >
            {copy.reload}
          </button>
        </main>
      </body>
    </html>
  );
}
