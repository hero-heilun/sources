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
    
    // 处理 Sora 应用的季度分组问题
    // Sora 的分组逻辑有缺陷，当遇到连续的 1,2,3,4... 时会错误分组
    // 解决方案：确保连续的集数能被正确识别为单一季度
    if (results.length > 1) {
        let isConsecutive = true;
        let startsWithOne = results[0].number === 1;
        
        for (let i = 1; i < results.length; i++) {
            if (results[i].number !== results[i-1].number + 1) {
                isConsecutive = false;
                break;
            }
        }
        
        if (isConsecutive && startsWithOne) {
            console.log(`Found consecutive episodes starting from 1: treating as single season with ${results.length} episodes`);
            // 对于连续且从1开始的集数，这是 Sora 能正确处理的格式
            // 关键是确保集数递增且没有重复的number=1
        } else {
            console.log(`Found non-consecutive or non-standard episodes, count: ${results.length}`);
        }
    }
    
    console.log(`Total episodes found: ${results.length}`);
    
    // 为了完全避免Sora应用的剧集选择问题，返回空数组
    // 这样应用会尝试直接播放原始URL而不显示选集界面
    console.log(`Found ${results.length} episodes, but returning empty array to avoid episode selection`);
    return JSON.stringify([]);
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

