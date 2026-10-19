import { test } from "node:test";
import assert from "node:assert/strict";
import { site } from "../../content/site.ts";

test("external links are https and the email link is mailto", () => {
  for (const link of site.contact.links) {
    if (link.kind === "external") assert.match(link.href, /^https:\/\//);
    else assert.equal(link.href, `mailto:${link.label}`);
  }
});

test("panels are building, story and offline, in that order", () => {
  assert.deepEqual(site.back.panels.map((p) => p.id), ["building", "story", "offline"]);
});

// Typographic apostrophes and quotes (’ “ ”) in every text: straight ones read as tick marks at the headline's size.
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
