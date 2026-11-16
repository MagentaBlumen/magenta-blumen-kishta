"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: React.ReactNode;
  badge?: number;
};

export function AdminNav({ openOrderCount }: { openOrderCount: number }) {
  const pathname = usePathname();

  const items: Item[] = [
    {
      href: "/admin",
      label: "Heute",
      match: (p) =>
        p === "/admin" ||
        p.startsWith("/admin/bestellung") ||
        p.startsWith("/admin/kalender"),
      icon: (
        <svg
          className="icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="16" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      ),
      badge: openOrderCount,
    },
    {
      href: "/admin/produkte",
      label: "Produkte",
      match: (p) => p.startsWith("/admin/produkte"),
      icon: (
        <svg
          className="icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="8" r="2" />
          <circle cx="12" cy="4.2" r="1.9" />
          <circle cx="15.8" cy="8" r="1.9" />
          <circle cx="12" cy="11.8" r="1.9" />
          <circle cx="8.2" cy="8" r="1.9" />
          <path d="M12 13.8V21M12 18c-1.4-1.8-3.3-2.4-5-2.2M12 18c1.4-1.8 3.3-2.4 5-2.2" />
        </svg>
      ),
    },
    {
      href: "/admin/kunden",
      label: "Kunden",
      match: (p) => p.startsWith("/admin/kunden"),
      icon: (
        <svg
          className="icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16.5 14.2c2.9.3 5 2.4 5 5.8" />
        </svg>
      ),
    },
    {
      href: "/admin/einstellungen",
      label: "Einstellungen",
      match: (p) => p.startsWith("/admin/einstellungen"),
      icon: (
        <svg
          className="icon"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
          <circle cx="15" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      ),
    },
  ];

  return (
    <ul className="adm-nav">
      {items.map((item) => {
        const isActive = item.match(pathname);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon}
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="adm-nav__badge" aria-label="offen">
                  {item.badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
