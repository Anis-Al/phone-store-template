"use client";

import { ArrowLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { saveProduct, uploadImage } from "@/app/admin/(panel)/products/actions";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";
import { cellKey as key, moveAxis } from "@/lib/catalog";
import { categoryOf, categorySlugs, storeConfig } from "@/lib/config/store.config";
import { productInputSchema, type Product, type ProductInput } from "@/lib/data/schemas";
import { formatStorage, t, type TKey } from "@/lib/i18n";
import { cn, slugify } from "@/lib/utils";

type Color = { cid: number; name: string; hex: string; images: string[] };
type Cell = { on: boolean; sku: string; prevSku?: string; stockWas?: number; price: string; stock: string };
type Identity = Pick<ProductInput, "slug" | "category" | "name" | "brand" | "model" | "condition" | "basePrice" | "featured" | "description"> & {
  specs: NonNullable<ProductInput["specs"]>;
  tagline: string;
  tags: string;
};

const SPECS = ["screen", "chipset", "ram", "storage", "battery", "mainCamera", "frontCamera", "os", "network"] as const;
const OFF: Cell = { on: false, sku: "", price: "", stock: "0" };
const ascii = (s: string, n: number) => s.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, n);

/** SKU suggestion, e.g. "IP17PRMA-256-NOMI". Shown as the placeholder of an empty SKU field. */
const autoSku = (model: string, color: string, storage?: number) =>
  [
    model.split(/\s+/).map((w) => ascii(w, /\d/.test(w) ? 4 : 2)).join("").slice(0, 16) || "SKU",
    ...(storage ? [storage >= 1024 ? `${storage / 1024}T` : storage] : []),
    color.split(/\s+/).map((w) => ascii(w, 2)).join("").slice(0, 4) || "X",
  ].join("-");

const defaultStorages = (slug: string) => (categoryOf(slug)?.specs ? [128] : []);
const rows = (storages: number[]) => (storages.length ? storages : [undefined]);

/** Product → matrix state. `copy` (duplicate) drops identity: new SKUs, zero stock. */
function toMatrix(p: Product | null, copy: boolean, category: string) {
  const colors: Color[] = [];
  const storages: number[] = [];
  const cells: Record<string, Cell> = {};
  for (const v of p?.variants ?? []) {
    let c = colors.find((x) => x.name === v.color.name);
    if (!c) {
      c = { cid: colors.length, name: v.color.name, hex: v.color.hex, images: v.images ?? (colors.length ? [] : p!.images) };
      colors.push(c);
    }
    if (v.storage && !storages.includes(v.storage)) storages.push(v.storage);
    const price = v.priceOverride?.toString() ?? "";
    cells[key(c.cid, v.storage)] = copy
      ? { on: true, sku: "", price, stock: "0" }
      : { on: true, sku: v.sku, prevSku: v.sku, stockWas: v.stockQty, price, stock: String(v.stockQty) };
  }
  if (!colors.length) colors.push({ cid: 0, name: "", hex: "#000000", images: [] });
  if (!p) storages.push(...defaultStorages(category));
  for (const c of colors) for (const s of rows(storages)) cells[key(c.cid, s)] ??= p ? OFF : { ...OFF, on: true };
  return { colors, storages: storages.sort((a, b) => a - b), cells };
}

export function ProductEditor({ product, copy = false, brands, saved }: { product: Product | null; copy?: boolean; brands: string[]; saved?: boolean }) {
  const router = useRouter();
  const editing = Boolean(product && !copy);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok?: boolean; error?: TKey }>(saved ? { ok: true } : {});
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<number | null>(null);
  const [newStorage, setNewStorage] = useState("");
  const [initial] = useState(() => toMatrix(product, copy, product?.category ?? categorySlugs[0]));
  const [colors, setColors] = useState(initial.colors);
  const [storages, setStorages] = useState(initial.storages);
  const [cells, setCells] = useState(initial.cells);
  const nextCid = useRef(initial.colors.length);
  const [slugTouched, setSlugTouched] = useState(editing);

  const { register, handleSubmit, setValue, control } = useForm<Identity>({
    defaultValues: {
      name: product ? `${product.name}${copy ? ` ${t("admin.products.editor.copy")}` : ""}` : "",
      slug: editing ? product!.slug : product ? slugify(`${product.name} ${t("admin.products.editor.copy")}`) : "",
      category: product?.category ?? categorySlugs[0],
      brand: product?.brand ?? "",
      model: product?.model ?? "",
      condition: product?.condition ?? "new",
      basePrice: product?.basePrice ?? 0,
      featured: copy ? false : (product?.featured ?? false),
      tagline: product?.tagline ?? "",
      description: product?.description ?? "",
      tags: product?.tags.join(", ") ?? "",
      specs: product?.specs ?? { screen: "", chipset: "", ram: 8, storage: "", battery: "", mainCamera: "", frontCamera: "", os: "", network: "" },
    },
  });
  const [modelValue, nameValue, categoryValue] = useWatch({ control, name: ["model", "name", "category"] });
  const model = modelValue || nameValue;
  const hasSpecs = Boolean(categoryOf(categoryValue)?.specs);

  const msg = (path: string) => {
    const m = issues[path];
    return m && t((/^(admin|errors)\./.test(m) ? m : "admin.errors.required") as TKey);
  };
  const setCell = (k: string, patch: Partial<Cell>) => setCells((all) => ({ ...all, [k]: { ...(all[k] ?? OFF), ...patch } }));
  const setColor = (cid: number, patch: Partial<Color>) => setColors((all) => all.map((c) => (c.cid === cid ? { ...c, ...patch } : c)));

  function setAxis(next: number[]) {
    const prev = storages;
    setStorages(next);
    setCells((all) => moveAxis(all, colors.map((c) => c.cid), prev, next, OFF));
  }

  function addStorage() {
    const gb = Number(newStorage);
    if (!Number.isInteger(gb) || gb <= 0 || storages.includes(gb)) return;
    setAxis([...storages, gb].sort((a, b) => a - b));
    setNewStorage("");
  }

  function addColor() {
    const cid = nextCid.current++;
    setColors((all) => [...all, { cid, name: "", hex: "#000000", images: [] }]);
    for (const s of rows(storages)) setCell(key(cid, s), { on: true });
  }

  async function upload(cid: number, files: FileList | null) {
    setUploading(cid);
    for (const file of Array.from(files ?? [])) {
      const form = new FormData();
      form.append("file", file);
      const r = await uploadImage(form);
      if (r.url) setColors((all) => all.map((c) => (c.cid === cid ? { ...c, images: [...c.images, r.url!] } : c)));
      else setStatus({ error: r.error });
    }
    setUploading(null);
  }

  const moveImage = (c: Color, i: number, to: number) => {
    const images = [...c.images];
    [images[i], images[to]] = [images[to], images[i]];
    setColor(c.cid, { images });
  };

  const onSubmit = handleSubmit((form) => {
    // Matrix → variants, remembering which cell each variant came from (to place errors).
    const order: string[] = [];
    const variants: ProductInput["variants"] = [];
    for (const c of colors) {
      for (const s of rows(storages)) {
        const k = key(c.cid, s);
        const cell = cells[k];
        if (!cell?.on) continue;
        order.push(k);
        variants.push({
          sku: cell.sku.trim() || autoSku(model, c.name, s),
          prevSku: cell.prevSku,
          stockWas: cell.stockWas,
          color: { name: c.name.trim(), hex: c.hex },
          storage: s,
          priceOverride: cell.price === "" ? undefined : Number(cell.price),
          stockQty: Number(cell.stock),
          images: c.images.length ? c.images : undefined,
        });
      }
    }
    const input = {
      ...form,
      id: editing ? product!.id : undefined,
      basePrice: Number(form.basePrice),
      specs: hasSpecs ? { ...form.specs, ram: Number(form.specs.ram) } : undefined,
      tagline: form.tagline.trim() || undefined,
      tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
      images: colors.find((c) => c.images.length)?.images ?? [],
      variants,
    };

    const showIssues = (list: { path: string; message: string }[]) => {
      const map: Record<string, string> = {};
      for (const i of list) {
        const m = i.path.match(/^variants\.(\d+)\.(\w+)/);
        map[m ? `cell:${order[Number(m[1])]}:${m[2] === "color" ? "sku" : m[2]}` : i.path] ??= i.message;
      }
      setIssues(map);
      setStatus({ error: "admin.products.editor.fix" });
    };

    const local = productInputSchema.safeParse(input);
    if (!local.success) return showIssues(local.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    setIssues({});
    startTransition(async () => {
      const r = await saveProduct(local.data);
      if (r.issues) return showIssues(r.issues);
      if (!r.id) return setStatus({ error: r.error });
      if (!editing) return router.push(`/admin/products/${r.id}?saved=1`);
      // What's in the database now is the new baseline for the next save (stock is sent as a delta).
      setCells((all) =>
        Object.fromEntries(Object.entries(all).map(([k, c]) => {
          const i = order.indexOf(k);
          return [k, i < 0 ? { ...c, prevSku: undefined, stockWas: undefined } : { ...c, sku: variants[i].sku, prevSku: variants[i].sku, stockWas: variants[i].stockQty }];
        })),
      );
      setStatus({ ok: true });
      router.refresh();
    });
  });

  const section = "flex flex-col gap-4 rounded-lg border border-border p-4";
  const reg = (path: Parameters<typeof register>[0], opts?: Parameters<typeof register>[1]) => ({
    ...register(path, opts),
    className: inputClass(Boolean(issues[path])),
    "aria-invalid": Boolean(issues[path]) || undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <section className={section} aria-labelledby="identity">
        <h2 id="identity" className="text-xl font-semibold">{t("admin.products.editor.identity")}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="category" label={t("admin.products.editor.category")} error={msg("category")}>
            <select id="category" {...reg("category", { onChange: (e) => !product && setAxis(defaultStorages(e.target.value)) })}>
              {storeConfig.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field id="name" label={t("admin.products.editor.name")} error={msg("name")}>
            <input
              id="name"
              {...reg("name", { onChange: (e) => !slugTouched && setValue("slug", slugify(e.target.value)) })}
            />
          </Field>
          <Field
            id="slug"
            label={t("admin.products.editor.slug")}
            error={msg("slug")}
            hint={t(editing ? "admin.products.editor.slugLocked" : "admin.products.editor.slugHint")}
          >
            <input id="slug" readOnly={editing} {...reg("slug", { onChange: () => setSlugTouched(true) })} />
          </Field>
          <Field id="brand" label={t("admin.products.editor.brand")} error={msg("brand")}>
            <input id="brand" list="brands" {...reg("brand")} />
          </Field>
          <datalist id="brands">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <Field id="model" label={t("admin.products.editor.model")} error={msg("model")}>
            <input id="model" {...reg("model")} />
          </Field>
          <Field id="condition" label={t("admin.products.editor.condition")}>
            <select id="condition" {...reg("condition")}>
              <option value="new">{t("admin.products.editor.new")}</option>
              <option value="used">{t("admin.products.editor.used")}</option>
            </select>
          </Field>
          <Field id="basePrice" label={t("admin.products.editor.basePrice", { currency: storeConfig.commerce.currency })} error={msg("basePrice")}>
            <input id="basePrice" type="number" min={0} step={1} inputMode="numeric" {...reg("basePrice")} />
          </Field>
          <Field id="tagline" label={t("admin.products.editor.tagline")} error={msg("tagline")}>
            <input id="tagline" maxLength={90} {...reg("tagline")} />
          </Field>
          <Field id="tags" label={t("admin.products.editor.tags")}>
            <input id="tags" {...reg("tags")} />
          </Field>
          <div className="md:col-span-2">
            <Field id="description" label={t("admin.products.editor.description")} error={msg("description")}>
              <textarea id="description" rows={4} {...reg("description")} />
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="size-5" {...register("featured")} />
            {t("admin.products.editor.featured")}
          </label>
        </div>
      </section>

      {hasSpecs && (
        <section className={section} aria-labelledby="specs">
          <h2 id="specs" className="text-xl font-semibold">{t("admin.products.editor.specs")}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {SPECS.map((s) => (
              <Field key={s} id={`spec-${s}`} label={t(`specs.${s}`)} error={msg(`specs.${s}`)}>
                <input id={`spec-${s}`} {...(s === "ram" ? { type: "number", min: 1, inputMode: "numeric" as const } : {})} {...reg(`specs.${s}`)} />
              </Field>
            ))}
          </div>
        </section>
      )}

      <section className={section} aria-labelledby="matrix">
        <h2 id="matrix" className="text-xl font-semibold">
          {t(storages.length ? "admin.products.editor.matrix" : "admin.products.editor.colors")}
        </h2>
        <p className="text-sm text-text-muted">{t("admin.products.editor.matrixHint")}</p>
        {msg("variants") && <p role="alert" className="text-sm text-danger">{msg("variants")}</p>}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold">{t("admin.products.editor.storages")}</legend>
          <p className="text-sm text-text-muted">{t("admin.products.editor.storagesHint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            {storages.map((s) => (
              <span key={s} className="inline-flex min-h-11 items-center gap-1 rounded-pill border border-border ps-3">
                {formatStorage(s)}
                <button
                  type="button"
                  aria-label={t("admin.products.editor.removeStorage", { size: formatStorage(s) })}
                  onClick={() => setAxis(storages.filter((x) => x !== s))}
                  className="inline-flex size-11 items-center justify-center"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </span>
            ))}
            <span className="flex items-center gap-2">
              <label htmlFor="new-storage" className="sr-only">{t("admin.products.editor.storages")}</label>
              <span className="w-28">
                <input
                  id="new-storage"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder={t("admin.products.editor.storagePlaceholder")}
                  value={newStorage}
                  onChange={(e) => setNewStorage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addStorage())}
                  className={inputClass()}
                />
              </span>
              <Button variant="secondary" onClick={addStorage}>
                <Plus className="size-5" aria-hidden />
                {t("admin.products.editor.addStorage")}
              </Button>
            </span>
          </div>
        </fieldset>

        {colors.map((c) => (
          <fieldset key={c.cid} className="flex flex-col gap-3 rounded-md bg-surface-alt p-3">
            <legend className="sr-only">{c.name || t("admin.products.editor.colorName")}</legend>
            <div className="flex items-end gap-2">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {t("admin.products.editor.colorHex")}
                <input
                  type="color"
                  value={c.hex}
                  onChange={(e) => setColor(c.cid, { hex: e.target.value })}
                  className="h-11 w-14 cursor-pointer rounded-md border border-border bg-surface"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
                {t("admin.products.editor.colorName")}
                <input value={c.name} maxLength={40} onChange={(e) => setColor(c.cid, { name: e.target.value })} className={inputClass()} />
              </label>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("admin.products.editor.removeColor", { name: c.name })}
                onClick={() => colors.length > 1 && setColors((all) => all.filter((x) => x.cid !== c.cid))}
              >
                <Trash2 className="size-5" aria-hidden />
              </Button>
            </div>

            <ul className="flex flex-col divide-y divide-border">
              {rows(storages).map((s) => {
                const k = key(c.cid, s);
                const cell = cells[k] ?? OFF;
                const err = msg(`cell:${k}:sku`) || msg(`cell:${k}:stockQty`) || msg(`cell:${k}:priceOverride`);
                const id = `cell-${c.cid}-${s ?? "x"}`;
                return (
                  <li key={k} className={cn("grid grid-cols-2 items-end gap-2 py-2 md:grid-cols-[8rem_1fr_7rem_6rem]", !cell.on && "opacity-60")}>
                    <label className="col-span-2 flex min-h-11 items-center gap-2 font-semibold md:col-span-1">
                      <input type="checkbox" className="size-5" checked={cell.on} onChange={(e) => setCell(k, { on: e.target.checked })} />
                      {s ? formatStorage(s) : t("admin.products.editor.enabled")}
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 text-xs text-text-muted md:col-span-1">
                      {t("admin.products.editor.sku")}
                      <input
                        id={`${id}-sku`}
                        value={cell.sku}
                        disabled={!cell.on}
                        placeholder={autoSku(model, c.name, s)}
                        onChange={(e) => setCell(k, { sku: e.target.value.toUpperCase() })}
                        aria-invalid={Boolean(err) || undefined}
                        aria-describedby={err ? `${id}-err` : undefined}
                        className={inputClass(Boolean(err))}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-text-muted">
                      {t("admin.products.editor.priceOverride")}
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={cell.price}
                        disabled={!cell.on}
                        placeholder={t("admin.products.editor.basePlaceholder")}
                        onChange={(e) => setCell(k, { price: e.target.value })}
                        className={inputClass()}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-text-muted">
                      {t("admin.products.editor.stockQty")}
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={cell.stock}
                        disabled={!cell.on}
                        onChange={(e) => setCell(k, { stock: e.target.value })}
                        className={inputClass()}
                      />
                    </label>
                    {err && (
                      <p id={`${id}-err`} role="alert" className="col-span-full text-sm text-danger">
                        {err}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">{t("admin.products.editor.images", { name: c.name || "…" })}</p>
              <ul className="flex flex-wrap gap-2">
                {c.images.map((src, i) => (
                  <li key={src} className="flex flex-col items-center gap-1 rounded-md bg-surface p-1">
                    <Image src={src} alt="" width={88} height={88} className="size-22 object-contain" />
                    <span className="flex">
                      <button type="button" disabled={i === 0} onClick={() => moveImage(c, i, i - 1)} aria-label={t("admin.products.editor.moveLeft")} className="inline-flex size-11 items-center justify-center disabled:opacity-30">
                        <ArrowLeft className="size-5 rtl:rotate-180" aria-hidden />
                      </button>
                      <button type="button" disabled={i === c.images.length - 1} onClick={() => moveImage(c, i, i + 1)} aria-label={t("admin.products.editor.moveRight")} className="inline-flex size-11 items-center justify-center disabled:opacity-30">
                        <ArrowRight className="size-5 rtl:rotate-180" aria-hidden />
                      </button>
                      <button type="button" onClick={() => setColor(c.cid, { images: c.images.filter((x) => x !== src) })} aria-label={t("admin.products.editor.removeImage")} className="inline-flex size-11 items-center justify-center text-danger">
                        <Trash2 className="size-5" aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-pill border border-primary px-5 text-primary focus-within:outline-2">
                <Plus className="size-5" aria-hidden />
                {uploading === c.cid ? t("admin.products.editor.uploading") : t("admin.products.editor.upload")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  className="sr-only"
                  disabled={uploading !== null}
                  onChange={(e) => {
                    upload(c.cid, e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </fieldset>
        ))}
        {msg("images") && <p role="alert" className="text-sm text-danger">{msg("images")}</p>}
        <p className="text-sm text-text-muted">{t("admin.products.editor.imagesHint")}</p>
        <Button variant="secondary" onClick={addColor} className="self-start">
          <Plus className="size-5" aria-hidden />
          {t("admin.products.editor.addColor")}
        </Button>
      </section>

      <div className="sticky bottom-8 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3 md:bottom-3">
        <Button type="submit" disabled={pending || uploading !== null}>
          {pending ? t("admin.common.saving") : t("admin.products.editor.save")}
        </Button>
        <p role="status" aria-live="polite" className={cn("text-sm", status.error ? "text-danger" : "text-success")}>
          {status.error ? t(status.error) : status.ok ? t("admin.products.editor.saved") : ""}
        </p>
      </div>
    </form>
  );
}
