import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { storeConfig } from "@/lib/config/store.config";
import { locale } from "@/lib/i18n";

const vars: Record<string, string> = {
  store: storeConfig.identity.name,
  phone: storeConfig.contact.phone,
  email: storeConfig.contact.email,
  orderPrefix: storeConfig.commerce.orderPrefix,
  address: `${storeConfig.contact.address.street}, ${storeConfig.contact.address.city}`,
};

/**
 * content/pages/<slug>.<locale>.md (falls back to .fr.md). First "# " line = page title.
 * {{store}}, {{phone}}, {{email}}, {{address}}, {{orderPrefix}} are filled from store.config.ts.
 * Files are trusted repo content, rendered at build time (SSG).
 */
export async function getPage(slug: "about" | "warranty") {
  const dir = path.join(process.cwd(), "content", "pages");
  const md = await readFile(path.join(dir, `${slug}.${locale}.md`), "utf8").catch(() =>
    readFile(path.join(dir, `${slug}.fr.md`), "utf8"),
  );
  const filled = md.replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m);
  const [, title = slug, body = filled] = filled.match(/^#\s+(.+)\n([\s\S]*)$/) ?? [];
  const description = body.trim().split("\n")[0].replace(/[*_`#>]/g, "").slice(0, 160);
  return { title, description, html: marked.parse(body, { async: false }) };
}
