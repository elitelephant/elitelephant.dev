// What search engines and AI agents read instead of the card, built from the same copy so it never drifts.
// Plain Node runs this file too (the unit tests), so it imports only types.
import type { Paragraph, Site } from "./site";

// schema.org's Person, for the JSON-LD on the home page.
export function personJsonLd(site: Site) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: site.meta.title,
    alternateName: site.meta.alternateName,
    url: site.url,
    description: site.meta.summary,
    sameAs: site.contact.links.filter((link) => link.kind === "external").map((link) => link.href),
  };
}

// Markdown keeps a link inside its sentence, where the card has it.
const markdown = (paragraph: Paragraph) =>
  typeof paragraph === "string"
    ? paragraph
    : paragraph.map((part) => (typeof part === "string" ? part : `[${part.label}](${part.href})`)).join("");

// The llms.txt format, a title, a one-paragraph summary as a quote, then sections. The panels go in the card's order.
export function llmsTxt(site: Site) {
  const panels = site.back.panels.map((panel) => [`## ${panel.label}`, ...panel.paragraphs.map(markdown)].join("\n\n"));
  const links = site.contact.links.map((link) => `- [${link.label}](${link.href})`).join("\n");
  return [`# ${site.meta.title}`, `> ${site.meta.summary}`, ...panels, `## ${site.back.sayHi.label}`, site.back.sayHi.text, links]
    .join("\n\n") + "\n";
}
