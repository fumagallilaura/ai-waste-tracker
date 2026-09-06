"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, startGoogleLogin } from "@/lib/auth";
import { GoogleIcon } from "@/components/GoogleIcon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      setNotice("Sua sessão expirou. Entre novamente para continuar.");
    } else if (params.get("motivo") === "limite") {
      setNotice(
        "Você já criou sua produção grátis sem cadastro. Crie sua conta (é grátis) para continuar."
      );
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await startGoogleLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar login com Google");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-bg-surface rounded-2xl border border-border-default shadow-lg p-8">
        <h1 className="text-2xl font-bold text-text-primary text-center">Entrar</h1>
        <p className="text-text-secondary text-sm text-center mt-1 mb-8">
          Acesse suas produções, requisições e balanços de desperdício.
        </p>

        {notice && (
          <div
            data-testid="auth-notice"
            className="mb-4 p-3 bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-lg text-sm text-info-700 dark:text-info-300"
          >
            {notice}
          </div>
        )}

        {error && (
          <div
            data-testid="auth-error"
            role="alert"
            className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-sm text-danger-700 dark:text-danger-300"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          data-testid="login-google"
          className="w-full flex items-center justify-center gap-3 py-2.5 mb-4 rounded-lg border border-border-default bg-bg-surface text-text-primary font-medium hover:bg-bg-surface-alt disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <GoogleIcon />
          {googleLoading ? "Redirecionando..." : "Entrar com Google"}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span className="h-px flex-1 bg-border-default" />
          <span className="text-xs text-text-muted">ou com email</span>
          <span className="h-px flex-1 bg-border-default" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1">
              Email
            </label>
            <input
              id="email"
              data-testid="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@restaurante.com.br"
              autoComplete="email"
              required
              className="w-full px-4 py-2.5 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1">
              Senha
            </label>
            <input
              id="password"
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="w-full px-4 py-2.5 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <button
            type="submit"
            data-testid="login-submit"
            disabled={loading}
            className="w-full bg-primary-600 text-text-inverse py-2.5 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-sm text-text-muted text-center mt-6">
          Não tem conta?{" "}
          <Link href="/register" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  );
}
