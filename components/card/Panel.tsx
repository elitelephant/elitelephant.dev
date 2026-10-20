import type { Panel as PanelContent } from "@/content/site";
import { ContactLinks } from "./ContactLinks";

// The last two words of a paragraph share a line. text-wrap: pretty moves a short last word down, but leaves a long
// one ("speculated.") alone on a narrow phone, and Firefox doesn't do it at all.
const lastTwoTogether = (text: string) => text.replace(/ (\S+)$/, "\u00a0$1");

// One section of the back, headed "Story", "Building" or "Offline".
export function Panel({ panel }: { panel: PanelContent }) {
  return (
    <section className={panel.id === "story" ? "panel story" : "panel"} id={panel.id} aria-labelledby={`h-${panel.id}`}>
      <h2 className="label" id={`h-${panel.id}`}>{panel.label}</h2>
      {panel.paragraphs.map((text) => (
        <p key={text}>{lastTwoTogether(text)}</p>
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
