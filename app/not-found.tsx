import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grain flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <p className="eyebrow">404</p>
      <h1 className="display mt-4 text-5xl sm:text-6xl">Nothing here.</h1>
      <Link href="/" className="btn-primary mt-10">
        Back home
      </Link>
    </main>
  );
}
