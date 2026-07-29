import sanitizeHtmlLib from 'sanitize-html';

// Matches the tag set the client's Tiptap StarterKit editor can produce.
// No attributes are allowed on any tag at all — this eliminates the entire
// class of attribute-based XSS (onerror=, javascript: hrefs, etc.) without
// needing an attribute-by-attribute allowlist.
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
];

export function sanitizeHtml(dirty: string): string {
  return sanitizeHtmlLib(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });
}
