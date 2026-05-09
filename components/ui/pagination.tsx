import Link from "next/link";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  baseUrl: string;
  extraParams?: Record<string, string>;
};

export function Pagination({ page, pageSize, total, baseUrl, extraParams = {} }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const buildUrl = (p: number) => {
    const params = new URLSearchParams({ ...extraParams, page: String(p) });
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        Страница {page} из {totalPages} · всего {total}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={buildUrl(page - 1)}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors"
          >
            ← Назад
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={buildUrl(page + 1)}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors"
          >
            Вперёд →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
