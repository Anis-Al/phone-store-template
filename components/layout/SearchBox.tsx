"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { SearchHit } from "@/app/api/search/route";
import { Sheet } from "@/components/ui/sheet";
import { formatPrice, t } from "@/lib/i18n";

export function SearchBox() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ q: string; results: SearchHit[] } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inflight = useRef<AbortController>(undefined);

  // Debounced typeahead: fires 200 ms after the last keystroke, cancels stale requests.
  const onChange = (value: string) => {
    setQ(value);
    clearTimeout(timer.current);
    inflight.current?.abort();
    if (value.trim().length < 2) return setHits(null);
    timer.current = setTimeout(async () => {
      const ctl = (inflight.current = new AbortController());
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal: ctl.signal });
        setHits({ q: value, results: ((await res.json()) as { results: SearchHit[] }).results });
      } catch {
        /* aborted or offline: keep previous results */
      }
    }, 200);
  };

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("search.open")}
        className="inline-flex size-11 items-center justify-center"
      >
        <Search aria-hidden size={20} />
      </button>
      <Sheet open={open} onClose={close} title={t("search.label")} side="center">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (!q.trim()) return;
            close();
            router.push(`/catalog?q=${encodeURIComponent(q.trim())}`);
          }}
        >
          <label htmlFor="site-search" className="sr-only">
            {t("search.label")}
          </label>
          <div className="relative">
            <Search aria-hidden size={18} className="absolute start-4 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              id="site-search"
              type="search"
              data-autofocus
              autoComplete="off"
              enterKeyHint="search"
              value={q}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t("search.placeholder")}
              className="min-h-11 w-full rounded-pill border border-border bg-surface ps-11 pe-4 text-base"
            />
          </div>
        </form>
        <div aria-live="polite" className="mt-4">
          {hits && hits.results.length === 0 && (
            <p className="text-sm text-text-muted">{t("search.noResults", { q: hits.q })}</p>
          )}
          {hits && hits.results.length > 0 && (
            <>
              <p className="sr-only">{t("search.results", { n: hits.results.length })}</p>
              <ul className="flex flex-col">
                {hits.results.map((h) => (
                  <li key={h.slug}>
                    <Link
                      href={`/product/${h.slug}`}
                      onClick={close}
                      className="flex min-h-14 items-center gap-3 rounded-sm px-2 py-1 hover:bg-surface-alt"
                    >
                      <Image src={h.image} alt="" width={48} height={48} className="size-12 object-contain" />
                      <span className="flex-1">
                        <span className="block text-sm font-semibold">{h.name}</span>
                        <span className="block text-xs text-text-muted">{h.brand}</span>
                      </span>
                      <span className="text-sm">{formatPrice(h.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={`/catalog?q=${encodeURIComponent(hits.q)}`}
                onClick={close}
                className="mt-2 inline-flex min-h-11 items-center text-sm text-primary"
              >
                {t("search.seeAll")} ›
              </Link>
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
