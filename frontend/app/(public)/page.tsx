"use client";

import Link from "next/link";
import { useEffect, useState, useDeferredValue } from "react";
import { Fraunces, DM_Sans } from "next/font/google";
import { getAccessToken } from "@/lib/auth";
import { BrandMark } from "@/components/BrandMark";
import { ArrowRight, ChevronRight } from "lucide-react";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-landing-display",
});

const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-landing-sans",
});

const COST_PER_PORTION = 8.5; // R$ estimado sobrando por porção
const SMART_FACTOR = 0.7;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function EventSimulator() {
  const [guests, setGuests] = useState(80);
  const deferred = useDeferredValue(guests);
  const naive = deferred;
  const smart = Math.round(deferred * SMART_FACTOR);
  const wastePortions = naive - smart;
  const saved = wastePortions * COST_PER_PORTION;

  return (
    <section
      data-testid="landing-simulator"
      className="relative mx-auto max-w-3xl px-4"
      aria-labelledby="sim-title"
    >
      <div className="rounded-3xl border border-border-default/80 bg-bg-surface/80 p-6 shadow-[0_24px_60px_-40px_rgba(42,22,14,0.45)] backdrop-blur-md sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-400">
          Experimente agora
        </p>
        <h2
          id="sim-title"
          className={`${display.className} mt-2 text-2xl font-semibold text-text-primary sm:text-3xl`}
        >
          Quanto você deixa na mesa?
        </h2>
        <p className="mt-2 max-w-xl text-sm text-text-secondary">
          Arraste o número de convidados e veja a diferença entre produzir “1 por pessoa” e produzir com o fator do redu.
        </p>

        <label className="mt-8 block">
          <div className="mb-3 flex items-end justify-between gap-3">
            <span className="text-sm font-medium text-text-secondary">Convidados</span>
            <span className={`${display.className} text-4xl font-semibold tabular-nums text-text-primary`}>
              {guests}
            </span>
          </div>
          <input
            type="range"
            min={20}
            max={200}
            step={5}
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="landing-range w-full"
            aria-valuetext={`${guests} convidados`}
          />
          <div className="mt-1 flex justify-between text-xs text-text-muted">
            <span>20</span>
            <span>200</span>
          </div>
        </label>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-warning-50/80 p-5 dark:bg-warning-50/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning-700 dark:text-warning-400">
              Sem o redu
            </p>
            <p className={`${display.className} mt-3 text-3xl font-semibold tabular-nums text-text-primary`}>
              {naive}
              <span className="ml-1 text-base font-medium text-text-secondary">porções</span>
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              1 por pessoa. Sobra típica: ~{wastePortions} porções.
            </p>
          </div>

          <div className="rounded-2xl bg-primary-50/90 p-5 ring-1 ring-primary-200/60 dark:bg-primary-50/30 dark:ring-primary-400/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-400">
              Com o redu
            </p>
            <p className={`${display.className} mt-3 text-3xl font-semibold tabular-nums text-text-primary`}>
              {smart}
              <span className="ml-1 text-base font-medium text-text-secondary">porções</span>
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Fator 70% — você ajusta por cliente depois.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl bg-bg-surface-alt px-5 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-text-secondary">Economia estimada neste evento</p>
            <p
              key={saved}
              className={`${display.className} animate-landing-pop text-3xl font-semibold tabular-nums text-primary-600 dark:text-primary-400`}
            >
              {formatBRL(saved)}
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-border-default">
            <div
              className="h-full rounded-full bg-primary-500 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(100, (wastePortions / Math.max(naive, 1)) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getAccessToken());
  }, []);

  return (
    <div className={`${sans.variable} ${display.variable} ${sans.className} landing-page`}>
      {/* Hero — one composition */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 landing-hero-glow"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl animate-landing-float"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-warning-400/15 blur-3xl animate-landing-float-delayed"
        />

        <div className="relative mx-auto flex min-h-[min(88vh,760px)] max-w-5xl flex-col items-center justify-center px-4 pb-16 pt-10 text-center sm:pt-14">
          <div className="mb-8 animate-landing-rise">
            <BrandMark href="/" size="lg" />
          </div>

          <h1
            className={`${display.className} max-w-2xl animate-landing-rise text-4xl font-semibold leading-[1.1] tracking-tight text-text-primary sm:text-5xl md:text-6xl`}
            style={{ animationDelay: "80ms" }}
          >
            Produza certo.
            <br />
            <span className="text-primary-600 dark:text-primary-400">Desperdice menos.</span>
          </h1>

          <p
            className="mt-5 max-w-md animate-landing-rise text-base text-text-secondary sm:text-lg"
            style={{ animationDelay: "140ms" }}
          >
            Do evento à lista de compras — e de volta ao estoque — em minutos.
          </p>

          <div
            className="mt-9 flex animate-landing-rise flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "200ms" }}
          >
            {loggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-7 py-3.5 text-sm font-semibold text-text-inverse transition hover:bg-primary-700"
              >
                Ir para o app
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/comecar"
                  data-testid="landing-trial"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-7 py-3.5 text-sm font-semibold text-text-inverse transition hover:bg-primary-700"
                >
                  Ver na prática
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-bg-surface/70 px-6 py-3.5 text-sm font-semibold text-text-primary backdrop-blur transition hover:border-primary-400"
                >
                  Criar conta grátis
                </Link>
              </>
            )}
          </div>

          {!loggedIn && (
            <Link
              href="/login"
              className="mt-4 animate-landing-rise text-sm text-text-muted underline-offset-4 hover:text-text-secondary hover:underline"
              style={{ animationDelay: "260ms" }}
            >
              Já tenho conta — entrar
            </Link>
          )}

          <div
            className="mt-14 hidden w-full max-w-lg animate-landing-rise sm:block"
            style={{ animationDelay: "320ms" }}
            aria-hidden
          >
            <div className="landing-hero-stage relative mx-auto h-40 overflow-hidden rounded-[2rem] border border-border-default/60 bg-bg-surface/50 shadow-[0_30px_80px_-50px_rgba(42,22,14,0.5)] backdrop-blur">
              <div className="absolute inset-x-6 top-5 flex items-center justify-between text-[11px] font-medium text-text-muted">
                <span>Evento · 80 pessoas</span>
                <span className="rounded-full bg-primary-100 px-2 py-0.5 text-primary-700 dark:bg-primary-50 dark:text-primary-400">
                  −30% desperdício
                </span>
              </div>
              <div className="absolute inset-x-6 bottom-6 flex items-end gap-2">
                <div className="h-16 flex-1 rounded-t-lg bg-warning-300/80 dark:bg-warning-400/50" />
                <div className="h-11 flex-1 rounded-t-lg bg-primary-500/90" />
                <div className="h-14 flex-1 rounded-t-lg bg-primary-400/70" />
                <div className="h-8 flex-1 rounded-t-lg bg-warning-200/90 dark:bg-warning-300/40" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive power demo */}
      <div className="pb-20 pt-4">
        <EventSimulator />
      </div>

      {/* 3 beats — minimal copy */}
      <section className="mx-auto max-w-4xl px-4 pb-24" aria-label="Como funciona">
        <ol className="grid gap-8 sm:grid-cols-3">
          {[
            { n: "01", t: "Monte o evento", d: "Receitas × quantidade. Lista de compras pronta." },
            { n: "02", t: "Feche o balanço", d: "Consumido, descartado, o que volta ao estoque." },
            { n: "03", t: "Aprenda o cliente", d: "O próximo evento já nasce no fator certo." },
          ].map((step) => (
            <li key={step.n} className="relative">
              <p className={`${display.className} text-4xl font-semibold text-primary-500/35 dark:text-primary-400/30`}>
                {step.n}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-text-primary">{step.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">{step.d}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14 flex justify-center">
          <Link
            href={loggedIn ? "/dashboard" : "/comecar"}
            data-testid={loggedIn ? undefined : "landing-trial-secondary"}
            className="group inline-flex items-center gap-1 text-sm font-semibold text-primary-600 transition hover:text-primary-700 dark:text-primary-400"
          >
            {loggedIn ? "Abrir o dashboard" : "Testar sem cadastro"}
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <p className="pb-8 text-center text-xs text-text-muted">
        <Link href="/termos" className="hover:underline">
          Termos de uso
        </Link>
        {" · "}
        <Link href="/privacidade" className="hover:underline">
          Privacidade
        </Link>
      </p>
    </div>
  );
}
