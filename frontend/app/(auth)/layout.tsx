"use client";

import Link from "next/link";
import { useTheme } from "@/lib/theme";
import { Sun, Moon } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <header className="max-w-5xl mx-auto w-full px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-primary-600 dark:text-primary-400">
          🌱 Desperdício Zero
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
      </header>
      <main className="flex-1 flex items-center justify-center px-4 pb-16">{children}</main>
    </div>
  );
}
