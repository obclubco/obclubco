"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMember } from "@/components/MemberGate";
import { ErrorState, Loading } from "@/components/States";
import { getCoursesWithLessons, isLessonComplete } from "@/lib/data";
import { SplitWords } from "@/components/SplitWords";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import type { Progress } from "@/lib/types";

async function loadAdminData() {
  const sb = supabase();
  const [allowed, profiles, progress, courses] = await Promise.all([
    sb.from("allowed_emails").select("email, full_name, is_admin, created_at").order("created_at", { ascending: false }),
    sb.from("profiles").select("id, email, created_at"),
    sb.from("lesson_progress").select("user_id, lesson_id, video_completed_at, quiz_passed_at, best_score, attempts, updated_at"),
    getCoursesWithLessons(),
  ]);
  const error = allowed.error ?? profiles.error ?? progress.error;
  if (error) throw error;
  return { allowed: allowed.data, profiles: profiles.data, progress: progress.data, courses };
}

function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export default function AdminPage() {
  const member = useMember();
  const router = useRouter();
  usePageTitle("Admin");
  useEffect(() => {
    if (!member.isAdmin) router.replace("/dashboard/");
  }, [member.isAdmin, router]);
  const { data, error } = useLoad(loadAdminData, []);

  if (!member.isAdmin) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <Loading />;
  const { allowed, profiles, progress, courses } = data;

  const lessons = courses
    .filter((c) => c.course.is_published)
    .flatMap((c) => c.lessons.filter((l) => l.is_published));
  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const profileByEmail = new Map((profiles ?? []).map((p) => [p.email, p]));
  const progressByUser = new Map<string, (Progress & { updated_at: string })[]>();
  for (const p of progress ?? []) {
    progressByUser.set(p.user_id, [...(progressByUser.get(p.user_id) ?? []), p]);
  }

  const rows = (allowed ?? []).map((a) => {
    const profile = profileByEmail.get(a.email);
    const items = profile ? (progressByUser.get(profile.id) ?? []) : [];
    const completed = items.filter((p) => {
      const l = lessonById.get(p.lesson_id);
      return l && isLessonComplete(l, p);
    }).length;
    const scores = items.map((p) => p.best_score).filter((s): s is number => s != null);
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const last = items.map((p) => p.updated_at).sort().at(-1);
    return { ...a, joined: profile?.created_at, completed, avg, last };
  });

  return (
    <div className="container-x py-12 sm:py-16">
      <p className="eyebrow enter">Admin</p>
      <h1 className="display mt-4 text-5xl">
        <SplitWords text="Partners" delay={100} />
      </h1>
      <p className="enter mt-4 max-w-2xl text-sm text-mute" style={{ "--d": "300ms" } as React.CSSProperties}>
        Partner access and course content are managed in Supabase: add an email to the <code className="text-bone">allowed_emails</code>{" "}
        table to authorise someone, and add rows to <code className="text-bone">courses</code>,{" "}
        <code className="text-bone">lessons</code> and <code className="text-bone">questions</code> to publish content.
      </p>

      <div
        data-reveal
        className="glow-card glow-inset mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4"
      >
        {[
          ["Authorised", rows.length],
          ["Signed up", rows.filter((r) => r.joined).length],
          ["Published courses", courses.filter((c) => c.course.is_published).length],
          ["Published lessons", lessons.length],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface p-6">
            <p className="display text-4xl">{v}</p>
            <p className="mt-1 text-[11px] uppercase tracking-widest text-mute">{k}</p>
          </div>
        ))}
      </div>

      <div data-reveal className="card mt-10 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-widest text-mute">
            <tr>
              <th className="px-5 py-4 font-medium">Partner</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Lessons done</th>
              <th className="px-5 py-4 font-medium">Avg. quiz</th>
              <th className="px-5 py-4 font-medium">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.email} className="transition duration-300 hover:bg-elevated/60">
                <td className="px-5 py-4">
                  <p>{r.full_name ?? "—"}</p>
                  <p className="text-xs text-mute">{r.email}</p>
                </td>
                <td className="px-5 py-4">
                  {r.is_admin ? (
                    <span className="text-accent">Admin</span>
                  ) : r.joined ? (
                    <span className="text-good">Joined {fmt(r.joined)}</span>
                  ) : (
                    <span className="text-mute">Invited</span>
                  )}
                </td>
                <td className="px-5 py-4">
                  {r.completed} / {lessons.length}
                </td>
                <td className="px-5 py-4">{r.avg != null ? `${r.avg}%` : "—"}</td>
                <td className="px-5 py-4 text-mute">{fmt(r.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
