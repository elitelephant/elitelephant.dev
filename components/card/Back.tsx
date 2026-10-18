import { site } from "@/content/site";
import { Panel } from "./Panel";
import { Panels } from "./Panels";

export function Back() {
  const { back } = site;
  return (
    <Panels label={back.panelsLabel} dotsLabel={back.dotsLabel} sections={back.panels.map(({ id, label }) => ({ id, label }))}>
      {back.panels.map((panel) => (
        <Panel key={panel.id} panel={panel} />
      ))}
    </Panels>
  );
}
