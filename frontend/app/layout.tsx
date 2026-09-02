import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Desperdício Zero — Descubra onde está perdendo dinheiro",
  description:
    "Gestão de desperdício alimentar para pequenos negócios. Receitas, eventos, lista de compras e controle de desperdício em 30 segundos.",
  keywords: [
    "desperdício de alimentos",
    "calculadora de desperdício",
    "gestão de restaurante",
    "CMV",
    "buffet",
    "eventos",
  ],
  manifest: "/manifest.json",
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
