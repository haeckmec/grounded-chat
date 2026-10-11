// WCAG relative luminance (the standard sRGB formula, not a linear brightness approximation), so
// text stays legible on whatever colour a theme picks. A single brightness cutoff gets saturated
// mid-brightness colours wrong: pure red scores "dark enough" for white text, yet its contrast with
// white is about 4.0:1, below the 4.5:1 AA threshold. This computes the real contrast ratio against
// white and near-black and picks the higher.
function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}

function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** White or near-black, whichever contrasts more with the background colour; white for anything not a hex colour. */
export function contrastTextColor(hex?: string): string {
  if (!hex) return '#ffffff';
  const cleaned = hex.replace('#', '');
  const full = cleaned.length === 3 ? cleaned.split('').map((c) => c + c).join('') : cleaned;
  if (full.length !== 6 || /[^0-9a-fA-F]/.test(full)) return '#ffffff';

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const backgroundLuminance = relativeLuminance(r, g, b);

  const whiteContrast = contrastRatio(backgroundLuminance, 1);
  const darkContrast = contrastRatio(backgroundLuminance, 0);

  return whiteContrast >= darkContrast ? '#ffffff' : '#111827';
}
