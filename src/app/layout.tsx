import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevLogue — build in public, from real work",
  description:
    "Turn documented development sessions into evidence-based social content, storyboards and scheduled posts.",
};

const themeScript = `try{const t=localStorage.getItem("devlogue-theme")||"system";const d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
