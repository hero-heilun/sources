async function* searchResults(keyword) {
  try {
    const encodedKeyword = encodeURIComponent(keyword);
    const responseText = await soraFetch(`https://www.novelcool.com/search/?wd=${encodedKeyword}`);
    const data = await responseText.text();
    const results = [];
    
    const regex = /<div class="book-item"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
    let match;
    
    while ((match = regex.exec(data)) !== null) {
      const bookItemHTML = match[1];
      
      if (bookItemHTML.includes('book-type-manga')) {
        continue;
      }
      
      const infoRegex = /<div class="book-info">[\s\S]*?<a href="([^"]+)"[^>]*>[\s\S]*?<div class="book-name[^>]*"[^>]*>(.*?)<\/div>/;
      const infoMatch = infoRegex.exec(bookItemHTML);
      
      if (infoMatch) {
        results.push({
          title: infoMatch[2].trim(),
          href: infoMatch[1].trim()
        });
      }
    }
    
    console.log(JSON.stringify(results));
    return JSON.stringify(results);
  } catch (error) {
    console.log('Fetch error in searchResults:', error);
    return JSON.stringify([{ title: 'Error', href: '' }]);
  }
}


async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        const htmlText = await response.text();

        const descriptionMatch = htmlText.match(/<div class="bk-summary-txt"[^>]*>([\s\S]*?)<\/div>/);
        const description = descriptionMatch ? descriptionMatch[1].trim() : 'No description available';

        const transformedResults = [{
            description,
            aliases: 'N/A',
            airdate: 'N/A'
        }];

        console.log(JSON.stringify(transformedResults));
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Details error:', error);
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

        const chapters = [];
        const regex = /<div class="chp-item">[\s\S]*?<a href="([^"]+)"[^>]*title="([^"]+)">[\s\S]*?<\/a>[\s\S]*?<\/div>/g;

        let match;
        let count = 1;
        while ((match = regex.exec(htmlText)) !== null) {
            chapters.push({
                href: match[1].trim(),
                title: match[2].trim(),
                number: count++
            });
        }

        if (chapters.length === 0) {
            chapters.push({
                href: url,
                title: "Currently no chapters available",
                number: 1
            });
        }

        console.log(JSON.stringify(chapters.reverse()));
        return chapters.reverse();
    } catch (error) {
        console.log('Fetch error in extractChapters:', error);
        return [{
            href: url,
            title: "Currently no chapters available",
            number: 1
        }];
    }
}



async function extractText(url) {
    try {
        const response = await soraFetch(url);
        const htmlText = await response.text();

        const match = htmlText.match(
            /<h2 class="chapter-title[^>]*>[\s\S]*?<\/h2>([\s\S]*?)<div class="bookinfo-share">/i
        );

        if (!match) {
            throw new Error("Chapter content not found");
        }

        let content = match[1].trim();

        content = content.replace(/<script[\s\S]*?<\/script>/gi, '');

        content = content.trim();

        console.log(JSON.stringify(content));
        return content;
    } catch (error) {
        console.log("Fetch error in extractText:", error);
        return JSON.stringify({ text: 'Error extracting text' });
    }
}

async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            return null;
        }
    }
}
