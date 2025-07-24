async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const url = `https://readnovelfull.com/novel-list/search?keyword=${encodedKeyword}`;
        const response = await soraFetch(url);
        const html = await response.text();

        const results = [];
        const rowRegex = /<div class="row">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
        let rowMatch;

        while ((rowMatch = rowRegex.exec(html)) !== null) {
            const rowHtml = rowMatch[1];

            const imgMatch = rowHtml.match(/<img\s+src="([^"]+)"[^>]*class="cover"/);
            const linkMatch = rowHtml.match(/<h3 class="novel-title">\s*<a href="([^"]+)"\s+title="([^"]+)"/);

            if (imgMatch && linkMatch) {
                let image = imgMatch[1];
                if (!image.startsWith("http")) image = "https:" + image;

                results.push({
                    title: decodeHtmlEntities(linkMatch[2]),
                    href: "https://readnovelfull.com" +linkMatch[1],
                    image
                });
            }
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

extractChapters('https://readnovelfull.com/genius-club.html');

async function extractDetails(url) {
  try {
    const response = await soraFetch(url);
    const htmlText = await response.text();

    const descMatch = htmlText.match(/<div class="desc-text"[^>]*itemprop="description"[^>]*>([\s\S]*?)<\/div>/i);

    let description = descMatch
      ? descMatch[1]
          .replace(/<p[^>]*>/gi, '')
          .replace(/<\/p>/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
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

    const novelIdMatch = htmlText.match(/<div id="rating"[^>]*data-novel-id="([^"]+)"[^>]*>/i);
    if (!novelIdMatch) {
      throw new Error("Novel ID not found");
    }
    const novelId = novelIdMatch[1];

    const chaptersResponse = await soraFetch(`https://readnovelfull.com/ajax/chapter-archive?novelId=${novelId}`);
    const chaptersHtml = await chaptersResponse.text();

    const chapters = [];
    const chapterRegex = /<a\s+href="([^"]+)"\s+title="([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*\bnchr-text\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;

    let match;
    while ((match = chapterRegex.exec(chaptersHtml)) !== null) {
      const href = "https://readnovelfull.com" + match[1];
      const titleFromAttr = match[2].trim();
      const titleFromSpan = match[3].replace(/\s+/g, ' ').trim();

      const title = titleFromAttr || titleFromSpan;

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
