/**
 * Crawler ligero basado en fetch (Arquitectura §9, REQ-001).
 * Extrae texto, titulos, meta y CTAs de la landing y de paginas clave.
 * NOTA: no ejecuta JS. El renderizado con Playwright se anadira como mejora
 * para sitios SPA; la interfaz de salida no cambiara.
 */

export interface CrawledPage {
  url: string;
  title: string;
  description: string;
  headings: string[];
  ctas: string[];
  text: string;
}

export interface CrawlResult {
  baseUrl: string;
  pages: CrawledPage[];
}

const KEY_KEYWORDS = [
  "pricing", "precio", "planes", "plans",
  "features", "funcionalidad", "caracteristicas", "producto",
  "about", "nosotros", "empresa", "quienes",
];

const CTA_KEYWORDS = [
  "empieza", "empezar", "prueba", "regist", "sign up", "signup", "get started",
  "comprar", "contrata", "solicita", "reserva", "descarga", "unete", "crear cuenta",
  "start", "try", "book", "demo", "contact",
];

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(html: string, tag: string): string {
  const m = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? stripTags(m[1]) : "";
}

function extractMetaDescription(html: string): string {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  return m ? m[1].trim() : "";
}

function extractHeadings(html: string): string[] {
  const out: string[] = [];
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 20) {
    const t = stripTags(m[1]);
    if (t) out.push(t);
  }
  return out;
}

function extractCtas(html: string): string[] {
  const out = new Set<string>();
  const re = /<(?:a|button)[^>]*>([\s\S]*?)<\/(?:a|button)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const t = stripTags(m[1]);
    if (!t || t.length > 40) continue;
    if (CTA_KEYWORDS.some((k) => t.toLowerCase().includes(k))) out.add(t);
    if (out.size >= 15) break;
  }
  return [...out];
}

function extractLinks(html: string, base: URL): string[] {
  const out = new Set<string>();
  const re = /<a[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], base);
      if (u.origin === base.origin) out.add(u.href.split("#")[0]);
    } catch {
      /* ignora hrefs invalidos */
    }
  }
  return [...out];
}

async function fetchPage(url: string): Promise<CrawledPage | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RRSS-Studio/0.1)" },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    const bodyText = stripTags(html);
    return {
      url,
      title: extractTag(html, "title"),
      description: extractMetaDescription(html),
      headings: extractHeadings(html),
      ctas: extractCtas(html),
      text: bodyText.slice(0, 6000),
    };
  } catch {
    return null;
  }
}

export async function crawlSite(
  baseUrl: string,
  maxPages = 4,
  context = "",
): Promise<CrawlResult> {
  const base = new URL(baseUrl);
  const home = await fetchPage(base.href);
  const pages: CrawledPage[] = home ? [home] : [];

  if (home) {
    const raw = await fetch(base.href, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RRSS-Studio/0.1)" },
    })
      .then((r) => r.text())
      .catch(() => "");
    const links = extractLinks(raw, base);
    const contextTokens = context
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4)
      .slice(0, 30);
    const key = links.filter((l) =>
      KEY_KEYWORDS.some((k) => l.toLowerCase().includes(k)) ||
      contextTokens.some((token) =>
        l.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(token),
      ),
    );
    for (const link of key.slice(0, maxPages - 1)) {
      const p = await fetchPage(link);
      if (p) pages.push(p);
    }
  }

  return { baseUrl: base.href, pages };
}
