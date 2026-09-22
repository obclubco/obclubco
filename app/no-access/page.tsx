import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Starfield } from "@/components/Starfield";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata = { title: "Access pending" };

export default function NoAccess() {
  return (
    <main className="grain relative flex min-h-dvh flex-col">
      <Starfield count={110} />
      <div className="container-x relative flex h-20 items-center">
        <Logo />
      </div>
      <div className="container-x relative flex flex-1 flex-col items-center justify-center pb-24 text-center">
        <span className="pill">
          <span className="size-1.5 rounded-full bg-bone" /> Access pending
        </span>
        <h1 className="display mt-7 max-w-2xl text-5xl sm:text-6xl">Your seat isn&apos;t ready yet.</h1>
        <p className="mt-5 max-w-md text-mute">
          This email isn&apos;t currently authorised for the Partnership Program. Reach out to the OB Club team and
          we&apos;ll get you set up.
        </p>
        <div className="mt-10 flex gap-3">
          <SignOutButton className="btn-ghost" />
          <Link href="/" className="btn-primary">
            Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
