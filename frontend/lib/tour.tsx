"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

/**
 * Tutorial guiado (usável):
 * - Spotlight: só o alvo fica clicável; o resto fica dimmed/bloqueado
 * - Card perto do alvo (não cobre o botão pedido)
 * - Leva sozinho pra tela certa antes de pedir o clique
 */

const DONE_KEY = "tour_v3_done";
const REPLAY_KEY = "tour_v3_replay";

interface Step {
  title: string;
  body: string;
  target?: string;
  /** Garante que estamos nesta rota antes de destacar o alvo */
  requirePath?: string;
}

const STEPS: Step[] = [
  {
    title: "Bem-vinda ao redu",
    body: "Em 3 toques você aprende o caminho principal. Pode pular quando quiser.",
  },
  {
    title: "1 · Receitas",
    body: "Aqui você cadastra o que produz. Toque em Receitas.",
    target: '[data-tour="nav-recipes"]',
  },
  {
    title: "2 · Eventos",
    body: "Cada festa ou turno vira um evento. Toque em Eventos.",
    target: '[data-tour="nav-events"]',
  },
  {
    title: "3 · Criar evento",
    body: "Dentro de Eventos, toque em Novo evento.",
    target: '[data-tour="btn-new-event"]',
    requirePath: "/productions",
  },
  {
    title: "Pronto!",
    body: "Fluxo básico: Receitas → Eventos → Novo evento. Refaça quando quiser em Ajuda.",
  },
];

let replayListener: (() => void) | null = null;

export function startTour(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DONE_KEY);
    localStorage.setItem(REPLAY_KEY, "1");
  } catch {
    /* ignore */
  }
  replayListener?.();
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function pickVisible(selector: string): HTMLElement | null {
  for (const node of document.querySelectorAll<HTMLElement>(selector)) {
    if (isVisible(node)) return node;
  }
  return null;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function toRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function OnboardingTour() {
  const pathname = usePathname();
  const router = useRouter();
  const [step, setStep] = useState(-1);
  const [hole, setHole] = useState<Rect | null>(null);

  const close = useCallback(() => {
    setStep(-1);
    setHole(null);
    try {
      localStorage.setItem(DONE_KEY, "1");
      localStorage.removeItem(REPLAY_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const goNext = useCallback(() => {
    setStep((s) => {
      if (s < 0) return s;
      if (s >= STEPS.length - 1) {
        // último — fecha no botão, não aqui
        return s;
      }
      return s + 1;
    });
  }, []);

  // auto-start / replay
  useEffect(() => {
    if (step !== -1) return;
    try {
      const replay = localStorage.getItem(REPLAY_KEY) === "1";
      const done = localStorage.getItem(DONE_KEY) === "1";
      if (replay || (!done && pathname === "/dashboard")) {
        setStep(0);
      }
    } catch {
      /* ignore */
    }
  }, [pathname, step]);

  useEffect(() => {
    replayListener = () => {
      setHole(null);
      setStep(0);
    };
    return () => {
      replayListener = null;
    };
  }, []);

  // leva pra rota exigida pelo passo
  useEffect(() => {
    if (step < 0) return;
    const need = STEPS[step]?.requirePath;
    if (!need) return;
    if (pathname === need || pathname.startsWith(`${need}/`)) {
      // /productions/new não deve contar pra passo que precisa da lista
      if (need === "/productions" && pathname !== "/productions") {
        router.replace("/productions");
      }
      return;
    }
    router.push(need);
  }, [step, pathname, router]);

  // mede o buraco do spotlight
  useLayoutEffect(() => {
    if (step < 0) {
      setHole(null);
      return;
    }
    const selector = STEPS[step]?.target;
    if (!selector) {
      setHole(null);
      return;
    }

    let cancelled = false;
    let tries = 0;

    const measure = () => {
      if (cancelled) return;
      const el = pickVisible(selector);
      if (el) {
        setHole(toRect(el));
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      setHole(null);
      if (tries++ < 40) requestAnimationFrame(measure);
    };
    measure();

    const onWin = () => {
      const el = pickVisible(selector);
      setHole(el ? toRect(el) : null);
    };
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [step, pathname]);

  // clique no alvo → avança (deixa o Link navegar)
  useEffect(() => {
    if (step < 0) return;
    const selector = STEPS[step]?.target;
    if (!selector) return;

    const onClick = (event: MouseEvent) => {
      const clicked = event.target as Element | null;
      if (!clicked || clicked.closest("[data-tour-card]")) return;
      const visible = pickVisible(selector);
      if (!visible) return;
      const hit = clicked.closest(selector);
      if (!hit || hit !== visible) return;
      // deixa o click natural; avança em seguida
      window.setTimeout(() => goNext(), 80);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step, goNext]);

  useEffect(() => {
    if (step < 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, close]);

  if (step < 0) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const interactive = Boolean(current.target);
  const pad = 8;

  const holeStyle =
    hole &&
    ({
      top: Math.max(0, hole.top - pad),
      left: Math.max(0, hole.left - pad),
      width: hole.width + pad * 2,
      height: hole.height + pad * 2,
    } as const);

  // card: se o alvo está na metade de baixo, card sobe; senão fica abaixo do alvo
  const cardNearBottom = hole ? hole.top > window.innerHeight * 0.45 : false;

  return (
    <div
      className="fixed inset-0 z-[200] pointer-events-none"
      aria-label="Tutorial"
      role="dialog"
      aria-modal="true"
    >
      {/* Spotlight: 4 painéis bloqueiam cliques fora do alvo */}
      {interactive && holeStyle ? (
        <>
          <div
            className="absolute left-0 right-0 top-0 bg-black/55 pointer-events-auto"
            style={{ height: holeStyle.top }}
          />
          <div
            className="absolute left-0 bg-black/55 pointer-events-auto"
            style={{
              top: holeStyle.top,
              width: holeStyle.left,
              height: holeStyle.height,
            }}
          />
          <div
            className="absolute right-0 bg-black/55 pointer-events-auto"
            style={{
              top: holeStyle.top,
              left: holeStyle.left + holeStyle.width,
              height: holeStyle.height,
            }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-black/55 pointer-events-auto"
            style={{ top: holeStyle.top + holeStyle.height }}
          />
          <div
            className="absolute rounded-xl ring-4 ring-primary-400 pointer-events-none animate-pulse"
            style={holeStyle}
          />
        </>
      ) : interactive ? (
        <div className="absolute inset-0 bg-black/35 pointer-events-none" />
      ) : (
        <div className="absolute inset-0 bg-black/45 pointer-events-auto" onClick={close} />
      )}

      {/* Card de instrução */}
      <div
        data-tour-card
        className={`pointer-events-auto absolute left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[22rem] bg-bg-surface border border-border-default rounded-2xl shadow-2xl p-4 ${
          interactive && cardNearBottom
            ? "top-20"
            : interactive && holeStyle
              ? ""
              : "top-1/2 -translate-y-1/2"
        }`}
        style={
          interactive && holeStyle && !cardNearBottom
            ? { top: Math.min(holeStyle.top + holeStyle.height + 12, window.innerHeight - 220) }
            : undefined
        }
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
            Tutorial · {step + 1}/{STEPS.length}
          </p>
          <button
            type="button"
            onClick={close}
            className="text-text-muted hover:text-text-primary p-1"
            aria-label="Fechar tutorial"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? "bg-primary-500" : "bg-bg-surface-alt"
              }`}
            />
          ))}
        </div>

        <h3 className="text-lg font-semibold text-text-primary">{current.title}</h3>
        <p className="text-sm text-text-secondary mt-1 leading-relaxed">{current.body}</p>

        {interactive && !holeStyle && (
          <p className="mt-3 text-sm text-text-muted">Abrindo a tela…</p>
        )}
        {interactive && holeStyle && (
          <p className="mt-3 text-sm font-medium text-primary-700 dark:text-primary-300">
            Toque no item iluminado para continuar.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 mt-4">
          <button
            type="button"
            onClick={close}
            className="text-sm text-text-muted hover:text-text-primary"
          >
            Pular
          </button>

          {!interactive && (
            <button
              type="button"
              onClick={() => {
                if (isLast) {
                  close();
                  return;
                }
                if (isFirst && pathname !== "/dashboard") {
                  router.push("/dashboard");
                }
                goNext();
              }}
              className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-text-inverse text-sm font-medium rounded-lg inline-flex items-center gap-1.5"
            >
              {isLast ? (
                <>
                  <Check className="w-4 h-4" />
                  Concluir
                </>
              ) : (
                "Começar"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
