"use client";

import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">
          Acompanhe seu desperdício e economia.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg-surface rounded-xl p-6 shadow-sm border border-border-default">
          <p className="text-sm text-text-muted">Desperdício este mês</p>
          <p className="text-3xl font-bold text-danger-600 dark:text-danger-400 mt-2">R$ 0</p>
          <p className="text-xs text-text-muted mt-1">Registre sua primeira produção</p>
        </div>

        <div className="bg-bg-surface rounded-xl p-6 shadow-sm border border-border-default">
          <p className="text-sm text-text-muted">Economia estimada</p>
          <p className="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-2">R$ 0</p>
          <p className="text-xs text-text-muted mt-1">Baseado na média do mercado</p>
        </div>

        <div className="bg-bg-surface rounded-xl p-6 shadow-sm border border-border-default">
          <p className="text-sm text-text-muted">Produções realizadas</p>
          <p className="text-3xl font-bold text-text-primary mt-2">0</p>
          <p className="text-xs text-text-muted mt-1">Este mês</p>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-8 text-center border border-primary-200 dark:border-primary-800">
        <h2 className="text-xl font-semibold text-primary-800 dark:text-primary-300 mb-2">
          Comece agora
        </h2>
        <p className="text-primary-700 dark:text-primary-400 mb-4">
          Cadastre sua primeira receita ou crie uma produção para ver seus números.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/recipes"
            className="bg-primary-600 text-text-inverse px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Cadastrar receita
          </Link>
          <Link
            href="/productions/new"
            className="bg-bg-surface text-primary-700 dark:text-primary-300 px-6 py-2 rounded-lg border border-primary-300 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
          >
            Criar produção
          </Link>
        </div>
      </div>
    </div>
  );
}
