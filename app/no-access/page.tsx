import { Logo } from "@/components/Logo";
import { Arrow } from "@/components/Icons";
import { Backdrop } from "@/components/Backdrop";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata = { title: "Access pending" };

export default function NoAccess() {
  return (
    <main id="main" className="relative isolate flex min-h-dvh flex-col">
      <Backdrop />
      <div className="container-x flex h-20 items-center">
        <Logo />
      </div>
      <div className="container-x flex flex-1 flex-col items-center justify-center pb-24 text-center">
        <span className="pill enter">
          <span className="size-1.5 rounded-full bg-bone" /> Access pending
        </span>
        <h1 className="enter display mt-7 max-w-2xl text-5xl sm:text-6xl" style={{ "--d": "150ms" } as React.CSSProperties}>Your Seat Isn&apos;t Ready Yet.</h1>
        <p className="enter mt-5 max-w-md text-sm leading-6 text-mute" style={{ "--d": "300ms" } as React.CSSProperties}>
          This email isn&apos;t currently authorised for the Partnership Program. Reach out to the OBC team and
          we&apos;ll get you set up.
        </p>
        <div className="enter mt-10 flex flex-wrap justify-center gap-3" style={{ "--d": "450ms" } as React.CSSProperties}>
          <SignOutButton className="btn-ghost" />
          <a href="https://www.obclub.co" className="btn-primary">
            Visit OBC <Arrow />
          </a>
        </div>
      </div>
    </main>
  );
}
