"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  count: number | null;
  icon: React.ReactNode;
};

export function KontoNav({
  orderCount,
  addressCount,
  trailing,
}: {
  orderCount: number;
  addressCount: number;
  trailing?: React.ReactNode;
}) {
  const pathname = usePathname();
  const items: Item[] = [
    {
      href: "/konto",
      label: "Übersicht",
      count: null,
      icon: (
        <svg
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
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
        </svg>
      ),
    },
    {
      href: "/konto/bestellungen",
      label: "Bestellungen",
      count: orderCount,
      icon: (
        <svg
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
          <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
          <path d="M3 7l9 4 9-4M12 11v10" />
        </svg>
      ),
    },
    {
      href: "/konto/adressen",
      label: "Empfänger",
      count: addressCount,
      icon: (
        <svg
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
      href: "/konto/einstellungen",
      label: "Profil",
      count: null,
      icon: (
        <svg
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
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      aria-label="Mein Konto"
      // Mobile: fixed bottom tab bar (one-hand thumb reach).
      // Desktop: vertical rail. Layout adds pb-28 on mobile.
      className={[
        "fixed bottom-0 inset-x-0 z-40 flex border-t border-mist bg-ivory",
        "lg:static lg:flex-col lg:bg-transparent lg:border-t-0",
        "[padding-bottom:env(safe-area-inset-bottom,0px)] lg:[padding-bottom:0]",
      ].join(" ")}
    >
      {items.map((item) => (
        <NavItem key={item.href} item={item} pathname={pathname} />
      ))}
      {trailing}
    </nav>
  );
}

function NavItem({ item, pathname }: { item: Item; pathname: string }) {
  // Exact match only — never highlight a parent route when a child is
  // active. Previously the <Link> active-state also applied hover
  // bg-cream, which could stick after a focus and look like a second
  // active item; now only aria-current drives the background.
  const isActive = pathname === item.href;
  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      className={[
        // Mobile tab
        "flex-1 min-w-0 min-h-16 flex flex-col items-center justify-center gap-1 px-1 py-2 text-[12px]",
        // Desktop list row
        "lg:flex-none lg:flex-row lg:items-center lg:justify-start lg:min-h-[52px] lg:px-3.5 lg:py-0 lg:gap-3 lg:text-[15px]",
        "lg:border-b lg:border-hair",
        "transition-colors",
        isActive
          ? [
              // Mobile: rose icon/label with top accent bar.
              "text-rose shadow-[inset_0_3px_0_var(--color-rose)]",
              // Desktop: cream bg + bark text + left rose accent.
              "lg:shadow-[inset_3px_0_0_var(--color-rose)]",
              "lg:bg-cream lg:text-bark font-semibold",
            ].join(" ")
          : "text-sage hover:text-rose lg:hover:text-bark",
      ].join(" ")}
    >
      <span aria-hidden className="lg:hidden">
        {item.icon}
      </span>
      <span aria-hidden className="hidden lg:inline-flex">
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
      {item.count !== null && (
        <span
          className={`hidden lg:inline ml-auto text-[12px] tabular-nums ${
            isActive ? "text-rose font-semibold" : "text-sage"
          }`}
        >
          {item.count}
        </span>
      )}
    </Link>
  );
}
