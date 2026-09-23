import { supabase } from "@/lib/supabase";
import type { Category } from "@/lib/types";

/** Public summary of a published course (for the About page). */
export type CatalogCourse = {
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  category: Category;
  lessons: number;
  minutes: number;
};

export type Coach = {
  id: string;
  name: string;
  role: string | null;
  photo_url: string | null;
  bio: string | null;
  experience: string | null;
  highlights: string[];
  portfolio: { label: string; url: string }[];
};

export async function getCatalog(): Promise<CatalogCourse[]> {
  const { data, error } = await supabase().rpc("get_course_catalog");
  if (error) throw error;
  return (data ?? []) as CatalogCourse[];
}

export async function getCoaches(): Promise<Coach[]> {
  const { data, error } = await supabase()
    .from("coaches")
    .select("id, name, role, photo_url, bio, experience, highlights, portfolio")
    .order("sort_order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as Coach[];
}
