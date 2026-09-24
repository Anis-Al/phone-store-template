import { z } from "zod";
import { fromPrice } from "@/lib/catalog";
import { repo } from "@/lib/data/repository";

export type SearchHit = { slug: string; name: string; brand: string; image: string; price: number };

const query = z.string().trim().min(2).max(80);

export async function GET(req: Request) {
  const q = query.safeParse(new URL(req.url).searchParams.get("q"));
  if (!q.success) return Response.json({ results: [] });
  const products = await repo.getProducts({ q: q.data, limit: 6 });
  const results: SearchHit[] = products.map((p) => ({
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    image: p.images[0],
    price: fromPrice(p),
  }));
  return Response.json({ results });
}
