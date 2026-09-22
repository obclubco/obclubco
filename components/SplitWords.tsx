import { Fragment } from "react";

/**
 * Text whose words rise in one after another.
 * on="load" animates immediately (hero headlines); on="scroll" waits until it scrolls into view.
 */
export function SplitWords({
  text,
  on = "load",
  delay = 0,
  step = 70,
}: {
  text: string;
  on?: "load" | "scroll";
  delay?: number;
  step?: number;
}) {
  const words = text.split(" ");
  return (
    <span data-reveal={on === "scroll" ? "words" : undefined} className={on === "load" ? "words-load" : undefined}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className="word" style={{ "--d": `${delay + i * step}ms` } as React.CSSProperties}>
            {word}
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </span>
  );
}
