import { useMemo } from "react";
import type { DemoSpaceAccent, SpaceMeta } from "@airis/shared";
import { DEMO_SPACE_TEMPLATES } from "@airis/shared";
import { getDemoSpaceTemplate } from "../data/demoSpacesConfig";
import { DemoSpaceGlyph } from "./DemoSpaceGlyph";

const ACCENT_GLYPH: Record<DemoSpaceAccent, string> = {
  iris: "text-[color:var(--airis-accent-iris)]",
  gold: "text-[color:var(--airis-accent-gold)]",
  violet: "text-[color:rgba(186,168,255,0.95)]",
  mint: "text-[color:rgba(110,231,183,0.95)]",
  coral: "text-[color:rgba(253,164,175,0.95)]",
  sky: "text-[color:rgba(125,211,252,0.95)]",
};

function FeaturedPreviewBackdrop({ src, fallbackClass }: { src?: string; fallbackClass: string }) {
  if (!src) {
    return <div className={`pointer-events-none absolute inset-0 ${fallbackClass}`} />;
  }
  return (
    <>
      <img
        src={src}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08] object-cover opacity-92 blur-[11px]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/58 via-black/44 to-black/68" />
      <div className="pointer-events-none absolute inset-0 backdrop-blur-[2px] bg-[color:rgba(10,12,20,0.48)]" />
    </>
  );
}

type Props = {
  demoSpaces: SpaceMeta[];
  onOpenDemo: (spaceId: string) => void;
};

export function FeaturedDemoSections({ demoSpaces, onOpenDemo }: Props) {
  const { flagship, rest } = useMemo(() => {
    const f: SpaceMeta[] = [];
    const r: SpaceMeta[] = [];
    for (const s of demoSpaces) {
      const t = getDemoSpaceTemplate(s.demoTemplateId);
      if (t?.flagship) f.push(s);
      else r.push(s);
    }
    const order = new Map(DEMO_SPACE_TEMPLATES.map((t, i) => [t.templateId, i]));
    const sortFn = (a: SpaceMeta, b: SpaceMeta) =>
      (order.get(a.demoTemplateId ?? "") ?? 99) - (order.get(b.demoTemplateId ?? "") ?? 99);
    f.sort(sortFn);
    r.sort(sortFn);
    return { flagship: f, rest: r };
  }, [demoSpaces]);

  if (demoSpaces.length === 0) return null;

  return (
    <div className="mt-10 space-y-10 sm:mt-12">
      {flagship.length > 0 && (
        <section>
          <div className="text-center">
            <h2 className="text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--airis-accent-gold)]">
              Flagship workspaces
            </h2>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-snug text-[color:var(--airis-text-secondary)]">
              Our strongest demos — each open clones an editable workspace for you; the seeds stay on Home for
              your next visit.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {flagship.map((s) => {
              const tmpl = getDemoSpaceTemplate(s.demoTemplateId);
              const accent = tmpl?.accent ?? "iris";
              const desc = s.demoDescription ?? tmpl?.description;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenDemo(s.id)}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-[color:rgba(246,207,122,0.28)] text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-[color:rgba(246,207,122,0.45)]"
                >
                  <FeaturedPreviewBackdrop
                    src={tmpl?.homePreviewPath}
                    fallbackClass="bg-[color:rgba(246,207,122,0.06)] transition group-hover:bg-[color:rgba(246,207,122,0.1)]"
                  />
                  <div className="relative z-10 flex flex-col p-4">
                    <div className="flex items-start gap-3">
                      {tmpl && (
                        <span
                          className={`mt-0.5 shrink-0 drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)] [&>svg]:h-9 [&>svg]:w-9 ${ACCENT_GLYPH[accent]}`}
                        >
                          <DemoSpaceGlyph name={tmpl.icon} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--airis-accent-gold)] [text-shadow:0_1px_12px_rgba(0,0,0,0.55)]">
                            Flagship
                          </span>
                        </div>
                        <h3 className="mt-1 text-base font-semibold text-[color:var(--airis-text-primary)] [text-shadow:0_1px_14px_rgba(0,0,0,0.5)]">
                          {s.name}
                        </h3>
                        {desc && (
                          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[color:var(--airis-text-secondary)] [text-shadow:0_1px_10px_rgba(0,0,0,0.45)]">
                            {desc}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="mt-4 text-[11px] font-medium text-[color:var(--airis-accent-iris)] [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] group-hover:underline">
                      Clone &amp; open →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section>
          <h2 className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--airis-text-tertiary)]">
            More examples
          </h2>
          <p className="mx-auto mt-2 max-w-md text-center text-[12px] text-[color:var(--airis-text-tertiary)]">
            Additional starter layouts — same clone-on-open behavior.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {rest.map((s) => {
              const tmpl = getDemoSpaceTemplate(s.demoTemplateId);
              const accent = tmpl?.accent ?? "iris";
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenDemo(s.id)}
                  className="group relative inline-flex max-w-full overflow-hidden rounded-[var(--airis-radius-pill)] border border-[color:var(--airis-border-glass)] py-1.5 pl-2.5 pr-3 text-left text-[13px] font-medium text-[color:var(--airis-text-primary)] transition hover:border-[color:var(--airis-border-glass-strong)]"
                >
                  <FeaturedPreviewBackdrop
                    src={tmpl?.homePreviewPath}
                    fallbackClass="bg-[color:rgba(255,255,255,0.04)] transition group-hover:bg-[color:rgba(255,255,255,0.07)]"
                  />
                  <span className="relative z-10 inline-flex min-w-0 items-center gap-2">
                    {tmpl && (
                      <span
                        className={`shrink-0 drop-shadow-[0_1px_8px_rgba(0,0,0,0.5)] [&>svg]:h-4 [&>svg]:w-4 ${ACCENT_GLYPH[accent]}`}
                      >
                        <DemoSpaceGlyph name={tmpl.icon} />
                      </span>
                    )}
                    <span className="min-w-0 truncate [text-shadow:0_1px_10px_rgba(0,0,0,0.45)]">
                      {s.name}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
