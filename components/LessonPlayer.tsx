"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Arrow, DrawCheck } from "@/components/Icons";
import { CountUp } from "@/components/CountUp";
import type { Question, QuizResult } from "@/lib/types";
import type { VideoSource } from "@/lib/video";

type Props = {
  lessonId: string;
  video: VideoSource | null;
  questions: Question[];
  passPercentage: number;
  initiallyWatched: boolean;
  initiallyPassed: boolean;
  bestScore: number | null;
  nextHref: string;
  nextLabel: string;
  header: React.ReactNode;
  /** Called after progress is saved, so the page can refresh the lesson list. */
  onProgress: () => void;
};

export function LessonPlayer(props: Props) {
  const { lessonId, video, questions, passPercentage, nextHref, nextLabel, header, onProgress } = props;
  const [watched, setWatched] = useState(props.initiallyWatched);
  const [passed, setPassed] = useState(props.initiallyPassed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markWatched() {
    if (watched) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase().rpc("mark_video_complete", { p_lesson_id: lessonId });
    setSaving(false);
    if (error) return setError("Couldn't save your progress. Please try again.");
    setWatched(true);
    onProgress();
  }

  const hasQuiz = questions.length > 0;
  const complete = watched && (!hasQuiz || passed);

  return (
    <>
      <div className="enter overflow-hidden rounded-2xl border border-line bg-black shadow-[0_30px_80px_-30px_rgb(255_255_255/0.12)]">
        <div className="aspect-video">
          {!video ? (
            <div className="grid size-full place-items-center text-sm text-mute">Video unavailable.</div>
          ) : video.kind === "embed" ? (
            <iframe
              src={video.src}
              className="size-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              title="Lesson video"
            />
          ) : (
            <video src={video.src} controls playsInline controlsList="nodownload" className="size-full" onEnded={markWatched} />
          )}
        </div>
      </div>

      {header}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {watched ? (
          <span className="enter inline-flex items-center gap-2 rounded-full border border-accent/40 px-4 py-2 text-sm text-accent">
            <DrawCheck /> Video watched
          </span>
        ) : (
          <button onClick={markWatched} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : hasQuiz ? "I've watched it — take the quiz" : "Mark lesson complete"}
          </button>
        )}
        {complete && (
          <Link href={nextHref} className="enter btn-accent">
            {nextLabel} <Arrow />
          </Link>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}

      {hasQuiz && watched && (
        <Quiz
          lessonId={lessonId}
          questions={questions}
          passPercentage={passPercentage}
          alreadyPassed={passed}
          bestScore={props.bestScore}
          onPassed={() => {
            setPassed(true);
            onProgress();
          }}
          nextHref={nextHref}
          nextLabel={nextLabel}
        />
      )}
    </>
  );
}

function Quiz({
  lessonId,
  questions,
  passPercentage,
  alreadyPassed,
  bestScore,
  onPassed,
  nextHref,
  nextLabel,
}: {
  lessonId: string;
  questions: Question[];
  passPercentage: number;
  alreadyPassed: boolean;
  bestScore: number | null;
  onPassed: () => void;
  nextHref: string;
  nextLabel: string;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feedback = new Map(result?.results.map((r) => [r.question_id, r]));
  const allAnswered = questions.every((q) => answers[q.id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { data, error } = await supabase().rpc("submit_quiz", { p_lesson_id: lessonId, p_answers: answers });
    setSubmitting(false);
    if (error) return setError("Couldn't submit your answers. Please try again.");
    const r = data as QuizResult;
    setResult(r);
    if (r.passed) onPassed();
    document.getElementById("quiz")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function retry() {
    setAnswers({});
    setResult(null);
  }

  return (
    <section id="quiz" className="mt-12 scroll-mt-24 border-t border-line pt-10">
      <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Knowledge check</p>
          <h2 className="display mt-3 text-4xl">
            {questions.length} {questions.length === 1 ? "question" : "questions"}
          </h2>
        </div>
        <p className="text-sm text-mute">
          Pass mark {passPercentage}%{bestScore != null && ` · Best score ${bestScore}%`}
        </p>
      </div>

      {result && (
        <div
          data-reveal
          className={`mt-8 flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center sm:justify-between ${
            result.passed ? "border-good/40 bg-good/5" : "border-bad/40 bg-bad/5"
          }`}
        >
          <div>
            <p className={`display flex items-center gap-3 text-4xl ${result.passed ? "text-good" : "text-bad"}`}>
              <CountUp value={result.percentage} suffix="%" />
              {result.passed && <DrawCheck className="size-7" />}
            </p>
            <p className="mt-1 text-sm text-mute">
              {result.correct} of {result.total} correct ·{" "}
              {result.passed ? "Passed — nicely done." : `You need ${result.pass_percentage}% to pass.`}
            </p>
          </div>
          {result.passed ? (
            <Link href={nextHref} className="enter btn-accent">
              {nextLabel} <Arrow />
            </Link>
          ) : (
            <button onClick={retry} className="btn-primary">
              Try again
            </button>
          )}
        </div>
      )}

      {alreadyPassed && !result && (
        <p className="mt-6 text-sm text-mute">You&apos;ve already passed this quiz. Feel free to retake it anytime.</p>
      )}

      <form onSubmit={submit} className="mt-8 space-y-6">
        {questions.map((q, qi) => {
          const fb = feedback.get(q.id);
          return (
            <fieldset key={q.id} data-reveal className="card glow-card p-6 sm:p-7" disabled={!!result}>
              <legend className="sr-only">Question {qi + 1}</legend>
              <p className="text-xs uppercase tracking-widest text-mute">Question {qi + 1}</p>
              <p className="mt-2 text-lg">{q.prompt}</p>
              <div className="mt-5 space-y-2">
                {q.options.map((opt, oi) => {
                  const value = oi + 1;
                  const selected = answers[q.id] === value;
                  const isCorrect = fb && fb.correct_option === value;
                  const isWrongPick = fb && selected && !fb.is_correct;
                  const tone = isCorrect
                    ? "border-good/60 bg-good/10"
                    : isWrongPick
                      ? "border-bad/60 bg-bad/10"
                      : selected
                        ? "border-accent bg-accent/10"
                        : "border-line hover:border-bone/30";
                  return (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition duration-300 ${tone} ${
                        result ? "cursor-default" : ""
                      } ${isWrongPick ? "shake" : selected || isCorrect ? "pop" : ""}`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={value}
                        checked={selected}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: value }))}
                        className="size-4 accent-[var(--color-accent)]"
                      />
                      <span className="flex-1">{opt}</span>
                      {isCorrect && <DrawCheck className="size-4 text-good" />}
                    </label>
                  );
                })}
              </div>
              {fb?.explanation && (
                <p className="enter mt-4 border-l-2 border-accent/50 pl-4 text-sm leading-relaxed text-mute">
                  {fb.explanation}
                </p>
              )}
            </fieldset>
          );
        })}
        {!result && (
          <div className="flex items-center gap-4">
            <button className="btn-accent" disabled={!allAnswered || submitting}>
              {submitting ? "Checking…" : "Submit answers"}
            </button>
            {!allAnswered && <span className="text-xs text-mute">Answer every question to submit.</span>}
          </div>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
      </form>
    </section>
  );
}
