import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { OfflineRegistration } from "@/components/offline-registration";
export const metadata: Metadata = {
  title: "Easy Pay — Safe Pay",
  description:
    "Simple, accessible payment guidance and fraud support. A fictional hackathon demo.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/app-icon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <OfflineRegistration />
      </body>
    </html>
  );
}
