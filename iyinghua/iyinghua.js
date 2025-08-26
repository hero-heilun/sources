async function searchResults(keyword) {
    const results = [];
    const response = await fetchv2(`http://www.iyinghua.com/search/${keyword}/`);
    const html = await response.text();

    const regex = /<a href="(\/show\/\d+\.html)"><img src="(http[^"]+)" alt="([^"]+)"><\/a><h2><a href="[^"]+" title="([^"]+)"/g;
    
    let match;
    while ((match = regex.exec(html)) !== null) {
        results.push({
            title: match[4].trim(),
            image: match[2].trim(),
            href: `http://www.iyinghua.com${match[1].trim()}`
        });
    }

    return JSON.stringify(results);
}

async function extractDetails(url) {
    const results = [];
    const response = await fetchv2(url);
    const html = await response.text();

    const descriptionRegex = /<div class="info">([^<]+)<\/div>/;
    const descriptionMatch = descriptionRegex.exec(html);
    const description = descriptionMatch ? descriptionMatch[1].trim() : 'N/A';

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

    const episodeRegex = /<li><a href="(\/v\/\d+-([\dpv]+)\.html)" target="_blank">([^<]+)<\/a><\/li>/g;

    let match;
    let episodeCount = 0;

    while ((match = episodeRegex.exec(html)) !== null) {
        const href = `http://www.iyinghua.com${match[1].trim()}`;
        const number = match[2].match(/^\d+$/) ? parseInt(match[2], 10) : null;

        if (number !== null) {
            results.push({ href, number });
        } else {
            episodeCount++; 
        }
    }

    if (results.length === 0 && episodeCount > 0) {
        episodeRegex.lastIndex = 0; 
        let index = 1;
        while ((match = episodeRegex.exec(html)) !== null) {
            results.push({
                href: `http://www.iyinghua.com${match[1].trim()}`,
                number: index++
            });
        }
    }
    results.reverse();
    return JSON.stringify(results);
}

async function extractStreamUrl(url) {
    const response = await fetchv2(url);
    const html = await response.text();
    
    // 首先尝试查找 changeplay 函数中的URL (这是实际使用的方法)
    const changeplayRegex = /changeplay\(['"]([^'"]+)['"]\)/;
    const changeplayMatch = changeplayRegex.exec(html);
    
    if (changeplayMatch && changeplayMatch[1]) {
        let streamUrl = changeplayMatch[1];
        
        // 处理特殊格式的URL (例如: https://example.com/video.m3u8$mp4)
        // 移除 $mp4 或其他类似的后缀
        if (streamUrl.includes('$')) {
            streamUrl = streamUrl.split('$')[0];
        }
        
        console.log('Found stream URL from changeplay:', streamUrl);
        
        // 返回符合Sora期望格式的JSON对象，包含必要的Headers
        return JSON.stringify({
            streams: [{
                url: streamUrl,
                headers: {
                    "Referer": "http://www.iyinghua.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            }],
            subtitles: []
        });
    }
    
    // 备用方法：查找 data-vid 属性
    const dataVidRegex = /data-vid="([^"]+)"/;
    const dataVidMatch = dataVidRegex.exec(html);
    
    if (dataVidMatch && dataVidMatch[1]) {
        let streamUrl = dataVidMatch[1];
        
        if (streamUrl.includes('$')) {
            streamUrl = streamUrl.split('$')[0];
        }
        
        console.log('Found stream URL from data-vid:', streamUrl);
        
        return JSON.stringify({
            streams: [{
                url: streamUrl,
                headers: {
                    "Referer": "http://www.iyinghua.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
            }],
            subtitles: []
        });
    }
    
    console.error('No stream URL found in page:', url);
    return null;
}

