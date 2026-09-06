"use client";

/**
 * Métricas de produto opcionais, ativadas por variável de ambiente:
 * - NEXT_PUBLIC_POSTHOG_KEY (+ NEXT_PUBLIC_POSTHOG_HOST): pageviews, funil,
 *   usuários identificados (1M eventos/mês no free tier).
 * - NEXT_PUBLIC_CLARITY_ID: gravações de sessão e heatmaps (grátis/ilimitado).
 *
 * Sem as chaves, nada é injetado — zero custo e zero script no HTML.
 * Os scripts são carregados por src externo (execução garantida) e o init
 * acontece no onLoad; o primeiro pageview é capturado ali, os seguintes na
 * troca de rota.
 */

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

interface PostHogClient {
  capture?: (...args: unknown[]) => void;
  identify?: (...args: unknown[]) => void;
  init?: (...args: unknown[]) => void;
}

declare global {
  interface Window {
    posthog?: PostHogClient;
    clarity?: (...args: unknown[]) => void;
  }
}

export function Analytics() {
  const pathname = usePathname();
  const lastCapturedPath = useRef<string | null>(null);

  const capturePageview = () => {
    if (!pathname || lastCapturedPath.current === pathname) return;
    lastCapturedPath.current = pathname;
    window.posthog?.capture?.("$pageview", { $current_url: window.location.href });
  };

  // troca de rota (navegação client-side)
  useEffect(() => {
    if (window.posthog) capturePageview();
  }, [pathname]);

  if (!POSTHOG_KEY && !CLARITY_ID) return null;

  return (
    <>
      {POSTHOG_KEY && (
        <Script
          id="posthog-analytics"
          strategy="afterInteractive"
          src={`${POSTHOG_HOST}/static/array.js`}
          onLoad={() => {
            window.posthog?.init?.(POSTHOG_KEY, {
              api_host: POSTHOG_HOST,
              capture_pageview: false,
              persistence: "localStorage+cookie",
            });
            capturePageview();
          }}
        />
      )}
      {CLARITY_ID && (
        <Script
          id="clarity-analytics"
          strategy="afterInteractive"
          src={`https://www.clarity.ms/tag/${CLARITY_ID}`}
        />
      )}
    </>
  );
}

/** Associa o uso à conta logada (pseudônimo: id do usuário). Chamar após o login. */
export function identifyUser(userId: string, email: string): void {
  window.posthog?.identify?.(userId, { email });
}
