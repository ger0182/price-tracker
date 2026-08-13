const TRACKER_URL = "https://price-tracker-sigma-lime.vercel.app/";
const PRODUCT_URL = "https://24h.pchome.com.tw/prod/DAAT0R-1900GIZXQ";
const PRODUCT_NAME = "滿意寶寶 純水99濕巾｜補充包 24包組";
const LOW_PRICE_THRESHOLD = 999;

function formatTaipeiTime(date = new Date()) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

async function sendLineBroadcast(messages, token) {
  const response = await fetch("https://api.line.me/v2/bot/message/broadcast", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages.map((text) => ({ type: "text", text })),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LINE broadcast failed: ${response.status} ${detail}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  if (!lineToken) {
    return res.status(500).json({
      success: false,
      error: "Missing LINE_CHANNEL_ACCESS_TOKEN",
    });
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const priceApiUrl = `${protocol}://${host}/api/price`;
  const checkTime = formatTaipeiTime();

  try {
    const priceResponse = await fetch(priceApiUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    const data = await priceResponse.json();
    if (!priceResponse.ok || !data.success || data.price == null) {
      throw new Error(data.error || `Price API failed: ${priceResponse.status}`);
    }

    const price = Number(data.price);
    const originalPrice = data.original_price == null ? null : Number(data.original_price);
    const stockText = data.in_stock ? "✅ 有庫存" : "❌ 無庫存";

    const priceText = originalPrice && originalPrice !== price
      ? `目前價格：NT$${price}\n原價：NT$${originalPrice}`
      : `目前價格：NT$${price}`;

    const normalMessage = [
      "🔎 商品價格自動檢查",
      PRODUCT_NAME,
      "",
      priceText,
      `庫存：${stockText}`,
      `檢查時間：${checkTime}`,
      "",
      `🛒 商品頁：${PRODUCT_URL}`,
      `📊 查價頁：${TRACKER_URL}`,
    ].join("\n");

    const messages = [normalMessage];

    if (price < LOW_PRICE_THRESHOLD) {
      messages.push([
        "🔥🔥🔥 低價警報 🔥🔥🔥",
        "",
        PRODUCT_NAME,
        `目前只要 NT$${price}！`,
        `已低於你設定的 NT$${LOW_PRICE_THRESHOLD} 門檻。`,
        "",
        stockText,
        "",
        "👉 建議現在查看商品：",
        PRODUCT_URL,
      ].join("\n"));
    }

    await sendLineBroadcast(messages, lineToken);

    return res.status(200).json({
      success: true,
      source: "vercel-cron",
      price,
      original_price: originalPrice,
      in_stock: Boolean(data.in_stock),
      low_price_alert: price < LOW_PRICE_THRESHOLD,
      checked_at: new Date().toISOString(),
      schedule: req.headers["x-vercel-cron-schedule"] || null,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    try {
      await sendLineBroadcast([
        [
          "⚠️ 商品價格查詢失敗",
          PRODUCT_NAME,
          `時間：${checkTime}`,
          `原因：${errorMessage}`,
          "",
          `查價頁：${TRACKER_URL}`,
        ].join("\n"),
      ], lineToken);
    } catch (lineError) {
      console.error("Failed to send LINE failure notification:", lineError);
    }

    console.error("Vercel cron price check failed:", error);
    return res.status(500).json({ success: false, error: errorMessage });
  }
}
