import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Access pending" };

export default function NoAccess() {
  return (
    <main className="grain flex min-h-dvh flex-col">
      <div className="container-x flex h-20 items-center">
        <Logo />
      </div>
      <div className="container-x flex flex-1 flex-col items-center justify-center pb-24 text-center">
        <p className="eyebrow">Access pending</p>
        <h1 className="display mt-4 max-w-2xl text-5xl sm:text-6xl">Your seat isn&apos;t ready yet.</h1>
        <p className="mt-5 max-w-md text-mute">
          This email isn&apos;t currently authorised for the Partnership Program. Reach out to the OB Club team and
          we&apos;ll get you set up.
        </p>
        <form action="/auth/signout" method="post" className="mt-10 flex gap-3">
          <button className="btn-ghost">Sign out</button>
          <Link href="/" className="btn-primary">
            Back home
          </Link>
        </form>
      </div>
    </main>
  );
}
