import { readImage } from "@/lib/media";

/** Uploaded product photos (lib/media.ts). Names are content hashes, so they're immutable. */
export async function GET(_: Request, { params }: RouteContext<"/media/[...path]">) {
  const { path } = await params;
  const file = path.length === 1 ? await readImage(path[0]) : null;
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
