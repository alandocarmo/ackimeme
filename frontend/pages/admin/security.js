import React, { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

export default function SecurityAdmin() {
  const router = useRouter();
  const [anomalies, setAnomalies] = useState([]);
  const [password, setPassword] = useState("");
  const [adminJwt, setAdminJwt] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAdminJwt(data.adminJwt);
      fetchAnomalies(data.adminJwt);
    } catch(err) {
      setError(err.message);
    }
  }

  const fetchAnomalies = async (token) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/admin/security/anomalies`, {
        headers: { "x-admin-jwt": token }
      });
      const data = await res.json();
      if (res.ok) setAnomalies(data.anomalies || []);
    } catch (err) {
      console.error(err);
    }
  }

  if (!adminJwt) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center p-4">
        <div className="glass-panel p-8 max-w-sm w-full font-mono">
          <h2 className="text-xl font-bold text-[#ff3333] mb-4">SECURITY OVERRIDE</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              placeholder="Admin Master Token" 
              className="w-full bg-black/50 border border-[#333] p-3 text-red-500 font-bold focus:border-red-500 outline-none"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
            <button className="w-full bg-[#ff3333] text-black font-bold py-3 hover:bg-red-400 uppercase tracking-widest transition-colors">
              Access Feed
            </button>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-mono p-8 selection:bg-red-500/30">
      <Head><title>AckiMeme - Security Mission Control</title></Head>

      <div className="max-w-7xl mx-auto space-y-8">
        <header className="border-b border-red-500/20 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter mix-blend-screen">
              THREAT<span className="text-red-500">_MONITOR</span>
            </h1>
            <p className="text-sm text-red-400/60 mt-1 uppercase tracking-widest">
              Live Network Anomaly Detection System /// Acki Nacki
            </p>
          </div>
          <div className="flex gap-4">
             <div className="bg-red-500/10 border border-red-500/30 px-4 py-2 rounded text-red-500 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                LIVE SENSORS
             </div>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-panel p-6 border-l-4 border-l-red-500 col-span-2">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
               <span className="text-red-500">⚠</span> RECENT ANOMALIES
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-[#222]">
                    <th className="pb-3 font-normal uppercase tracking-wider">Wallet IP / Signature</th>
                    <th className="pb-3 font-normal uppercase tracking-wider">Type</th>
                    <th className="pb-3 font-normal uppercase tracking-wider">Risk Score</th>
                    <th className="pb-3 font-normal uppercase tracking-wider">Triggers</th>
                    <th className="pb-3 font-normal uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222]">
                  {anomalies.map((ano, i) => (
                    <tr key={ano.wallet} className="hover:bg-[#111] transition-colors">
                      <td className="py-4">
                        <div className="font-bold text-gray-300">{ano.wallet}</div>
                        <div className="text-xs text-gray-600">{ano.ip}</div>
                      </td>
                      <td className="py-4">
                        <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs rounded uppercase tracking-wider">
                          {ano.type}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                           <div className="w-16 h-2 bg-[#222] rounded overflow-hidden">
                             <div className="h-full bg-red-500" style={{ width: `${ano.score}%` }}></div>
                           </div>
                           <span className="text-xs font-bold">{ano.score}/100</span>
                        </div>
                      </td>
                      <td className="py-4 text-xs text-gray-400">
                        {ano.triggers.join(" // ")}
                      </td>
                      <td className="py-4 text-right">
                        <button className="text-xs border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-black px-3 py-1 rounded transition-colors uppercase font-bold tracking-wider">
                          Ban IP
                        </button>
                      </td>
                    </tr>
                  ))}
                  {anomalies.length === 0 && (
                    <tr><td colSpan="5" className="py-8 text-center text-gray-500">No recent anomalies detected.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
             <div className="glass-panel p-6 border-l-4 border-l-orange-500">
               <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Automated Security Checks</h3>
               <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between border-b border-[#222] pb-2">
                    <span className="text-sm">Auto Pool (Pre-bonding)</span>
                    <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded">ACTIVE (Bancor)</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[#222] pb-2">
                    <span className="text-sm">Liquidity Lock (Anti-rug)</span>
                    <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded">ON-CHAIN (30 Days)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">ML Sniper Detection</span>
                    <span className="text-xs px-2 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded">HEURISTIC SIM</span>
                  </div>
               </div>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}
