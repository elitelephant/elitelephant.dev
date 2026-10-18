import { site } from "@/content/site";
import { ContactLinks } from "./ContactLinks";

export function Front() {
  const { front } = site;
  return (
    <>
      <p className="hi">{front.hi}</p>
      <h1>
        {front.watching} <span className="now">{front.building}</span>
      </h1>
      <ContactLinks />
    </>
  );
}
