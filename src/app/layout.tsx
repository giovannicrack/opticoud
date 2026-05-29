import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OptiCoud — Gestión de Proyectos con IA",
    template: "%s | OptiCoud",
  },
  description: "Panel de control para gestionar proyectos y ejecutar tareas con Claude Code CLI.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
