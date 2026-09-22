"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";
import { useMember } from "@/components/MemberGate";

export function AppHeader() {
  const member = useMember();
  const name = member.fullName?.split(" ")[0] ?? member.email;
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/80 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo href="/dashboard/" />
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href="/dashboard/" className="rounded-full px-3 py-2 text-mute hover:text-bone">
            Courses
          </Link>
          {member.isAdmin && (
            <Link href="/admin/" className="rounded-full px-3 py-2 text-mute hover:text-bone">
              Admin
            </Link>
          )}
          <span className="hidden max-w-40 truncate px-3 text-mute/70 md:inline">{name}</span>
          <SignOutButton className="rounded-full border border-line px-4 py-2 text-mute hover:border-bone/40 hover:text-bone" />
        </nav>
      </div>
    </header>
  );
}
