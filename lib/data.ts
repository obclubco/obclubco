import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Course, Lesson, LessonWithState, Progress } from "@/lib/types";

const COURSE_COLUMNS =
  "id, slug, title, subtitle, description, category, cover_image_url, sort_order, pass_percentage, is_published";
const LESSON_COLUMNS =
  "id, course_id, title, description, video_url, duration_minutes, sort_order, is_published, questions(count)";

export type Member = {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
};

/** Current signed-in, allowlisted member. Redirects otherwise. */
export const requireMember = cache(async (): Promise<Member> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("allowed_emails")
    .select("full_name, is_admin")
    .eq("email", (user.email ?? "").toLowerCase())
    .maybeSingle();
  if (!row) redirect("/no-access");

  return { id: user.id, email: user.email ?? "", fullName: row.full_name, isAdmin: row.is_admin };
});

type LessonRow = Omit<Lesson, "question_count"> & { questions: { count: number }[] };

function toLesson(row: LessonRow): Lesson {
  const { questions, ...rest } = row;
  return { ...rest, question_count: questions?.[0]?.count ?? 0 };
}

export function isLessonComplete(lesson: Lesson, progress: Progress | null) {
  if (!progress?.video_completed_at) return false;
  return lesson.question_count === 0 || !!progress.quiz_passed_at;
}

/** Lessons unlock in order: each one opens once the previous is complete. */
export function withState(lessons: Lesson[], progress: Progress[], bypassLocks = false): LessonWithState[] {
  const byLesson = new Map(progress.map((p) => [p.lesson_id, p]));
  let previousComplete = true;
  return lessons.map((lesson) => {
    const p = byLesson.get(lesson.id) ?? null;
    const completed = isLessonComplete(lesson, p);
    const unlocked = bypassLocks || previousComplete || completed;
    previousComplete = completed;
    return { ...lesson, progress: p, completed, unlocked };
  });
}

export async function getProgress(userId: string): Promise<Progress[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lesson_progress")
    .select("lesson_id, video_completed_at, quiz_passed_at, best_score, attempts")
    .eq("user_id", userId);
  return data ?? [];
}

export async function getCoursesWithLessons() {
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select(`${COURSE_COLUMNS}, lessons(${LESSON_COLUMNS})`)
    .order("sort_order")
    .order("created_at");

  return (courses ?? []).map((c) => {
    const { lessons, ...course } = c as Course & { lessons: LessonRow[] };
    return {
      course: course as Course,
      lessons: (lessons ?? []).map(toLesson).sort((a, b) => a.sort_order - b.sort_order),
    };
  });
}

export async function getCourse(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select(`${COURSE_COLUMNS}, lessons(${LESSON_COLUMNS})`)
    .eq("slug", slug)
    .maybeSingle();
  if (!data) return null;
  const { lessons, ...course } = data as Course & { lessons: LessonRow[] };
  return {
    course: course as Course,
    lessons: (lessons ?? []).map(toLesson).sort((a, b) => a.sort_order - b.sort_order),
  };
}

export async function getQuestions(lessonId: string) {
  const supabase = await createClient();
  // Only these columns are granted — the answer key stays in the database.
  const { data } = await supabase
    .from("questions")
    .select("id, lesson_id, prompt, options, sort_order")
    .eq("lesson_id", lessonId)
    .order("sort_order");
  return data ?? [];
}
