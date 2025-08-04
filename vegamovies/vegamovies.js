async function searchResults(keyword) {
    const results = [];
    try {
        const postData = {
            "do": "search",
            "subaction": "search",
            "story": keyword
        };

        const headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        };

        const response = await fetchv2("https://vegamovies.bh/", headers, "POST", postData);
        const html = await response.text();

        
        const regex = /<a[^>]+href="([^"]+)"[^>]*title="([^"]+)"[^>]*class="blog-img[^"]*"[^>]*>\s*<img[^>]+src="([^"]+)"[^>]*>/g;
        
        let match;
        while ((match = regex.exec(html)) !== null) {
            results.push({
                title: match[2].trim(),
                image: match[3].trim().startsWith("http") ? match[3].trim() : "https://vegamovies.bh" + match[3].trim(),
                href: match[1].trim()
            });
        }

        return JSON.stringify(results);
    } catch (err) {
        console.error("Search error:"+ err);
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

        const match = html.match(/<div class="entry-content\s*">([\s\S]*?)<h3/i);
        const rawDescription = match ? match[1] : "";
        const cleaned = rawDescription
            .replace(/<br\s*\/?>/gi, "\n")
            .replace(/<[^>]+>/g, "")
            .trim();

        return JSON.stringify([{
            description: cleaned || "N/A",
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
    return JSON.stringify([{ href: url, number: 1 }]);
}

async function extractStreamUrl(url) {
    try {
        const response = await fetchv2(url);
        const html = await response.text();

        const regex = /<h3[^>]*><span[^>]*>(1080p|720p|480p)<\/span><\/h3>\s*<h3[^>]*>\s*<div>\s*<a[^>]+href="([^"]+)"/g;

        let match;
        const qualityLinks = {};

        while ((match = regex.exec(html)) !== null) {
            qualityLinks[match[1]] = match[2];
        }

        const streams = [];

        for (const [quality, link] of Object.entries(qualityLinks)) {
            try {
                console.log(link);
                const res = await fetchv2("https://passthrough-worker.simplepostrequest.workers.dev/?url=" + link);
                const page = await res.text();
                
                const vdMatch = page.match(/<a id="vd" href="([^"]+)"/);
                if (vdMatch && vdMatch[1]) {
                    streams.push(quality, vdMatch[1]);
                }
            } catch (e) {
                console.log(`Failed to fetch stream for ${quality}:`+ e);
            }
        }

        const final = {
            streams,
            subtitles: ""
        };

        console.log("RETURN: " + JSON.stringify(final));
        return JSON.stringify("final");

    } catch (err) {
        console.log("Error in extractStreamUrl:"+ err);
        return "Error";
    }
}
