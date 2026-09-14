import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { Analytics } from "@/components/Analytics";
import { Toaster } from "@/lib/toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "redu — Produza certo, desperdice menos",
  description:
    "Gestão de desperdício alimentar para pequenos negócios. Receitas, eventos, lista de compras e controle de desperdício em 30 segundos.",
  keywords: [
    "redu",
    "desperdício de alimentos",
    "calculadora de desperdício",
    "gestão de restaurante",
    "CMV",
    "buffet",
    "eventos",
  ],
  manifest: "/manifest.json",
  icons: {
    icon: "/logoredu.png",
    apple: "/logoredu.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#457D2C",
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
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
