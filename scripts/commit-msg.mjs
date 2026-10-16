// Run by .githooks/commit-msg. A commit message has to make sense on its own: no decision IDs (D-nnnn) and no
// ticket numbers (#nn), which point at notes that are not in this repo (and #nn would link a GitHub issue).
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const RULES = [
  [/\bD-\d{4}\b/, "a decision ID (D-nnnn)"],
  [/(?:^|[^\w&])#\d{1,5}\b/m, "a ticket number (#nn)"],
];

// Git's own lines start with "# ", and with `commit -v` the diff below the scissors line is not part of the message.
export function problems(message) {
  const lines = message.split("\n");
  const cut = lines.findIndex((line) => /^# -+ >8 -+$/.test(line));
  const text = (cut < 0 ? lines : lines.slice(0, cut)).filter((line) => !/^#( |$)/.test(line)).join("\n");
  return RULES.filter(([rule]) => rule.test(text)).map(([, what]) => what);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const found = problems(readFileSync(process.argv[2], "utf8"));
  if (found.length) {
    console.error(`commit-msg: the message has ${found.join(" and ")}. Say what changed and why in its own words.`);
    process.exit(1);
  }
}
