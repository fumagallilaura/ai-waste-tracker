"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Sun, Moon } from "lucide-react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border-default bg-bg-surface">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary-600 dark:text-primary-400">
            🌱 Desperdício Zero
          </Link>
          <nav className="flex gap-4 items-center">
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-bg-surface-alt transition-colors"
              aria-label={resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="w-5 h-5 text-text-secondary" />
              ) : (
                <Moon className="w-5 h-5 text-text-secondary" />
              )}
            </button>
            <Link
              href="/login"
              className="text-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="text-sm bg-primary-600 text-text-inverse px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Começar grátis
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-border-default mt-16 bg-bg-surface">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center text-sm text-text-muted">
          <p>© 2026 Desperdício Zero. Todos os direitos reservados.</p>
          <div className="mt-2 flex justify-center gap-4">
            <Link href="/privacidade" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
              Política de Privacidade
            </Link>
            <Link href="/termos" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
              Termos de Uso
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
