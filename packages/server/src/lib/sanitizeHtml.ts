import sanitizeHtmlLib from 'sanitize-html';

// Matches the tag set the client's Tiptap StarterKit editor can produce,
// plus `a` for the "View on Google Maps" link the search box pre-fills.
// No attributes are allowed except href/target/rel on `a` (and href is
// restricted to http/https, so javascript:/data: links can't sneak in via
// a direct API call even though nothing in the client UI can produce one) —
// this keeps the rest of the tag set free of attribute-based XSS
// (onerror=, etc.) without needing a per-tag allowlist for everything else.
const ALLOWED_TAGS = [
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
  'a',
];

export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https'],
    disallowedTagsMode: 'discard',
  });
}
