"use client";

import { useState } from "react";
import Link from "next/link";

const SEGMENTOS = [
  { value: "restaurante", label: "Restaurante", cmvIdeal: "28-35%", desperdicioMedio: "11.3%" },
  { value: "pizzaria", label: "Pizzaria", cmvIdeal: "25-32%", desperdicioMedio: "8.5%" },
  { value: "hamburgueria", label: "Hamburgueria", cmvIdeal: "30-38%", desperdicioMedio: "10.0%" },
  { value: "bar", label: "Bar / Pub", cmvIdeal: "22-28%", desperdicioMedio: "5.0%" },
  { value: "cafeteria", label: "Cafeteria", cmvIdeal: "18-25%", desperdicioMedio: "7.0%" },
  { value: "self_service", label: "Self-Service / Buffet", cmvIdeal: "32-40%", desperdicioMedio: "15.0%" },
  { value: "buffet", label: "Buffet de Eventos", cmvIdeal: "30-38%", desperdicioMedio: "18.0%" },
  { value: "dark_kitchen", label: "Dark Kitchen", cmvIdeal: "25-32%", desperdicioMedio: "9.0%" },
];

export default function CalculadoraPage() {
  const [segmento, setSegmento] = useState("");
  const [faturamento, setFaturamento] = useState("");
  const [custoInsumos, setCustoInsumos] = useState("");
  const [resultado, setResultado] = useState<null | {
    cmv: number;
    cmvIdeal: string;
    perdaMensal: number;
    desperdicioEstimado: number;
  }>(null);

  const calcular = () => {
    if (!faturamento || !custoInsumos || !segmento) return;

    const f = parseFloat(faturamento);
    const c = parseFloat(custoInsumos);
    const cmv = (c / f) * 100;

    const seg = SEGMENTOS.find((s) => s.value === segmento);
    const cmvMax = parseFloat(seg!.cmvIdeal.split("-")[1]);
    const desperdicioMedio = parseFloat(seg!.desperdicioMedio);

    const perdaMensal = cmv > cmvMax ? (cmv - cmvMax) / 100 * f : 0;
    const desperdicioEstimado = (desperdicioMedio / 100) * c;

    setResultado({
      cmv: Math.round(cmv * 10) / 10,
      cmvIdeal: seg!.cmvIdeal,
      perdaMensal: Math.round(perdaMensal),
      desperdicioEstimado: Math.round(desperdicioEstimado),
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-text-primary mb-4">
          Quanto você está <span className="text-primary-600 dark:text-primary-400">jogando fora</span>?
        </h1>
        <p className="text-lg text-text-secondary">
          Calcule seu CMV e descubra quanto dinheiro seu restaurante perde com desperdício.
        </p>
      </div>

      <div className="bg-bg-surface rounded-2xl shadow-lg p-8 space-y-6 border border-border-default">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Tipo de negócio
          </label>
          <select
            value={segmento}
            onChange={(e) => setSegmento(e.target.value)}
            className="w-full px-4 py-3 border border-border-default rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Selecione...</option>
            {SEGMENTOS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Faturamento mensal (R$)
          </label>
          <input
            type="number"
            value={faturamento}
            onChange={(e) => setFaturamento(e.target.value)}
            placeholder="Ex: 80000"
            className="w-full px-4 py-3 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            Custo mensal de insumos (R$)
          </label>
          <input
            type="number"
            value={custoInsumos}
            onChange={(e) => setCustoInsumos(e.target.value)}
            placeholder="Ex: 28000"
            className="w-full px-4 py-3 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <button
          onClick={calcular}
          disabled={!segmento || !faturamento || !custoInsumos}
          className="w-full bg-primary-600 text-text-inverse py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Calcular desperdício
        </button>

        {resultado && (
          <div className="mt-6 p-6 bg-primary-50 dark:bg-primary-900/20 rounded-xl space-y-4 border border-primary-200 dark:border-primary-800">
            <h3 className="text-lg font-semibold text-primary-800 dark:text-primary-300">
              Resultado
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-text-muted">Seu CMV</p>
                <p className="text-2xl font-bold text-text-primary">
                  {resultado.cmv}%
                </p>
              </div>
              <div>
                <p className="text-sm text-text-muted">CMV ideal</p>
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{resultado.cmvIdeal}%</p>
              </div>
              <div>
                <p className="text-sm text-text-muted">Perda estimada/mês</p>
                <p className="text-2xl font-bold text-danger-600 dark:text-danger-400">
                  R$ {resultado.perdaMensal.toLocaleString("pt-BR")}
                </p>
              </div>
              <div>
                <p className="text-sm text-text-muted">Desperdício estimado/mês</p>
                <p className="text-2xl font-bold text-warning-600 dark:text-warning-400">
                  R$ {resultado.desperdicioEstimado.toLocaleString("pt-BR")}
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-primary-200 dark:border-primary-800">
              <Link
                href="/register"
                className="block text-center bg-primary-600 text-text-inverse py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                Quer descobrir onde está perdendo dinheiro? →
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 text-center text-sm text-text-muted">
        <p>
          Dados de referência: SEBRAE, ABRASEL e benchmarks da indústria de food service brasileira.
        </p>
      </div>
    </div>
  );
}
