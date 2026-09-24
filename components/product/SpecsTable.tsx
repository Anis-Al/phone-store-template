import type { Product } from "@/lib/data/schemas";
import { formatStorage, t } from "@/lib/i18n";

const ROWS = ["screen", "chipset", "ram", "storage", "battery", "mainCamera", "frontCamera", "os", "network"] as const;

export function SpecsTable({ specs }: { specs: NonNullable<Product["specs"]> }) {
  return (
    <table className="w-full text-sm">
      <tbody className="divide-y divide-border">
        {ROWS.map((k) => (
          <tr key={k}>
            <th scope="row" className="w-2/5 py-3 pe-4 text-start align-top font-semibold">
              {t(`specs.${k}`)}
            </th>
            <td className="py-3 text-text-muted">{k === "ram" ? formatStorage(specs.ram) : specs[k]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
