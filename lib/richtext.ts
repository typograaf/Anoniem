/** The CMS stores rich text exactly as Webflow emitted it (`<p>` blocks with
 *  `<br/>` line breaks) so untouched fields stay byte-identical to the
 *  published site. The editor shows plain text and converts on the way in. */

export function htmlToText(html: string): string {
  return String(html ?? '')
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?p>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/‍/g, '')
    .trim()
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function textToHtml(text: string): string {
  const blocks = String(text ?? '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
  if (!blocks.length) return ''
  return blocks
    .map((b) => `<p>${b.split('\n').map(escape).join('<br/>')}</p>`)
    .join('')
}
