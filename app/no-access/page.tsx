import { Logo } from "@/components/Logo";
import { Arrow } from "@/components/Icons";
import { Starfield } from "@/components/Starfield";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata = { title: "Access pending" };

export default function NoAccess() {
  return (
    <main className="grain relative isolate flex min-h-dvh flex-col">
      <Starfield />
      <div className="container-x flex h-20 items-center">
        <Logo />
      </div>
      <div className="container-x flex flex-1 flex-col items-center justify-center pb-24 text-center">
        <span className="pill">
          <span className="size-1.5 rounded-full bg-bone" /> Access pending
        </span>
        <h1 className="display mt-7 max-w-2xl text-5xl sm:text-6xl">Your Seat Isn&apos;t Ready Yet.</h1>
        <p className="mt-5 max-w-md text-sm leading-6 text-mute">
          This email isn&apos;t currently authorised for the Partnership Program. Reach out to the OBC team and
          we&apos;ll get you set up.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <SignOutButton className="btn-ghost" />
          <a href="https://www.obclub.co" className="btn-primary">
            Visit OBC <Arrow />
          </a>
        </div>
      </div>
    </main>
  );
}
