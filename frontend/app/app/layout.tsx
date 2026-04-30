import type { ReactNode } from "react";
import { AppNav } from "@/components/app/layout/AppNav";
import { AppFooter } from "@/components/app/layout/AppFooter";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-screen flex flex-col">
      <AppNav />
      <main className="flex-1 mx-4 flex flex-col overflow-auto">{children}</main>
      <AppFooter />
    </div>
  );
}
