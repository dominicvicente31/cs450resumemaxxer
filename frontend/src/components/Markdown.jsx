/**
 * Renders the small markdown subset the model uses in writing advice:
 * headings (#), bulleted and numbered lists, blockquotes (>), paragraphs,
 * and inline **bold**, *italic* / _italic_, and `code`.
 * Builds React elements only (no innerHTML), so model output can't inject markup.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function inline(text) {
  return text.split(INLINE).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={i}>{part.slice(1, -1)}</code>;
    if (/^(\*[^*]+\*|_[^_]+_)$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export default function Markdown({ text }) {
  const blocks = [];
  let list = null; // { ordered, start, items: [{ text, quotes }] }
  const flush = () => {
    if (list) blocks.push(list);
    list = null;
  };
  const lastItem = () => list.items[list.items.length - 1];

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    let match;
    if (!line) continue; // blank lines don't end a list, so "1. … 2. …" spaced apart stays one list
    if ((match = line.match(/^(#{1,6})\s+(.*)$/))) {
      flush();
      blocks.push({ type: "heading", text: match[2] });
    } else if ((match = line.match(/^[-*+]\s+(.*)$/)) || (match = line.match(/^(\d+)[.)]\s+(.*)$/))) {
      const ordered = /^\d/.test(line);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { type: "list", ordered, start: ordered ? Number(match[1]) : undefined, items: [] };
      }
      list.items.push({ text: ordered ? match[2] : match[1], quotes: [] });
    } else if ((match = line.match(/^>\s?(.*)$/))) {
      // A quoted line under a list item (the advice quotes the line it applies to) stays in that item.
      if (list) lastItem().quotes.push(match[1]);
      else blocks.push({ type: "quote", text: match[1] });
    } else if (list && /^\s{2,}\S/.test(raw)) {
      lastItem().text += " " + line; // indented continuation of a list item
    } else {
      flush();
      blocks.push({ type: "p", text: line });
    }
  }
  flush();

  return (
    <div className="markdown">
      {blocks.map((b, i) => {
        if (b.type === "heading") return <h3 key={i}>{inline(b.text)}</h3>;
        if (b.type === "quote") return <blockquote key={i}>{inline(b.text)}</blockquote>;
        if (b.type === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          return (
            <Tag key={i} start={b.start}>
              {b.items.map((item, j) => (
                <li key={j}>
                  {inline(item.text)}
                  {item.quotes.map((q, k) => <blockquote key={k}>{inline(q)}</blockquote>)}
                </li>
              ))}
            </Tag>
          );
        }
        return <p key={i}>{inline(b.text)}</p>;
      })}
    </div>
  );
}
