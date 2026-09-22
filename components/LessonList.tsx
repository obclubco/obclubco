import Link from "next/link";
import { Check, Lock, Play } from "@/components/Icons";
import type { LessonWithState } from "@/lib/types";

export function LessonList({
  courseSlug,
  lessons,
  activeId,
}: {
  courseSlug: string;
  lessons: LessonWithState[];
  activeId?: string;
}) {
  return (
    <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {lessons.map((l, i) => {
        const active = l.id === activeId;
        const icon = l.completed ? (
          <span className="grid size-8 place-items-center rounded-full bg-gold text-ink"><Check /></span>
        ) : l.unlocked ? (
          <span className={`grid size-8 place-items-center rounded-full border ${active ? "border-gold text-gold" : "border-line text-bone"}`}><Play className="size-3.5" /></span>
        ) : (
          <span className="grid size-8 place-items-center rounded-full border border-line text-mute"><Lock className="size-3.5" /></span>
        );
        const body = (
          <div className="flex items-center gap-4 px-5 py-4">
            {icon}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-widest text-mute">Lesson {i + 1}</p>
              <p className={`truncate text-sm ${active ? "text-gold" : l.unlocked ? "text-bone" : "text-mute"}`}>{l.title}</p>
            </div>
            <div className="shrink-0 text-right text-xs text-mute">
              {l.duration_minutes ? `${l.duration_minutes} min` : null}
              {l.question_count > 0 && <p>{l.progress?.best_score != null ? `${l.progress.best_score}%` : `${l.question_count} Q`}</p>}
            </div>
          </div>
        );
        return (
          <li key={l.id} className={active ? "bg-elevated" : ""}>
            {l.unlocked ? (
              <Link href={`/lesson/?course=${courseSlug}&id=${l.id}`} className="block transition hover:bg-elevated">
                {body}
              </Link>
            ) : (
              <div className="cursor-not-allowed" title="Complete the previous lesson to unlock">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
