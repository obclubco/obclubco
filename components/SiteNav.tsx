"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Arrow } from "@/components/Icons";
import { InstallApp } from "@/components/InstallApp";

const linkClass =
  "relative py-1 transition duration-300 after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:bg-bone/70 after:transition-transform after:duration-500 after:ease-smooth hover:text-bone hover:after:scale-x-100";

/** Floating, bordered nav bar as on obclub.co, with optional page links. */
export function SiteNav({ cta, links = [] }: { cta?: React.ReactNode; links?: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="enter-nav sticky top-0 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-[max(1rem,env(safe-area-inset-top))]">
      <nav className="nav-shell mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-2xl border border-line bg-ink/70 pl-4 pr-2 backdrop-blur-md sm:h-[68px] sm:pl-7 sm:pr-3">
        <Logo href="/" />
        <div className="flex items-center gap-4 text-[12px] text-bone/80 sm:gap-7 sm:text-[13px]">
          {links.map((l) => {
            const active = pathname === l.href || pathname === l.href.replace(/\/$/, "");
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`${linkClass} ${active ? "text-bone after:scale-x-100" : "after:scale-x-0"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <InstallApp />
          {cta}
        </div>
      </nav>
    </div>
  );
}

/** A nav bar button: white (the page's main action) or outlined (`ghost`). */
export function NavButton({
  href,
  children,
  ghost = false,
  className: extra = "",
}: {
  href: string;
  children: React.ReactNode;
  ghost?: boolean;
  className?: string;
}) {
  const className = `${ghost ? "btn-ghost" : "btn-primary"} px-3.5 py-2 text-[12px] sm:px-5 sm:py-2.5 sm:text-[13px] ${extra}`;
  return href.startsWith("http") ? (
    <a href={href} className={className}>
      {children} <Arrow />
    </a>
  ) : (
    <Link href={href} className={className}>
      {children} <Arrow />
    </Link>
  );
}
