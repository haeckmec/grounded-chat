/**
 * The default look, written only against CSS variables so a host themes it without touching the
 * markup. Render it once with `<GroundedChatStyles />`, or skip it and style the `classNames` slots.
 *
 * Variables, with their defaults:
 * --gc-bg #ffffff, --gc-fg #18181b, --gc-muted #71717a, --gc-border #e4e4e7, --gc-surface #f4f4f5,
 * --gc-primary #18181b, --gc-primary-fg #ffffff, --gc-error #dc2626, --gc-radius 1rem,
 * --gc-font inherit, --gc-max-width 42rem.
 */
export const GROUNDED_CHAT_CSS = `
.gc-root{--gc-bg:#ffffff;--gc-fg:#18181b;--gc-muted:#71717a;--gc-border:#e4e4e7;--gc-surface:#f4f4f5;--gc-primary:#18181b;--gc-primary-fg:#ffffff;--gc-error:#dc2626;--gc-radius:1rem;--gc-font:inherit;--gc-max-width:42rem;
  display:flex;flex-direction:column;height:100vh;max-width:var(--gc-max-width);margin:0 auto;background:var(--gc-bg);color:var(--gc-fg);font-family:var(--gc-font)}
.gc-header{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-bottom:1px solid var(--gc-border)}
.gc-brand,.gc-actions{display:flex;align-items:center;gap:.5rem}
.gc-logo{width:1.5rem;height:1.5rem;border-radius:.25rem}
.gc-title{margin:0;font-size:1rem;font-weight:500}
.gc-reset{background:none;border:0;font-size:.75rem;color:var(--gc-muted);cursor:pointer}
.gc-languages{display:flex;gap:.25rem;font-size:.75rem}
.gc-language{border:0;border-radius:.25rem;padding:.25rem .5rem;background:none;color:var(--gc-muted);cursor:pointer}
.gc-language-active{background:var(--gc-primary);color:var(--gc-primary-fg)}
.gc-messages{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.75rem}
.gc-row-user{text-align:right}.gc-row-assistant{text-align:left}
.gc-bubble{display:inline-block;max-width:80%;padding:.5rem .75rem;border-radius:var(--gc-radius);font-size:.875rem;white-space:pre-wrap}
.gc-bubble-user{background:var(--gc-primary);color:var(--gc-primary-fg)}
.gc-bubble-assistant{background:var(--gc-surface);color:var(--gc-fg)}
.gc-typing{font-size:.875rem;color:var(--gc-muted)}.gc-error{font-size:.875rem;color:var(--gc-error)}
.gc-replies{padding:0 1rem .5rem}.gc-replies-label{margin:0 0 .5rem;font-size:.75rem;color:var(--gc-muted)}
.gc-pills{display:flex;flex-wrap:wrap;gap:.5rem}
.gc-pill{border:1px solid var(--gc-border);border-radius:999px;padding:.25rem .75rem;background:none;font-size:.75rem;color:var(--gc-fg);cursor:pointer}
.gc-pill-explain{border-style:dashed;color:var(--gc-muted)}
.gc-composer{display:flex;align-items:flex-end;gap:.5rem;padding:.75rem 1rem;border-top:1px solid var(--gc-border)}
.gc-input{flex:1;max-height:9rem;resize:none;overflow-y:auto;border:1px solid var(--gc-border);border-radius:var(--gc-radius);padding:.5rem 1rem;font:inherit;font-size:.875rem}
.gc-send{border:0;border-radius:999px;padding:.5rem 1rem;background:var(--gc-primary);color:var(--gc-primary-fg);font-size:.875rem;cursor:pointer}
.gc-send:disabled{opacity:.4;cursor:default}
.gc-toast-outer{position:fixed;left:0;right:0;bottom:1rem;display:flex;justify-content:center;padding:0 1rem;pointer-events:none}
.gc-toast{pointer-events:auto;border-radius:999px;padding:.5rem 1rem;background:var(--gc-fg);color:var(--gc-bg);font-size:.75rem}
`;

/** Renders the default stylesheet. */
export function GroundedChatStyles() {
  return <style>{GROUNDED_CHAT_CSS}</style>;
}
