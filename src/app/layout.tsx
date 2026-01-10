import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coding Tutor",
  description: "AI-powered coding tutor using Claude",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
