import Link from "next/link";

export function Loading() {
  return (
    <div className="container-x grid min-h-[50dvh] place-items-center">
      <span className="size-6 animate-spin rounded-full border-2 border-line border-t-accent" aria-label="Loading" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="container-x grid min-h-[50dvh] place-items-center text-center">
      <div>
        <p className="eyebrow">Something went wrong</p>
        <p className="mt-4 max-w-md text-sm text-mute">{message}</p>
      </div>
    </div>
  );
}

export function NotFoundState({ label = "Nothing here." }: { label?: string }) {
  return (
    <div className="container-x grid min-h-[50dvh] place-items-center text-center">
      <div>
        <p className="eyebrow">Not found</p>
        <h1 className="display mt-4 text-4xl">{label}</h1>
        <Link href="/dashboard/" className="btn-primary mt-8">
          Back to courses
        </Link>
      </div>
    </div>
  );
}
