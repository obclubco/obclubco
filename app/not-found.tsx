import Link from "next/link";
import { Starfield } from "@/components/Starfield";

export default function NotFound() {
  return (
    <main className="grain relative isolate flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Starfield />
      <span className="pill">404</span>
      <h1 className="display mt-6 text-5xl sm:text-6xl">Nothing Here.</h1>
      <Link href="/" className="btn-primary mt-10">
        Back home
      </Link>
    </main>
  );
}
