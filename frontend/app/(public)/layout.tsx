"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { BrandMark } from "@/components/BrandMark";
import { Sun, Moon } from "lucide-react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-20 border-b border-border-default/70 bg-bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <BrandMark href="/" size="md" />
          <nav className="flex items-center gap-3">
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="rounded-lg p-2 transition-colors hover:bg-bg-surface-alt"
              aria-label={resolvedTheme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-5 w-5 text-text-secondary" />
              ) : (
                <Moon className="h-5 w-5 text-text-secondary" />
              )}
            </button>
            <Link
              href="/login"
              className="hidden text-sm text-text-secondary transition-colors hover:text-primary-600 dark:hover:text-primary-400 sm:inline"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm text-text-inverse transition-colors hover:bg-primary-700"
            >
              Começar grátis
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-8 border-t border-border-default bg-bg-surface">
        <div className="mx-auto max-w-5xl px-4 py-8 text-center text-sm text-text-muted">
          <p>© 2026 redu</p>
          <div className="mt-2 flex justify-center gap-4">
            <Link href="/privacidade" className="transition-colors hover:text-primary-600 dark:hover:text-primary-400">
              Privacidade
            </Link>
            <Link href="/termos" className="transition-colors hover:text-primary-600 dark:hover:text-primary-400">
              Termos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
