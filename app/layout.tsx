import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "@/components/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fit Plan",
  description: "Seguimiento de entrenamiento, nutricion y progreso",
  applicationName: "Fit Plan",
  icons: {
    icon: [
      { url: "/brand/logo-transparent.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/brand/logo-transparent.png", type: "image/png" }],
  },
  openGraph: {
    title: "Fit Plan",
    description: "Seguimiento de entrenamiento, nutricion y progreso",
    type: "website",
    images: [{ url: "/brand/logo-bg.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fit Plan",
    description: "Seguimiento de entrenamiento, nutricion y progreso",
    images: ["/brand/logo-bg.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
