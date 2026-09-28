import { Avatar } from "@/components/Avatar";
import { EyeOff, Globe, Instagram, LinkedIn, Mail, MapPin, Phone } from "@/components/Icons";
import { instagramHandle, instagramUrl, linkedinUrl, prettyUrl, telHref, websiteUrl } from "@/lib/format";
import { roleLine, type PublicProfile } from "@/lib/network";

/** Web links and contact details from a profile, ready to show. */
export function contactLinks(p: PublicProfile) {
  const linkedin = linkedinUrl(p.linkedin);
  const instagram = instagramUrl(p.instagram);
  const website = websiteUrl(p.website);
  return [
    linkedin && { key: "linkedin", href: linkedin, label: "LinkedIn", icon: <LinkedIn />, external: true },
    instagram && { key: "instagram", href: instagram, label: instagramHandle(instagram), icon: <Instagram />, external: true },
    website && { key: "website", href: website, label: prettyUrl(website), icon: <Globe />, external: true },
    p.email && { key: "email", href: `mailto:${p.email}`, label: p.email, icon: <Mail />, external: false },
    p.phone && { key: "phone", href: telHref(p.phone), label: p.phone, icon: <Phone />, external: false },
  ].filter((l) => !!l);
}

/** A guest's full profile, as other guests see it. Also used as the live preview on the Profile page. */
export function GuestProfile({
  profile,
  badge,
  as: Heading = "h1",
}: {
  profile: PublicProfile;
  badge?: string;
  /** Heading level for the name (h2 when the profile is shown inside another page, as a preview). */
  as?: "h1" | "h2";
}) {
  const line = roleLine(profile);
  const links = contactLinks(profile);
  const empty = !profile.bio && !profile.looking_for && !profile.can_help_with && profile.interests.length === 0;

  return (
    <article>
      <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <Avatar name={profile.full_name} url={profile.photo_url} size="xl" className="shadow-[0_20px_60px_-20px_rgb(255_255_255/0.25)]" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {badge && <span className="pill px-3 py-1 text-[10px]">{badge}</span>}
            {profile.is_visible === false && (
              <span className="pill px-3 py-1 text-[10px]">
                <EyeOff className="size-3.5" /> Hidden from guests
              </span>
            )}
          </div>
          <Heading className="display mt-3 break-words text-4xl sm:text-5xl">{profile.full_name}</Heading>
          {line && <p className="mt-2 text-bone/80">{line}</p>}
          {profile.city && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-mute">
              <MapPin /> {profile.city}
            </p>
          )}
        </div>
      </header>

      {links.length > 0 && (
        <div className="mt-7 flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.href}
              {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="btn-ghost max-w-full gap-2 px-4 py-2 text-xs"
            >
              {l.icon} <span className="truncate">{l.label}</span>
              {l.external && <span aria-hidden>↗</span>}
            </a>
          ))}
        </div>
      )}

      {profile.bio && <p className="mt-8 max-w-2xl whitespace-pre-line leading-relaxed text-bone/85">{profile.bio}</p>}

      {(profile.looking_for || profile.can_help_with) && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {profile.looking_for && (
            <section className="card glow-card bg-surface/80 p-6 backdrop-blur">
              <h2 className="eyebrow">Looking for</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-bone/85">{profile.looking_for}</p>
            </section>
          )}
          {profile.can_help_with && (
            <section className="card glow-card bg-surface/80 p-6 backdrop-blur">
              <h2 className="eyebrow">Can help with</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-bone/85">{profile.can_help_with}</p>
            </section>
          )}
        </div>
      )}

      {profile.interests.length > 0 && (
        <section className="mt-8">
          <h2 className="eyebrow">Interests</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.interests.map((t) => (
              <li key={t} className="rounded-full border border-line bg-elevated/70 px-3 py-1 text-xs text-bone/80">
                {t}
              </li>
            ))}
          </ul>
        </section>
      )}

      {empty && links.length === 0 && (
        <p className="mt-8 text-sm text-mute">No details yet. Say hi at the next event.</p>
      )}
    </article>
  );
}
