import React from "react";

export function LiveTicker() {
  const events = [
    { id: 1, type: "buy", text: "🟢 0x3F.. just bought 50,000 PEPE" },
    { id: 2, type: "launch", text: "🚀 DOGE.acki just launched!" },
    { id: 3, type: "king", text: "👑 CAT is 98% to AckiSwap!" },
    { id: 4, type: "buy", text: "🟢 0x7A.. just bought 12,500 SHIB" },
    { id: 5, type: "migrate", text: "✨ TOAD just migrated to AckiSwap Premium Pool!" },
  ];

  return (
    <div style={{
      width: "100%",
      background: "rgba(0, 0, 0, 0.8)",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      overflow: "hidden",
      whiteSpace: "nowrap",
      position: "fixed",
      top: 0,
      left: 0,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      height: "36px",
      fontFamily: "'Inter', sans-serif"
    }}>
      <div 
        style={{
          display: "inline-block",
          paddingLeft: "100%",
          animation: "ticker 20s linear infinite"
        }}
      >
        {events.map((ev, i) => (
          <span key={ev.id} style={{
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            marginRight: "48px",
            textShadow: "0 0 10px rgba(255,255,255,0.2)"
          }}>
            {ev.text}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
      `}</style>
    </div>
  );
}
