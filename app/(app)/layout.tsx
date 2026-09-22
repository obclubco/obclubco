import { AppHeader } from "@/components/AppHeader";
import { Footer } from "@/components/Footer";
import { requireMember } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader member={member} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
