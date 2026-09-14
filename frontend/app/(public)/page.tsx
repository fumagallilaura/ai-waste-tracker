"use client";

import Link from "next/link";
import { getAccessToken } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Calculator, TrendingDown, Package } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getAccessToken());
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <div className="flex justify-center mb-10">
          <BrandMark href="/" size="lg" />
        </div>
        <h1 className="text-4xl font-bold text-text-primary mb-4">
         Produza. Reduza. Renda.
        </h1>
        <p className="text-lg text-text-secondary">
          Mais controle na produção. Menos desperdício. Mais rendimento.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          {loggedIn ? (
            <Link
              href="/dashboard"
              className="bg-primary-600 text-text-inverse px-8 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Ir para o app
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="bg-primary-600 text-text-inverse px-8 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                Criar conta grátis
              </Link>
              <Link
                href="/comecar"
                data-testid="landing-trial"
                className="bg-bg-surface text-text-primary px-8 py-3 rounded-lg font-medium border border-border-default hover:border-primary-400 transition-colors"
              >
                Testar sem cadastro
              </Link>
              <Link
                href="/login"
                className="bg-bg-surface text-text-primary px-8 py-3 rounded-lg font-medium border border-border-default hover:border-border-strong transition-colors"
              >
                Entrar
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-16">
        <div className="bg-bg-surface rounded-2xl p-6 border border-border-default">
          <Calculator className="w-8 h-8 text-primary-600 dark:text-primary-400 mb-4" />
          <h2 className="font-semibold text-text-primary mb-2">Evento → ingredientes</h2>
          <p className="text-sm text-text-secondary">
            O evento precisa de 10 receitas do bolo? Informe a quantidade e receba a
            lista de compras dos ingredientes, já descontando o que você tem em estoque.
          </p>
        </div>

        <div className="bg-bg-surface rounded-2xl p-6 border border-border-default">
          <TrendingDown className="w-8 h-8 text-primary-600 dark:text-primary-400 mb-4" />
          <h2 className="font-semibold text-text-primary mb-2">Balanço do evento</h2>
          <p className="text-sm text-text-secondary">
            No fim do evento, registre quanto foi consumido, quanto foi descartado
            (estava exposto) e quanto voltou (não exposto). O que volta volta para o estoque.
          </p>
        </div>

        <div className="bg-bg-surface rounded-2xl p-6 border border-border-default">
          <Package className="w-8 h-8 text-primary-600 dark:text-primary-400 mb-4" />
          <h2 className="font-semibold text-text-primary mb-2">Padrão por cliente</h2>
          <p className="text-sm text-text-secondary">
            Com o histórico de cada cliente ou buffet, o app aprende o padrão de consumo
            e sugere quanto produzir no próximo evento — sem excesso, sem falta.
          </p>
        </div>
      </div>

      <div className="bg-bg-surface rounded-2xl p-8 border border-border-default text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-2">
          A regra dos 70%
        </h2>
        <p className="text-text-secondary text-sm max-w-xl mx-auto">
          Fazer 1 unidade por pessoa sempre sobra. Cada cliente tem um fator de produção
          (ex.: 70% do total) que você ajusta conforme aprende o comportamento do público.
        </p>
      </div>

      <p className="text-center text-xs text-text-muted mt-12">
        <Link href="/termos" className="hover:underline">Termos de uso</Link>
        {" · "}
        <Link href="/privacidade" className="hover:underline">Privacidade</Link>
      </p>
    </div>
  );
}
