import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "RRSS Automation",
  description: "Automatizacion de contenido para redes sociales",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 min-w-0 p-6 lg:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
