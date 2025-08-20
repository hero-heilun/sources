async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://bakashi.to/?s=" + encodeURIComponent(keyword));
        const html = await response.text();

        const regex = /<div class="result-item">[\s\S]*?<a href="([^"]+)"[^>]*>\s*<img src="([^"]+)"[^>]*alt="([^"]+)"/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                href: match[1].trim(),
                image: match[2].trim(),
                title: cleanHtmlSymbols(match[3].trim())
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            title: "Error",
            image: "Error",
            href: "Error"
        }]);
    }
}

async function extractDetails(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const regex = /<h2>\s*Sinopse\s*<\/h2>\s*<div class="wp-content">\s*<p>([\s\S]*?)<\/p>/i;
        const match = regex.exec(html);
        const description = match ? match[1].trim() : "fuck off you don't need a description";

        const aliasRegex = /<b class="variante">\s*T[ií]tulo Original\s*<\/b>\s*<span class="valor">\s*([^<]+)<\/span>/i;
        const aliasMatch = aliasRegex.exec(html);
        const aliases = aliasMatch ? aliasMatch[1].trim() : "N/A";

        const airdateRegex = /<b class="variante">\s*Primeira data de exibição\s*<\/b>\s*<span class="valor">\s*([^<]+)<\/span>/i;
        const airdateMatch = airdateRegex.exec(html);
        const airdate = airdateMatch ? airdateMatch[1].trim() : "N/A";

        return JSON.stringify([{
            description: description,
            aliases: aliases,
            airdate: airdate
        }]);
    } catch (err) {
        return JSON.stringify([{
            description: "Error",
            aliases: "Error",
            airdate: "Error"
        }]);
    }
}


async function extractEpisodes(url) {
    const results = [];

    const regex = /<div class=['"]?numerando['"]?[^>]*>\d+\s*-\s*(\d+)<\/div>[\s\S]*?<a\s+href=['"]([^'"]+)['"][^>]*>/g;

    try {
        const response = await fetchv2(url);
        const html = await response.text();

        let match;
        while ((match = regex.exec(html)) !== null) {
            const episodeNumber = parseInt(match[1], 10);
            const href = match[2].trim();

            results.push({
                href: "episode: " + href,
                number: episodeNumber
            });
        }

        if (results.length === 0) {
            results.push({
                href: "movie: " + url,
                number: 1
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        return JSON.stringify([{
            href: "Error",
            number: "Error"
        }]);
    }
}

async function extractStreamUrl(url) {
    try {
        let endpointType;

        if (url.startsWith("movie: ")) {
            url = url.replace("movie: ", "");
            endpointType = "movie";
        } else if (url.startsWith("episode: ")) {
            url = url.replace("episode: ", "");
            endpointType = "tv";
        } else {
            return "ERROR";
        }

        const simpleFetchUrl = `https://passthrough-worker.simplepostrequest.workers.dev/?simple=${encodeURIComponent(url)}`;
        const response = await fetchv2(simpleFetchUrl);
        const html = await response.text();

        const idMatch = html.match(/<link rel=['"]shortlink['"] href=['"][^?]+\?p=(\d+)['"]/);
        if (!idMatch) return "ID NOT FOUND";
        const id = idMatch[1];

        const postData = {
            action: "doo_player_ajax",
            post: id,
            nume: "1",
            type: endpointType
        };

        const passthroughUrl = `https://passthrough-worker.simplepostrequest.workers.dev/?url=${encodeURIComponent("https://bakashi.to/wp-admin/admin-ajax.php")}&body=${encodeURIComponent(JSON.stringify(postData))}&type=multipart`;

        const responseTwo = await fetchv2(passthroughUrl);
        const json = await responseTwo.json();

        console.log(JSON.stringify(json));

        const responseThree = await fetchv2(json.embed_url);
        const htmlTwo = await responseThree.text();

        const match = htmlTwo.match(/"play_url":"([^"]+)"/);
        const firstPlayUrl = match ? match[1] : null;

        console.log(firstPlayUrl);

        return firstPlayUrl; 
    } catch (err) {
        console.error("Error extracting stream URL:" + err);
        return {
            error: err.message
        };
    }
}


function cleanHtmlSymbols(string) {
    if (!string) return "";
    return string
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, "-")
        .replace(/&#[0-9]+;/g, "")
        .replace(/\r?\n|\r/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
