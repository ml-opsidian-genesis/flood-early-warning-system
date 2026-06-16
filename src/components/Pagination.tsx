"use client";

type Props = {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
};

export default function Pagination({ page, totalPages, onPage }: Props) {
  if (totalPages <= 1) return null;

  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ← Prev
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`d${i}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p as number)}
            className={`min-w-[2rem] rounded px-2 py-1 font-medium ${
              p === page ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="rounded px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next →
      </button>
    </div>
  );
}
