import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booking Platform POC",
  description: "Multi-tenant SaaS booking platform with dynamic pricing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
