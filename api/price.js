// api/price.js — Vercel Serverless Function
// 基本售價從 PChome prodapi 取得；若館別促銷頁有「售價已折」則優先採用活動價。

const PRODUCT_ID = "DAAT0R-1900GIZXQ";
const PRODUCT_ID_WITH_SUFFIX = `${PRODUCT_ID}-000`;
const PRODUCT_NAME_KEYWORD = "純水99嬰兒濕巾補充包(24包組)";
const PROMOTION_PAGE_URL = "https://24h.pchome.com.tw/region/DAAO/bestsellers";

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",
  "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
};

function toNumber(value) {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function extractPromotionPriceFromCard(cardHtml, basePrice) {
  if (!cardHtml) return null;

  const normalized = cardHtml
    .replace(/&nbsp;/gi, " ")
    .replace(/&#36;/g, "$")
    .replace(/\s+/g, " ");

  const candidates = [];
  const patterns = [
    /任選\s*1\s*件\s*\$?\s*([\d,]+)/gi,
    /\$\s*([\d,]+)\s*(?:\([^)]*售價已折[^)]*\)|售價已折)/gi,
    /(?:salePrice|finalPrice|discountPrice|promoPrice)["']?\s*[:=]\s*["']?\s*([\d,]+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(normalized)) !== null) {
      const value = toNumber(match[1]);
      if (value && value < basePrice) candidates.push(value);
    }
  }

  return candidates.length ? Math.min(...candidates) : null;
}

async function fetchPromotionalPrice(basePrice) {
  try {
    const response = await fetch(`${PROMOTION_PAGE_URL}?_=${Date.now()}`, {
      headers: {
        ...REQUEST_HEADERS,
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!response.ok) return null;
    const html = await response.text();

    let index = html.indexOf(PRODUCT_ID);
    if (index < 0) index = html.indexOf(PRODUCT_NAME_KEYWORD);
    if (index < 0) return null;

    // 優先只解析包含目標商品的 <a> 卡片，避免抓到相鄰商品價格。
    let start = html.lastIndexOf("<a", index);
    let end = html.indexOf("</a>", index);
    let cardHtml = "";

    if (start >= 0 && end > index) {
      cardHtml = html.slice(start, end + 4);
    } else {
      cardHtml = html.slice(Math.max(0, index - 1800), Math.min(html.length, index + 3000));
    }

    return extractPromotionPriceFromCard(cardHtml, basePrice);
  } catch {
    // 促銷來源失敗不應讓整個查價失敗；仍可回傳 prodapi 基本售價。
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  try {
    const apiUrl = `https://ecapi.pchome.com.tw/ecshop/prodapi/v2/prod?id=${PRODUCT_ID_WITH_SUFFIX}&fields=Price,Discount,Qty,Store`;

    const response = await fetch(apiUrl, {
      headers: {
        ...REQUEST_HEADERS,
        Referer: "https://24h.pchome.com.tw/",
        Accept: "application/json, text/plain, */*",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`PChome API 回應錯誤: ${response.status}`);
    }

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("無法解析 PChome API 回應: " + raw.substring(0, 100));
    }

    const productData = data[PRODUCT_ID_WITH_SUFFIX];
    if (!productData) {
      throw new Error("找不到商品資料，API 回傳: " + JSON.stringify(data).substring(0, 200));
    }

    const basePrice = toNumber(productData?.Price?.P) || toNumber(productData?.Price?.M);
    const listPrice = toNumber(productData?.Price?.M);
    const inStock = (productData?.Qty ?? 0) > 0;

    if (!basePrice) {
      throw new Error("無法取得價格，Price 欄位: " + JSON.stringify(productData?.Price));
    }

    const promotionPrice = await fetchPromotionalPrice(basePrice);
    const price = promotionPrice || basePrice;
    const originalPrice = promotionPrice
      ? basePrice
      : (listPrice && listPrice !== basePrice ? listPrice : null);

    return res.status(200).json({
      success: true,
      price,
      original_price: originalPrice,
      in_stock: inStock,
      fetched_at: new Date().toISOString(),
      source: promotionPrice ? "pchome_promotion" : "pchome_prodapi",
    });

  } catch (error) {
    // 備援：直接抓商品頁 HTML 解析公開價格。
    try {
      const htmlRes = await fetch(`https://24h.pchome.com.tw/prod/${PRODUCT_ID}?_=${Date.now()}`, {
        headers: {
          ...REQUEST_HEADERS,
          Accept: "text/html,application/xhtml+xml",
        },
        cache: "no-store",
      });
      const html = await htmlRes.text();

      let price = null;

      const ogPrice = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([^"]+)"/);
      if (ogPrice) price = toNumber(ogPrice[1]);

      if (!price) {
        const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
        if (ldMatch) {
          try {
            const ld = JSON.parse(ldMatch[1]);
            price = toNumber(ld?.offers?.price || ld?.price);
          } catch {}
        }
      }

      if (!price) {
        const priceMatch = html.match(/"price"\s*:\s*(\d+)/);
        if (priceMatch) price = toNumber(priceMatch[1]);
      }

      if (price) {
        return res.status(200).json({
          success: true,
          price,
          original_price: null,
          in_stock: true,
          fetched_at: new Date().toISOString(),
          source: "html_fallback",
        });
      }

      throw new Error("備援方法也無法取得價格");
    } catch (fallbackError) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fallback_error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      });
    }
  }
}
