export function Footer() {
  return (
    <footer className="border-t border-line/70">
      <div className="container-x flex flex-col gap-2 py-8 text-xs text-mute sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} OB Club. Partnership Program.</p>
        <a href="https://www.obclub.co" className="hover:text-bone">
          obclub.co ↗
        </a>
      </div>
    </footer>
  );
}
