"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { getCurrentUser, logout } from "@/lib/auth";
import { identifyUser } from "@/components/Analytics";
import { flushOutbox, onPendingChange, pendingCount } from "@/lib/offline";
import { BottomNav } from "@/components/BottomNav";
import { OnboardingTour } from "@/lib/tour";
import { BrandMark } from "@/components/BrandMark";
import { Sun, Moon, Settings, HelpCircle, LogOut, CloudOff } from "lucide-react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const check = async () => {
      // valida a sessão de verdade: token presente mas expirado não passa mais
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/login?expired=1");
        return;
      }
      // métricas de produto (quando ativadas): uso associado ao id da conta
      identifyUser(user.id, user.email);
      setChecked(true);
      setPending(await pendingCount());
    };
    check();
  }, [router]);

  useEffect(() => onPendingChange(setPending), []);

  useEffect(() => {
    const sync = async () => {
      const synced = await flushOutbox();
      if (synced > 0) setPending(await pendingCount());
    };
    window.addEventListener("online", sync);
    // tenta sincronizar o que ficou pendente ao abrir o app
    const t = setTimeout(sync, 1500);
    return () => {
      window.removeEventListener("online", sync);
      clearTimeout(t);
    };
  }, []);

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
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <BrandMark href="/dashboard" size="sm" />
          <nav className="flex gap-2 md:gap-4 items-center">
            <Link
              href="/dashboard"
              className="text-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors whitespace-nowrap hidden md:inline"
            >
              Início
            </Link>
            <Link
              href="/recipes"
              data-tour="nav-recipes"
              className="text-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors whitespace-nowrap hidden md:inline"
            >
              Receitas
            </Link>
            <Link
              href="/productions"
              data-tour="nav-events"
              className="text-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors whitespace-nowrap hidden md:inline"
            >
              Eventos
            </Link>
            <Link
              href="/analises"
              className="text-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors whitespace-nowrap hidden md:inline"
            >
              Análises
            </Link>
            <Link
              href="/clients"
              className="text-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors whitespace-nowrap hidden md:inline"
            >
              Clientes
            </Link>
            <Link
              href="/estoque"
              className="text-sm text-text-secondary hover:text-primary-600 dark:hover:text-primary-400 transition-colors whitespace-nowrap hidden md:inline"
            >
              Estoque
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
              href="/settings#help"
              className="p-2 rounded-lg hover:bg-bg-surface-alt transition-colors"
              aria-label="Ajuda e tutorial"
            >
              <HelpCircle className="w-5 h-5 text-text-secondary" />
            </Link>
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
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-8">{children}</main>
      <BottomNav />
      <OnboardingTour />

      {pending > 0 && (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-50 flex items-center gap-2 bg-warning-100 dark:bg-warning-900/40 text-warning-800 dark:text-warning-200 border border-warning-300 dark:border-warning-700 rounded-full px-4 py-2 text-sm shadow-lg">
          <CloudOff className="w-4 h-4" />
          {pending} alteração(ões) salva(s) no dispositivo — enviamos quando a internet voltar
        </div>
      )}
    </div>
  );
}
