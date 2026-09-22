"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";
import { useMember } from "@/components/MemberGate";

export function AppHeader() {
  const member = useMember();
  const name = member.fullName?.split(" ")[0] ?? member.email;
  return (
    <div className="enter-nav sticky top-0 z-30 px-4 pt-3 sm:pt-4">
      <nav className="nav-shell mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-2xl border border-line bg-ink/70 pl-5 pr-2 backdrop-blur-md sm:h-[68px] sm:pl-7 sm:pr-3">
        <Logo href="/dashboard/" />
        <div className="flex items-center gap-1 text-[13px] sm:gap-2">
          <Link href="/dashboard/" className="rounded-full px-3 py-2 text-bone/80 transition duration-300 hover:bg-elevated hover:text-bone">
            Courses
          </Link>
          {member.isAdmin && (
            <Link href="/admin/" className="rounded-full px-3 py-2 text-bone/80 transition duration-300 hover:bg-elevated hover:text-bone">
              Admin
            </Link>
          )}
          <span className="hidden max-w-40 truncate px-3 text-mute md:inline">{name}</span>
          <SignOutButton className="btn-primary px-4 py-2.5 text-[13px]" />
        </div>
      </nav>
    </div>
  );
}
