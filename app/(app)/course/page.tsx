"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LessonList } from "@/components/LessonList";
import { ProgressBar } from "@/components/ProgressBar";
import { Arrow } from "@/components/Icons";
import { useMember } from "@/components/MemberGate";
import { ErrorState, Loading, NotFoundState } from "@/components/States";
import { getCourse, getProgress, withState } from "@/lib/data";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { CATEGORY_LABEL } from "@/lib/types";

export default function CoursePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Course />
    </Suspense>
  );
}

function Course() {
  const slug = useSearchParams().get("slug") ?? "";
  const member = useMember();
  const { data, error, loading } = useLoad(() => Promise.all([getCourse(slug), getProgress(member.id)]), [slug, member.id]);
  usePageTitle(data?.[0]?.course.title);

  if (error) return <ErrorState message={error} />;
  if (loading || !data) return <Loading />;
  const [found, progress] = data;
  if (!found) return <NotFoundState label="Course not found." />;

  const { course } = found;
  const lessons = withState(found.lessons, progress, member.isAdmin);
  const done = lessons.filter((l) => l.completed).length;
  const pct = lessons.length ? (done / lessons.length) * 100 : 0;
  const next = lessons.find((l) => l.unlocked && !l.completed) ?? lessons[0];
  const minutes = lessons.reduce((m, l) => m + (l.duration_minutes ?? 0), 0);

  return (
    <div className="container-x py-12 sm:py-16">
      <Link href="/dashboard/" className="text-sm text-mute hover:text-bone">
        ← All courses
      </Link>
      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_420px]">
        <section>
          <p className="eyebrow">{CATEGORY_LABEL[course.category]}</p>
          <h1 className="display mt-4 text-5xl sm:text-7xl">{course.title}</h1>
          {course.subtitle && <p className="mt-5 max-w-2xl text-lg text-mute">{course.subtitle}</p>}
          {course.description && (
            <p className="mt-6 max-w-2xl whitespace-pre-line leading-relaxed text-bone/85">{course.description}</p>
          )}
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line text-center">
            {[
              ["Lessons", lessons.length],
              ["Minutes", minutes || "—"],
              ["Pass mark", `${course.pass_percentage}%`],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-3 py-5">
                <dd className="display text-3xl">{v}</dd>
                <dt className="mt-1 text-[11px] uppercase tracking-widest text-mute">{k}</dt>
              </div>
            ))}
          </dl>
          <div className="mt-10 max-w-lg">
            <div className="mb-3 flex justify-between text-xs text-mute">
              <span>Your progress</span>
              <span>
                {done}/{lessons.length} complete
              </span>
            </div>
            <ProgressBar value={pct} />
          </div>
          {next && (
            <Link href={`/lesson/?course=${course.slug}&id=${next.id}`} className="btn-gold mt-10">
              {done === 0 ? "Start course" : done === lessons.length ? "Review course" : "Continue"} <Arrow />
            </Link>
          )}
        </section>
        <aside>
          <h2 className="mb-4 text-sm text-mute">Course content</h2>
          {lessons.length ? (
            <LessonList courseSlug={course.slug} lessons={lessons} />
          ) : (
            <p className="card p-6 text-sm text-mute">Lessons coming soon.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
