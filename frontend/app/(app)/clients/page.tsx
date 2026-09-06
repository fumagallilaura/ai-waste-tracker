"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { Plus, Trash2, Users, TrendingDown, Pencil, Check } from "lucide-react";

interface Client {
  id: string;
  nome: string;
  tipo: string;
  fator_producao: number;
  observacoes: string | null;
}

interface PatternItem {
  item: string;
  unidade_base: string;
  eventos: number;
  media_consumida: number;
  media_descartada: number;
  media_devolvida: number;
  consumo_por_convidado: number | null;
}

interface Pattern {
  eventos_analisados: number;
  itens: PatternItem[];
}

const emptyForm = { nome: "", tipo: "buffet", fator_producao: "0.7", observacoes: "" };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [patternFor, setPatternFor] = useState<string | null>(null);
  const [pattern, setPattern] = useState<Pattern | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    apiGet<Client[]>("/clients", token)
      .then(setClients)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const openNewForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (c: Client) => {
    setEditingId(c.id);
    setForm({
      nome: c.nome,
      tipo: c.tipo,
      fator_producao: String(c.fator_producao),
      observacoes: c.observacoes ?? "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !form.nome.trim()) return;
    setSaving(true);
    setError(null);

    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      fator_producao: parseFloat(form.fator_producao) || 0.7,
      observacoes: form.observacoes.trim() || null,
    };

    try {
      if (editingId) {
        const updated = await apiPut<Client>(`/clients/${editingId}`, payload, token);
        setClients((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
      } else {
        const created = await apiPost<Client>("/clients", payload, token);
        setClients((prev) => [...prev, created]);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar cliente");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiDelete(`/clients/${id}`, token);
      setClients((prev) => prev.filter((c) => c.id !== id));
      if (patternFor === id) {
        setPatternFor(null);
        setPattern(null);
      }
    } catch {
      alert("Erro ao excluir cliente");
    }
  };

  const togglePattern = async (id: string) => {
    const token = getAccessToken();
    if (!token) return;
    if (patternFor === id) {
      setPatternFor(null);
      setPattern(null);
      return;
    }
    setPatternFor(id);
    setPattern(null);
    try {
      const p = await apiGet<Pattern>(`/clients/${id}/pattern`, token);
      setPattern(p);
    } catch {
      setPattern({ eventos_analisados: 0, itens: [] });
    }
  };

  const fmtBase = (qtd: number, unit: string) => {
    if (unit === "g" && qtd >= 1000) return `${(qtd / 1000).toLocaleString("pt-BR")} kg`;
    if (unit === "ml" && qtd >= 1000) return `${(qtd / 1000).toLocaleString("pt-BR")} L`;
    return `${qtd.toLocaleString("pt-BR")} ${unit}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Clientes e Buffets</h1>
          <p className="text-text-secondary mt-1">
            Mapeie o padrão de consumo de cada cliente para produzir a quantidade certa.
          </p>
        </div>
        <button
          onClick={openNewForm}
          className="flex items-center gap-2 bg-primary-600 text-text-inverse px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Novo cliente
        </button>
      </div>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-4 text-danger-700 dark:text-danger-300">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-bg-surface rounded-xl border border-border-default p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-text-primary">
            {editingId ? "Editar cliente" : "Novo cliente"}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Nome *</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Buffet Aurora, Casamento Silva..."
                required
                className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
                className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="buffet">Buffet (recorrente)</option>
                <option value="cliente">Cliente (evento pontual)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Fator de produção (0 a 1)
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={form.fator_producao}
                onChange={(e) => setForm((p) => ({ ...p, fator_producao: e.target.value }))}
                className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-text-muted mt-1">
                Fração do total a produzir por opção — ex.: 0.7 = regra dos 70%.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
              rows={2}
              placeholder="Ex: público come pouco doce; sempre sobra salgado..."
              className="w-full px-3 py-2 border border-border-default rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border-default rounded-lg text-text-secondary hover:text-text-primary text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-text-inverse rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      )}

      {clients.length === 0 ? (
        <div className="text-center py-12 bg-bg-surface rounded-xl border border-border-default">
          <Users className="w-12 h-12 mx-auto text-text-muted mb-3" />
          <p className="text-text-muted">Nenhum cliente cadastrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => (
            <div key={c.id} className="bg-bg-surface rounded-xl border border-border-default">
              <div className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text-primary">{c.nome}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300">
                      {c.tipo}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    Fator de produção: {(c.fator_producao * 100).toFixed(0)}%
                    {c.observacoes && ` · ${c.observacoes}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePattern(c.id)}
                    className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                      patternFor === c.id
                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                        : "border-border-default text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    Padrão de consumo
                  </button>
                  <button
                    onClick={() => openEditForm(c)}
                    className="p-2 rounded hover:bg-bg-surface-alt text-text-muted hover:text-text-primary"
                    aria-label="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-2 rounded hover:bg-danger-50 dark:hover:bg-danger-900/20 text-text-muted hover:text-danger-600"
                    aria-label="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {patternFor === c.id && (
                <div className="border-t border-border-default p-4 bg-bg-surface-alt rounded-b-xl">
                  {!pattern ? (
                    <p className="text-sm text-text-muted">Carregando padrão...</p>
                  ) : pattern.eventos_analisados === 0 ? (
                    <p className="text-sm text-text-muted">
                      Nenhum evento finalizado com balanço registrado ainda. Registre o
                      balanço (consumido / descartado / devolvido) no fim de cada evento
                      para aprender o padrão deste cliente.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-text-muted">
                        Base: {pattern.eventos_analisados} evento(s) finalizado(s)
                      </p>
                      {pattern.itens.map((item) => (
                        <div
                          key={item.item}
                          className="flex items-center justify-between text-sm py-2 px-3 bg-bg-surface rounded-lg"
                        >
                          <span className="text-text-primary font-medium">{item.item}</span>
                          <span className="text-text-muted">
                            Consome ~{fmtBase(item.media_consumida, item.unidade_base)}/evento
                            {item.consumo_por_convidado !== null &&
                              ` (${fmtBase(item.consumo_por_convidado, item.unidade_base)}/convidado)`}
                            {" · "}
                            descarta ~{fmtBase(item.media_descartada, item.unidade_base)}
                            {" · "}
                            devolve ~{fmtBase(item.media_devolvida, item.unidade_base)}
                          </span>
                        </div>
                      ))}
                      <p className="text-xs text-text-muted flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Ao criar a próxima produção deste cliente, use “Sugerir do histórico”.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="text-sm text-text-muted">
        <Link href="/productions/new" className="text-primary-600 dark:text-primary-400 hover:underline">
          Criar produção →
        </Link>{" "}
        vincule um cliente e receba a sugestão baseada no histórico.
      </div>
    </div>
  );
}
