/**
 * Web Search Service
 * Provides live, real-time web search capabilities for Council bots.
 * Queries search endpoints over HTTPS with zero external API key requirements.
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  source: string;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .trim();
}

export async function searchWeb(query: string, maxResults: number = 5): Promise<WebSearchResponse> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return { query: '', results: [], source: 'duckduckgo' };
  }

  const results: WebSearchResult[] = [];

  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const parts = html.split('<div class="result results_links results_links_deep web-result');

      for (let i = 1; i < parts.length && results.length < maxResults; i++) {
        const chunk = parts[i];
        const titleMatch = chunk.match(/<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
        const snippetMatch = chunk.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

        if (titleMatch) {
          let rawUrl = titleMatch[1];
          if (rawUrl.includes('uddg=')) {
            try {
              rawUrl = decodeURIComponent(rawUrl.split('uddg=')[1].split('&')[0]);
            } catch {
              // keep as is if decoding fails
            }
          }

          const title = decodeHtmlEntities(titleMatch[2]);
          const snippet = snippetMatch ? decodeHtmlEntities(snippetMatch[1]) : '';

          if (title && rawUrl.startsWith('http')) {
            results.push({
              title,
              url: rawUrl,
              snippet,
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[WebSearch] Search request failed for "${cleanQuery}":`, err.message);
  }

  // Fallback to Wikipedia API if general search yielded fewer than 2 results
  if (results.length < 2) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        cleanQuery
      )}&limit=3&namespace=0&format=json`;
      const wikiRes = await fetch(wikiUrl);
      if (wikiRes.ok) {
        const wikiData: any = await wikiRes.json();
        const titles = wikiData[1] || [];
        const snippets = wikiData[2] || [];
        const urls = wikiData[3] || [];

        for (let i = 0; i < titles.length && results.length < maxResults; i++) {
          if (urls[i] && !results.some((r) => r.url === urls[i])) {
            results.push({
              title: titles[i],
              url: urls[i],
              snippet: snippets[i] || `Information about ${titles[i]} on Wikipedia.`,
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return {
    query: cleanQuery,
    results,
    source: 'web',
  };
}
