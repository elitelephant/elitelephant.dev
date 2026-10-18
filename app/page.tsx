import { Back } from "@/components/card/Back";
import { FlipButton } from "@/components/card/FlipButton";
import { FlipCard } from "@/components/card/FlipCard";
import { Front } from "@/components/card/Front";
import { SceneLoader } from "@/components/scene/SceneLoader";
import { site } from "@/content/site";

export default function Home() {
  return (
    <>
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
