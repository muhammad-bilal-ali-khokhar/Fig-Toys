"use client";

// Minimal renderer for the release-notes Markdown that ships in the release
// body. Handles the subset used there: ATX headings (#, ##, ###), bullet lists
// (- / *), bold (**text**), and plain paragraphs. Returns styled JSX so the
// raw Markdown syntax is not shown to the user.

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <strong key={key++} className="font-semibold text-ink-900">
        {match[1]}
      </strong>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function ReleaseNotes({ notes }: { notes: string }) {
  if (!notes || !notes.trim()) return null;

  const lines = notes.trim().split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="mt-1 list-disc space-y-0.5 pl-4">
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      flushBullets();
      const level = trimmed.match(/^#+/)?.[0].length ?? 1;
      const title = trimmed.replace(/^#+\s*/, "");
      const Tag = level <= 2 ? "h3" : "h4";
      blocks.push(
        <Tag key={`h-${key++}`} className="mt-2 text-sm font-semibold text-ink-900 first:mt-0">
          {renderInline(title)}
        </Tag>,
      );
    } else if (/^\s*[-*]\s/.test(trimmed)) {
      bullets.push(trimmed.replace(/^\s*[-*]\s*/, ""));
    } else {
      flushBullets();
      blocks.push(
        <p key={`p-${key++}`} className="mt-1 text-xs leading-relaxed text-ink-600 first:mt-0">
          {renderInline(trimmed)}
        </p>,
      );
    }
  }
  flushBullets();

  return <div className="text-xs leading-relaxed text-ink-600">{blocks}</div>;
}
