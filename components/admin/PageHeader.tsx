import type { ReactNode } from "react";

export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <h1 className="text-3xl font-semibold">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
