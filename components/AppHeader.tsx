"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";
import { useMember } from "@/components/MemberGate";
import { InstallApp } from "@/components/InstallApp";

export function AppHeader() {
  const member = useMember();
  const name = member.fullName?.split(" ")[0] ?? member.email;
  return (
    <div className="enter-nav sticky top-0 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-[max(1rem,env(safe-area-inset-top))]">
      <nav className="nav-shell mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-2xl border border-line bg-ink/70 pl-5 pr-2 backdrop-blur-md sm:h-[68px] sm:pl-7 sm:pr-3">
        <Logo href="/dashboard/" />
        <div className="flex items-center gap-0.5 text-[12px] sm:gap-2 sm:text-[13px]">
          <Link href="/dashboard/" className="rounded-full px-2 py-2 text-bone/80 transition duration-300 hover:bg-elevated hover:text-bone sm:px-3">
            Courses
          </Link>
          {member.isAdmin && (
            <Link href="/admin/" className="rounded-full px-2 py-2 text-bone/80 transition duration-300 hover:bg-elevated hover:text-bone sm:px-3">
              Admin
            </Link>
          )}
          {member.isAdmin && (
            <Link href="/admin/social/" className="hidden rounded-full px-2 py-2 text-bone/80 transition duration-300 hover:bg-elevated hover:text-bone sm:inline sm:px-3">
              Social
            </Link>
          )}
          <span className="hidden max-w-40 truncate px-3 text-mute md:inline">{name}</span>
          <InstallApp />
          <SignOutButton className="btn-primary px-3.5 py-2 text-[12px] sm:px-4 sm:py-2.5 sm:text-[13px]" />
        </div>
      </nav>
    </div>
  );
}
