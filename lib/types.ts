export type Category = "sales" | "business" | "personal_branding" | "other";

export type Course = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: Category;
  cover_image_url: string | null;
  sort_order: number;
  pass_percentage: number;
  is_published: boolean;
};

export type Lesson = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_url: string;
  duration_minutes: number | null;
  sort_order: number;
  is_published: boolean;
  question_count: number;
};

export type Question = {
  id: string;
  lesson_id: string;
  prompt: string;
  options: string[];
  sort_order: number;
};

export type Progress = {
  lesson_id: string;
  video_completed_at: string | null;
  quiz_passed_at: string | null;
  best_score: number | null;
  attempts: number;
};

export type LessonWithState = Lesson & {
  progress: Progress | null;
  completed: boolean;
  unlocked: boolean;
};

export type QuizResult = {
  correct: number;
  total: number;
  percentage: number;
  pass_percentage: number;
  passed: boolean;
  results: {
    question_id: string;
    selected: number | null;
    correct_option: number;
    is_correct: boolean;
    explanation: string | null;
  }[];
};

export const CATEGORY_LABEL: Record<Category, string> = {
  sales: "Sales",
  business: "Business Building",
  personal_branding: "Personal Branding",
  other: "Masterclass",
};
