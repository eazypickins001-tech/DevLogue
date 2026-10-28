"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: "Create",
    items: [
      { href: "/projects", label: "Projects" },
      { href: "/sessions", label: "Sessions" },
      { href: "/record", label: "Record" },
    ],
  },
  {
    label: "Studio",
    items: [
      { href: "/studio", label: "Studio" },
      { href: "/timelines", label: "Timelines" },
      { href: "/video", label: "Worker" },
    ],
  },
  {
    label: "Publish",
    items: [
      { href: "/calendar", label: "Calendar" },
      { href: "/integrations", label: "Integrations" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/feedback", label: "Feedback" },
      { href: "/analytics", label: "Analytics" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/operations/errors", label: "Incidents" },
      { href: "/operations/storage", label: "Storage" },
      { href: "/settings", label: "Settings" },
      { href: "/help", label: "Help" },
    ],
  },
];

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const activeGroup = GROUPS.find((group) => group.items.some((item) => isActive(item.href)))?.label;

  useEffect(() => {
    if (!openGroup) return;
    menuRefs.current[openGroup]?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [openGroup]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (openGroup && desktopRef.current && !desktopRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (openGroup) {
        const group = openGroup;
        setOpenGroup(null);
        triggerRefs.current[group]?.focus();
      }
      if (mobileOpen) {
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openGroup, mobileOpen]);

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
    if (links.length === 0) return;
    event.preventDefault();
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next =
      index < 0
        ? event.key === "ArrowDown"
          ? 0
          : links.length - 1
        : event.key === "ArrowDown"
          ? (index + 1) % links.length
          : (index - 1 + links.length) % links.length;
    links[next]?.focus();
  }

  return (
    <nav aria-label="Main" className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 no-underline">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-sm font-bold text-white">
            DL
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">DevLogue</span>
        </Link>

        <div className="ml-auto flex items-center gap-2 min-[1400px]:order-3">
          <ThemeToggle />
          <button
            ref={mobileButtonRef}
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 min-[1400px]:hidden"
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>

        <div ref={desktopRef} className="relative hidden min-[1400px]:order-2 min-[1400px]:flex min-[1400px]:items-center min-[1400px]:gap-0.5">
          <Link
            href="/dashboard"
            aria-current={isActive("/dashboard") ? "page" : undefined}
            className={`rounded-md px-2.5 py-2 text-sm no-underline transition ${
              isActive("/dashboard")
                ? "bg-slate-100 font-medium text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            Dashboard
          </Link>
          {GROUPS.map((group) => (
            <div key={group.label} className="relative">
              <button
                ref={(node) => {
                  triggerRefs.current[group.label] = node;
                }}
                type="button"
                aria-expanded={openGroup === group.label}
                aria-haspopup="true"
                onClick={() => setOpenGroup((current) => (current === group.label ? null : group.label))}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-sm transition ${
                  activeGroup === group.label
                    ? "bg-slate-100 font-medium text-slate-900"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {group.label}
                <span aria-hidden="true" className="text-[10px] text-slate-400">
                  v
                </span>
              </button>
              {openGroup === group.label ? (
                <div
                  ref={(node) => {
                    menuRefs.current[group.label] = node;
                  }}
                  role="menu"
                  onKeyDown={onMenuKeyDown}
                  className="absolute left-0 top-full z-40 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                >
                  <ul className="space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          role="menuitem"
                          onClick={() => setOpenGroup(null)}
                          aria-current={isActive(item.href) ? "page" : undefined}
                          className={`block rounded-lg px-3 py-2 text-sm no-underline ${
                            isActive(item.href)
                              ? "bg-slate-100 font-medium text-slate-900"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {mobileOpen ? (
          <div
            id="mobile-nav"
            className="absolute left-0 right-0 top-[57px] z-30 max-h-[calc(100vh-57px)] overflow-y-auto border-b border-slate-200 bg-white p-4 shadow-sm min-[1400px]:hidden"
          >
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              aria-current={isActive("/dashboard") ? "page" : undefined}
              className={`block rounded-lg px-3 py-2 text-sm no-underline ${
                isActive("/dashboard")
                  ? "bg-slate-100 font-medium text-slate-900"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Dashboard
            </Link>
            {GROUPS.map((group) => (
              <div key={group.label} className="mt-4">
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {group.label}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={isActive(item.href) ? "page" : undefined}
                        className={`block rounded-lg px-3 py-2 text-sm no-underline ${
                          isActive(item.href)
                            ? "bg-slate-100 font-medium text-slate-900"
                            : "text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
