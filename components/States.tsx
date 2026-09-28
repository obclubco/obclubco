import Link from "next/link";

export function Loading() {
  return (
    <div className="container-x grid min-h-[50dvh] place-items-center">
      <span className="spinner" role="status" aria-label="Loading" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="container-x grid min-h-[50dvh] place-items-center text-center">
      <div className="enter">
        <p className="eyebrow">Something went wrong</p>
        <p className="mt-4 max-w-md text-sm text-mute">{message}</p>
      </div>
    </div>
  );
}

export function NotFoundState({
  label = "Nothing here.",
  href = "/home/",
  cta = "Back home",
}: {
  label?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="container-x grid min-h-[50dvh] place-items-center text-center">
      <div className="enter">
        <p className="eyebrow">Not found</p>
        <h1 className="display mt-4 text-4xl">{label}</h1>
        <Link href={href} className="btn-primary mt-8">
          {cta}
        </Link>
      </div>
    </div>
  );
}
