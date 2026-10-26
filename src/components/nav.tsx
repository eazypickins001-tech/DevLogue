"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/sessions", label: "Build Sessions" },
  { href: "/record", label: "Record" },
  { href: "/timelines", label: "Video Editor" },
  { href: "/studio", label: "Studio" },
  { href: "/video", label: "Video Production" },
  { href: "/calendar", label: "Publishing Calendar" },
  { href: "/feedback", label: "Feedback" },
  { href: "/analytics", label: "Analytics" },
  { href: "/integrations", label: "Integrations" },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Help" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Main" className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 no-underline">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            DL
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">DevLogue</span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="nav-links"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 lg:hidden"
          >
            Menu
          </button>
        </div>

        <ul
          id="nav-links"
          className={`${open ? "flex" : "hidden"} absolute left-0 right-0 top-[57px] z-20 flex-col gap-1 border-b border-slate-200 bg-white p-3 shadow-sm lg:static lg:z-auto lg:flex lg:flex-row lg:items-center lg:gap-0.5 lg:border-0 lg:p-0 lg:shadow-none`}
        >
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`block rounded-md px-2.5 py-2 text-sm no-underline transition ${
                  isActive(link.href)
                    ? "bg-slate-100 font-medium text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
