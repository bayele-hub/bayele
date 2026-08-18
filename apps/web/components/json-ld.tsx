/**
 * Renders one or more schema.org objects as a JSON-LD <script>. Server-rendered into the page so
 * crawlers see it in the initial HTML. Data is our own (never user-controlled keys), and we escape
 * the closing-tag sequence defensively since values (bio, name) can contain arbitrary text.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
