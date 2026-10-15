import Link from "next/link";
import { site } from "@/content/site";

export default function NotFound() {
  const { notFound } = site;
  return (
    <main className="stage">
      <section className="face notfound" aria-labelledby="not-found-title">
        <p className="hi">{notFound.code}</p>
        <h1 id="not-found-title">{notFound.text}</h1>
        <Link href="/">{notFound.link}</Link>
      </section>
    </main>
  );
}
