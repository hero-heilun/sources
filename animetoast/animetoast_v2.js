async function searchResults(keyword) {
    const results = [];
    const response = await soraFetch(`https://www.animetoast.cc/?s=${keyword}`);
    const html = await response.text();

    const regex = /<a href="(https:\/\/www\.animetoast\.cc\/[^"]+)"[^>]*title="([^"]+)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<\/a>/g;

    let match;
    while ((match = regex.exec(html)) !== null) {
        let title = match[2].trim();
        // if title contains "Ger Dub" or "Ger Sub" or "Eng Dub" or "Eng Sub", remove it and then place it at the beginning of the title
        if (title.includes("Ger Dub") || title.includes("Ger Sub") || title.includes("Eng Dub") || title.includes("Eng Sub")) {
            let lang = '';
            if (title.includes("Ger Dub")) {
                lang = 'DUB';
            } else if (title.includes("Ger Sub")) {
                lang = 'SUB';
            } else if (title.includes("Eng Dub")) {
                lang = 'EN-DUB';
            } else if (title.includes("Eng Sub")) {
                lang = 'EN-SUB';
            }
            title = `${lang} ${title.replace(/(Ger Dub|Ger Sub|Eng Dub|Eng Sub)/, '').trim()}`;
        }

        results.push({
            title: title,
            image: match[3].trim(),
            href: match[1].trim()
        });
    }
    return JSON.stringify(results);
}

async function extractDetails(url) {
    const results = [];
    const response = await soraFetch(url);
    const html = await response.text();

    let description = '';
    const descriptionRegex = /<p>(?:<img[^>]*>)?(.*?)<\/p>/s;
    const descriptionMatch = html.match(descriptionRegex);

    if (descriptionMatch && descriptionMatch[1]) {
        description = descriptionMatch[1].trim();
    }

    results.push({
        description: description,
        aliases: 'N/A',
        airdate: 'N/A'
    });

    return JSON.stringify(results);
}

async function extractEpisodes(url) {
    const results = [];
    const response = await soraFetch(url);
    const html = await response.text();

    let episodes = [];
    try {
        episodes = await extractEpisodeHosts(html, url);
    } catch (error) {
        sendLog("Error extracting episodes: " + error.message);
        return JSON.stringify([{ error: "Failed to extract episodes" }]);
    }


    sendLog(JSON.stringify(episodes));
    if (episodes.length === 0) {
        sendLog("No episodes found");
        return JSON.stringify([{ error: "No episodes found" }]);
    }
    let count = 0;
    for (const episodeUrl of episodes) {
    count++;
        results.push({
            href: episodeUrl,
            number: count
        });
    }
    sendLog("Extracted " + count + " episodes");
    return JSON.stringify(results);
}

  async function extractEpisodeHosts(html, url) {
        // <li class="active">
        //                     <a data-toggle="tab" href="#multi_link_tab0">Voe</a>
        //                 </li>
    const results = {}
    const tabRegex = /<a[^>]*data-toggle=["']tab["'][^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/g;

    const tabMatches = [...html.matchAll(tabRegex)];
    sendLog("Tab matches: " + JSON.stringify(tabMatches));
    if (tabMatches.length === 0) {
        sendLog("No tab matches found");
        return results; // Return empty array if no tabs found
    }

    if (!tabMatches[0]) {
      sendLog("No tab match found");
      return results; // Return empty array if no tab match found
    }
    
    for (const match of tabMatches) {
      const tabHref = match[1].trim();
      sendLog("Tab Href: " + tabHref);
      const tabId = tabHref.startsWith('#') ? tabHref.substring(1) : tabHref;
      sendLog("Tab ID: " + tabId);
      const provider = match[2].trim().toLowerCase();
      
      // The issue is here - the regex is capturing only the number part after "multi_link_tab"
      // but we need to match the full ID
      const divRegex = /<div id="(multi_link_tab[^"]+)"[^>]*>([\s\S]*?)<\/div>/gs;
      
      const divMatch = [...html.matchAll(divRegex)];
      // sendLog("Div matches: " + JSON.stringify(divMatch));

      // Find the matching div by comparing the full ID
      const matchingDiv = divMatch.filter(div => div[1] === tabId);

      // sendLog("Matching Div: " + JSON.stringify(matchingDiv));

      if (!matchingDiv || matchingDiv.length === 0) {
        sendLog("No div match found for tab ID: " + tabId);
        continue; // Skip if no matching div found
      }


        const epRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?Ep\.\s*(\d+)\s*<\/a>/g;
        const epMatches = [...matchingDiv[0][2].matchAll(epRegex)];
      // sendLog("Episode matches: " + JSON.stringify(epMatches));
      // https://www.animetoast.cc/summer-pockets-ger-sub/?link=0

      // results:
      /*
      {
        "voe": [
        "0", // ?link=0
        "1", // ?link=1
        "2"  // ?link=2
        ],
        "doodstream": [
        "3", // ?link=3
        "4", // ?link=4
        "5"  // ?link=5
        ]
      }
      */
      if (!results[provider]) {
        results[provider] = [];
      }
      results[provider].push(...epMatches.map(match => {
        const url = match[1];
        const linkMatch = url.match(/[?&]link=(\d+)/);
        return linkMatch ? linkMatch[1] : null;
      }).filter(Boolean));
      sendLog(`Extracted ${epMatches.length} episodes for provider ${provider}`);

    }
    
    let newResults = [];
    // build new urls out of results like this:
    /*
    https://www.animetoast.cc/summer-pockets-ger-sub/#voe=0,doodstream=12,playn=24,fmoon=36,mp4upload=48
    https://www.animetoast.cc/summer-pockets-ger-sub/#voe=1,doodstream=13,playn=25,fmoon=37,mp4upload=49
    ...
    */
  //  loop through results and build new urls
    const maxLength = Math.max(...Object.values(results).map(arr => arr.length));
    for (let i = 0; i < maxLength; i++) {
      let newUrl = url.split('#')[0] + '#';
      for (const [provider, links] of Object.entries(results)) {
        if (links[i]) {
          newUrl += `${provider}=${links[i]},`;
        }
      }
      newUrl = newUrl.slice(0, -1); // Remove trailing comma
      newResults.push(newUrl);
    }

    // sendLog("New Results: " + JSON.stringify(newResults));
    return newResults;
}



async function extractStreamUrl(url) {
  try {

    // now we need to extract the providers from the url
    // e.g. https://www.animetoast.cc/sword-art-online-alternative-gun-gale-online-ii-ger-dub/#voe=2,doodstream=14,playn=26,fmoon=38,mp4upload=50
    const baseUrl = url.split('#')[0];
    const providersString = url.split('#')[1];
    if (!providersString) {
      sendLog("No providers found in URL: " + url);
      return JSON.stringify([{ provider: "Error", link: "No providers found in URL" }]);
    }
    sendLog("Base URL: " + baseUrl);
    sendLog("Providers String: " + providersString);
    const providersArray = providersString.split(',');
    sendLog("Providers Array: " + JSON.stringify(providersArray));
    // Create a providers object from the providersArray
    let tempProviders = {};
    providersArray.forEach(provider => {
      const [name, id] = provider.split('=');
      tempProviders[name] = id;
    });

    // rename fmoon to filemoon
    if (tempProviders['fmoon']) {
      tempProviders['filemoon'] = tempProviders['fmoon'];
      delete tempProviders['fmoon'];
    }

    if (tempProviders['doodstream']) {
      delete tempProviders['doodstream']; // Idk why, but it just crashes the app
    }

    // remove any providers that are not in the list of available providers, using eval(`typeof ${provider}Extractor`) !== "function"
    for (const provider in tempProviders) {
      if (eval(`typeof ${provider}Extractor`) !== "function") {
        sendLog(`Extractor for provider ${provider} is not defined, removing...`);
        delete tempProviders[provider];
      }
    }

    

    sendLog("Providers Object: " + JSON.stringify(tempProviders));
    let providers = await extractProviders(tempProviders, baseUrl);
    sendLog("Extracted Providers: " + JSON.stringify(providers));
    if (Object.keys(providers).length === 0) {
      sendLog("No valid providers found, returning error");
      return JSON.stringify([{ provider: "Error", link: "No valid providers found" }]);
    }


    // Logic to populate providers
    // ...
    // Note: The higher up the provider is in the list, the higher the priority
    // Available providers: bigwarp, doodstream, mp4upload, speedfiles, turbovid, vidmoly, vidoza, voe


    // E.g.
    // providers = {
    //   "https://vidmoly.to/embed-preghvoypr2m.html": "vidmoly",
    //   "https://speedfiles.net/40d98cdccf9c": "speedfiles",
    //   "https://speedfiles.net/82346fs": "speedfiles",
    // };

    // Choose one of the following:

    // Multiple extractor (recommended)
    let streams = [];
    try {
      streams = await multiExtractor(providers);
      let returnedStreams = {
        streams: streams,
      }

      sendLog("Multi extractor streams: " + JSON.stringify(returnedStreams));
      return JSON.stringify(returnedStreams);
    } catch (error) {
      sendLog("Multi extractor error:" + error);
      return JSON.stringify([{ provider: "Error2", link: "" }]);
    }

  } catch (error) {
    sendLog("Fetch error:", error);
    return null;
  }
}

async function extractProviders(tempProviders, baseUrl) {
  let providers = {};
  for (const [name, id] of Object.entries(tempProviders)) {
    try {
      const response = await fetch(`${baseUrl}?link=${id}`);
      const data =  response.text ? await response.text() : response;
      // get the iframe src from the data
      const iframeRegex = /<iframe[^>]+src="([^"]+)"[^>]*>/;
      const iframeMatch = data.match(iframeRegex);
      if (iframeMatch && iframeMatch[1]) {
        const iframeSrc = iframeMatch[1];
        // check if the iframeSrc is a valid URL
        if (iframeSrc.startsWith("http") || iframeSrc.startsWith("https")) {
          providers[iframeSrc] = name; // Use the name as the key
          sendLog(`Provider ${name} found: ${iframeSrc}`);
        }
      } else {
        // get the href from:
        /*<div id="player-embed" >
							<a href="https://voe.sx/af0gf1xla2c4" target="_blank">
              */
            //  get the div with id player-embed
      const divRegex = /<div id="player-embed"[^>]*>\s*<a href="([^"]+)"[^>]*>/;
      const divMatch = data.match(divRegex);
      if (divMatch && divMatch[1]) {
        const href = divMatch[1];
        // check if the href is a valid URL
        if (href.startsWith("http") || href.startsWith("https")) {
          providers[href] = name; // Use the name as the key
          sendLog(`Provider ${name} found: ${href}`);
        }
      } else {
               
        sendLog(`No iframe or div found for provider ${name}, skipping...`);

        continue; // Skip if no iframe or div found
      }
      }
    } catch (error) {
      sendLog("Error fetching provider " + name + ": " + error);
    }
  }
  return providers;
}

// node
if (typeof module !== 'undefined' && module.exports) {
  // let eps = extractEpisodes("https://www.animetoast.cc/sword-art-online-alternative-gun-gale-online-ii-ger-dub/");
  // console.log(eps);
  let testStreams = extractStreamUrl("https://www.animetoast.cc/sword-art-online-alternative-gun-gale-online-ii-ger-dub/#voe=2,doodstream=14,playn=26,fmoon=38,mp4upload=50");
  console.log(testStreams);
}

// Debugging function to send logs
async function sendLog(message) {
    // send http://192.168.2.130/sora-module/log.php?action=add&message=message
    console.log(message);
    // return;

    await fetch('http://192.168.2.130/sora-module/log.php?action=add&message=' + encodeURIComponent(message))
    .catch(error => {
        console.error('Error sending log:', error);
    });
}

/* Replace your extractStreamUrl function with the script below */

/**
 * @name global_extractor.js
 * @description Global extractor to be used in Sora Modules
 * @author Cufiy
 * @license MIT
 * @date 2025-06-09 16:52:50
 * @note This file is automatically generated.
 */



function globalExtractor(providers) {
  for (const [url, provider] of Object.entries(providers)) {
    try {
      const streamUrl = extractStreamUrlByProvider(url, provider);
      // check if streamUrl is not null, a string, and starts with http or https
      if (streamUrl && typeof streamUrl === "string" && (streamUrl.startsWith("http"))) {
        return streamUrl;
      }
    } catch (error) {
      // Ignore the error and try the next provider
    }
  }
  return null;
}

async function multiExtractor(providers) {
  /* this scheme should be returned as a JSON object
  {
  "streams": [
    "FileMoon",
    "https://filemoon.example/stream1.m3u8",
    "StreamWish",
    "https://streamwish.example/stream2.m3u8",
    "Okru",
    "https://okru.example/stream3.m3u8",
    "MP4",
    "https://mp4upload.example/stream4.mp4",
    "Default",
    "https://default.example/stream5.m3u8"
  ]
}
  */

  const streams = [];
  const providersCount = {};
  for (const [url, provider] of Object.entries(providers)) {
    try {
      // check if providercount is not bigger than 3
      if (providersCount[provider] && providersCount[provider] >= 3) {
        sendLog(`Skipping ${provider} as it has already 3 streams`);
        continue;
      }
      const streamUrl = await extractStreamUrlByProvider(url, provider);
      // check if streamUrl is not null, a string, and starts with http or https
      // check if provider is already in streams, if it is, add a number to it
      if (
        !streamUrl ||
        typeof streamUrl !== "string" ||
        !streamUrl.startsWith("http")
      ) {
        continue; // skip if streamUrl is not valid
      }
      if (providersCount[provider]) {
        providersCount[provider]++;
        streams.push(
          provider.charAt(0).toUpperCase() +
            provider.slice(1) +
            "-" +
            providersCount[provider],
          streamUrl
        );
      } else {
        providersCount[provider] = 1;
        streams.push(
          provider.charAt(0).toUpperCase() + provider.slice(1),
          streamUrl
        );
      }
    } catch (error) {
      // Ignore the error and try the next provider
    }
  }
  return streams;
}

async function extractStreamUrlByProvider(url, provider) {
  if (eval(`typeof ${provider}Extractor`) !== "function") {
    // skip if the extractor is not defined
    sendLog(`Extractor for provider ${provider} is not defined, skipping...`);
    return null;
  }
  let headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": url,
    "Connection": "keep-alive",
    "x-Requested-With": "XMLHttpRequest"
  };
  if(provider == 'bigwarp') {
    delete headers["User-Agent"];
    headers["x-requested-with"] = "XMLHttpRequest";
  }
  // fetch the url
  // and pass the response to the extractor function
  sendLog("Fetching URL: " + url);
  const response = await soraFetch(url, {
      headers
    });

  sendLog("Response: " + response.status);
  let html = response.text ? await response.text() : response;
  // if title contains redirect, then get the redirect url
  const title = html.match(/<title>(.*?)<\/title>/);
  if (title && title[1].toLowerCase().includes("redirect")) {
    const redirectUrl = html.match(/<meta http-equiv="refresh" content="0;url=(.*?)"/);
    const redirectUrl2 = html.match(/window\.location\.href\s*=\s*["'](.*?)["']/);
    const redirectUrl3 = html.match(/window\.location\.replace\s*\(\s*["'](.*?)["']\s*\)/);
    if (redirectUrl) {
      sendLog("Redirect URL: " + redirectUrl[1]);
      url = redirectUrl[1];
      html = await soraFetch(url, {
        headers
      });
      html = html.text ? await html.text() : html;

    } else if (redirectUrl2) {
      sendLog("Redirect URL 2: " + redirectUrl2[1]);
      url = redirectUrl2[1];
      html = await soraFetch(url, {
        headers
      });
      html = html.text ? await html.text() : html;
    } else if (redirectUrl3) {
      sendLog("Redirect URL 3: " + redirectUrl3[1]);
      url = redirectUrl3[1];
      html = await soraFetch(url, {
        headers
      });
      html = html.text ? await html.text() : html;
    } else {
      sendLog("No redirect URL found");
    }
  }

  // sendLog("HTML: " + html);
  switch (provider) {
    case "bigwarp":
      try {
         return await bigwarpExtractor(html, url);
      } catch (error) {
         sendLog("Error extracting stream URL from bigwarp:", error);
         return null;
      }
    case "doodstream":
      try {
         return await doodstreamExtractor(html, url);
      } catch (error) {
         sendLog("Error extracting stream URL from doodstream:", error);
         return null;
      }
    case "mp4upload":
      try {
         return await mp4uploadExtractor(html, url);
      } catch (error) {
         sendLog("Error extracting stream URL from mp4upload:", error);
         return null;
      }
    case "speedfiles":
      try {
         return await speedfilesExtractor(html, url);
      } catch (error) {
         sendLog("Error extracting stream URL from speedfiles:", error);
         return null;
      }
    case "turbovid":
      try {
         return await turbovidExtractor(html, url);
      } catch (error) {
         sendLog("Error extracting stream URL from turbovid:", error);
         return null;
      }
    case "vidmoly":
      try {
         return await vidmolyExtractor(html, url);
      } catch (error) {
         sendLog("Error extracting stream URL from vidmoly:", error);
         return null;
      }
    case "vidoza":
      try {
         return await vidozaExtractor(html, url);
      } catch (error) {
         sendLog("Error extracting stream URL from vidoza:", error);
         return null;
      }
    case "voe":
      try {
         return await voeExtractor(html, url);
      } catch (error) {
         sendLog("Error extracting stream URL from voe:", error);
         return null;
      }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}





/**
 * Uses Sora's fetchv2 on ipad, fallbacks to regular fetch on Windows
 * @author ShadeOfChaos
 *
 * @param {string} url The URL to make the request to.
 * @param {object} [options] The options to use for the request.
 * @param {object} [options.headers] The headers to send with the request.
 * @param {string} [options.method='GET'] The method to use for the request.
 * @param {string} [options.body=null] The body of the request.
 *
 * @returns {Promise<Response|null>} The response from the server, or null if the
 * request failed.
 */
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    try {
        return await fetchv2(url, options.headers ?? {}, options.method ?? 'GET', options.body ?? null);
    } catch(e) {
        try {
            return await fetch(url, options);
        } catch(error) {
            await sendLog('soraFetch error: ' + error.message);
            return null;
        }
    }
}

////////////////////////////////////////////////
//                 EXTRACTORS                 //
////////////////////////////////////////////////

// DO NOT EDIT BELOW THIS LINE UNLESS YOU KNOW WHAT YOU ARE DOING //


/* --- bigwarp --- */

/**
 * 
 * @name bigWarpExtractor
 * @author Cufiy
 */
async function bigwarpExtractor(videoPage, url = null) {

  // regex get 'sources: [{file:"THIS_IS_THE_URL" ... '
  const scriptRegex = /sources:\s*\[\{file:"([^"]+)"/;
  // const scriptRegex =
  const scriptMatch = scriptRegex.exec(videoPage);
  const bwDecoded = scriptMatch ? scriptMatch[1] : false;
  sendLog("BigWarp HD Decoded:", bwDecoded);
  return bwDecoded;
}


/* --- doodstream --- */

/**
 * @name doodstreamExtractor
 * @author Cufiy
 */
async function doodstreamExtractor(html, url = null) {
    sendLog("DoodStream extractor called");
    sendLog("DoodStream extractor URL: " + url);
        const streamDomain = url.match(/https:\/\/(.*?)\//, url)[0].slice(8, -1);
        const md5Path = html.match(/'\/pass_md5\/(.*?)',/, url)[0].slice(11, -2);
        const token = md5Path.substring(md5Path.lastIndexOf("/") + 1);
        const expiryTimestamp = new Date().valueOf();
        const random = randomStr(10);
        const passResponse = await fetch(`https://${streamDomain}/pass_md5/${md5Path}`, {
            headers: {
                "Referer": url,
            },
        });
        sendLog("DoodStream extractor response: " + passResponse.status);
        const responseData = await passResponse.text();
        const videoUrl = `${responseData}${random}?token=${token}&expiry=${expiryTimestamp}`;
        sendLog("DoodStream extractor video URL: " + videoUrl);
        return videoUrl;
}
function randomStr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}


/* --- mp4upload --- */

/**
 * @name mp4uploadExtractor
 * @author Cufiy
 */
async function mp4uploadExtractor(html, url = null) {
    // src: "https://a4.mp4upload.com:183/d/xkx3b4etz3b4quuo66rbmyqtjjoivahfxp27f35pti45rzapbvj5xwb4wuqtlpewdz4dirfp/video.mp4"  
    const regex = /src:\s*"([^"]+)"/;
  const match = html.match(regex);
  if (match) {
    return match[1];
  } else {
    sendLog("No match found for mp4upload extractor");
    return null;
  }
}


/* --- speedfiles --- */

/**
 * @name speedfilesExtractor
 * @author Cufiy
 */
function speedfilesExtractor(sourcePageHtml) {
  // get var _0x5opu234 = "THIS_IS_AN_ENCODED_STRING"
  const REGEX = /var\s+_0x5opu234\s*=\s*"([^"]+)"/;
  const match = sourcePageHtml.match(REGEX);
  if (match == null || match[1] == null) {
    sendLog("Could not extract from Speedfiles source");
    return null;
  }
  const encodedString = match[1];
  sendLog("Encoded String:" + encodedString);
  // Step 1: Base64 decode the initial string
  let step1 = atob(encodedString);
  // Step 2: Swap character cases and reverse
  let step2 = step1
    .split("")
    .map((c) =>
      /[a-zA-Z]/.test(c)
        ? c === c.toLowerCase()
          ? c.toUpperCase()
          : c.toLowerCase()
        : c
    )
    .join("");
  let step3 = step2.split("").reverse().join("");
  // Step 3: Base64 decode again and reverse
  let step4 = atob(step3);
  let step5 = step4.split("").reverse().join("");
  // Step 4: Hex decode pairs
  let step6 = "";
  for (let i = 0; i < step5.length; i += 2) {
    step6 += String.fromCharCode(parseInt(step5.substr(i, 2), 16));
  }
  // Step 5: Subtract 3 from character codes
  let step7 = step6
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) - 3))
    .join("");
  // Step 6: Final case swap, reverse, and Base64 decode
  let step8 = step7
    .split("")
    .map((c) =>
      /[a-zA-Z]/.test(c)
        ? c === c.toLowerCase()
          ? c.toUpperCase()
          : c.toLowerCase()
        : c
    )
    .join("");
  let step9 = step8.split("").reverse().join("");
  // return atob(step9);
  let decodedUrl = atob(step9);
  return decodedUrl;
}


/* --- turbovid --- */

/**
 * @name turbovidExtractor
 * @author Cufiy
 */
async function turbovidExtractor(html, url = null) {
  const embedUrl = url;
  // 1. Extract critical variables from embed page
  const { mediaType, apKey, xxId } = await extractEmbedVariables(html);
  sendLog(
    "mediaType:" + mediaType + " | apKey:" + apKey + " | xxId:" + xxId
  );
  // 2. Get decryption keys
  const juiceKeys = await fetchJuiceKeys(embedUrl);
  sendLog("juiceKeys: " + juiceKeys.juice);
  // 3. Get encrypted video payload
  const encryptedPayload = await fetchEncryptedPayload(embedUrl, apKey, xxId);
 
  // 4. Decrypt and return final url
  const streamUrl = xorDecryptHex(encryptedPayload, juiceKeys.juice);
  sendLog("streamUrl: " + streamUrl);
  // 5. Return the final stream URL
  return streamUrl;
}
//   HELPERS
async function extractEmbedVariables(html) {
  return {
    mediaType: getJsVarValue(html, "media_type"),
    // posterPath: getJsVarValue(html, 'posterPath'),
    apKey: getJsVarValue(html, "apkey"),
    dKey: getJsVarValue(html, "dakey"),
    xxId: getJsVarValue(html, "xxid"),
    xyId: getJsVarValue(html, "xyid"),
  };
}
function getJsVarValue(html, varName) {
  const regex = new RegExp(`const ${varName}\\s*=\\s*"([^"]+)`);
  const match = html.match(regex);
  return match ? match[1] : null;
}
async function fetchJuiceKeys(embedUrl) {
  // sendLog("fetchJuiceKeys called with embedUrl:", embedUrl);
  // const headers = `Referer=${embedUrl}|Origin=${embedUrl}`;
  const fetchUrl =
    atob("aHR0cHM6Ly90dXJib3ZpZC5ldS9hcGkvY3Vja2VkLw==") + "juice_key";
  // const vercelUrl = `https://sora-passthrough.vercel.app/passthrough?url=${fetchUrl}&headers=${headers} }`;
  // const response = await fetch(vercelUrl);
  const response = await fetch(fetchUrl, {
    headers: {
      method: "GET",
      referer: embedUrl,
    },
  });
  sendLog("fetchJuiceKeys response:", response.status);
  // save entire response to file  
  return await response.json() || await JSON.parse(response);
}
async function fetchEncryptedPayload(embedUrl, apKey, xxId) {
  const url =
    atob("aHR0cHM6Ly90dXJib3ZpZC5ldS9hcGkvY3Vja2VkLw==") +
    "the_juice_v2/?" +
    apKey +
    "=" +
    xxId;
  sendLog("url:", url);
  // const headers = `Referer=${embedUrl}|Origin=${embedUrl}`;
  // const vercelUrl = `https://sora-passthrough.vercel.app/passthrough?url=${url}&headers=${headers} }`;
  // const response = await fetch(vercelUrl);
  const response = await fetch(url, {
    headers: {
      method: "GET",
      referer: embedUrl,
    },
  });
  sendLog("fetchEncryptedPayload response:", response.status);
  const data = await response.json() || await JSON.parse(response);
  return data.data;
}
function xorDecryptHex(hexData, key) {
  if (!hexData) {
    throw new Error("hexData is undefined or null");
  }
  const buffer = new Uint8Array(
    hexData
      .toString()
      .match(/../g)
      .map((h) => parseInt(h, 16))
  );
  let decrypted = "";
  for (let i = 0; i < buffer.length; i++) {
    const keyByte = key.charCodeAt(i % key.length);
    decrypted += String.fromCharCode(buffer[i] ^ keyByte);
  }
  return decrypted;
}


/* --- vidmoly --- */

/**
 * @name vidmolyExtractor
 * @author Ibro
 */
async function vidmolyExtractor(html, url = null) {
  const regexSub = /<option value="([^"]+)"[^>]*>\s*SUB - Omega\s*<\/option>/;
  const regexFallback = /<option value="([^"]+)"[^>]*>\s*Omega\s*<\/option>/;
  const fallback =
    /<option value="([^"]+)"[^>]*>\s*SUB v2 - Omega\s*<\/option>/;
  let match =
    html.match(regexSub) || html.match(regexFallback) || html.match(fallback);
  if (match) {
    const decodedHtml = atob(match[1]); // Decode base64
    const iframeMatch = decodedHtml.match(/<iframe\s+src="([^"]+)"/);
    if (!iframeMatch) {
      sendLog("Vidmoly extractor: No iframe match found");
      return null;
    }
    const streamUrl = iframeMatch[1].startsWith("//")
      ? "https:" + iframeMatch[1]
      : iframeMatch[1];
    const responseTwo = await soraFetch(streamUrl);
    const htmlTwo = await responseTwo.text();
    const m3u8Match = htmlTwo.match(/sources:\s*\[\{file:"([^"]+\.m3u8)"/);
    return m3u8Match ? m3u8Match[1] : null;
  } else {
    sendLog("Vidmoly extractor: No match found, using fallback");
    //  regex the sources: [{file:"this_is_the_link"}]
    const sourcesRegex = /sources:\s*\[\{file:"(https?:\/\/[^"]+)"\}/;
    const sourcesMatch = html.match(sourcesRegex);
    let sourcesString = sourcesMatch
      ? sourcesMatch[1].replace(/'/g, '"')
      : null;
    return sourcesString;
  }
}


/* --- vidoza --- */

/**
 * @name vidozaExtractor
 * @author Cufiy
 */
async function vidozaExtractor(html, url = null) {
  const regex = /<source src="([^"]+)" type='video\/mp4'>/;
  const match = html.match(regex);
  if (match) {
    return match[1];
  } else {
    sendLog("No match found for vidoza extractor");
    return null;
  }
}


/* --- voe --- */

/**
 * @name voeExtractor
 * @author Cufiy
 */
function voeExtractor(html, url = null) {
// Extract the first <script type="application/json">...</script>
    const jsonScriptMatch = html.match(
      /<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!jsonScriptMatch) {
      sendLog("No application/json script tag found");
      return null;
    }

    const obfuscatedJson = jsonScriptMatch[1].trim();
  let data;
  try {
    data = JSON.parse(obfuscatedJson);
  } catch (e) {
    throw new Error("Invalid JSON input.");
  }
  if (!Array.isArray(data) || typeof data[0] !== "string") {
    throw new Error("Input doesn't match expected format.");
  }
  let obfuscatedString = data[0];
  // Step 1: ROT13
  let step1 = voeRot13(obfuscatedString);
  // Step 2: Remove patterns
  let step2 = voeRemovePatterns(step1);
  // Step 3: Base64 decode
  let step3 = voeBase64Decode(step2);
  // Step 4: Subtract 3 from each char code
  let step4 = voeShiftChars(step3, 3);
  // Step 5: Reverse string
  let step5 = step4.split("").reverse().join("");
  // Step 6: Base64 decode again
  let step6 = voeBase64Decode(step5);
  // Step 7: Parse as JSON
  let result;
  try {
    result = JSON.parse(step6);
  } catch (e) {
    throw new Error("Final JSON parse error: " + e.message);
  }
  // sendLog("Decoded JSON:", result);
  // check if direct_access_url is set, not null and starts with http
  if (result && typeof result === "object") {
    const streamUrl =
      result.direct_access_url ||
      result.source
        .map((source) => source.direct_access_url)
        .find((url) => url && url.startsWith("http"));
    if (streamUrl) {
      sendLog("Voe Stream URL: " + streamUrl);
      return streamUrl;
    } else {
      sendLog("No stream URL found in the decoded JSON");
    }
  }
  return result;
}
function voeRot13(str) {
  return str.replace(/[a-zA-Z]/g, function (c) {
    return String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13)
        ? c
        : c - 26
    );
  });
}
function voeRemovePatterns(str) {
  const patterns = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
  let result = str;
  for (const pat of patterns) {
    result = result.split(pat).join("");
  }
  return result;
}
function voeBase64Decode(str) {
  // atob is available in browsers and Node >= 16
  if (typeof atob === "function") {
    return atob(str);
  }
  // Node.js fallback
  return Buffer.from(str, "base64").toString("utf-8");
}
function voeShiftChars(str, shift) {
  return str
    .split("")
    .map((c) => String.fromCharCode(c.charCodeAt(0) - shift))
    .join("");
}

