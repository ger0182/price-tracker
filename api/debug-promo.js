const PRODUCT_ID = "DAAT0R-1900GIZXQ";
const QUERY = encodeURIComponent("滿意寶寶 純水99嬰兒濕巾補充包 24包組");
const URL = `https://ecshweb.pchome.com.tw/search/v4.3/all/results?q=${QUERY}&page=1&pageCount=40`;

export default async function handler(req, res) {
  const response = await fetch(`${URL}&_=${Date.now()}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });

  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch {}

  const products = data?.Prods || data?.prods || [];
  const target = products.find((p) => p?.Id === PRODUCT_ID || p?.id === PRODUCT_ID) || null;

  return res.status(200).json({
    status: response.status,
    count: products.length,
    target,
    topLevelKeys: data ? Object.keys(data) : null,
    preview: data ? null : text.slice(0, 1000),
  });
}
