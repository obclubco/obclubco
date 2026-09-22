"use client";

import Link from "next/link";
import { CourseCard } from "@/components/CourseCard";
import { Arrow } from "@/components/Icons";
import { useMember } from "@/components/MemberGate";
import { ErrorState, Loading } from "@/components/States";
import { getCoursesWithLessons, getProgress, withState } from "@/lib/data";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { CATEGORY_LABEL, type Category } from "@/lib/types";

export default function Dashboard() {
  const member = useMember();
  usePageTitle("Your courses");
  const { data, error, loading } = useLoad(
    () => Promise.all([getCoursesWithLessons(), getProgress(member.id)]),
    [member.id],
  );
  if (error) return <ErrorState message={error} />;
  if (loading || !data) return <Loading />;

  const [courses, progress] = data;
  const rows = courses.map(({ course, lessons }) => {
    const state = withState(lessons, progress, member.isAdmin);
    return {
      course,
      lessons: state,
      completed: state.filter((l) => l.completed).length,
      minutes: lessons.reduce((m, l) => m + (l.duration_minutes ?? 0), 0),
    };
  });

  const totalLessons = rows.reduce((n, r) => n + r.lessons.length, 0);
  const totalDone = rows.reduce((n, r) => n + r.completed, 0);

  // First unfinished, unlocked lesson in a course the member has already started (or the first course).
  const resume =
    rows.find((r) => r.completed > 0 && r.completed < r.lessons.length) ?? rows.find((r) => r.completed < r.lessons.length);
  const resumeLesson = resume?.lessons.find((l) => l.unlocked && !l.completed);

  const categories = [...new Set(rows.map((r) => r.course.category))] as Category[];
  const firstName = member.fullName?.split(" ")[0];

  return (
    <div className="container-x py-12 sm:py-16">
      <section className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-end">
        <div>
          <p className="eyebrow">Partnership Program</p>
          <h1 className="display mt-4 text-5xl sm:text-6xl">{firstName ? `Welcome, ${firstName}.` : "Welcome back."}</h1>
          <p className="mt-4 max-w-lg text-mute">
            {totalLessons === 0
              ? "Courses are being prepared. Check back soon."
              : `You've completed ${totalDone} of ${totalLessons} lessons. Keep the momentum.`}
          </p>
        </div>
        {resume && resumeLesson && (
          <Link
            href={`/lesson/?course=${resume.course.slug}&id=${resumeLesson.id}`}
            className="card group flex items-center justify-between gap-4 p-6 transition hover:border-accent/60"
          >
            <div className="min-w-0">
              <p className="text-xs text-mute">{resume.completed > 0 ? "Pick up where you left off" : "Start here"}</p>
              <p className="mt-1 truncate font-medium">{resumeLesson.title}</p>
              <p className="truncate text-xs text-mute">{resume.course.title}</p>
            </div>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-ink transition group-hover:bg-accent-soft">
              <Arrow />
            </span>
          </Link>
        )}
      </section>

      {categories.map((cat) => (
        <section key={cat} className="mt-16">
          <div className="mb-6 flex items-baseline justify-between border-b border-line pb-4">
            <h2 className="display text-3xl">{CATEGORY_LABEL[cat]}</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rows
              .filter((r) => r.course.category === cat)
              .map((r) => (
                <CourseCard
                  key={r.course.id}
                  course={r.course}
                  lessonCount={r.lessons.length}
                  completedCount={r.completed}
                  minutes={r.minutes}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
