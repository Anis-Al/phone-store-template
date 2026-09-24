import type { MetadataRoute } from "next";
import { multiCategory, storeConfig } from "@/lib/config/store.config";
import { repo } from "@/lib/data/repository";
import { absoluteUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = ["/", "/catalog", "/contact", "/about", "/warranty"].map((p) => ({
    url: absoluteUrl(p),
    changeFrequency: "weekly" as const,
    priority: p === "/" ? 1 : 0.6,
  }));
  const products = (await repo.getProducts()).map((p) => ({
    url: absoluteUrl(`/product/${p.slug}`),
    lastModified: p.createdAt,
    images: p.images.map(absoluteUrl),
    priority: 0.8,
  }));
  const categories = multiCategory
    ? storeConfig.categories.map((c) => ({ url: absoluteUrl(`/catalog?category=${c.slug}`), changeFrequency: "weekly" as const, priority: 0.7 }))
    : [];
  return [...pages, ...categories, ...products];
}
