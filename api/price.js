// api/price.js — Vercel Serverless Function
// 在伺服器端呼叫 PChome API，繞過瀏覽器 CORS 限制

export default async function handler(req, res) {
  // 允許所有來源呼叫（CORS）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  const PRODUCT_ID = "DAAT0R-1900GIZXQ";
  // PChome API 需要在商品 ID 後加上 "-000"
  const PRODUCT_ID_WITH_SUFFIX = `${PRODUCT_ID}-000`;

  try {
    // 正確的 PChome 商品 API 格式
    // 參考：https://ecapi.pchome.com.tw/ecshop/prodapi/v2/prod?id=商品ID-000&fields=Price,Qty
    const apiUrl = `https://ecapi.pchome.com.tw/ecshop/prodapi/v2/prod?id=${PRODUCT_ID_WITH_SUFFIX}&fields=Price,Qty,Store`;

    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://24h.pchome.com.tw/",
        "Accept": "application/json, text/plain, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`PChome API 回應錯誤: ${response.status}`);
    }

    const raw = await response.text();

    // PChome API 回傳純 JSON 格式
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("無法解析 PChome API 回應: " + raw.substring(0, 100));
    }

    // 回傳格式：{ "DAAT0R-1900GIZXQ-000": { Price: { P: 售價, M: 原價 }, Qty: 庫存數 } }
    const productData = data[PRODUCT_ID_WITH_SUFFIX];
    if (!productData) {
      throw new Error("找不到商品資料，API 回傳: " + JSON.stringify(data).substring(0, 200));
    }

    const price = productData?.Price?.P || productData?.Price?.M || null;
    const originalPrice = productData?.Price?.M || null;
    const inStock = (productData?.Qty ?? 0) > 0;

    if (!price) {
      throw new Error("無法取得價格，Price 欄位: " + JSON.stringify(productData?.Price));
    }

    res.status(200).json({
      success: true,
      price: Number(price),
      original_price: originalPrice && Number(originalPrice) !== Number(price) ? Number(originalPrice) : null,
      in_stock: inStock,
      fetched_at: new Date().toISOString(),
    });

  } catch (error) {
    // 備援：直接抓商品頁 HTML 解析價格
    try {
      const htmlRes = await fetch(`https://24h.pchome.com.tw/prod/${PRODUCT_ID}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "zh-TW,zh;q=0.9",
        },
      });
      const html = await htmlRes.text();

      // 從頁面 meta 或 JSON-LD 抓價格
      let price = null;
      
      // 方法1: og:price meta tag
      const ogPrice = html.match(/<meta[^>]+property="product:price:amount"[^>]+content="([^"]+)"/);
      if (ogPrice) price = parseFloat(ogPrice[1]);
      
      // 方法2: JSON-LD schema
      if (!price) {
        const ldMatch = html.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
        if (ldMatch) {
          try {
            const ld = JSON.parse(ldMatch[1]);
            price = ld?.offers?.price || ld?.price;
          } catch {}
        }
      }

      // 方法3: 頁面內的價格文字
      if (!price) {
        const priceMatch = html.match(/"price"\s*:\s*(\d+)/);
        if (priceMatch) price = parseInt(priceMatch[1]);
      }

      if (price) {
        res.status(200).json({
          success: true,
          price: Number(price),
          original_price: null,
          in_stock: true,
          fetched_at: new Date().toISOString(),
          source: "html_fallback",
        });
      } else {
        throw new Error("備援方法也無法取得價格");
      }
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        error: error.message,
        fallback_error: fallbackError.message,
      });
    }
  }
}
