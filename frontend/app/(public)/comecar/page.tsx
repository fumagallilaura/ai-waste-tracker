"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { publicPost } from "@/lib/api";
import { Plus, Trash2, ArrowLeft, Sparkles } from "lucide-react";

interface GuestItem {
  nome: string;
  quantidadeTotal: string;
  unidade: string;
}

const UNIDADES = ["g", "kg", "ml", "L", "unidade"];

export default function ComecarPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [convidados, setConvidados] = useState("");
  const [items, setItems] = useState<GuestItem[]>([
    { nome: "", quantidadeTotal: "", unidade: "unidade" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItem = () =>
    setItems((prev) => [...prev, { nome: "", quantidadeTotal: "", unidade: "unidade" }]);

  const removeItem = (index: number) => {
    if (items.length === 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof GuestItem, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const toBase = (qtd: string, unidade: string): [number, string] => {
    const v = parseFloat(qtd) || 0;
    if (unidade === "kg") return [v * 1000, "g"];
    if (unidade === "L") return [v * 1000, "ml"];
    return [v, unidade];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nome.trim()) {
      setError("Dê um nome para o evento");
      return;
    }

    const itensValidos = items
      .filter((i) => i.nome.trim() && i.quantidadeTotal)
      .map((item) => {
        const [qtd, unidade] = toBase(item.quantidadeTotal, item.unidade);
        return {
          recipe_id: null,
          escala_fator: 1,
          item_nome: item.nome.trim(),
          item_quantidade_base: qtd,
          item_unidade: unidade,
        };
      });

    if (itensValidos.length === 0) {
      setError("Informe pelo menos um item com quantidade");
      return;
    }

    setSaving(true);
    try {
      const created = await publicPost<{ id: string }>("/guest/productions", {
        nome: nome.trim(),
        tipo: "outro",
        data,
        convidados: convidados ? parseInt(convidados) : null,
        recipes: itensValidos,
      });
      router.push(`/comecar/${created.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar produção";
      if (message.includes("produção grátis")) {
        // cota do visitante esgotada → login
        router.push("/login?motivo=limite");
        return;
      }
      setError(message);
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Testar sem cadastro</h1>
          <p className="text-text-secondary mt-1 text-sm">
            Crie 1 produção e registre o balanço de graça, sem conta. Depois é só criar
            sua conta para salvar tudo e continuar.
          </p>
        </div>
      </div>

      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4 text-sm text-primary-800 dark:text-primary-300 flex items-start gap-2">
        <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
        Informe o que você vai produzir no evento (ex.: 70 brigadeiros, 5 kg de bolo).
        A lista de ingredientes para comprar aparece na hora.
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Nome do evento *
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Aniversário da Maria"
                className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Data</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="max-w-xs">
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Convidados (opcional)
            </label>
            <input
              type="number"
              min="1"
              value={convidados}
              onChange={(e) => setConvidados(e.target.value)}
              placeholder="Ex: 50"
              className="w-full px-4 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        <div className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">O que vai produzir?</h2>
          {items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-12 gap-2 sm:gap-3 items-end p-3 bg-bg-surface-alt rounded-lg"
            >
              <div className="col-span-12 sm:col-span-5">
                <label className="block text-xs text-text-muted mb-1">Item</label>
                <input
                  type="text"
                  value={item.nome}
                  onChange={(e) => updateItem(index, "nome", e.target.value)}
                  placeholder="Ex: brigadeiro"
                  className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="col-span-5 sm:col-span-3">
                <label className="block text-xs text-text-muted mb-1">Quantidade total</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={item.quantidadeTotal}
                  onChange={(e) => updateItem(index, "quantidadeTotal", e.target.value)}
                  placeholder="Ex: 70"
                  className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm placeholder:text-text-muted focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="col-span-4 sm:col-span-3">
                <label className="block text-xs text-text-muted mb-1">Unidade</label>
                <select
                  value={item.unidade}
                  onChange={(e) => updateItem(index, "unidade", e.target.value)}
                  className="w-full px-3 py-2 border border-border-default rounded bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {UNIDADES.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-3 sm:col-span-1">
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  className="p-2 rounded hover:bg-danger-50 dark:hover:bg-danger-900/20 text-text-muted hover:text-danger-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Remover item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            <Plus className="w-4 h-4" />
            Adicionar item
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-8 py-3 bg-primary-600 text-text-inverse rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Criando..." : "Criar produção e ver a lista"}
        </button>
      </form>
    </div>
  );
}
