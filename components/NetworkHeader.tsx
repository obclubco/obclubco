"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { useMe } from "@/components/GuestGate";
import { Calendar, Home, Shield, User, Users } from "@/components/Icons";
import { InstallApp } from "@/components/InstallApp";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";

/** The site's sections. Detail pages (/event/, /guest/) light up their list's tab. */
const SECTIONS = [
  { href: "/home/", label: "Home", icon: Home, match: ["/home"] },
  { href: "/events/", label: "Events", icon: Calendar, match: ["/events", "/event"] },
  { href: "/guests/", label: "Guests", icon: Users, match: ["/guests", "/guest"] },
  { href: "/profile/", label: "Profile", icon: User, match: ["/profile"] },
];
const ADMIN = { href: "/manage/", label: "Admin", icon: Shield, match: ["/manage"] };

function useActive() {
  const path = usePathname().replace(/\/$/, "") || "/";
  return (match: string[]) => match.includes(path);
}

/** Floating top bar. On phones the sections move to the bottom tab bar. */
export function NetworkHeader() {
  const me = useMe();
  const isActive = useActive();
  const links = me.is_admin ? [...SECTIONS.slice(0, 3), ADMIN] : SECTIONS.slice(0, 3);

  return (
    <div className="enter-nav sticky top-0 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-[max(1rem,env(safe-area-inset-top))]">
      <nav className="nav-shell mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-2xl border border-line bg-ink/70 pl-5 pr-2 backdrop-blur-md sm:h-[68px] sm:pl-7 sm:pr-3">
        <Logo href="/home/" />
        <div className="hidden items-center gap-1 text-[13px] md:flex">
          {links.map((l) => {
            const active = isActive(l.match);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 transition duration-300 hover:bg-elevated hover:text-bone ${active ? "bg-elevated text-bone" : "text-bone/70"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          {me.is_admin && (
            <Link
              href={ADMIN.href}
              className={`rounded-full px-3 py-2 text-[12px] transition hover:text-bone md:hidden ${isActive(ADMIN.match) ? "text-bone" : "text-bone/70"}`}
            >
              Admin
            </Link>
          )}
          <Link
            href="/profile/"
            aria-label="Your profile"
            className={`group hidden items-center gap-2.5 rounded-full py-1 pl-1 pr-3 text-[13px] transition duration-300 hover:bg-elevated md:flex ${isActive(SECTIONS[3].match) ? "bg-elevated text-bone" : "text-bone/80"}`}
          >
            <Avatar name={me.full_name} url={me.photo_url} size="xs" />
            <span className="hidden max-w-32 truncate lg:inline">{me.full_name.split(" ")[0]}</span>
          </Link>
          <InstallApp aboveTabBar />
          <SignOutButton className="btn-primary px-4 py-2.5 text-[13px]" />
        </div>
      </nav>
    </div>
  );
}

/** Phones: the sections as an app-style tab bar at the bottom of the screen. */
export function TabBar() {
  const me = useMe();
  const isActive = useActive();
  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-ink/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-4">
        {SECTIONS.map((s) => {
          const active = isActive(s.match);
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] uppercase tracking-[0.18em] transition duration-300 ${active ? "text-bone" : "text-mute hover:text-bone"}`}
            >
              {s.href === "/profile/" ? (
                <Avatar name={me.full_name} url={me.photo_url} size="2xs" className={active ? "ring-1 ring-bone ring-offset-2 ring-offset-ink" : ""} />
              ) : (
                <Icon className="size-[22px]" />
              )}
              {s.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
