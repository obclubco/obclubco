import Link from "next/link";
import { ProgressBar } from "@/components/ProgressBar";
import { Arrow } from "@/components/Icons";
import { CATEGORY_LABEL, type Course } from "@/lib/types";

export function CourseCard({
  course,
  lessonCount,
  completedCount,
  minutes,
}: {
  course: Course;
  lessonCount: number;
  completedCount: number;
  minutes: number;
}) {
  const pct = lessonCount ? (completedCount / lessonCount) * 100 : 0;
  const status = completedCount === 0 ? "Start" : completedCount === lessonCount ? "Review" : "Continue";
  return (
    <Link href={`/courses/${course.slug}`} className="card group flex flex-col overflow-hidden transition hover:border-bone/30">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-line bg-elevated">
        {course.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.cover_image_url} alt="" className="size-full object-cover opacity-80 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100" />
        ) : (
          <div className="grain flex size-full items-end p-6">
            <span className="display text-3xl text-bone/80">{course.title}</span>
          </div>
        )}
        {!course.is_published && (
          <span className="absolute right-3 top-3 rounded-full bg-ink/80 px-3 py-1 text-[10px] uppercase tracking-widest text-gold">
            Draft
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <p className="eyebrow">{CATEGORY_LABEL[course.category]}</p>
        <h3 className="display mt-3 text-3xl">{course.title}</h3>
        {course.subtitle && <p className="mt-2 line-clamp-2 text-sm text-mute">{course.subtitle}</p>}
        <div className="mt-auto pt-6">
          <div className="mb-3 flex items-center justify-between text-xs text-mute">
            <span>
              {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
              {minutes > 0 && ` · ${minutes} min`}
            </span>
            <span>{Math.round(pct)}%</span>
          </div>
          <ProgressBar value={pct} />
          <span className="mt-5 inline-flex items-center gap-2 text-sm text-bone transition group-hover:text-gold">
            {status} <Arrow />
          </span>
        </div>
      </div>
    </Link>
  );
}
