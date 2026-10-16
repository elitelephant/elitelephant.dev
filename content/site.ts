// Every text on the site lives here; components never hard-code copy.
// Plain Node runs this file too (the unit tests), so it uses only erasable TypeScript syntax.

export type ContactLink =
  | { kind: "external"; label: string; href: string }
  | { kind: "email"; label: string; href: string };

export type Panel = {
  id: "building" | "story" | "offline";
  number: string;
  label: string;
  title?: string;
  paragraphs: readonly string[];
  sayHi?: string;
};

export type Site = {
  url: string;
  meta: {
    title: string;
    description: string;
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
  };
  notFound: { code: string; text: string; link: string };
};

export const site = {
  url: "https://elitelephant.dev",
  meta: {
    title: "elitelephant",
    description: "I spent years watching from the sidelines. Now I'm building things.",
    ogAlt: "I spent years watching from the sidelines. Now I'm building things.",
    shareLines: {
      watching: ["I spent years", "watching from", "the sidelines."],
      building: ["Now I'm", "building things."],
    },
    twitterCreator: "@elitelephant",
    themeColor: "#8cfeb8",
  },
  card: {
    label: "elitelephant",
    backLabel: "Who's behind elitelephant",
  },
  front: {
    hi: "Hi, I'm elitelephant, from Chile.",
    watching: "I spent years watching from the sidelines.",
    building: "Now I'm building things.",
    flip: "Who's behind this?",
  },
  contact: {
    label: "Contact",
    newTab: " (opens in a new tab)",
    emailPrefix: "Email ",
    links: [
      { kind: "external", label: "Telegram", href: "https://t.me/elitelephant" },
      { kind: "external", label: "X", href: "https://x.com/elitelephant" },
      { kind: "external", label: "GitHub", href: "https://github.com/elitelephant" },
      // Out until hello@elitelephant.dev receives mail; it goes back as:
      // { kind: "email", label: "hello@elitelephant.dev", href: "mailto:hello@elitelephant.dev" },
    ],
  },
  back: {
    panelsLabel: "Building, story and offline",
    dotsLabel: "Sections",
    flip: "Back",
    flipLabel: "Back to the front",
    panels: [
      {
        id: "building",
        number: "01",
        label: "Building",
        title: "Encendidos",
        paragraphs: [
          "\"Bring the rails to the users,\" wrote Stellar's Denelle Dixon. Lots of people already automate their work in n8n. So I'm bringing Stellar there, as one more node next to Gmail, Sheets or a webhook.",
          "Any trigger can start a payment. A merged PR, a delivered package, an AI agent's decision.",
          "Moving money is the easy part. Trust is harder, so that's what I'm working on: checking before paying, and not paying twice when a workflow retries.",
        ],
      },
      {
        id: "story",
        number: "02",
        label: "Story",
        paragraphs: [
          "Most people know me as Santiago.",
          "I bought my first crypto in January 2021. For four years that was most of it. I followed projects, read threads, speculated.",
          "In March 2025 I went to my first in-person blockchain talk and met the people behind the charts.",
          "Since then I've joined several hackathons and won one. I've helped run community events in Santiago, built n8n flows that still run every day, and put my first site online.",
        ],
      },
      {
        id: "offline",
        number: "03",
        label: "Offline",
        paragraphs: [
          "I enjoy riding bikes. Tuesday mornings are for an early social ride that ends with coffee. I'm also getting into running.",
          "In a new city I like to get lost and walk for hours.",
          "I speak Spanish, French and English.",
        ],
        sayHi: "Say hi.",
      },
    ],
  },
  notFound: {
    code: "404",
    text: "Nothing here.",
    link: "Back to the card",
  },
} as const satisfies Site;
