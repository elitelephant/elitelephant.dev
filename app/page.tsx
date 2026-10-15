import { Back } from "@/components/card/Back";
import { FlipCard } from "@/components/card/FlipCard";
import { Front } from "@/components/card/Front";
import { site } from "@/content/site";

export default function Home() {
  return (
    <main className="stage">
      <FlipCard label={site.card.label} backLabel={site.card.backLabel} front={<Front />} back={<Back />} />
    </main>
  );
}
