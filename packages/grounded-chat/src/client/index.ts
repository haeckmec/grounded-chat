/**
 * Browser helpers with no React: the server-sent event reader for streamed turns, embed parameter
 * parsing, a readable text colour for any theme colour, and the curated web font list.
 */
export { readServerSentEvents, type ServerSentEvent } from './sse.js';
export { isValidOrigin, parseEmbedParams, sanitizeHexColor, type EmbedParams, type EmbedParamsSpec } from './embed.js';
export { contrastTextColor } from './contrast.js';
export { FONT_OPTIONS, findFontOption, googleFontsHref, type FontOption } from './fonts.js';
