"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LessonList } from "@/components/LessonList";
import { LessonPlayer } from "@/components/LessonPlayer";
import { useMember } from "@/components/MemberGate";
import { ErrorState, Loading, NotFoundState } from "@/components/States";
import { getCourse, getProgress, getQuestions, withState } from "@/lib/data";
import { useLoad, usePageTitle } from "@/lib/hooks";
import { resolveVideo } from "@/lib/video";

export default function LessonPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Lesson />
    </Suspense>
  );
}

function Lesson() {
  const params = useSearchParams();
  const slug = params.get("course") ?? "";
  const lessonId = params.get("id") ?? "";
  const member = useMember();
  const router = useRouter();

  const course = useLoad(() => Promise.all([getCourse(slug), getProgress(member.id)]), [slug, member.id]);
  const lessonUrl = course.data?.[0]?.lessons.find((l) => l.id === lessonId)?.video_url;
  const content = useLoad(
    async () => (lessonUrl === undefined ? null : Promise.all([resolveVideo(lessonUrl), getQuestions(lessonId)])),
    [lessonId, lessonUrl],
  );

  const found = course.data?.[0];
  const lessons = found ? withState(found.lessons, course.data![1], member.isAdmin) : [];
  const index = lessons.findIndex((l) => l.id === lessonId);
  const lesson = lessons[index];
  usePageTitle(lesson?.title);

  const locked = lesson && !lesson.unlocked;
  useEffect(() => {
    if (locked) router.replace(`/course/?slug=${slug}`);
  }, [locked, router, slug]);

  if (course.error || content.error) return <ErrorState message={(course.error ?? content.error)!} />;
  if (!course.data || (course.loading && found?.course.slug !== slug)) return <Loading />;
  if (!found || !lesson) return <NotFoundState label="Lesson not found." />;
  if (locked || !content.data || content.loading) return <Loading />;

  const [video, questions] = content.data;
  const next = lessons[index + 1];

  return (
    <div className="container-x py-8 sm:py-12">
      <Link href={`/course/?slug=${slug}`} className="text-sm text-mute hover:text-bone">
        ← {found.course.title}
      </Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
        <section className="min-w-0">
          <LessonPlayer
            key={lesson.id}
            lessonId={lesson.id}
            video={video}
            questions={questions}
            passPercentage={found.course.pass_percentage}
            initiallyWatched={!!lesson.progress?.video_completed_at}
            initiallyPassed={!!lesson.progress?.quiz_passed_at}
            bestScore={lesson.progress?.best_score ?? null}
            nextHref={next ? `/lesson/?course=${slug}&id=${next.id}` : `/course/?slug=${slug}`}
            nextLabel={next ? "Next lesson" : "Finish course"}
            onProgress={course.reload}
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
