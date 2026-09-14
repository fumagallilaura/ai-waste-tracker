"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, UtensilsCrossed, BarChart3 } from "lucide-react";

interface Item {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  tourId?: string;
}

const ITEMS: Item[] = [
  { href: "/dashboard", label: "Início", Icon: LayoutDashboard },
  { href: "/recipes", label: "Receitas", Icon: BookOpen, tourId: "nav-recipes" },
  { href: "/productions", label: "Eventos", Icon: UtensilsCrossed, tourId: "nav-events" },
  { href: "/analises", label: "Análises", Icon: BarChart3 },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  // Eventos inclui lista, novo e detalhe
  if (href === "/productions") return pathname.startsWith("/productions");
  return pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-bg-surface border-t border-border-default"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ href, label, Icon, tourId }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                data-tour={tourId}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${
                  active
                    ? "text-primary-600 dark:text-primary-400"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
