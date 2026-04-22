import type { Metadata } from "next";
import { Roboto, Geist_Mono } from "next/font/google";
import "./globals.css";
import LayoutGrid from "@/components/layout/LayoutGrid";
import { getThemeCssVariables } from "@/constants";

const roboto = Roboto({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orbital — N-asset stablecoin AMM",
  description:
    "One pool. N stablecoins. 154× the capital efficiency of a flat sphere. Concentrated liquidity with automatic depeg isolation. Derived from the Paradigm Orbital paper.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${roboto.variable} ${geistMono.variable} h-full antialiased`}
      data-layout-grid="hidden"
      style={getThemeCssVariables("dark")}
    >
      <body
        className="min-h-full flex flex-col"
      >
        {children}
         {process.env.NODE_ENV === "development" && <LayoutGrid />}
      </body>
    </html>
  );
}
