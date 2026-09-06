"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveTokens } from "@/lib/auth";

/** Google OAuth lands here with tokens in the URL fragment (#...). */
export default function GoogleCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");

    if (!accessToken || !refreshToken) {
      setError("Não recebemos o retorno do Google. Tente entrar novamente.");
      return;
    }

    saveTokens({ access_token: accessToken, refresh_token: refreshToken, token_type: "bearer" });
    // limpa o fragmento para os tokens não ficarem na barra de endereço
    window.history.replaceState(null, "", window.location.pathname);
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="w-full max-w-md">
      <div className="bg-bg-surface rounded-2xl border border-border-default shadow-lg p-8 text-center">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-text-primary mb-2">Falha no login</h1>
            <p className="text-text-secondary text-sm mb-6">{error}</p>
            <Link
              href="/login"
              className="inline-block bg-primary-600 text-text-inverse px-6 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Voltar para o login
            </Link>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4" />
            <p className="text-text-secondary text-sm">Entrando com Google...</p>
          </>
        )}
      </div>
    </div>
  );
}
