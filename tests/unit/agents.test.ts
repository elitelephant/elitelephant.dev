import { test } from "node:test";
import assert from "node:assert/strict";
import { llmsTxt, personJsonLd } from "../../content/agents.ts";
import { site } from "../../content/site.ts";

test("the JSON-LD names elitelephant, also known as Santiago, with the summary and the profiles", () => {
  const person = personJsonLd(site);
  assert.equal(person["@type"], "Person");
  assert.equal(person.name, "elitelephant");
  assert.equal(person.alternateName, "Santiago");
  assert.equal(person.url, site.url);
  assert.equal(person.description, site.meta.summary);
  const external = site.contact.links.filter((l) => l.kind === "external").map((l) => l.href);
  assert.deepEqual(person.sameAs, external);
});

// The email link is out of the copy for now, so this adds one to check it stays out of the profiles when it's back.
test("the JSON-LD's profiles leave out an email link", () => {
  const email = { kind: "email", label: "hello@elitelephant.dev", href: "mailto:hello@elitelephant.dev" } as const;
  const withEmail = { ...site, contact: { ...site.contact, links: [...site.contact.links, email] } };
  for (const href of personJsonLd(withEmail).sameAs) assert.match(href, /^https:\/\//);
});

// Agents read this instead of the card, so every sentence and link on the back has to be in it.
test("llms.txt has the summary, every panel's text and links, and the contact links", () => {
  const text = llmsTxt(site);
  assert.ok(text.startsWith(`# ${site.meta.title}\n\n> ${site.meta.summary}\n\n`));
  for (const panel of site.back.panels) {
    assert.ok(text.includes(`\n## ${panel.label}\n`), panel.label);
    for (const paragraph of panel.paragraphs) {
      for (const part of typeof paragraph === "string" ? [paragraph] : paragraph) {
        const expected = typeof part === "string" ? part : `[${part.label}](${part.href})`;
        assert.ok(text.includes(expected), expected);
      }
    }
  }
  assert.ok(text.includes(site.back.sayHi.text));
  for (const link of site.contact.links) assert.ok(text.includes(`- [${link.label}](${link.href})`), link.label);
});

test("llms.txt keeps the card's order and ends in a newline", () => {
  const text = llmsTxt(site);
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, [...site.back.panels.map((p) => p.label), site.back.sayHi.label]);
  assert.ok(text.endsWith("\n") && !text.endsWith("\n\n"));
});
