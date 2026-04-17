import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Web3Provider } from "@/components/Web3Provider";

const geistMono = localFont({
  src: [
    { path: "../public/Geist_Mono/static/GeistMono-Regular.ttf",  weight: "400", style: "normal" },
    { path: "../public/Geist_Mono/static/GeistMono-Medium.ttf",   weight: "500", style: "normal" },
    { path: "../public/Geist_Mono/static/GeistMono-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/Geist_Mono/static/GeistMono-Bold.ttf",     weight: "700", style: "normal" },
  ],
  variable: "--font-geist-mono",
  display: "block",
});

export const metadata: Metadata = {
  title: "Swap",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full dark`}>
      <body className="min-h-full flex flex-col">
        <Web3Provider>
          <ThemeProvider>{children}</ThemeProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
