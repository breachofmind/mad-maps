// Mirrors server/src/lib/sanitizeHtml.ts's allowlist — kept in sync manually
// since the two run in different runtimes (DOMPurify in-browser vs
// sanitize-html on the server) and can't share a single config module.
export const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    's',
    'u',
    'h1',
    'h2',
    'h3',
    'ul',
    'ol',
    'li',
    'blockquote',
    'code',
    'pre',
    'hr',
  ],
  ALLOWED_ATTR: [] as string[],
};
