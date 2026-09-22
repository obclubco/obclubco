import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LessonList } from "@/components/LessonList";
import { getCourse, getProgress, getQuestions, requireMember, withState } from "@/lib/data";
import { resolveVideo } from "@/lib/video";
import { LessonPlayer } from "./LessonPlayer";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const data = await getCourse(slug);
  return { title: data?.lessons.find((l) => l.id === lessonId)?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const member = await requireMember();
  const [data, progress] = await Promise.all([getCourse(slug), getProgress(member.id)]);
  if (!data) notFound();

  const lessons = withState(data.lessons, progress, member.isAdmin);
  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index === -1) notFound();
  const lesson = lessons[index];
  if (!lesson.unlocked) redirect(`/courses/${slug}`);

  const [video, questions] = await Promise.all([resolveVideo(lesson.video_url), getQuestions(lesson.id)]);
  const next = lessons[index + 1];

  return (
    <div className="container-x py-8 sm:py-12">
      <Link href={`/courses/${slug}`} className="text-sm text-mute hover:text-bone">
        ← {data.course.title}
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0">
          <LessonPlayer
            key={lesson.id}
            lessonId={lesson.id}
            video={video}
            questions={questions}
            passPercentage={data.course.pass_percentage}
            initiallyWatched={!!lesson.progress?.video_completed_at}
            initiallyPassed={!!lesson.progress?.quiz_passed_at}
            bestScore={lesson.progress?.best_score ?? null}
            nextHref={next ? `/courses/${slug}/lessons/${next.id}` : `/courses/${slug}`}
            nextLabel={next ? "Next lesson" : "Finish course"}
            header={
              <div className="mt-8">
                <p className="eyebrow">
                  Lesson {index + 1} of {lessons.length}
                  {lesson.duration_minutes ? ` · ${lesson.duration_minutes} min` : ""}
                </p>
                <h1 className="display mt-3 text-4xl sm:text-5xl">{lesson.title}</h1>
                {lesson.description && (
                  <p className="mt-4 max-w-3xl whitespace-pre-line leading-relaxed text-mute">{lesson.description}</p>
                )}
              </div>
            }
          />
        </section>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <h2 className="mb-4 text-sm text-mute">Course content</h2>
          <LessonList courseSlug={slug} lessons={lessons} activeId={lesson.id} />
        </aside>
      </div>
    </div>
  );
}
