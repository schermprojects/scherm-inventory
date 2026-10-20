import type { Metadata } from "next";

import { AuthSessionProvider } from "@/components/auth/AuthSessionProvider";
import { ToastProvider } from "@/components/ui/Toast";

import "./globals.css";

export const metadata: Metadata = {
  title: {
  default: "Schermix",
  template: "%s | Schermix",
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
        <AuthSessionProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
