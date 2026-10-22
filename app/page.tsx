import { Back } from "@/components/card/Back";
import { FlipButton } from "@/components/card/FlipButton";
import { FlipCard } from "@/components/card/FlipCard";
import { Front } from "@/components/card/Front";
import { SceneLoader } from "@/components/scene/SceneLoader";
import { personJsonLd } from "@/content/agents";
import { site } from "@/content/site";

// Escaped so no text in it can close the script tag early.
const jsonLd = JSON.stringify(personJsonLd(site)).replaceAll("<", "\\u003c");

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SceneLoader />
      <main className="stage">
        <FlipCard
          label={site.card.label}
          backLabel={site.card.backLabel}
          front={<Front />}
          back={<Back />}
          button={<FlipButton front={site.front.flip} back={site.back.flip} backName={site.back.flipLabel} />}
        />
      </main>
    </>
  );
}
