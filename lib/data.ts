import { supabase } from "@/lib/supabase";
import type { Course, Lesson, LessonWithState, Progress, Question } from "@/lib/types";

const COURSE_COLUMNS =
  "id, slug, title, subtitle, description, category, cover_image_url, sort_order, pass_percentage, is_published";
const LESSON_COLUMNS =
  "id, course_id, title, description, video_url, duration_minutes, sort_order, is_published, questions(id)";

export type Member = {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
};

export type CourseWithLessons = { course: Course; lessons: Lesson[] };

type LessonRow = Omit<Lesson, "question_count"> & { questions: { id: string }[] };
type CourseRow = Course & { lessons: LessonRow[] };

function toLesson(row: LessonRow): Lesson {
  const { questions, ...rest } = row;
  return { ...rest, question_count: questions?.length ?? 0 };
}

function toCourse({ lessons, ...course }: CourseRow): CourseWithLessons {
  return {
    course,
    lessons: (lessons ?? []).map(toLesson).sort((a, b) => a.sort_order - b.sort_order),
  };
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

/** Signed-in member, or why not: "signed_out" | "not_allowed". */
export async function loadMember(): Promise<Member | "signed_out" | "not_allowed"> {
  const {
    data: { session },
  } = await supabase().auth.getSession();
  if (!session) return "signed_out";
  const email = (session.user.email ?? "").toLowerCase();
  const { data: row, error } = await supabase()
    .from("allowed_emails")
    .select("full_name, is_admin")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  if (!row) return "not_allowed";
  return { id: session.user.id, email, fullName: row.full_name, isAdmin: row.is_admin };
}

export async function getProgress(userId: string): Promise<Progress[]> {
  const { data, error } = await supabase()
    .from("lesson_progress")
    .select("lesson_id, video_completed_at, quiz_passed_at, best_score, attempts")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function getCoursesWithLessons(): Promise<CourseWithLessons[]> {
  const { data, error } = await supabase()
    .from("courses")
    .select(`${COURSE_COLUMNS}, lessons(${LESSON_COLUMNS})`)
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return ((data ?? []) as unknown as CourseRow[]).map(toCourse);
}

export async function getCourse(slug: string): Promise<CourseWithLessons | null> {
  const { data, error } = await supabase()
    .from("courses")
    .select(`${COURSE_COLUMNS}, lessons(${LESSON_COLUMNS})`)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ? toCourse(data as unknown as CourseRow) : null;
}

export async function getQuestions(lessonId: string): Promise<Question[]> {
  // Only these columns are granted — the answer key stays in the database.
  const { data, error } = await supabase()
    .from("questions")
    .select("id, lesson_id, prompt, options, sort_order")
    .eq("lesson_id", lessonId)
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}
