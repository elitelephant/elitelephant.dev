import { site } from "@/content/site";
import { FlipButton } from "./FlipButton";
import { Panel } from "./Panel";
import { Panels } from "./Panels";

export function Back() {
  const { back } = site;
  return (
    <>
      <Panels label={back.panelsLabel} dotsLabel={back.dotsLabel} sections={back.panels.map(({ id, label }) => ({ id, label }))}>
        {back.panels.map((panel) => (
          <Panel key={panel.id} panel={panel} />
        ))}
      </Panels>
      <FlipButton side="back" label={back.flip} ariaLabel={back.flipLabel} />
    </>
  );
}
