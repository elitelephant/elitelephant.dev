import { site } from "@/content/site";
import { ContactLinks } from "./ContactLinks";

export function Front() {
  const { front } = site;
  return (
    <section className="face front" id="front">
      <p className="hi">{front.hi}</p>
      <h1>
        {front.watching} <span className="now">{front.building}</span>
      </h1>
      <div className="row">
        <ContactLinks />
      </div>
    </section>
  );
}
