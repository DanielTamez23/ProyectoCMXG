import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Station Management Pro",
  description: "Advanced personnel assignment and station tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen text-slate-900 antialiased selection:bg-blue-300/40`}>
        {children}
      </body>
    </html>
  );
}
