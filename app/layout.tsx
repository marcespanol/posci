import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Posci Poster Builder",
  description: "Scientific poster builder MVP"
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
