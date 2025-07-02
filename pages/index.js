import { useState, useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function Home() {
  // ---------------- state / refs ----------------
  const DEFAULT_CA = "0xC7e29EA23E3dAb1E1bc891674dCF631cb8569f00";
  const [ca, setCa] = useState(DEFAULT_CA);
  const [candles, setCandles] = useState([]);
  const [tokenMeta, setTokenMeta] = useState({});
  const [latestPrice, setLatestPrice] = useState(null);
  const containerRef = useRef();
  const chart = useRef();          // chart instance
  const candleSeries = useRef();   // series instance

  // ---------------- default placeholder data ----------------
  const DEFAULT_CANDLES = [
    { time: Math.floor(Date.now() / 1000) - 300, open: 1.0, high: 1.2, low: 0.9, close: 1.1 },
    { time: Math.floor(Date.now() / 1000) - 240, open: 1.1, high: 1.3, low: 1.0, close: 1.2 },
    { time: Math.floor(Date.now() / 1000) - 180, open: 1.2, high: 1.4, low: 1.1, close: 1.3 },
    { time: Math.floor(Date.now() / 1000) - 120, open: 1.3, high: 1.5, low: 1.2, close: 1.4 },
    { time: Math.floor(Date.now() / 1000) -  60, open: 1.4, high: 1.6, low: 1.3, close: 1.5 },
  ];

// ---------------- helpers ----------------
const groupToCandles = (trades) => {
  const interval = 60;
  const map = {};
  trades.forEach(({ timestamp, price }) => {
    const bucket = Math.floor(timestamp / interval) * interval;
    if (!map[bucket]) {
      map[bucket] = { time: bucket, open: price, high: price, low: price, close: price };
    } else {
      const c = map[bucket];
      c.high = Math.max(c.high, price);
      c.low = Math.min(c.low, price);
      c.close = price;
    }
  });
  return Object.values(map).sort((a, b) => a.time - b.time);
};

const fetchTrades = async () => {
  if (!ca) return;
  console.log("Fetching trades for CA:", ca);
  try {
    const res = await fetch(`/api/history?ca=${ca}`);
    if (!res.ok) {
      console.error("API /api/history error:", res.status);
      setCandles([]);               // <- fallback to default
      return;
    }
    const data = await res.json();
    if (!data.trades || !Array.isArray(data.trades)) {
      console.error("Unexpected payload:", data);
      setCandles([]);
      return;
    }
    const grouped = groupToCandles(data.trades);
    setCandles(grouped);
    if (data.trades.length) {
      setLatestPrice(data.trades[data.trades.length - 1].price.toFixed(8));
    }
  } catch (err) {
    console.error("fetchTrades() failed:", err);
    setCandles([]);                 // <- fallback to default
  }
};

const fetchTokenMeta = async () => {
  if (!ca) return;
  try {
    const res = await fetch(`https://puppyscan.shib.io/api/token/${ca}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    setTokenMeta({ name: data.name, symbol: data.symbol, logo: data.logoURI });
  } catch (err) {
    console.error("fetchTokenMeta() failed:", err);
    setTokenMeta({});
  }
};


  // ---------------- create chart once ----------------
  useEffect(() => {
    if (!containerRef.current || chart.current) return;

    chart.current = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 400,
      layout: { background: { type: "solid", color: "#12172b" }, textColor: "#ddd" },
      grid: { vertLines: { color: "#334" }, horzLines: { color: "#334" } },
    });
    candleSeries.current = chart.current.addCandlestickSeries();

    // resize on window change
    const handleResize = () =>
      chart.current.resize(containerRef.current.clientWidth, 400);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ---------------- set data whenever candles change ----------------
  useEffect(() => {
    if (!candleSeries.current) return;
    candleSeries.current.setData(candles.length ? candles : DEFAULT_CANDLES);
  }, [candles]);

  // ---------------- fetch data on CA change & poll ----------------
  useEffect(() => {
    console.log("CA changed, fetching trades...");
    fetchTrades();
    fetchTokenMeta();
    const id = setInterval(fetchTrades, 15000);
    return () => clearInterval(id);
  }, [ca]);

  // ---------------- render ----------------
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0e1a3a 0%,#37236d 100%)", color: "#fff" }}>
      {/* header */}
      <header style={{ display: "flex", alignItems: "center", background: "#0a1633", padding: "10px 20px" }}>
        <img src="/nsp-logo.png" alt="NSP Logo" style={{ width: 40, height: 40, marginRight: 15 }} />
        <h1 style={{ fontSize: 22, margin: 0 }}>NSP Chart Tool</h1>
      </header>

      {/* main */}
      <main style={{ maxWidth: 900, margin: "30px auto", padding: 15 }}>
        {/* input */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <input
            value={ca}
            onChange={(e) => setCa(e.target.value)}
            placeholder="Enter Token Contract Address"
            style={{ flex: "1 1 220px", padding: 12, borderRadius: 6, border: "none", color: "#222" }}
          />
          <button
            onClick={() => { fetchTrades(); fetchTokenMeta(); }}
            style={{ padding: "12px 20px", borderRadius: 6, border: "none", background: "#2e61f0", color: "#fff", fontWeight: 600 }}
          >
            Load Chart
          </button>
        </div>

        {/* token meta */}
        {tokenMeta.name && (
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap" }}>
            {tokenMeta.logo && <img src={tokenMeta.logo} alt="logo" width="50" height="50" style={{ borderRadius: 8 }} />}
            <h3 style={{ margin: 0 }}>{tokenMeta.name} ({tokenMeta.symbol})</h3>
            {latestPrice && <span><strong>Latest:</strong> ${latestPrice}</span>}
          </div>
        )}

        {/* chart */}
        <div ref={containerRef} style={{ marginTop: 30, width: "100%" }} />

        {/* footer */}
        <footer style={{ marginTop: 50, textAlign: "center", color: "#bbb", fontStyle: "italic" }}>
          Made by <a href="https://twitter.com/RealBossman" target="_blank" rel="noreferrer" style={{ color: "#aaa" }}>@RealBossman</a>
        </footer>
      </main>
    </div>
  );
}
