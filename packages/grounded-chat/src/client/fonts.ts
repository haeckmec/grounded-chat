/** One web font a theme can choose. */
export interface FontOption {
  /** The plain family name, stored in config and used as the CSS font-family. */
  value: string;
  label: string;
  /** The family= value for the Google Fonts CSS2 API. */
  googleFontParam: string;
}

/** Popular web fonts a theme may pick; anything else stays on the host's own stack. */
export const FONT_OPTIONS: FontOption[] = [
  { value: 'Inter', label: 'Inter', googleFontParam: 'Inter:wght@400;500;600;700' },
  { value: 'Roboto', label: 'Roboto', googleFontParam: 'Roboto:wght@400;500;700' },
  { value: 'Open Sans', label: 'Open Sans', googleFontParam: 'Open+Sans:wght@400;600;700' },
  { value: 'Lato', label: 'Lato', googleFontParam: 'Lato:wght@400;700' },
  { value: 'Montserrat', label: 'Montserrat', googleFontParam: 'Montserrat:wght@400;500;700' },
  { value: 'Poppins', label: 'Poppins', googleFontParam: 'Poppins:wght@400;500;600' },
  { value: 'Source Sans 3', label: 'Source Sans 3', googleFontParam: 'Source+Sans+3:wght@400;600' },
  { value: 'Nunito', label: 'Nunito', googleFontParam: 'Nunito:wght@400;600;700' },
  { value: 'Raleway', label: 'Raleway', googleFontParam: 'Raleway:wght@400;600' },
  { value: 'Work Sans', label: 'Work Sans', googleFontParam: 'Work+Sans:wght@400;500;600' },
];

/** The option for a family name, if it is on the list. */
export function findFontOption(value?: string): FontOption | undefined {
  return FONT_OPTIONS.find((option) => option.value === value);
}

/** The stylesheet URL that loads a listed font, or undefined for anything not on the list. */
export function googleFontsHref(fontValue?: string): string | undefined {
  const option = findFontOption(fontValue);
  if (!option) return undefined;
  return `https://fonts.googleapis.com/css2?family=${option.googleFontParam}&display=swap`;
}
