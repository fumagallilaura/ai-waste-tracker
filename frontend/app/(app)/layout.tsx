"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Sun, Moon, Monitor, Settings } from "lucide-react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="bg-bg-surface border-b border-border-default">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-primary-600 dark:text-primary-400">
            🌱 Desperdício Zero
          </Link>
          <nav className="flex gap-4 items-center">
            <Link
              href="/dashboard"
              className="text-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/recipes"
              className="text-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Receitas
            </Link>
            <Link
              href="/productions"
              className="text-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              Produções
            </Link>
            <Link
              href="/settings"
              className="p-2 rounded-lg hover:bg-bg-surface-alt transition-colors"
              aria-label="Configurações"
            >
              <Settings className="w-5 h-5 text-text-secondary" />
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
