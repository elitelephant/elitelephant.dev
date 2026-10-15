import { Front } from "@/components/card/Front";
import { site } from "@/content/site";

export default function Home() {
  return (
    <main className="stage">
      <article className="card" id="card" aria-label={site.card.label}>
        <Front />
      </article>
    </main>
  );
}
