import { useState, useEffect, useCallback } from "react";

const PRODUCT_URL = "https://24h.pchome.com.tw/prod/DAAT0R-1900GIZXQ";
const STORAGE_KEY = "pchome-price-history";
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// ⚠️ 填入你的 Anthropic API Key
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";

export default function PriceTracker() {
  const [priceHistory, setPriceHistory] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        setPriceHistory(data.history || []);
        setCurrentPrice(data.currentPrice || null);
        setLastChecked(data.lastChecked || null);
      }
      const auto = localStorage.getItem("price-tracker-auto") === "true";
      setAutoEnabled(auto);
    } catch (e) {}
  }, []);

  const saveToStorage = (history, price, checked) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      history, currentPrice: price, lastChecked: checked
    }));
  };

  const fetchPrice = useCallback(async () => {
    if (!API_KEY) {
      setStatus("error");
      setErrorMsg("請先設定 VITE_ANTHROPIC_API_KEY 環境變數（見 README）");
      return;
    }
    setLoading(true);
    setStatus("fetching");
    setErrorMsg("");

    try {
      const res = await fetch(ANTHROPIC_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{
            role: "user",
            content: `請搜尋 PChome 24h購物「滿意寶寶 純水99嬰兒濕巾補充包(24包組)」的目前售價，商品網址：${PRODUCT_URL}。只回傳 JSON：{"price":數字,"original_price":數字或null,"in_stock":true或false}，不含其他文字。`
          }]
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const text = data.content.map(i => i.type === "text" ? i.text : "").join("");
      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) throw new Error("無法解析回傳資料");
      const parsed = JSON.parse(match[0]);
      if (!parsed.price || isNaN(parsed.price)) throw new Error("價格資料異常");

      const now = new Date().toISOString();
      const entry = { date: now, price: parsed.price, original_price: parsed.original_price || null, in_stock: parsed.in_stock !== false };
      const newHistory = [...priceHistory, entry].slice(-60);
      setPriceHistory(newHistory);
      setCurrentPrice(parsed.price);
      setLastChecked(now);
      setStatus("success");
      saveToStorage(newHistory, parsed.price, now);

    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message || "查詢失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  }, [priceHistory]);

  // Auto-fetch on load if enabled and not yet fetched today
  useEffect(() => {
    if (!autoEnabled) return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const last = data.lastChecked ? new Date(data.lastChecked) : null;
      if (last && last.toDateString() === new Date().toDateString()) return;
    }
    const t = setTimeout(fetchPrice, 1200);
    return () => clearTimeout(t);
  }, [autoEnabled]);

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPriceHistory([]); setCurrentPrice(null); setLastChecked(null); setStatus("idle");
  };

  const toggleAuto = () => {
    const next = !autoEnabled;
    setAutoEnabled(next);
    localStorage.setItem("price-tracker-auto", String(next));
  };

  // Chart
  const minP = priceHistory.length ? Math.min(...priceHistory.map(h => h.price)) : 0;
  const maxP = priceHistory.length ? Math.max(...priceHistory.map(h => h.price)) : 0;
  const range = maxP - minP || 1;
  const CW = 560, CH = 120, PL = 52, PR = 16, PT = 12, PB = 28;
  const gx = i => PL + (i / Math.max(priceHistory.length - 1, 1)) * (CW - PL - PR);
  const gy = p => PT + CH - PB - ((p - minP) / range) * (CH - PT - PB);
  const polyline = priceHistory.map((h, i) => `${gx(i)},${gy(h.price)}`).join(" ");
  const area = priceHistory.length > 1
    ? `M${gx(0)},${gy(priceHistory[0].price)} ${priceHistory.map((h,i) => `L${gx(i)},${gy(h.price)}`).join(" ")} L${gx(priceHistory.length-1)},${CH-PB} L${gx(0)},${CH-PB} Z`
    : "";
  const lowest = priceHistory.length ? priceHistory.reduce((a,b) => a.price < b.price ? a : b) : null;

  const fmt = iso => { if (!iso) return ""; const d = new Date(iso); return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
  const fmtS = iso => { if (!iso) return ""; const d = new Date(iso); return `${d.getMonth()+1}/${d.getDate()}`; };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)", fontFamily:"'Noto Sans TC',system-ui,sans-serif", padding:"24px 16px", color:"#e8e0f7" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box}
        .card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px}
        .btn{cursor:pointer;border:none;border-radius:10px;font-weight:600;transition:all .2s;letter-spacing:.04em}
        .btn:hover:not(:disabled){transform:translateY(-1px)}
        .btn:disabled{opacity:.5;cursor:not-allowed}
        .fade-in{animation:fadeIn .4s ease}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .spin{animation:spin 1s linear infinite;display:inline-block}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .mono{font-family:'JetBrains Mono',monospace}
        .rh:hover{background:rgba(255,255,255,.05)}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.2);border-radius:4px}
      `}</style>

      <div style={{ maxWidth:640, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:11, letterSpacing:".2em", color:"#a78bfa", textTransform:"uppercase", marginBottom:6 }}>PChome 24h 價格追蹤器</div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>滿意寶寶 純水99濕巾</h1>
          <p style={{ margin:"4px 0 0", fontSize:13, color:"#9ca3af" }}>補充包 24包組 · 一般型100抽／厚型80抽</p>
        </div>

        {/* Price Card */}
        <div className="card fade-in" style={{ padding:24, marginBottom:16, position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-40, right:-40, width:140, height:140, background:"radial-gradient(circle,rgba(139,92,246,.3) 0%,transparent 70%)", borderRadius:"50%" }} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:12, color:"#9ca3af", marginBottom:8 }}>目前售價</div>
              {currentPrice
                ? <div style={{ display:"flex", alignItems:"baseline", gap:8 }}><span className="mono" style={{ fontSize:44, fontWeight:600, color:"#c4b5fd" }}>${currentPrice.toLocaleString()}</span><span style={{ fontSize:14, color:"#6b7280" }}>TWD</span></div>
                : <div style={{ fontSize:22, color:"#4b5563" }}>尚未查詢</div>}
              {lastChecked && <div style={{ fontSize:12, color:"#6b7280", marginTop:6 }}>最後更新：{fmt(lastChecked)}</div>}
            </div>
            <div style={{ textAlign:"right" }}>
              {lowest && <div style={{ marginBottom:8 }}>
                <div style={{ fontSize:11, color:"#6b7280" }}>歷史最低</div>
                <div className="mono" style={{ fontSize:18, color:"#34d399", fontWeight:600 }}>${lowest.price.toLocaleString()}</div>
                <div style={{ fontSize:10, color:"#6b7280" }}>{fmt(lowest.date)}</div>
              </div>}
              <div style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, background: priceHistory.length && priceHistory[priceHistory.length-1]?.in_stock !== false ? "rgba(52,211,153,.15)" : "rgba(239,68,68,.15)", border:`1px solid ${priceHistory.length && priceHistory[priceHistory.length-1]?.in_stock !== false ? "rgba(52,211,153,.3)" : "rgba(239,68,68,.3)"}`, fontSize:11, color: priceHistory.length && priceHistory[priceHistory.length-1]?.in_stock !== false ? "#34d399" : "#f87171" }}>
                {priceHistory.length && priceHistory[priceHistory.length-1]?.in_stock !== false ? "● 有庫存" : "● 無庫存"}
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        {priceHistory.length > 1 && (
          <div className="card fade-in" style={{ padding:20, marginBottom:16 }}>
            <div style={{ fontSize:12, color:"#9ca3af", marginBottom:12 }}>價格走勢（近 {priceHistory.length} 筆）</div>
            <svg width="100%" viewBox={`0 0 ${CW} ${CH}`} style={{ overflow:"visible" }}>
              <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity=".3"/><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"/></linearGradient></defs>
              {[0,.25,.5,.75,1].map(f => { const y=PT+(1-f)*(CH-PT-PB); return <g key={f}><line x1={PL} y1={y} x2={CW-PR} y2={y} stroke="rgba(255,255,255,.06)" strokeWidth="1"/><text x={PL-4} y={y+4} textAnchor="end" style={{ fontSize:9, fill:"#6b7280", fontFamily:"JetBrains Mono,monospace" }}>{Math.round(minP+f*range)}</text></g>; })}
              {priceHistory.filter((_,i) => i % Math.max(1,Math.floor(priceHistory.length/5))===0).map((h) => { const i=priceHistory.indexOf(h); return <text key={i} x={gx(i)} y={CH-4} textAnchor="middle" style={{ fontSize:9, fill:"#6b7280", fontFamily:"JetBrains Mono,monospace" }}>{fmtS(h.date)}</text>; })}
              {area && <path d={area} fill="url(#ag)"/>}
              {priceHistory.length > 1 && <polyline points={polyline} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round"/>}
              {priceHistory.map((h,i) => <circle key={i} cx={gx(i)} cy={gy(h.price)} r="3" fill={h.price===minP?"#34d399":"#8b5cf6"} stroke="rgba(15,12,41,.8)" strokeWidth="1.5"/>)}
            </svg>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display:"flex", gap:10, marginBottom:16 }}>
          <button className="btn" onClick={fetchPrice} disabled={loading} style={{ flex:1, padding:14, background: loading ? "rgba(139,92,246,.3)" : "linear-gradient(135deg,#7c3aed,#4f46e5)", color:"white", fontSize:14, boxShadow: loading ? "none" : "0 4px 16px rgba(124,58,237,.4)" }}>
            {loading ? <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}><span className="spin">⟳</span>查詢中...</span> : "🔍 立即查詢價格"}
          </button>
          <a href={PRODUCT_URL} target="_blank" rel="noopener noreferrer" className="btn" style={{ padding:"14px 16px", fontSize:14, background:"rgba(255,255,255,.08)", color:"#d1d5db", textDecoration:"none", display:"flex", alignItems:"center" }}>🛒 商品頁</a>
        </div>

        {/* Status */}
        {status === "success" && <div className="fade-in" style={{ padding:"12px 16px", borderRadius:10, marginBottom:16, background:"rgba(52,211,153,.1)", border:"1px solid rgba(52,211,153,.2)", color:"#34d399", fontSize:13 }}>✓ 查詢成功！目前售價 <strong className="mono">${currentPrice?.toLocaleString()}</strong> TWD</div>}
        {status === "error" && <div className="fade-in" style={{ padding:"12px 16px", borderRadius:10, marginBottom:16, background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.2)", color:"#f87171", fontSize:13 }}>✗ {errorMsg}</div>}

        {/* Auto toggle */}
        <div className="card" style={{ padding:16, marginBottom:16 }}>
          <div style={{ fontSize:12, color:"#a78bfa", fontWeight:600, marginBottom:10 }}>📅 每日自動查詢</div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div onClick={toggleAuto} style={{ width:40, height:22, borderRadius:11, cursor:"pointer", background: autoEnabled ? "#7c3aed" : "rgba(255,255,255,.1)", position:"relative", transition:"background .2s", border:"1px solid rgba(255,255,255,.15)", flexShrink:0 }}>
              <div style={{ width:16, height:16, borderRadius:"50%", background:"white", position:"absolute", top:2, left: autoEnabled ? 20 : 2, transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.3)" }}/>
            </div>
            <div style={{ fontSize:12, color: autoEnabled ? "#a78bfa" : "#6b7280" }}>
              {autoEnabled ? "✓ 已啟用 — 每次開啟此頁面自動執行今日查詢" : "啟用後，每天首次開啟頁面即自動查詢價格"}
            </div>
          </div>
        </div>

        {/* History */}
        {priceHistory.length > 0 && (
          <div className="card" style={{ padding:20, marginBottom:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:12, color:"#9ca3af" }}>歷史記錄（{priceHistory.length} 筆）</div>
              <button className="btn" onClick={clearHistory} style={{ padding:"4px 10px", fontSize:11, background:"rgba(239,68,68,.15)", color:"#f87171", border:"1px solid rgba(239,68,68,.2)" }}>清除</button>
            </div>
            <div style={{ maxHeight:240, overflowY:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead><tr style={{ color:"#6b7280", borderBottom:"1px solid rgba(255,255,255,.08)" }}>
                  <th style={{ textAlign:"left", padding:"6px 8px", fontWeight:500 }}>日期時間</th>
                  <th style={{ textAlign:"right", padding:"6px 8px", fontWeight:500 }}>售價</th>
                  <th style={{ textAlign:"right", padding:"6px 8px", fontWeight:500 }}>原價</th>
                  <th style={{ textAlign:"center", padding:"6px 8px", fontWeight:500 }}>庫存</th>
                </tr></thead>
                <tbody>
                  {[...priceHistory].reverse().map((h,i) => {
                    const isLow = h.price === minP && priceHistory.length > 1;
                    return <tr key={i} className="rh" style={{ borderBottom:"1px solid rgba(255,255,255,.04)" }}>
                      <td style={{ padding:"7px 8px", color:"#9ca3af", fontFamily:"JetBrains Mono,monospace" }}>{fmt(h.date)}</td>
                      <td style={{ padding:"7px 8px", textAlign:"right", fontFamily:"JetBrains Mono,monospace", fontWeight:600, color: isLow ? "#34d399" : "#c4b5fd" }}>${h.price.toLocaleString()}{isLow && <span style={{ fontSize:10, marginLeft:4 }}>最低</span>}</td>
                      <td style={{ padding:"7px 8px", textAlign:"right", color:"#6b7280", fontFamily:"JetBrains Mono,monospace", textDecoration:"line-through" }}>{h.original_price ? `$${h.original_price.toLocaleString()}` : "—"}</td>
                      <td style={{ padding:"7px 8px", textAlign:"center", color: h.in_stock !== false ? "#34d399" : "#f87171" }}>{h.in_stock !== false ? "●" : "○"}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ textAlign:"center", fontSize:11, color:"#4b5563", paddingBottom:16 }}>資料來源：PChome 24h 購物 · 記錄儲存於本機瀏覽器</div>
      </div>
    </div>
  );
}
