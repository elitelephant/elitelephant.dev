import { site } from "@/content/site";
import { Panel, SayHiPanel } from "./Panel";
import { Panels } from "./Panels";

export function Back() {
  const { back } = site;
  const sections = [...back.panels.map(({ id, label }) => ({ id, label })), { id: "say-hi", label: back.sayHi.label }];
  return (
    <Panels label={back.panelsLabel} dotsLabel={back.dotsLabel} sections={sections}>
      {back.panels.map((panel) => (
        <Panel key={panel.id} panel={panel} />
      ))}
      <SayHiPanel text={back.sayHi.text} />
    </Panels>
  );
}
