import Link from "next/link";
import { Backdrop } from "@/components/Backdrop";

export default function NotFound() {
  return (
    <main id="main" className="relative isolate flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Backdrop />
      <span className="pill enter">404</span>
      <h1 className="enter display mt-6 text-5xl sm:text-6xl" style={{ "--d": "150ms" } as React.CSSProperties}>
        Nothing Here.
      </h1>
      <Link href="/" className="enter btn-primary mt-10" style={{ "--d": "300ms" } as React.CSSProperties}>
        Back home
      </Link>
    </main>
  );
}
