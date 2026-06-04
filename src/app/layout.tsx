import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grassroots Cocktail Recommender",
  description: "Cabinet-aware cocktail recommendations with flavor and vibe matching."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
