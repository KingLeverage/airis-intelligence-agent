import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const GlassInput = forwardRef<HTMLTextAreaElement, Props>(function GlassInput(
  { className = "", ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={`min-h-[44px] w-full resize-y rounded-[var(--airis-radius-pill)] border border-[color:var(--airis-border-glass)] bg-[color:rgba(8,16,26,0.55)] px-4 py-2.5 text-sm text-[color:var(--airis-text-primary)] shadow-inner outline-none backdrop-blur-md placeholder:text-[color:var(--airis-text-tertiary)] focus:border-[color:var(--airis-border-focus)] focus:shadow-[var(--airis-shadow-focus)] ${className}`.trim()}
      {...rest}
    />
  );
});
