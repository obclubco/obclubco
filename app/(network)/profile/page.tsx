"use client";

import { useMe, useSetMe } from "@/components/GuestGate";
import { PasswordForm } from "@/components/PasswordForm";
import { ProfileEditor } from "@/components/ProfileEditor";
import { SignOutButton } from "@/components/SignOutButton";
import { SplitWords } from "@/components/SplitWords";
import { usePageTitle } from "@/lib/hooks";

export default function ProfilePage() {
  const me = useMe();
  const setMe = useSetMe();
  usePageTitle("Your profile");

  return (
    <div className="container-x py-12 sm:py-16">
      <p className="eyebrow enter">Your profile</p>
      <h1 className="display mt-4 text-5xl sm:text-6xl">
        <SplitWords text="How Others See You." delay={100} step={90} />
      </h1>
      <p className="enter mt-4 max-w-xl text-mute" style={{ "--d": "400ms" } as React.CSSProperties}>
        Guests you&apos;ve met at OB Club events see this. A photo, what you do and what you&apos;re looking for go a long
        way.
      </p>

      <div className="enter mt-12" style={{ "--d": "500ms" } as React.CSSProperties}>
        <ProfileEditor me={me} onSaved={setMe} />
      </div>

      <section className="mt-20">
        <h2 data-reveal className="display border-b border-line pb-4 text-3xl">
          Account
        </h2>
        <div data-reveal className="card mt-6 grid gap-8 bg-surface/80 p-6 backdrop-blur sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="min-w-0">
            <p className="text-xs text-mute">Logged in as</p>
            <p className="mt-1 break-all">{me.email}</p>
            <p className="mt-4 text-xs leading-5 text-mute">
              Your login email can only be changed by the OBC team.
            </p>
            <SignOutButton className="btn-ghost mt-6 px-5 py-2.5 text-[13px]" />
          </div>
          <div>
            <p className="mb-4 text-sm">Change your password</p>
            <PasswordForm email={me.email} />
          </div>
        </div>
      </section>
    </div>
  );
}
