import { useMemo, useState } from "react";
import type { WidgetRecord } from "@airis/shared";

type SortKey = "rank" | "badnessScore" | "name" | "rating" | "reviewCount";

type LeadFinderRow = Record<string, unknown> & { _rank: number };

export function LeadFinderWidgetView({ record }: { record: WidgetRecord }) {
  const data = record.data as Record<string, unknown>;
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const businesses = Array.isArray(data?.businesses) ? (data.businesses as Record<string, unknown>[]) : [];

  const sorted = useMemo(() => {
    const arr: LeadFinderRow[] = businesses.map((b, i) => ({ ...b, _rank: i + 1 }));
    arr.sort((a, b) => {
      const get = (x: LeadFinderRow) => {
        switch (sortKey) {
          case "rank":
            return x._rank;
          case "badnessScore": {
            const av = x.audit as { badnessScore?: number } | undefined;
            return av?.badnessScore ?? -1;
          }
          case "rating":
            return typeof x.rating === "number" ? x.rating : -1;
          case "reviewCount":
            return typeof x.reviewCount === "number" ? x.reviewCount : -1;
          case "name":
            return String(x.name ?? "").toLowerCase();
          default:
            return 0;
        }
      };
      const av = get(a);
      const bv = get(b);
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [businesses, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "rank" || k === "name" ? "asc" : "desc");
    }
  };

  const badnessColor = (s: number | undefined) => {
    if (s == null) return "#666";
    if (s >= 70) return "#e53935";
    if (s >= 40) return "#fb8c00";
    if (s >= 15) return "#fdd835";
    return "#43a047";
  };

  const csvUrl = `/api/spaces/${record.spaceId}/lead-finder/${record.id}/csv`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-3">
      <div className="shrink-0">
        <div className="font-semibold text-slate-100">
          {typeof data.query === "string" && data.query.length > 0 ? data.query : "Lead finder"}
        </div>
        <div className="text-xs text-slate-500">
          {typeof data.businessCount === "number" ? data.businessCount : 0} leads ·{" "}
          {typeof data.auditedCount === "number" ? data.auditedCount : 0} audited · avg badness{" "}
          {data.avgBadness != null && typeof data.avgBadness === "number" ? data.avgBadness : "—"}
        </div>
      </div>
      <div className="flex min-h-0 flex-[1_1_auto] flex-col overflow-auto rounded-lg border border-slate-800/80 bg-slate-950/30">
        <div className="sticky top-0 z-[2] flex shrink-0 items-center justify-end border-b border-slate-800/80 bg-slate-950/95 px-2 py-1.5 backdrop-blur-sm">
          <a
            href={csvUrl}
            download
            className="shrink-0 rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-200 no-underline hover:border-cyan-700/50 hover:text-cyan-100"
          >
            Download CSV
          </a>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-900/95">
            <tr className="border-b border-slate-800">
              {(
                [
                  ["rank", "#"],
                  ["badnessScore", "Badness"],
                  ["name", "Name"],
                  ["rating", "Rating"],
                  ["reviewCount", "Reviews"],
                ] as [SortKey, string][]
              ).map(([k, label]) => (
                <th
                  key={k}
                  className="cursor-pointer select-none px-2 py-2 text-left font-medium text-slate-400 hover:text-slate-200"
                  onClick={() => toggleSort(k)}
                >
                  {label}
                  {sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th className="px-2 py-2 text-left font-medium text-slate-400">Phone</th>
              <th className="px-2 py-2 text-left font-medium text-slate-400">Website</th>
              <th className="px-2 py-2 text-left font-medium text-slate-400">Tech</th>
              <th className="px-2 py-2 text-left font-medium text-slate-400">Signals</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const audit = b.audit as { badnessScore?: number; techStack?: string[]; signals?: { id: string }[] } | undefined;
              const rank = b._rank as number;
              return (
                <tr key={`${String(b.name)}-${rank}`} className="border-t border-slate-800/60">
                  <td className="px-2 py-2 text-slate-300">{rank}</td>
                  <td className="px-2 py-2">
                    <span
                      className="inline-block rounded px-2 py-0.5 text-[11px] font-semibold text-black"
                      style={{ background: badnessColor(audit?.badnessScore) }}
                    >
                      {audit?.badnessScore ?? "—"}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-2 py-2 text-slate-200">{String(b.name ?? "")}</td>
                  <td className="px-2 py-2 text-slate-300">{b.rating != null ? String(b.rating) : "—"}</td>
                  <td className="px-2 py-2 text-slate-300">{b.reviewCount != null ? String(b.reviewCount) : "—"}</td>
                  <td className="max-w-[120px] truncate px-2 py-2 text-slate-400">{String(b.phone ?? "—")}</td>
                  <td className="max-w-[220px] truncate px-2 py-2 text-slate-300">
                    {typeof b.website === "string" && b.website.startsWith("http") ? (
                      <a href={b.website} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300">
                        {b.website}
                      </a>
                    ) : (
                      <em className="text-slate-500">NO WEBSITE</em>
                    )}
                  </td>
                  <td className="max-w-[140px] truncate px-2 py-2 text-slate-400">
                    {(audit?.techStack ?? []).join(", ") || "—"}
                  </td>
                  <td className="max-w-[160px] truncate px-2 py-2 font-mono text-[10px] text-slate-500">
                    {(audit?.signals ?? []).map((s) => s.id).join(", ") || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
