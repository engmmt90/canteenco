import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CanteenCo",
  description: "School canteen wallets, pre-orders and student payments.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
