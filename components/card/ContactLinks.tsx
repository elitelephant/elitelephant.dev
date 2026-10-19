import { site } from "@/content/site";

// GitHub, Telegram and X open in a new tab, so the card stays open, and say so to screen readers. mailto: gets no
// target: it opens the mail app, and some browsers would leave an empty tab behind.
export function ContactLinks() {
  const { contact } = site;
  return (
    <ul className="links" aria-label={contact.label}>
      {contact.links.map((link) => (
        <li key={link.href}>
          {link.kind === "external" ? (
            <a href={link.href} target="_blank" rel="noopener noreferrer">
              {link.label}
              <span className="ext" aria-hidden="true"> ↗</span>
              <span className="sr-only">{contact.newTab}</span>
            </a>
          ) : (
            <a href={link.href}>
              <span className="sr-only">{contact.emailPrefix}</span>
              {link.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
