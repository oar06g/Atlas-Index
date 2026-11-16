import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ModelPullProvider } from "./_components/model-pull-provider";
import { ModelPullToast } from "./_components/model-pull-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atlas Index | Local Knowledge Assistant",
  description: "A private, offline-first knowledge base with semantic search.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ModelPullProvider>
          {children}
          <ModelPullToast />
        </ModelPullProvider>
      </body>
    </html>
  );
}
