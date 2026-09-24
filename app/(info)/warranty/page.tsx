import type { Metadata } from "next";
import { MarkdownPage } from "@/components/MarkdownPage";
import { getPage } from "@/lib/content";

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = await getPage("warranty");
  return { title, description, alternates: { canonical: "/warranty" } };
}

export default function Page() {
  return <MarkdownPage slug="warranty" />;
}
