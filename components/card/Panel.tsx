import type { Panel as PanelContent } from "@/content/site";
import { ContactLinks } from "./ContactLinks";

// One section of the back, headed "Building", "Story" or "Offline".
export function Panel({ panel }: { panel: PanelContent }) {
  return (
    <section className={panel.id === "story" ? "panel story" : "panel"} id={panel.id} aria-labelledby={`h-${panel.id}`}>
      <h2 className="label" id={`h-${panel.id}`}>{panel.label}</h2>
      {panel.title && <h3>{panel.title}</h3>}
      {panel.paragraphs.map((text) => (
        <p key={text}>{text}</p>
      ))}
      {panel.sayHi && (
        <>
          <p className="say">{panel.sayHi}</p>
          <ContactLinks />
        </>
      )}
    </section>
  );
}
