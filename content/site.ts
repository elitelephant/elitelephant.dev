// Every text on the site lives here; components never hard-code copy.
// Plain Node runs this file too (the unit tests), so it uses only erasable TypeScript syntax.

export type ContactLink =
  | { kind: "external"; label: string; href: string }
  | { kind: "email"; label: string; href: string };

// A link inside a paragraph, to another site, so it opens in a new tab like the contact links.
export type InlineLink = { label: string; href: string };
// Plain text, or text with links in it, in reading order.
export type Paragraph = string | readonly (string | InlineLink)[];

export type Panel = {
  id: "story" | "building" | "offline";
  label: string;
  paragraphs: readonly Paragraph[];
};

export type Site = {
  url: string;
  meta: {
    title: string;
    // Who's behind the site, in the third person, for search engines and AI agents (the JSON-LD and /llms.txt).
    // There's no meta description, so link previews show only the title and the share image.
    summary: string;
    // The name Story opens with, for the JSON-LD.
    alternateName: string;
    ogAlt: string;
    // The share image breaks the headline by phrase (Satori has no balanced wrapping). Same words as `front`.
    shareLines: { watching: readonly string[]; building: readonly string[] };
    twitterCreator: string;
    themeColor: string;
  };
  card: { label: string; backLabel: string };
  front: { hi: string; watching: string; building: string; flip: string };
  contact: {
    label: string;
    newTab: string;
    emailPrefix: string;
    links: readonly ContactLink[];
  };
  back: {
    panelsLabel: string;
    dotsLabel: string;
    flip: string;
    flipLabel: string;
    panels: readonly Panel[];
    // The last panel is the call to write, with the contact links. The label names its dot.
    sayHi: { label: string; text: string };
  };
  notFound: { code: string; text: string; link: string };
};

export const site = {
  url: "https://elitelephant.dev",
  meta: {
    title: "elitelephant",
    summary:
      "elitelephant is Santiago, from Chile. He watched crypto from the outside for four years while studying economics in France. Back in Chile he started computer science, joined several hackathons, won one, and began helping run community events in Santiago de Chile. At an internship he built n8n flows that still handle forms and reports every day. In August he paused his degree to explore, build and rest. Now he’s building Encendidos, a Stellar node for n8n where a person can approve each payment before it goes out.",
    alternateName: "Santiago",
    ogAlt: "I spent years watching from the sidelines. Now I’m building things.",
    shareLines: {
      watching: ["I spent years", "watching from", "the sidelines."],
      building: ["Now I’m", "building things."],
    },
    twitterCreator: "@elitelephant",
    themeColor: "#8cfeb8",
  },
  card: {
    label: "elitelephant",
    backLabel: "Who’s behind elitelephant",
  },
  front: {
    hi: "Hi, I’m elitelephant, from Chile.",
    watching: "I spent years watching from the sidelines.",
    building: "Now I’m building things.",
    flip: "Who’s behind this?",
  },
  contact: {
    label: "Contact",
    newTab: " (opens in a new tab)",
    emailPrefix: "Email ",
    links: [
      // In alphabetical order. Out until hello@elitelephant.dev receives mail; it goes back here, after GitHub, as:
      // { kind: "email", label: "hello@elitelephant.dev", href: "mailto:hello@elitelephant.dev" },
      { kind: "external", label: "GitHub", href: "https://github.com/elitelephant" },
      { kind: "external", label: "Telegram", href: "https://t.me/elitelephant" },
      { kind: "external", label: "X", href: "https://x.com/elitelephant" },
    ],
  },
  back: {
    panelsLabel: "Story, building, offline and say hi",
    dotsLabel: "Sections",
    flip: "Back",
    flipLabel: "Back to the front",
    panels: [
      {
        id: "story",
        label: "Story",
        paragraphs: [
          "Most people know me as Santiago.",
          "I bought my first crypto a few years ago. For the next four years I watched from the outside while studying economics in France.",
          "Last year I started computer science back in Chile. At my first blockchain talk I met the people building what I’d been watching.",
          "Since then I’ve joined hackathons and ended up winning one. I went from attending events in Santiago de Chile to helping run them.",
          "At an internship I built n8n flows that still handle forms and reports every day. I also put my first site online, in three days.",
          "In August I paused my degree to explore, build and rest.",
        ],
      },
      {
        id: "building",
        label: "Building",
        paragraphs: [
          [
            "I’m bringing Stellar to n8n, as one more node next to many others. A person can approve each payment before it goes out. I call the project Encendidos. The first step was updating ",
            { label: "the community node that signs Stellar transactions", href: "https://github.com/yripper/n8n-nodes-stellar" },
            ".",
          ],
          "n8n’s community has published over 13,000 workflow templates. Any of them could end in a payment.",
          "Yet out of more than 2,000 integrations, only a handful can send money. Encendidos is for that.",
        ],
      },
      {
        id: "offline",
        label: "Offline",
        paragraphs: [
          "I’ve been cycling for two years. Running is harder, and I’m still working on it.",
          "Walking I can do for hours, especially when I’m lost in a new city.",
          "I went to a French school in Chile, so I grew up with Spanish and French. I speak English too.",
        ],
      },
    ],
    sayHi: { label: "Say hi", text: "Met in Lisbon? Say hi." },
  },
  notFound: {
    code: "404",
    text: "Nothing here.",
    link: "Back to the card",
  },
} as const satisfies Site;
