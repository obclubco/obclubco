import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Arrow } from "@/components/Icons";

/** Floating, bordered nav bar as on obclub.co. */
export function SiteNav({
  links,
  cta,
  logoHref = "/",
}: {
  links: { href: string; label: string }[];
  cta?: React.ReactNode;
  logoHref?: string;
}) {
  return (
    <div className="sticky top-0 z-30 px-4 pt-3 sm:pt-4">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-2xl border border-line bg-ink/80 pl-5 pr-2 backdrop-blur sm:h-[68px] sm:pl-7 sm:pr-3">
        <Logo href={logoHref} />
        <div className="hidden items-center gap-7 text-[13px] text-bone/80 md:flex">
          {links.map((l) =>
            l.href.startsWith("http") ? (
              <a key={l.href} href={l.href} className="transition hover:text-bone">
                {l.label}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className="transition hover:text-bone">
                {l.label}
              </Link>
            ),
          )}
        </div>
        {cta}
      </nav>
    </div>
  );
}

export function NavButton({ href, children }: { href: string; children: React.ReactNode }) {
  const className = "btn-primary px-4 py-2.5 text-[13px] sm:px-5";
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
