const PRODUCT_ID = "DAAT0R-1900GIZXQ";
const PRODUCT_NAME_KEYWORD = "純水99嬰兒濕巾補充包(24包組)";
const URL = "https://24h.pchome.com.tw/region/DAAO/bestsellers";

export default async function handler(req, res) {
  const response = await fetch(`${URL}?_=${Date.now()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });

  const html = await response.text();
  let index = html.indexOf(PRODUCT_ID);
  let matchedBy = "id";
  if (index < 0) {
    index = html.indexOf(PRODUCT_NAME_KEYWORD);
    matchedBy = "name";
  }

  return res.status(200).json({
    status: response.status,
    length: html.length,
    index,
    matchedBy: index >= 0 ? matchedBy : null,
    has899: html.includes("899"),
    hasSaleText: html.includes("售價已折"),
    snippet: index >= 0 ? html.slice(Math.max(0, index - 2500), Math.min(html.length, index + 4500)) : html.slice(0, 1500),
  });
}
