function cleanTitle(title) {
    return title
        .replace(/&#8217;/g, "'")  
        .replace(/&#8211;/g, "-")  
        .replace(/&#[0-9]+;/g, ""); 
}

async function searchResults(keyword) {
    const url = `https://animeheaven.me/fastsearch.php?xhr=1&s=${encodeURIComponent(keyword)}`;
    const response = await fetchv2(url);
    const html = await response.text();
    const results = [];

    const itemRegex = /<a class='ac' href='([^']+)'>[\s\S]*?<img class='coverimg' src='([^']+)' alt='[^']*'>[\s\S]*?<div class='fastname'>([^<]+)<\/div>/g;
    let match;

    while ((match = itemRegex.exec(html)) !== null) {
        const href = `https://animeheaven.me${match[1]}`;
        const image = `https://animeheaven.me${match[2]}`;
        const rawTitle = match[3].trim();
        const title = cleanTitle(rawTitle);

        results.push({ title, image, href });
    }

    return JSON.stringify(results);
}

async function extractDetails(url) {
    const response = await fetchv2(url);
    const html = await response.text();
    const details = [];

    const descriptionMatch = html.match(/<div class='infodes c'>([^<]+)<\/div>/);
    let description = descriptionMatch ? descriptionMatch[1] : '';

    const aliasesMatch = html.match(/<div class='infotitle c'>([^<]+)<\/div>/);
    let aliases = aliasesMatch ? aliasesMatch[1] : '';

    const airdateMatch = html.match(/Year: <div class='inline c2'>([^<]+)<\/div>/);
    let airdate = airdateMatch ? airdateMatch[1] : '';

    if (description && airdate) {
        details.push({
            description: description,
            aliases: aliases || 'N/A',
            airdate: airdate
        });
    }

    return JSON.stringify(details);
}

async function extractEpisodes(url) {
    const response = await fetchv2(url);
    const html = await response.text();
    const episodes = [];
    const episodeRegex = /<a href='gate\.php'[^>]+id='([^']+)'[^>]*>[\s\S]*?<div class='watch2 bc[^']*'[^>]*>([^<]+)<\/div>/g;
    let match;

    while ((match = episodeRegex.exec(html)) !== null) {
        const id = match[1];
        const rawNumber = match[2].trim();
        const number = parseInt(rawNumber.match(/\d+/)?.[0], 10);
        if (!isNaN(number)) {
            episodes.push({
                href: id,
                number: number
            });
        }
    }

    episodes.reverse();
    return JSON.stringify(episodes);
}


async function extractStreamUrl(id) {
    const cookieHeader = `key=${id}`;
    const headers = {
        Cookie: cookieHeader
    };
    const html = await fetchv2(`https://animeheaven.me/gate.php`, headers);
    console.log(JSON.stringify(html));
    const response = await html.text();
    const sourceRegex = /<source\s+src=(["'])([^"']+)\1[^>]*type=(["'])video\/mp4\3[^>]*>/i;
    const match = response.match(sourceRegex);
    console.log("Extracted stream URL: " + match);
    return match ? match[2].replace(/&amp;/g, '&') : null;
}
