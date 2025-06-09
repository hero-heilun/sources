async function searchResults(keyword) {
    try {
        const encodedKeyword = encodeURIComponent(keyword);
        const responseText = await fetchv2(`https://frembed.xyz/api/public/search?query=${encodedKeyword}`);
        //const data = JSON.parse(responseText);
        const data = await responseText.json();
        
        const showsData = data.tvShows.map(show => {
            return {
                title: show.name || show.original_title,
                image: `https://image.tmdb.org/t/p/w500${show.poster_path}`,
                href: `${show.id}`
            }
        });

        //console.log(JSON.stringify(showsData));
        console.log(showsData);

        return JSON.stringify(showsData);
    } catch (error) {
        console.log('Fetch error in searchResults:', error.message);
        return JSON.stringify([{
            title: 'Error',
            image: '',
            href: ''
        }]);
    }
}

async function extractDetails(showId) {
    try {
        const responseText = await fetchv2(`https://frembed.xyz/api/public/tv-show/${showId}`);
        //const data = JSON.parse(responseText);
        const data = await responseText.json();

        const transformedResults = [{
            description: data.overview || 'N/A',
            aliases: data.title || 'N/A',
            airdate: data.year || 'N/A'
        }];

        //console.log(JSON.stringify(transformedResults));
        console.log(transformedResults);

        return transformedResults;
    } catch (error) {
        return null;
    }
}

async function extractEpisodes(showId) {
    try {
        const responseText = await fetchv2(`https://frembed.xyz/api/public/tv-show/${showId}/listep`);
        //const data = JSON.parse(responseText);
        const data = await responseText.json();


        const episodes = data.map(season =>
            season.episodes.map(episode => ({
                number: episode.epi,
                href: `id=${showId}&sa=${season.sa}&epi=${episode.epi}`
            }))
        ).flat();

        console.log(JSON.stringify(episodes));
        //console.log(episodes);
        return JSON.stringify(episodes);
    } catch (error) {
        return null;
    }
}

async function extractStreamUrl(url) {
    try {
        const headers = {
            'Referer': 'https://frembed.xyz',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
        };

        const responseText = await fetchv2(`https://frembed.xyz/api/series?${url}&idType=tmdb`, headers);

        const data = await responseText.json();
        const embedUrl = data.link3;
        const newEmbedUrl = embedUrl.replace("https://johnalwayssame.com/e/", "https://jilliandescribecompany.com/e/");
        console.log(newEmbedUrl);
        const response = await fetchv2(newEmbedUrl);
        const html = await response.text();

        
        let streamData = null;
        try {
        streamData = voeExtractor(html);
        } catch (error) {
        console.error("VOE extraction error:", error);
        return null;
        }

        if (typeof streamData === "string" && streamData.startsWith("http")) {
        console.error("Voe Stream URL: " + streamData);
        return streamData;
        }


        console.log("No stream URL found");
        return null;
  } catch (error) {
    console.log("Fetch error:", error);
    return null;
  }
}

/* SCHEME START */

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
      console.log("No application/json script tag found");
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
  // console.log("Decoded JSON:", result);

  // check if direct_access_url is set, not null and starts with http
  if (result && typeof result === "object") {
    const streamUrl =
      result.direct_access_url ||
      result.source
        .map((source) => source.direct_access_url)
        .find((url) => url && url.startsWith("http"));
    if (streamUrl) {
      console.log("Voe Stream URL: " + streamUrl);
      return streamUrl;
    } else {
      console.log("No stream URL found in the decoded JSON");
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

/* SCHEME END */
