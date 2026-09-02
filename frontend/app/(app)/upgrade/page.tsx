"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { formatCurrency } from "@/lib/units";
import { Check, ArrowLeft } from "lucide-react";
import Link from "next/link";

const PLANS = [
  {
    id: "pro_mensal",
    name: "Pro Mensal",
    price: 1990,
    period: "/mês",
    features: [
      "Produções ilimitadas",
      "Receitas ilimitadas",
      "Lista de compras automática",
      "Registro de desperdício",
      "Dashboard monetário",
      "Insights de IA (v2)",
      "Gamificação (v2)",
    ],
    popular: false,
  },
  {
    id: "pro_anual",
    name: "Pro Anual",
    price: 14900,
    period: "/ano",
    features: [
      "Tudo do Pro Mensal",
      "Economia de 38%",
      "Prioridade no suporte",
      "Benchmark da plataforma (v2)",
    ],
    popular: true,
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (planId: string) => {
    setLoading(true);
    setError(null);
    setSelectedPlan(planId);

    const token = getAccessToken();
    if (!token) {
      setError("Não autenticado");
      setLoading(false);
      return;
    }

    try {
      const result = await apiPost<{ init_point: string }>(
        "/payments/checkout",
        { plan: planId },
        token
      );

      // Redirect to Mercado Pago checkout
      window.location.href = result.init_point;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar checkout");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Upgrade para Pro</h1>
          <p className="text-text-secondary mt-1">
            Escolha o plano ideal para seu negócio.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-bg-surface rounded-xl border-2 p-6 space-y-4 transition-colors ${
              selectedPlan === plan.id
                ? "border-primary-500"
                : plan.popular
                ? "border-primary-300 dark:border-primary-700"
                : "border-border-default"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-4 bg-primary-600 text-text-inverse text-xs font-medium px-3 py-1 rounded-full">
                Mais econômico
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-text-primary">{plan.name}</h3>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-bold text-text-primary">
                  {formatCurrency(plan.price / 100)}
                </span>
                <span className="text-text-muted text-sm">{plan.period}</span>
              </div>
              {plan.id === "pro_anual" && (
                <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                  Equivale a {formatCurrency(plan.price / 12 / 100)}/mês
                </p>
              )}
            </div>

            <ul className="space-y-2">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                  <Check className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={loading}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                plan.popular
                  ? "bg-primary-600 text-text-inverse hover:bg-primary-700"
                  : "bg-bg-surface-alt text-text-primary border border-border-default hover:border-primary-300 dark:hover:border-primary-700"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading && selectedPlan === plan.id ? "Redirecionando..." : "Escolher plano"}
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-sm text-text-muted">
        Pagamento seguro via Mercado Pago (PIX, cartão ou boleto).
        <br />
        Cancele quando quiser. Sem fidelidade.
      </p>
    </div>
  );
}
