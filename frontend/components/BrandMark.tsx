"use client";

import Image from "next/image";
import Link from "next/link";
import { useTheme } from "@/lib/theme";

type Size = "sm" | "md" | "lg";

const HEIGHT: Record<Size, number> = {
  sm: 40,
  md: 52,
  lg: 88,
};

/** Marca redu — PNGs com fundo transparente; wordmark muda no light/dark. */
export function BrandMark({
  href = "/",
  size = "md",
}: {
  href?: string;
  size?: Size;
}) {
  const { resolvedTheme } = useTheme();
  const h = HEIGHT[size];
  const logoW = Math.round(h * (743 / 288));
  const titleW = Math.round(h * (602 / 208));
  const titleSrc =
    resolvedTheme === "dark" ? "/titleredu-dark.png" : "/titleredu-light.png";

  return (
    <Link
      href={href}
      aria-label="redu — início"
      className="inline-flex items-center gap-2 shrink-0"
    >
      <Image
        src="/logoredu.png"
        alt=""
        width={logoW}
        height={h}
        className="object-contain"
        style={{ height: h, width: "auto" }}
        priority
      />
      <Image
        src={titleSrc}
        alt="redu"
        width={titleW}
        height={h}
        className="object-contain"
        style={{ height: h, width: "auto" }}
        priority
      />
    </Link>
  );
}
