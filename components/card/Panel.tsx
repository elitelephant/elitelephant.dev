import { site, type Panel as PanelContent, type Paragraph } from "@/content/site";
import { ContactLinks } from "./ContactLinks";

// The last two words of a paragraph share a line. text-wrap: pretty moves a short last word down, but leaves a long
// one alone on a narrow phone, and Firefox doesn't do it at all.
const lastTwoTogether = (text: string) => text.replace(/ (\S+)$/, " $1");

// A paragraph's text and links in order. The links go to other sites, so like the contact links they open in a new
// tab and say so to screen readers.
function Text({ paragraph }: { paragraph: Paragraph }) {
  const parts = typeof paragraph === "string" ? [paragraph] : paragraph;
  return parts.map((part, i) => {
    if (typeof part === "string") return i === parts.length - 1 ? lastTwoTogether(part) : part;
    return (
      <a key={part.href} href={part.href} target="_blank" rel="noopener noreferrer">
        {part.label}
        <span className="sr-only">{site.contact.newTab}</span>
      </a>
    );
  });
}

const textOf = (paragraph: Paragraph) =>
  typeof paragraph === "string" ? paragraph : paragraph.map((part) => (typeof part === "string" ? part : part.label)).join("");

// One section of the back, headed "Story", "Building" or "Offline".
export function Panel({ panel }: { panel: PanelContent }) {
  return (
    <section className={panel.id === "story" ? "panel story" : "panel"} id={panel.id} aria-labelledby={`h-${panel.id}`}>
      <h2 className="label" id={`h-${panel.id}`}>{panel.label}</h2>
      {panel.paragraphs.map((paragraph) => (
        <p key={textOf(paragraph)}><Text paragraph={paragraph} /></p>
      ))}
    </section>
  );
}

// The last panel, with "Say hi." as its heading over the contact links.
export function SayHiPanel({ text }: { text: string }) {
  return (
    <section className="panel say-hi" id="say-hi" aria-labelledby="h-say-hi">
      <h2 className="say" id="h-say-hi">{text}</h2>
      <ContactLinks />
    </section>
  );
}
