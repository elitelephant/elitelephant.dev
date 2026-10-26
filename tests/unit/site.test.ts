import { test } from "node:test";
import assert from "node:assert/strict";
import { site, type Panel } from "../../content/site.ts";

test("external links are https and the email link is mailto", () => {
  for (const link of site.contact.links) {
    if (link.kind === "external") assert.match(link.href, /^https:\/\//);
    else assert.equal(link.href, `mailto:${link.label}`);
  }
});

test("links inside the panels' text are https", () => {
  // Read through the Panel type, since the literal types of two panels with links don't merge into one array.
  const panels: readonly Panel[] = site.back.panels;
  const links = panels.flatMap((p) => p.paragraphs.flatMap((t) => (typeof t === "string" ? [] : t)))
    .filter((part) => typeof part !== "string");
  assert.ok(links.length > 0);
  for (const link of links) assert.match(link.href, /^https:\/\//);
});

// Story first, since it answers the button that turns the card, "Who’s behind this?".
test("panels are story, building and offline, in that order", () => {
  assert.deepEqual(site.back.panels.map((p) => p.id), ["story", "building", "offline"]);
});

test("contact links are in alphabetical order", () => {
  const labels = site.contact.links.map((l) => l.label.toLowerCase());
  assert.deepEqual(labels, [...labels].sort());
});

// Screen readers announce the back by this name as the card turns; it lists the dots' names, in their order.
test("the back's name lists its panels in order", () => {
  const names = [...site.back.panels.map((p) => p.label), site.back.sayHi.label].map((n) => n.toLowerCase());
  const listed = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  assert.equal(site.back.panelsLabel.toLowerCase(), listed);
});

// Typographic apostrophes and quotes (’ “ ”) in every text, as straight ones read as tick marks at the headline's size.
test("copy uses typographic apostrophes and quotes", () => {
  const texts: string[] = [];
  const walk = (value: unknown, key = "") => {
    if (typeof value === "string") {
      if (key !== "href" && key !== "url") texts.push(value);
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  walk(site);
  assert.deepEqual(texts.filter((t) => /['"]/.test(t)), []);
});

test("accessible names contain the visible text", () => {
  assert.ok(site.back.flipLabel.startsWith(site.back.flip));
  assert.ok(site.contact.newTab.startsWith(" "));
  assert.ok(site.contact.emailPrefix.endsWith(" "));
});
