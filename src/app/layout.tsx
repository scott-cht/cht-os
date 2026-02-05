import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { Notifications } from "@/components/ui/Notifications";
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
  title: "CHT Command Centre",
  description: "Centralized intelligence layer for product intake, marketing, and cross-platform synchronization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50 dark:bg-zinc-950`}
      >
        <ThemeProvider defaultTheme="dark">
          <QueryProvider>
            {children}
            <Notifications />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
