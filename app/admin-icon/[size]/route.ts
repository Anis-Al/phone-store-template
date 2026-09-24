import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { storeConfig } from "@/lib/config/store.config";

export const generateStaticParams = () => [{ size: "192" }, { size: "512" }];
export const dynamicParams = false;

/** PNG app icons from the store logo (SVG or raster), rendered at build. Phones want PNG, not SVG. */
export async function GET(_: Request, { params }: RouteContext<"/admin-icon/[size]">) {
  const size = Number((await params).size);
  const logo = await readFile(path.join(process.cwd(), "public", storeConfig.identity.logo));
  const { width = size } = await sharp(logo).metadata();
  const png = await sharp(logo, { density: Math.max(72, (72 * size) / width) }) // SVG: rasterize at target size, not 72 dpi
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
}
