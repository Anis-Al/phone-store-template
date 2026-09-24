import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Uploaded product photos on local disk (UPLOAD_DIR, default .data/uploads), served by app/media/[...path].
// Files written to public/ after the build are not served by `next start`, hence the route.
// ponytail: local disk only (the default host is a VPS). Add an S3/R2 driver behind put()/read() if a store moves to serverless.

const DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), ".data", "uploads");
const MAX_BYTES = 5 * 1024 * 1024;
const RASTER = new Set(["jpeg", "png", "webp", "avif", "heif", "gif", "tiff"]); // no SVG/HTML: never served as-is anyway
export const MEDIA_NAME = /^[a-f0-9]{32}\.webp$/;

/** Validates and re-encodes to ≤1200 px WebP (drops EXIF/GPS, applies rotation). Returns its public URL. */
export async function putImage(file: File): Promise<string> {
  if (!file.size || file.size > MAX_BYTES) throw new Error("upload");
  const input = Buffer.from(await file.arrayBuffer());
  let meta;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new Error("upload"); // not an image
  }
  if (!meta.format || !RASTER.has(meta.format)) throw new Error("upload");
  const out = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  // Content-addressed name: same photo → same file; URLs can be cached forever.
  const name = `${createHash("sha256").update(out).digest("hex").slice(0, 32)}.webp`;
  await mkdir(/*turbopackIgnore: true*/ DIR, { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ DIR, name), out);
  return `/media/${name}`;
}

export async function readImage(name: string): Promise<Buffer | null> {
  if (!MEDIA_NAME.test(name)) return null;
  return readFile(path.join(/*turbopackIgnore: true*/ DIR, name)).catch(() => null);
}
