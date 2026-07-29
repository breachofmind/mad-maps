import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml — XSS payloads are stripped', () => {
  const payloads: Array<{ name: string; input: string; mustNotContain: string[] }> = [
    {
      name: 'raw <script> tag',
      input: '<p>hello</p><script>alert(1)</script>',
      mustNotContain: ['<script', 'alert(1)'],
    },
    {
      name: 'onerror= handler on <img>',
      input: '<img src="x" onerror="alert(1)">',
      mustNotContain: ['onerror', 'alert(1)', '<img'],
    },
    {
      name: 'onclick= handler on allowed tag',
      input: '<p onclick="alert(1)">click me</p>',
      mustNotContain: ['onclick', 'alert(1)'],
    },
    {
      name: 'javascript: href on <a>',
      input: '<a href="javascript:alert(1)">link</a>',
      mustNotContain: ['javascript:', 'href', '<a'],
    },
    {
      name: '<iframe> embed',
      input: '<iframe src="https://evil.example/"></iframe>',
      mustNotContain: ['<iframe', 'evil.example'],
    },
    {
      name: '<svg onload=> handler',
      input: '<svg onload="alert(1)"></svg>',
      mustNotContain: ['<svg', 'onload', 'alert(1)'],
    },
    {
      name: 'style attribute with expression()',
      input: '<p style="background:url(javascript:alert(1))">styled</p>',
      mustNotContain: ['style=', 'javascript:'],
    },
    {
      name: '<style> tag with data exfiltration selector',
      input: '<style>*{}</style><p>after</p>',
      mustNotContain: ['<style'],
    },
    {
      name: 'nested/obfuscated script via <script/xss>',
      input: '<scr<script>ipt>alert(1)</scr</script>ipt>',
      mustNotContain: ['<script'],
    },
    {
      name: 'data: URI script in <a>',
      input: '<a href="data:text/html,<script>alert(1)</script>">click</a>',
      mustNotContain: ['<script', 'href'],
    },
  ];

  it.each(payloads)('strips $name', ({ input, mustNotContain }) => {
    const output = sanitizeHtml(input);
    for (const forbidden of mustNotContain) {
      expect(output.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe('sanitizeHtml — allowlisted formatting survives', () => {
  it('keeps bold, italic, strike, underline, and paragraphs', () => {
    const input = '<p><strong>bold</strong> <em>italic</em> <s>strike</s> <u>underline</u></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('keeps headings h1-h3', () => {
    const input = '<h1>Title</h1><h2>Subtitle</h2><h3>Section</h3>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('keeps lists', () => {
    const input = '<ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('keeps blockquote, code, pre, hr, br', () => {
    const input = '<blockquote>quoted</blockquote><pre><code>code</code></pre><hr /><p>a<br />b</p>';
    expect(sanitizeHtml(input)).toBe(input.replace('<hr />', '<hr />'));
  });

  it('strips disallowed tags but keeps their safe inner text', () => {
    expect(sanitizeHtml('<div><p>kept</p></div>')).toBe('<p>kept</p>');
  });

  it('strips all attributes even on allowed tags', () => {
    expect(sanitizeHtml('<p class="foo" id="bar" data-x="y">text</p>')).toBe('<p>text</p>');
  });

  it('passes through plain text with no HTML unchanged', () => {
    expect(sanitizeHtml('just plain text')).toBe('just plain text');
  });

  it('handles empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});
