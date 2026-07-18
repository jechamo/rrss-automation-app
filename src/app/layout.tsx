import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "LeadView",
  description: "LeadView — automatización de contenido para redes sociales",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
