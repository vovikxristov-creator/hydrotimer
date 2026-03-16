import { useState, useEffect, useRef, useCallback } from "react";

// ─── Audio ───────────────────────────────────────────────
function createAudioContext() {
  return new (window.AudioContext || window.webkitAudioContext)();
}
function playTone(ctx, freq, dur, type = "sine", vol = 0.5, delay = 0) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
  gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + dur);
}
function playHotStart(ctx) {
  playTone(ctx, 440, 0.15, "triangle", 0.4, 0);
  playTone(ctx, 550, 0.15, "triangle", 0.4, 0.12);
  playTone(ctx, 660, 0.3,  "triangle", 0.5, 0.24);
}
function playHotEnd(ctx) {
  playTone(ctx, 660, 0.15, "sine", 0.4, 0);
  playTone(ctx, 550, 0.15, "sine", 0.4, 0.15);
  playTone(ctx, 440, 0.15, "sine", 0.4, 0.3);
  playTone(ctx, 330, 0.4,  "sine", 0.5, 0.45);
}
function playColdStart(ctx) {
  playTone(ctx, 880,  0.1,  "square", 0.3,  0);
  playTone(ctx, 1100, 0.1,  "square", 0.3,  0.1);
  playTone(ctx, 1320, 0.25, "square", 0.35, 0.2);
}
function playColdEnd(ctx) {
  playTone(ctx, 523, 0.2, "sine", 0.35, 0);
  playTone(ctx, 659, 0.2, "sine", 0.35, 0.18);
  playTone(ctx, 784, 0.4, "sine", 0.4,  0.36);
}
function playFinish(ctx) {
  [523, 659, 784, 1047].forEach((n, i) => playTone(ctx, n, 0.35, "triangle", 0.5, i * 0.2));
  playTone(ctx, 1047, 0.8, "sine", 0.45, 0.9);
}
function playCountdownBeep(ctx, secondsLeft) {
  const freq = secondsLeft <= 3 ? 1200 : 900;
  const vol  = secondsLeft <= 3 ? 0.55 : 0.35;
  playTone(ctx, freq, 0.08, "square", vol, 0);
  if (secondsLeft <= 3) {
    playTone(ctx, freq * 1.25, 0.06, "square", vol * 0.6, 0.1);
  }
}

// ─── Helpers ─────────────────────────────────────────────
const DEFAULTS = { hotTime: 60, coldTime: 30, cycles: 3 };
function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
function loadStats() {
  try { return JSON.parse(localStorage.getItem("hydroStats") || "{}"); } catch { return {}; }
}
function saveStats(s) {
  try { localStorage.setItem("hydroStats", JSON.stringify(s)); } catch {}
}

// ─── Achievements ────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: "first",    icon: "🚿", label: "Первый раз",    desc: "Завершить 1 процедуру",              check: s => (s.totalSessions||0) >= 1 },
  { id: "week",     icon: "📅", label: "Неделя",        desc: "7 завершённых процедур",             check: s => (s.totalSessions||0) >= 7 },
  { id: "month",    icon: "🗓", label: "Месяц",         desc: "30 завершённых процедур",            check: s => (s.totalSessions||0) >= 30 },
  { id: "iceman",   icon: "🧊", label: "Человек-лёд",   desc: "1 час под холодной водой суммарно",  check: s => (s.totalColdSec||0)  >= 3600 },
  { id: "volcano",  icon: "🌋", label: "Вулкан",        desc: "1 час под горячей водой суммарно",   check: s => (s.totalHotSec||0)   >= 3600 },
  { id: "hardcore", icon: "💪", label: "Хардкор",       desc: "Завершить 5-цикловую процедуру",     check: s => (s.maxCycles||0)     >= 5 },
  { id: "streak3",  icon: "🔥", label: "3 дня подряд",  desc: "Streak 3 дня",                       check: s => (s.streak||0)        >= 3 },
  { id: "streak7",  icon: "⚡", label: "7 дней подряд", desc: "Streak 7 дней",                      check: s => (s.streak||0)        >= 7 },
];

// ─── Sub-components ──────────────────────────────────────
function CircleProgress({ progress, isHot, alert, size = 260 }) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - progress);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={isHot ? "rgba(255,100,50,0.12)" : "rgba(80,180,255,0.12)"} strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={alert ? (isHot ? "#ff3a00" : "#00aaff") : (isHot ? "url(#hotG)" : "url(#coldG)")}
        strokeWidth={alert ? 10 : 8}
        strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.9s linear, stroke-width 0.2s" }}
      />
      <defs>
        <linearGradient id="hotG" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ff6432"/><stop offset="100%" stopColor="#ffb020"/>
        </linearGradient>
        <linearGradient id="coldG" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#38b6ff"/><stop offset="100%" stopColor="#a0e4ff"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

function SliderBlock({ label, value, min, max, step, color, colorClass, onChange, formatVal }) {
  const display = formatVal ? formatVal(value) : formatTime(value);
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12 }}>
        <div style={{ fontSize:12, color:"#777", letterSpacing:"0.06em" }}>{label}</div>
        <div style={{ fontSize:20, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.05em", color }}>{display}</div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        className={colorClass} onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}

function PhaseCard({ label, time, active, color }) {
  const rgb = color === "#ff6432" ? "255,100,50" : "56,182,255";
  return (
    <div style={{
      flex:1, padding:"12px 14px", borderRadius:12,
      background: active ? `rgba(${rgb},0.1)` : "rgba(255,255,255,0.03)",
      border: `1px solid ${active ? color+"44" : "rgba(255,255,255,0.06)"}`,
      transition: "all 0.6s ease",
    }}>
      <div style={{ fontSize:11, color: active ? color : "#444", letterSpacing:"0.08em", marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, color: active ? color : "#333", letterSpacing:"0.05em" }}>
        {formatTime(time)}
      </div>
    </div>
  );
}

function AchievementBadge({ ach, unlocked }) {
  return (
    <div title={`${ach.label}: ${ach.desc}`} style={{
      width:44, height:44, borderRadius:12,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:20,
      background: unlocked ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${unlocked ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}`,
      filter: unlocked ? "none" : "grayscale(1) opacity(0.3)",
      transition: "all 0.4s",
      cursor: "default",
      flexShrink: 0,
    }}>
      {ach.icon}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────
export default function App() {
  const [screen,   setScreen]   = useState("setup");
  const [settings, setSettings] = useState({ ...DEFAULTS });
  const [state,    setState]    = useState(null);
  const [tab,      setTab]      = useState("timer");
  const [stats,    setStats]    = useState(loadStats);

  const audioRef    = useRef(null);
  const timerRef    = useRef(null);
  const wakeLockRef = useRef(null);

  function getAudio() {
    if (!audioRef.current) audioRef.current = createAudioContext();
    if (audioRef.current.state === "suspended") audioRef.current.resume();
    return audioRef.current;
  }

  async function requestWakeLock() {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {}
  }
  function releaseWakeLock() {
    try { wakeLockRef.current?.release(); wakeLockRef.current = null; } catch {}
  }

  useEffect(() => {
    const reacquire = () => { if (screen === "running") requestWakeLock(); };
    document.addEventListener("visibilitychange", reacquire);
    return () => document.removeEventListener("visibilitychange", reacquire);
  }, [screen]);

  const tick = useCallback(() => {
    setState(prev => {
      if (!prev || prev.paused) return prev;
      const remaining = prev.remaining - 1;
      const ctx = getAudio();

      if (remaining > 0 && remaining <= 5) {
        playCountdownBeep(ctx, remaining);
      }

      if (remaining <= 0) {
        if (prev.phase === "hot") {
          playHotEnd(ctx);
          setTimeout(() => playColdStart(getAudio()), 700);
          return { ...prev, phase: "cold", remaining: prev.coldTime };
        } else {
          const nextCycle = prev.cycle + 1;
          if (nextCycle > prev.totalCycles) {
            setTimeout(() => playFinish(getAudio()), 200);
            clearInterval(timerRef.current);
            setStats(old => {
              const today    = new Date().toDateString();
              const lastDate = old.lastDate;
              const streak   = lastDate === new Date(Date.now() - 86400000).toDateString()
                ? (old.streak || 0) + 1
                : (lastDate === today ? (old.streak || 1) : 1);
              const updated = {
                totalSessions: (old.totalSessions || 0) + 1,
                totalHotSec:   (old.totalHotSec   || 0) + prev.hotTime  * prev.totalCycles,
                totalColdSec:  (old.totalColdSec  || 0) + prev.coldTime * prev.totalCycles,
                maxCycles:     Math.max(old.maxCycles || 0, prev.totalCycles),
                streak, lastDate: today,
                history: [...(old.history || []).slice(-29), {
                  date: today, cycles: prev.totalCycles,
                  total: (prev.hotTime + prev.coldTime) * prev.totalCycles,
                }],
              };
              saveStats(updated);
              return updated;
            });
            setScreen("done");
            return prev;
          } else {
            playColdEnd(ctx);
            setTimeout(() => playHotStart(getAudio()), 700);
            return { ...prev, phase: "hot", cycle: nextCycle, remaining: prev.hotTime };
          }
        }
      }
      return { ...prev, remaining };
    });
  }, []);

  function startSession() {
    requestWakeLock();
    const ctx = getAudio();
    const s = {
      phase: "hot", cycle: 1,
      totalCycles: settings.cycles,
      hotTime:  settings.hotTime,
      coldTime: settings.coldTime,
      remaining: settings.hotTime,
      paused: false,
    };
    setState(s);
    setScreen("running");
    setTab("timer");
    setTimeout(() => playHotStart(ctx), 300);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(tick, 1000);
  }

  function togglePause() {
    setState(prev => ({ ...prev, paused: !prev.paused }));
  }

  function stopSession() {
    clearInterval(timerRef.current);
    releaseWakeLock();
    setScreen("setup");
    setState(null);
  }

  useEffect(() => () => { clearInterval(timerRef.current); releaseWakeLock(); }, []);
  useEffect(() => {
    if (screen === "running") {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(tick, 1000);
    }
  }, [tick, screen]);

  const isHot         = state?.phase === "hot";
  const totalTime     = state ? (isHot ? state.hotTime : state.coldTime) : 1;
  const progress      = state ? state.remaining / totalTime : 1;
  const alert5        = state ? (state.remaining <= 5 && state.remaining > 0) : false;
  const unlockedIds   = new Set(ACHIEVEMENTS.filter(a => a.check(stats)).map(a => a.id));

  const sessionTotal   = state
    ? (state.hotTime + state.coldTime) * state.totalCycles : 1;
  const sessionElapsed = state
    ? (state.hotTime + state.coldTime) * (state.cycle - 1)
      + (isHot ? state.hotTime - state.remaining : state.hotTime + state.coldTime - state.remaining)
    : 0;
  const sessionProgress = state ? Math.min(1, sessionElapsed / sessionTotal) : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: screen === "running"
        ? isHot ? "radial-gradient(ellipse at 60% 0%,#1a0800 0%,#0d0d0d 70%)"
                : "radial-gradient(ellipse at 40% 0%,#001020 0%,#0d0d0d 70%)"
        : "radial-gradient(ellipse at 50% -10%,#111 0%,#0a0a0a 80%)",
      color: "#f0f0f0",
      fontFamily: "'DM Mono','Courier New',monospace",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "20px 16px 40px",
      transition: "background 1.5s ease",
      userSelect: "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        input[type=range] { -webkit-appearance:none; width:100%; height:4px; border-radius:2px; outline:none; cursor:pointer; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:18px; height:18px; border-radius:50%; cursor:pointer; transition:transform .15s; }
        input[type=range]::-webkit-slider-thumb:hover { transform:scale(1.3); }
        .hot-range  { background:linear-gradient(to right,#ff6432,#ffb020); }
        .hot-range::-webkit-slider-thumb  { background:#ff8040; box-shadow:0 0 8px #ff6432aa; }
        .cold-range { background:linear-gradient(to right,#38b6ff,#a0e4ff); }
        .cold-range::-webkit-slider-thumb { background:#50c8ff; box-shadow:0 0 8px #38b6ffaa; }
        .neutral-range { background:linear-gradient(to right,#666,#ccc); }
        .neutral-range::-webkit-slider-thumb { background:#aaa; }
        .btn { border:none; border-radius:12px; cursor:pointer; font-family:inherit;
          font-size:13px; letter-spacing:0.1em; text-transform:uppercase; transition:all .2s; }
        .btn:hover  { filter:brightness(1.15); transform:translateY(-1px); }
        .btn:active { transform:translateY(0); filter:brightness(0.95); }
        .tab-btn { border:none; cursor:pointer; font-family:inherit; font-size:11px;
          letter-spacing:.1em; text-transform:uppercase; padding:8px 18px; border-radius:8px; transition:all .2s; }
        @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes urgentPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.65;transform:scale(1.07)} }
        @keyframes fadeIn      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ringPulse   { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.06);opacity:.3} }
        @keyframes badgeIn     { 0%{transform:scale(0.7) rotate(-10deg);opacity:0} 60%{transform:scale(1.15) rotate(2deg)} 100%{transform:scale(1);opacity:1} }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ width:"100%", maxWidth:400, marginBottom:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:"0.3em", color:"#444" }}>CONTRAST SHOWER</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:34, letterSpacing:"0.05em", lineHeight:1 }}>
              <span style={{ color:"#ff6432" }}>HYDR</span>
              <span style={{ color:"#38b6ff" }}>OT</span>
              <span style={{ color:"#f0f0f0" }}>IMER</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:4, background:"rgba(255,255,255,0.05)", borderRadius:10, padding:3 }}>
            {[["timer","⏱","Таймер"],["stats","📊","Прогресс"]].map(([id,icon,lbl]) => (
              <button key={id} className="tab-btn" onClick={() => setTab(id)} style={{
                background: tab===id ? "rgba(255,255,255,0.12)" : "transparent",
                color:      tab===id ? "#fff" : "#555",
              }}>{icon} {lbl}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ TAB TIMER ══ */}
      {tab === "timer" && (
        <div style={{ width:"100%", maxWidth:400 }}>

          {/* SETUP */}
          {screen === "setup" && (
            <div style={{ animation:"fadeIn .4s ease" }}>
              <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:20, padding:"28px 24px", border:"1px solid rgba(255,255,255,0.07)" }}>
                <SliderBlock label="🔥 Горячая вода"  value={settings.hotTime}  min={10} max={300} step={5} color="#ff6432" colorClass="hot-range"     onChange={v=>setSettings(s=>({...s,hotTime:v}))} />
                <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"20px 0" }} />
                <SliderBlock label="❄️ Холодная вода" value={settings.coldTime} min={10} max={180} step={5} color="#38b6ff" colorClass="cold-range"    onChange={v=>setSettings(s=>({...s,coldTime:v}))} />
                <div style={{ height:1, background:"rgba(255,255,255,0.06)", margin:"20px 0" }} />
                <SliderBlock label="🔄 Циклов" value={settings.cycles} min={1} max={10} step={1} color="#aaa" colorClass="neutral-range"
                  onChange={v=>setSettings(s=>({...s,cycles:v}))} formatVal={v=>`${v} цикл${v===1?"":v<5?"а":"ов"}`} />
              </div>
              <div style={{ display:"flex", gap:10, marginTop:16, fontSize:11, color:"#555", letterSpacing:"0.05em" }}>
                {[
                  { l:"горячая",  v:formatTime(settings.hotTime),  c:"#ff6432", bg:"rgba(255,100,50,0.07)",   br:"rgba(255,100,50,0.15)" },
                  { l:"холодная", v:formatTime(settings.coldTime), c:"#38b6ff", bg:"rgba(56,182,255,0.07)",  br:"rgba(56,182,255,0.15)" },
                  { l:"итого",    v:formatTime((settings.hotTime+settings.coldTime)*settings.cycles), c:"#eee", bg:"rgba(255,255,255,0.04)", br:"rgba(255,255,255,0.08)" },
                ].map(x => (
                  <div key={x.l} style={{ flex:1, background:x.bg, border:`1px solid ${x.br}`, borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
                    <div style={{ color:x.c, fontSize:22, fontFamily:"'Bebas Neue',sans-serif", letterSpacing:"0.05em" }}>{x.v}</div>
                    <div>{x.l}</div>
                  </div>
                ))}
              </div>
              <button className="btn" onClick={startSession} style={{
                width:"100%", marginTop:24, padding:"18px",
                background:"linear-gradient(135deg,#ff6432,#ffb020)", color:"#fff",
                fontSize:14, fontWeight:500, letterSpacing:"0.15em", borderRadius:14,
                boxShadow:"0 4px 24px rgba(255,100,50,0.3)",
              }}>НАЧАТЬ ПРОЦЕДУРУ</button>
            </div>
          )}

          {/* RUNNING */}
          {screen === "running" && state && (
            <div style={{ textAlign:"center", animation:"fadeIn .4s ease" }}>

              {/* Session progress bar */}
              <div style={{ marginBottom:18 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#444", letterSpacing:"0.08em", marginBottom:6 }}>
                  <span>ПРОГРЕСС СЕССИИ</span>
                  <span>{Math.round(sessionProgress * 100)}%</span>
                </div>
                <div style={{ height:4, background:"rgba(255,255,255,0.07)", borderRadius:2, overflow:"hidden" }}>
                  <div style={{
                    height:"100%", borderRadius:2,
                    background:"linear-gradient(to right,#ff6432,#38b6ff)",
                    width:`${sessionProgress * 100}%`,
                    transition:"width 1s linear",
                  }}/>
                </div>
              </div>

              {/* Phase label */}
              <div style={{
                fontSize:11, letterSpacing:"0.35em",
                color: isHot ? "#ff6432" : "#38b6ff",
                marginBottom:6,
                animation: alert5 ? "urgentPulse .5s ease infinite" : "pulse 2s ease infinite",
              }}>
                {isHot ? "🔥 ГОРЯЧАЯ ВОДА" : "❄️ ХОЛОДНАЯ ВОДА"}
              </div>
              <div style={{ fontSize:12, color:"#444", letterSp
