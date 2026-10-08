import type { Metadata } from "next";
import { AppChrome } from "@/components/layout/app-chrome";
import { AppProviders } from "@/features/shared/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Botica Farma",
  description: "Portal operativo por empresa para boticas y farmacias.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Font Awesome local se mantiene temporalmente para conservar los iconos legacy. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/legacy/css/all.min.css" />
        <link rel="icon" href="/legacy/logo/logo.png" />
      </head>
      <body>
        <AppProviders>
          <AppChrome>{children}</AppChrome>
        </AppProviders>
      </body>
    </html>
  );
}
