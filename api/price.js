// api/price.js — Vercel Serverless Function
// 有效售價優先使用 PChome 搜尋 JSON API（可取得售價已折），prodapi 用於庫存與備援。

const PRODUCT_ID = "DAAT0R-1900GIZXQ";
const PRODUCT_ID_WITH_SUFFIX = `${PRODUCT_ID}-000`;
const SEARCH_QUERY = "滿意寶寶 純水99嬰兒濕巾補充包 24包組";

const REQUEST_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36",
  "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
};

function toNumber(value) {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

async function fetchSearchProduct() {
  const query = encodeURIComponent(SEARCH_QUERY);
  const url = `https://ecshweb.pchome.com.tw/search/v4.3/all/results?q=${query}&page=1&pageCount=40&_=${Date.now()}`;

  const response = await fetch(url, {
    headers: {
      ...REQUEST_HEADERS,
      Accept: "application/json, text/plain, */*",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PChome 搜尋 API 回應錯誤: ${response.status}`);
  }

  const data = await response.json();
  const products = data?.Prods || data?.prods || [];
  return products.find((product) => product?.Id === PRODUCT_ID || product?.id === PRODUCT_ID) || null;
}

async function fetchProdData() {
  const url = `https://ecapi.pchome.com.tw/ecshop/prodapi/v2/prod?id=${PRODUCT_ID_WITH_SUFFIX}&fields=Price,Qty,Store`;

  const response = await fetch(url, {
    headers: {
      ...REQUEST_HEADERS,
      Referer: "https://24h.pchome.com.tw/",
      Accept: "application/json, text/plain, */*",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PChome 商品 API 回應錯誤: ${response.status}`);
  }

  const data = await response.json();
  return data?.[PRODUCT_ID_WITH_SUFFIX] || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  try {
    const [searchResult, prodResult] = await Promise.allSettled([
      fetchSearchProduct(),
      fetchProdData(),
    ]);

    const searchProduct = searchResult.status === "fulfilled" ? searchResult.value : null;
    const productData = prodResult.status === "fulfilled" ? prodResult.value : null;

    const searchPrice = toNumber(searchProduct?.Price ?? searchProduct?.price);
    const searchOriginPrice = toNumber(searchProduct?.OriginPrice ?? searchProduct?.originPrice);
    const prodPrice = toNumber(productData?.Price?.P) || toNumber(productData?.Price?.M);
    const prodOriginalPrice = toNumber(productData?.Price?.M);

    const price = searchPrice || prodPrice;
    if (!price) {
      const searchError = searchResult.status === "rejected" ? String(searchResult.reason) : "找不到目標商品";
      const prodError = prodResult.status === "rejected" ? String(prodResult.reason) : "找不到商品資料";
      throw new Error(`無法取得價格；搜尋 API: ${searchError}；商品 API: ${prodError}`);
    }

    let originalPrice = null;
    if (searchPrice) {
      if (searchOriginPrice && searchOriginPrice !== searchPrice) {
        originalPrice = searchOriginPrice;
      }
    } else if (prodOriginalPrice && prodOriginalPrice !== prodPrice) {
      originalPrice = prodOriginalPrice;
    }

    const inStock = productData ? (productData?.Qty ?? 0) > 0 : true;

    return res.status(200).json({
      success: true,
      price,
      original_price: originalPrice,
      in_stock: inStock,
      fetched_at: new Date().toISOString(),
      source: searchPrice ? "pchome_search" : "pchome_prodapi",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
