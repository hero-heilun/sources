async function searchResults(keyword) {
    const results = [];
    try {
        const response = await fetchv2("https://animesorionvip.net/search/" + keyword);
        const html = await response.text();

        const regex = /<a href="([^"]+)"[^>]*>\s*<div class="thumbCa">\s*<img src="([^"]+)"[^>]*>\s*<\/div><div class="title">\s*<h2>([^<]+)<\/h2>/g;

        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                title: match[3].trim(),
                image: match[2].trim(),
                href: match[1].trim()
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

        const regex = /<div class="sinopsePost">[\s\S]*?<h2>.*?<\/h2>([\s\S]*?)<\/div>/;
        const match = regex.exec(html);
        const description = match ? match[1].replace(/<[^>]+>/g, '').trim() : "N/A";

        return JSON.stringify([{
            description: description,
            aliases: "N/A",
            airdate: "N/A"
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
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const liMatch = html.match(/<ul class="listaEP">([\s\S]*?)<\/ul>/);
        if (!liMatch) return [];

        const regex = /<a href="([^"]+)"[^>]*>[\s\S]*?<div class="tituloPost">[\s\S]*?<span>[^<]+<\/span>\s*<span>Episódio (\d+)<\/span>/g;
        let match;
        while ((match = regex.exec(liMatch[1])) !== null) {
            results.push({
                href: match[1].trim(),
                number: parseInt(match[2], 10)
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
        const response1 = await fetchv2(url);
        const html1 = await response1.text();

        const videoMatch = html1.match(/<div[^>]+id=["']player-1["'][^>]+data-video=["']([^"']+)["']/);
        if (!videoMatch) return null;

        const videoUrl = videoMatch[1];

        const response2 = await fetchv2(videoUrl);
        const html2 = await response2.text();

        const jwMatch = html2.match(/var jw\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
        if (!jwMatch) return null;

        const jwData = JSON.parse(jwMatch[1].replace(/\\\//g, '/'));
        return jwData.file; 
    } catch (err) {
        return null;
    }
}


