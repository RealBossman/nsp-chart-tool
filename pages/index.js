import { useState, useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

export default function Home() {
  const [ca, setCa] = useState("");
  const [candles, setCandles] = useState([]);
  const [tokenMeta, setTokenMeta] = useState({});
  const [latestPrice, setLatestPrice] = useState(null);
  const chartContainerRef = useRef();
  const chartInstance = useRef();

  const fetchTrades = async () => {
    if (!ca) return;
    const res = await fetch(`/api/history?ca=${ca}`);
    const data = await res.json();
    const grouped = groupToCandles(data.trades);
    setCandles(grouped);
    if (data.trades.length > 0) {
      setLatestPrice(data.trades[data.trades.length - 1].price.toFixed(8));
    }
  };

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

  const fetchTokenMeta = async () => {
    if (!ca) return;
    try {
      const res = await fetch(`https://puppyscan.shib.io/api/token/${ca}`);
      const data = await res.json();
      setTokenMeta({ name: data.name, symbol: data.symbol, logo: data.logoURI });
    } catch {
      setTokenMeta({});
    }
  };

  useEffect(() => {
    if (!ca) return;
    fetchTrades();
    fetchTokenMeta();
    const id = setInterval(fetchTrades, 15000);
    return () => clearInterval(id);
  }, [ca]);

  // create / resize chart
  useEffect(() => {
    if (!candles.length) return;

    const container = chartContainerRef.current;
    if (!chartInstance.current) {
      chartInstance.current = createChart(container, {
        width: container.clientWidth,
        height: 400,
        layout: { background: { type: 'solid', color: '#12172b' }, textColor: '#ddd' },
        grid: { vertLines: { color: '#334' }, horzLines: { color: '#334' } }
      });
      chartInstance.current.series = chartInstance.current.addCandlestickSeries();
      window.addEventListener('resize', handleResize);
    }

    chartInstance.current.series.setData(candles);

    function handleResize() {
      chartInstance.current.resize(container.clientWidth, 400);
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [candles]);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#0e1a3a 0%,#37236d 100%)", color: "#fff", fontFamily: "sans-serif" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", background: "#0a1633", padding: "10px 20px", boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>
        <img src="/nsp-logo.png" alt="NSP Logo" style={{ width: 40, height: 40, marginRight: 15 }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>NSP Chart Tool</h1>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 900, margin: "30px auto", padding: "0 15px" }}>
        {/* Input Row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <input
            value={ca}
            onChange={(e) => setCa(e.target.value)}
            placeholder="Enter Token Contract Address"
            style={{ flex: "1 1 220px", minWidth: 0, padding: 12, borderRadius: 6, border: "none", fontSize: 16, color: "#222" }}
          />
          <button
            onClick={() => { fetchTrades(); fetchTokenMeta(); }}
            style={{ padding: "12px 20px", borderRadius: 6, border: "none", background: "#2e61f0", color: "#fff", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
          >
            Load Chart
          </button>
        </div>

        {/* Token Meta */}
        {tokenMeta.name && (
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 15 }}>
            {tokenMeta.logo && <img src={tokenMeta.logo} alt="logo" width="50" height="50" style={{ borderRadius: 8 }} />}
            <h3 style={{ margin: 0 }}>{tokenMeta.name} ({tokenMeta.symbol})</h3>
            {latestPrice && <div style={{ fontSize: 18 }}><strong>Latest Price:</strong> ${latestPrice}</div>}
          </div>
        )}

        {/* Chart */}
        <div ref={chartContainerRef} style={{ marginTop: 30, width: "100%" }} />

        {/* Footer */}
        <footer style={{ marginTop: 50, textAlign: "center", color: "#bbb", fontSize: 14, fontStyle: "italic" }}>
          Made by <a href="https://twitter.com/RealBossman" target="_blank" rel="noreferrer" style={{ color: "#aaa" }}>@RealBossman</a>
        </footer>
      </main>
    </div>
  );
}