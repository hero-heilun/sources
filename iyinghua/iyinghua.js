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

    // 使用更精确的正则表达式匹配剧集列表
    // 匹配 <li><a href="/v/xxxx-x.html" target="_blank">第xx集</a></li> 格式
    const episodeRegex = /<li><a href="(\/v\/\d+-([\dpv]+)\.html)"[^>]*>([^<]+)<\/a><\/li>/g;

    let match;
    while ((match = episodeRegex.exec(html)) !== null) {
        const href = `http://www.iyinghua.com${match[1].trim()}`;
        const episodeId = match[2].trim();
        const episodeTitle = match[3].trim();
        
        // 尝试从URL中提取集数
        let number = null;
        if (episodeId.match(/^\d+$/)) {
            number = parseInt(episodeId, 10);
        } else {
            // 如果URL中的ID不是纯数字，尝试从标题中提取集数
            const titleMatch = episodeTitle.match(/第?(\d+)[集话]/);
            if (titleMatch) {
                number = parseInt(titleMatch[1], 10);
            } else if (episodeTitle === "全集" || episodeTitle.includes("全")) {
                // 对于"全集"类型，设为第1集
                number = 1;
            } else {
                // 如果都无法解析，使用当前结果数量+1作为集数
                number = results.length + 1;
            }
        }
        
        results.push({
            href: href,
            number: number,
            title: episodeTitle
        });
        
        console.log(`Found episode: ${episodeTitle} (${number}) -> ${href}`);
    }

    // 如果没有找到任何剧集，可能是页面结构不同，尝试备用方法
    if (results.length === 0) {
        console.log('No episodes found with primary method, trying fallback...');
        
        // 备用方法：直接查找所有 /v/ 链接
        const fallbackRegex = /<a href="(\/v\/\d+-[^"]+)"[^>]*>([^<]+)<\/a>/g;
        let fallbackMatch;
        while ((fallbackMatch = fallbackRegex.exec(html)) !== null) {
            const href = `http://www.iyinghua.com${fallbackMatch[1].trim()}`;
            const title = fallbackMatch[2].trim();
            const number = results.length + 1;
            
            results.push({
                href: href,
                number: number,
                title: title
            });
            
            console.log(`Fallback found: ${title} (${number}) -> ${href}`);
        }
    }

    // 按集数排序（确保顺序正确）
    results.sort((a, b) => a.number - b.number);
    
    console.log(`Total episodes found: ${results.length}`);
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

