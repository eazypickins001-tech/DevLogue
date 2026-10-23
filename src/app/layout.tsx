import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevLogue — build in public, from real work",
  description:
    "Turn documented development sessions into evidence-based social content, storyboards and scheduled posts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
