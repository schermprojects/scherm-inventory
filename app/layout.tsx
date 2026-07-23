import type { Metadata } from "next";

import { ToastProvider } from "@/components/ui/Toast";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Scherm Inventory",
    template: "%s | Scherm Inventory",
  },
  description:
    "Controle interno de equipamentos e estoque de infraestrutura e HPC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}