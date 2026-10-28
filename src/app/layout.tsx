import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { GUION_TEMA } from "@/componentes/InterruptorTema";
import { Navbar } from "@/componentes/Navbar";
import { PieDePagina } from "@/componentes/PieDePagina";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luka",
  description: "Sigue el rastro de tu plata. Control de gastos mensuales del hogar.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sin maximumScale: bloquear el zoom rompe la accesibilidad.
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        {/* Corre antes de pintar: sin esto se ve un destello del tema
            equivocado al cargar. */}
        <script dangerouslySetInnerHTML={{ __html: GUION_TEMA }} />
      </head>
      <body className="font-sans antialiased">
        {/* Suspense porque el navbar lee los parametros de la URL para
            conservar el mes al cambiar de pestana. El hueco mide lo mismo
            que el navbar en reposo (4.5rem mas su pt-3) para que la pagina
            no salte cuando aparece. */}
        <Suspense fallback={<div className="h-[calc(4.5rem+0.75rem)]" />}>
          <Navbar />
        </Suspense>
        {children}
        <PieDePagina />
      </body>
    </html>
  );
}
