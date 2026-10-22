import { llmsTxt } from "@/content/agents";
import { site } from "@/content/site";

// Plain text rather than text/markdown, so a browser shows the file instead of downloading it.
export function GET() {
  return new Response(llmsTxt(site), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
