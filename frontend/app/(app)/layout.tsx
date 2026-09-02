"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { getAccessToken, logout } from "@/lib/auth";
import { Sun, Moon, Settings, LogOut } from "lucide-react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <p className="text-text-muted">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="bg-bg-surface border-b border-border-default sticky top-0 z-10">
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
              href="/upgrade"
              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
            >
              Pro
            </Link>
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
              href="/settings"
              className="p-2 rounded-lg hover:bg-bg-surface-alt transition-colors"
              aria-label="Configurações"
            >
              <Settings className="w-5 h-5 text-text-secondary" />
            </Link>
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              className="p-2 rounded-lg hover:bg-bg-surface-alt transition-colors"
              aria-label="Sair"
            >
              <LogOut className="w-5 h-5 text-text-secondary" />
            </button>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
