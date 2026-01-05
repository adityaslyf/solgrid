import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { SolanaProvider } from "@/components/solana-provider";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "SolGrid | Dots & Boxes",
  description: "A premium Solana-based Dots & Boxes game.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} font-sans min-h-screen`}>
        <SolanaProvider>
          {children}
        </SolanaProvider>
      </body>
    </html>
  );
}
