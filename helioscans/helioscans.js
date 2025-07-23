async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const url = `https://helioscans.com/series/?q=${encodedKeyword}`;
        const response = await soraFetch(url);
        const html = await response.text();

        const results = [];
        const regex = /<button[^>]+?title="([^"]+?)"[^>]*?>[\s\S]*?<a href="([^"]+?)"[\s\S]*?background-image:url\(([^)]+)\)/g;
        let match;

        while ((match = regex.exec(html)) !== null) {
            const title = match[1];
            const href = `https://helioscans.com${match[2]}`;
            const rawImage = match[3].replace(/&amp;/g, "&");
            const image = rawImage.startsWith("http") ? rawImage : `https:${rawImage}`;

            results.push({ title, href, image });
        }

        console.log(JSON.stringify(results));
        return JSON.stringify(results);
    } catch (error) {
        console.error("Error fetching or parsing: " + error);
        return JSON.stringify([{
            title: "Error",
            href: "",
            image: ""
        }]);
    }
}
extractChapters('https://helioscans.com/series/63a6054296b/');

async function extractDetails(url) {
  try {
    const response = await soraFetch(url);
    const htmlText = await response.text();

    const metaMatch = htmlText.match(/<meta name="description" content="([\s\S]*?)">/i);
    const description = metaMatch
      ? metaMatch[1].replace(/\s+/g, ' ').trim()
      : "No description available";

    const aliases = 'N/A';
    const airdate = 'N/A';

    const transformedResults = [{
      description,
      aliases,
      airdate
    }];

    console.log(JSON.stringify(transformedResults));
    return JSON.stringify(transformedResults);

  } catch (error) {
    console.log('Details error:' + error);
    return JSON.stringify([{
      description: 'Error loading description',
      aliases: 'N/A',
      airdate: 'N/A'
    }]);
  }
}

async function extractChapters(url) {
  try {
    const response = await soraFetch(url);
    const htmlText = await response.text();
    console.log(htmlText);

    const chapters = [];
    const chapterLinkRegex = /<a\s+[^>]*href="([^"]*\/chapter\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch;

    while ((linkMatch = chapterLinkRegex.exec(htmlText)) !== null) {
      const fullLinkHtml = linkMatch[0];
      const href = `https://helioscans.com${linkMatch[1]}`;

      const titleRegex = /<span[^>]*class="[^"]*\btext-sm\b[^"]*\btruncate\b[^"]*"[^>]*>([^<]+)<\/span>/i;
      const titleMatch = titleRegex.exec(fullLinkHtml);
      const rawTitle = titleMatch ? titleMatch[1].trim() : "";

      if (!rawTitle) continue;

      const isLocked = /Coin\.svg/i.test(fullLinkHtml);
      const title = isLocked ? `${rawTitle} (Locked – 100 credits)` : rawTitle;

      chapters.push({ title, href });
    }

    chapters.sort((a, b) => {
      const numA = parseFloat(a.title.match(/Chapter\s+(\d+)/i)?.[1]) || 0;
      const numB = parseFloat(b.title.match(/Chapter\s+(\d+)/i)?.[1]) || 0;
      return numA - numB;
    });

    chapters.forEach((chapter, index) => {
      chapter.number = index + 1;
    });

    console.log(JSON.stringify(chapters));
    return JSON.stringify(chapters);
  } catch (error) {
    console.error('Fetch error in extractChapters:', error);
    return JSON.stringify([{
      href: url,
      title: "Error fetching chapters",
      number: 0
    }]);
  }
}

async function extractText(url) {
    try {
        const response = await soraFetch(url);
        const htmlText = await response.text();
        const contentRegex = /<div[^>]*id="chapter"[^>]*>([\s\S]*?)<\/div>/i;
        const match = contentRegex.exec(htmlText);
        if (!match) { throw new Error("Chapter content div not found"); }
        let innerContent = match[1];
        innerContent = innerContent.replace(/<script[\s\S]*?<\/script>/gi, '');
        innerContent = innerContent.replace(/<div[^>]*class="[^"]*flex[^"]*justify-center[^"]*items-center[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
        innerContent = innerContent.trim();
        if (!innerContent) { throw new Error("Chapter text not found or empty after cleaning"); }
        console.log(innerContent);
        return innerContent;
    } catch (error) {
        console.log("Fetch error in extractText: " + error);
        return '<p>Error extracting text</p>';
    }
}

async function soraFetch(url, options = {
    headers: {},
    method: 'GET',
    body: null
}) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (error) {
            return null;
        }
    }
}

function decodeHtmlEntities(text) {
    const entities = {
        '&#x2014;': '—',
        '&#x2013;': '–',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#x27;': "'",
        '&#x2F;': '/',
        '&#x60;': '`',
        '&#x3D;': '=',
        '&nbsp;': ' '
    };

    return text.replace(/&#x[\dA-Fa-f]+;|&\w+;/g, (match) => {
        return entities[match] || match;
    });
}
