import { getPage } from "@/lib/content";

export async function MarkdownPage({ slug }: { slug: "about" | "warranty" }) {
  const { title, html } = await getPage(slug);
  return (
    <article className="mx-auto max-w-3xl px-5 py-7 md:py-8">
      <h1 className="text-4xl font-semibold md:text-5xl">{title}</h1>
      {/* Trusted repo content rendered at build time. */}
      <div className="prose mt-6 text-text-muted" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
