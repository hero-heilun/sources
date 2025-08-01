async function searchResults(keyword) {
    const results = [];
    const response = await fetchv2("https://www.poseidonhd2.co/search?q=" + encodeURIComponent(keyword));
    const html = await response.text();

    const baseUrl = "https://www.poseidonhd2.co";

    const regex = /<a\s+href="([^"]+)">[^<]*(?:(?!<\/a>)[\s\S])*?<img[^>]+src="([^"]+)"[^>]*>[^<]*(?:(?!<\/a>)[\s\S])*?<[^>]+class="[^"]*Title[^"]*"[^>]*>([^<]+)<\/[^>]+>/gs;

    let match;
    while ((match = regex.exec(html)) !== null) {
        results.push({
            title: match[3].trim(),
            image: baseUrl + decodeURIComponent(match[2].replace(/&amp;/g, "&").trim()),
            href: baseUrl + match[1].trim()
        });
    }

    return JSON.stringify(results);
}
async function extractDetails(url) {
    const results = [];
    const response = await fetchv2(url);
    const html = await response.text();

    const regex = /<div class="Description">\s*<p>(.*?)<\/p>/s;
    const match = regex.exec(html);

    const description = match ? match[1].trim() : "N/A";

    results.push({
        description: description,
        aliases: 'N/A',
        airdate: 'N/A'
    });

    return JSON.stringify(results);
}

async function extractEpisodes(url) {
    const results = [];
    const response = await fetchv2(url);
    const html = await response.text();
    console.log(url);

    const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
    if (jsonMatch) {
        try {
            const data = JSON.parse(jsonMatch[1]);
            const seasons = data.props?.pageProps?.thisSerie?.seasons || [];

            for (const season of seasons) {
                for (const episode of season.episodes || []) {
                    results.push({
                        href: "https://www.poseidonhd2.co/" + episode.url.slug,
                        number: episode.number
                    });
                }
            }

            if (results.length > 0) return JSON.stringify(results);
        } catch (e) {
            console.warn("Failed to parse __NEXT_DATA__ episodes", e);
        }
    }

    try {
        const data = JSON.parse(jsonMatch[1]);
        const videos = data.props?.pageProps?.thisMovie?.videos || {};

        const getStreamwishLink = (videosArray) => {
            const entry = videosArray.find(v => v.cyberlocker === 'streamwish');
            return entry ? entry.result : null;
        };

        const latino = getStreamwishLink(videos.latino || []);
        const spanish = getStreamwishLink(videos.spanish || []);
        const subt = getStreamwishLink(videos.english || []);

        const parts = [];
        if (latino) parts.push(`Español latino:streamwish:${latino}`);
        if (spanish) parts.push(`Español:streamwish:${spanish}`);
        if (subt) parts.push(`Subtitulado:streamwish:${subt}`);

        if (parts.length > 0) {
            results.push({
                href: parts.join(' | '),
                number: 1
            });
            return JSON.stringify(results);
        }
    } catch (e) {
        console.warn("Failed to parse videos from __NEXT_DATA__", e);
    }

    const tableRowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>[\s\S]*?(?:#?\d+[\s\S]*?)?(?:<!--[^]*?-->)?\s*([^<]+)[^<]*<\/td>[\s\S]*?<td[^>]*>([^<]+)[^<]*<\/td>[\s\S]*?<td[^>]*><span>([^<]+)<\/span><\/td>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*class="Button STPb">Descargar<\/a>[\s\S]*?<\/tr>/gi;

    const linksMap = {
        "Español latino": null,
        "Español": null,
        "Subtitulado": null
    };

    let match;
    while ((match = tableRowRegex.exec(html)) !== null) {
        const [, providerRaw, languageRaw, , link] = match;
        const provider = providerRaw.trim().toLowerCase();
        const language = languageRaw.trim();

        if (!provider.includes("streamwish")) continue;

        if (language === 'Latino') linksMap["Español latino"] = link;
        else if (language === 'Español') linksMap["Español"] = link;
        else if (language === 'Subtitulado') linksMap["Subtitulado"] = link;
    }

    const parts = [];
    for (const [lang, link] of Object.entries(linksMap)) {
        if (link) parts.push(`${lang}:streamwish:${link}`);
    }

    if (parts.length > 0) {
        results.push({
            href: parts.join(' | '),
            number: 1
        });
    }

    return JSON.stringify(results);
}

async function extractStreamUrl(input) {
    const isEpisodeUrl = input.includes('/serie/') && input.includes('/episodio/');
    let urlData = input;

    if (isEpisodeUrl) {
        try {
            const res = await fetchv2(input);
            const html = await res.text();

            const jsonMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[1]);
                const videos = data.props?.pageProps?.thisEpisode?.videos || {};

                const getStreamwishLink = (videosArray) => {
                    const entry = videosArray.find(v => v.cyberlocker === 'streamwish');
                    return entry ? entry.result : null;
                };

                const latino = getStreamwishLink(videos.latino || []);
                const spanish = getStreamwishLink(videos.spanish || []);
                const subt = getStreamwishLink(videos.english || []);

                const parts = [];
                if (latino) parts.push(`Español latino:streamwish:${latino}`);
                if (spanish) parts.push(`Español:streamwish:${spanish}`);
                if (subt) parts.push(`Subtitulado:streamwish:${subt}`);

                urlData = parts.join(' | ');
            }
        } catch (e) {
            console.warn("Failed to fetch episode stream URLs"+ e);
            return "google.com";
        }
    }

    const languageBlocks = urlData.split('|');
    const streamwishLinks = {};

    for (const block of languageBlocks) {
        const match = block.match(/^([^:]+):streamwish:(.+)$/);
        if (!match) continue;
        const lang = match[1].trim();
        const link = match[2].trim();
        if (link && link !== 'null') {
            if (lang === 'Español latino') streamwishLinks.latino = link;
            else if (lang === 'Español') streamwishLinks.espanol = link;
            else if (lang === 'Subtitulado') streamwishLinks.subtitulado = link;
        }
    }

    async function getVarUrl(link) {
        try {
            const res = await fetchv2(link);
            const html = await res.text();
            const match = html.match(/var\s+url\s*=\s*['"]([^'"]+)['"]/);
            return match ? match[1] : null;
        } catch (err) {
            return null;
        }
    }

    async function getFinalStream(link) {
        try {
            const res = await fetchv2(link);
            const html = await res.text();

            const scriptMatch = html.match(/<script[^>]*>eval\(function\(p,a,c,k,e,d\).*?<\/script>/s);
            if (!scriptMatch) return null;

            const obfuscated = scriptMatch[0].match(/eval\(function\(p,a,c,k,e,d\)(.*?)\)\)/s);
            if (!obfuscated) return null;

            const unpacked = unpack(`eval(function(p,a,c,k,e,d)${obfuscated[1]}))`);
            const hls2Match = unpacked.match(/"hls2"\s*:\s*"([^"]+)"/);
            return hls2Match ? hls2Match[1] : null;
        } catch (err) {
            return null;
        }
    }

    const streams = [];

    for (const [langKey, embedUrl] of Object.entries(streamwishLinks)) {
        const varUrl = await getVarUrl(embedUrl);
        if (!varUrl) continue;

        const hls2 = await getFinalStream(varUrl);
        if (hls2) {
            const label =
                langKey === 'latino' ? 'LATINO' :
                langKey === 'espanol' ? 'CASTELLANO' :
                langKey === 'subtitulado' ? 'SUB' :
                langKey.toUpperCase();
            streams.push(label, hls2);
        }
    }

    const final = {
        streams,
        subtitles: ""
    };

    return JSON.stringify(final);
}
