import { useState, useEffect, useRef } from "react";

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const CAL_GOAL    = 1500;
const WATER_CUPS  = 12;
const STEP_GOAL   = 10000;
const KG_PER_KCAL = 1 / 7700;
const LB_PER_KCAL = 1 / 3500;

const DEFAULT_SUPPLEMENTS = [
  { id:1, name:"Vitamin D",   emoji:"☀️",  taken:false },
  { id:2, name:"Ferritin",    emoji:"🩸",  taken:false },
  { id:3, name:"Magnesium",   emoji:"💎",  taken:false },
  { id:4, name:"Adrenal SAP", emoji:"⚡",  taken:false },
  { id:5, name:"Multi",       emoji:"💊",  taken:false },
  { id:6, name:"Cranberry",   emoji:"🍒",  taken:false },
];

const todayStr = () => new Date().toISOString().slice(0,10);

/* ══════════════════════════════════════════════════════════════
   AI FOOD LOOKUP
══════════════════════════════════════════════════════════════ */
async function estimateFood(description) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:300,
      system:`You are a precise nutrition database. Return ONLY a JSON object, no markdown, no extra text:
{"name":"food name","kcal":number,"protein":number,"carbs":number,"fat":number,"emoji":"1 emoji","serving":"serving description"}
Be medically accurate. Base on standard serving unless quantity given.`,
      messages:[{role:"user",content:description}]
    })
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

/* ══════════════════════════════════════════════════════════════
   STORAGE HELPERS
══════════════════════════════════════════════════════════════ */
async function loadLog() {
  try {
    const res = await window.storage.get("nutripal-log");
    return res ? JSON.parse(res.value) : [];
  } catch { return []; }
}
async function saveLog(log) {
  try { await window.storage.set("nutripal-log", JSON.stringify(log)); } catch {}
}

/* ══════════════════════════════════════════════════════════════
   SHARED UI
══════════════════════════════════════════════════════════════ */
const CARD = { background:"white", borderRadius:22, padding:"20px 20px", marginBottom:14, boxShadow:"0 2px 20px rgba(40,90,60,0.08)" };
const LBL  = { fontSize:11, color:"#9aabb8", fontWeight:800, letterSpacing:1, textTransform:"uppercase", marginBottom:10 };
const btn  = (bg,color,extra={}) => ({ background:bg, color, border:"none", borderRadius:12, padding:"9px 18px", fontFamily:"Nunito,sans-serif", fontWeight:800, fontSize:13, cursor:"pointer", ...extra });

function Ring({ value, max, color, size=64, stroke=6, children }) {
  const r=(size-stroke)/2, circ=2*Math.PI*r, pct=Math.min(value/max,1);
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#edf2f7" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 0.7s cubic-bezier(.4,2,.6,1)" }}/>
      </svg>
      <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>{children}</div>
    </div>
  );
}

function MacroChip({ label, value, max, color }) {
  return (
    <div style={{ flex:1, background:"#f8fbf9", borderRadius:14, padding:"10px 6px", textAlign:"center" }}>
      <div style={{ fontSize:17, fontWeight:900, color }}>{value}<span style={{ fontSize:10,color:"#bbb",marginLeft:1 }}>g</span></div>
      <div style={{ height:4,borderRadius:99,background:"#edf2f7",overflow:"hidden",margin:"5px 2px 3px" }}>
        <div style={{ width:`${Math.min(value/max*100,100)}%`,height:"100%",borderRadius:99,background:color,transition:"width 0.7s ease" }}/>
      </div>
      <div style={{ fontSize:10,color:"#aab",fontWeight:700 }}>{label}</div>
    </div>
  );
}

function Mascot({ mood }) {
  return (
    <svg viewBox="0 0 120 130" width="110" height="120"
      style={{ filter:"drop-shadow(0 8px 20px rgba(0,0,0,0.15))", animation:"float 3s ease-in-out infinite" }}>
      <ellipse cx="60" cy="90" rx="32" ry="36" fill="#a0b4c8"/>
      <ellipse cx="60" cy="100" rx="16" ry="20" fill="#d8e8f0"/>
      <circle cx="60" cy="52" r="32" fill="#a0b4c8"/>
      <ellipse cx="60" cy="54" rx="26" ry="16" fill="#2d2d2d"/>
      <circle cx="48" cy="50" r="9" fill="white"/><circle cx="72" cy="50" r="9" fill="white"/>
      <circle cx="50" cy="51" r="5" fill="#111"/><circle cx="74" cy="51" r="5" fill="#111"/>
      <circle cx="51" cy="49" r="2" fill="white"/><circle cx="75" cy="49" r="2" fill="white"/>
      <ellipse cx="60" cy="62" rx="4" ry="2.5" fill="#ff9eb5"/>
      {mood==="happy"
        ? <path d="M53 67 Q60 75 67 67" stroke="#555" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        : <path d="M54 72 Q60 66 66 72" stroke="#555" strokeWidth="1.8" fill="none" strokeLinecap="round"/>}
      <ellipse cx="36" cy="28" rx="10" ry="14" fill="#a0b4c8"/>
      <ellipse cx="36" cy="28" rx="5" ry="8" fill="#ffb3c6"/>
      <ellipse cx="84" cy="28" rx="10" ry="14" fill="#a0b4c8"/>
      <ellipse cx="84" cy="28" rx="5" ry="8" fill="#ffb3c6"/>
      <path d="M28 100 Q10 110 14 125" stroke="#555" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M28 100 Q8 112 12 127" stroke="#a0b4c8" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <ellipse cx="30" cy="85" rx="8" ry="14" fill="#a0b4c8" transform="rotate(-20 30 85)"/>
      <ellipse cx="90" cy="85" rx="8" ry="14" fill="#a0b4c8" transform="rotate(20 90 85)"/>
    </svg>
  );
}

function DeficitChart({ log }) {
  if (!log.length) return null;
  const last90 = log.slice(-90);
  const max = Math.max(...last90.map(d=>Math.abs(d.deficit)), 1);
  return (
    <div style={{ overflowX:"auto", paddingBottom:4 }}>
      <div style={{ display:"flex", gap:3, minWidth: Math.max(last90.length*10,200) }}>
        {last90.map((d,i) => {
          const h = Math.max(Math.round((Math.abs(d.deficit)/max)*52),3);
          const isDeficit = d.deficit > 0;
          return (
            <div key={i} title={`${d.date}: ${d.deficit>0?"-":"+"} ${Math.abs(d.deficit)} kcal`}
              style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
              <div style={{ width:8, height:h, borderRadius:3,
                background: isDeficit
                  ? `hsl(${140+Math.round((d.deficit/max)*20)},60%,${55-Math.round((d.deficit/max)*15)}%)`
                  : "#fca5a5",
                transition:"height 0.3s" }}/>
            </div>
          );
        })}
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:10, color:"#aab" }}>
        <span>{last90[0]?.date.slice(5)}</span>
        {last90[Math.floor(last90.length/2)] && <span>{last90[Math.floor(last90.length/2)]?.date.slice(5)}</span>}
        <span>Today</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════════ */
export default function NutriPal() {

  const [meals,       setMeals]       = useState([]);
  const [cups,        setCups]        = useState(0);
  const [steps,       setSteps]       = useState(0);
  const [supplements, setSupplements] = useState(DEFAULT_SUPPLEMENTS);

  const [workoutType,   setWorkoutType]   = useState(null);
  const [workoutDone,   setWorkoutDone]   = useState(false);
  const [fastedIncline, setFastedIncline] = useState(false);

  const [fastRunning,  setFastRunning]  = useState(false);
  const [fastElapsed,  setFastElapsed]  = useState(0);
  const fastRef = useRef(null);

  const [deficitLog,  setDeficitLog]  = useState([]);
  const [logLoaded,   setLogLoaded]   = useState(false);
  const [dayLogged,   setDayLogged]   = useState(false);
  const [closingDay,  setClosingDay]  = useState(false);

  const [modal,       setModal]       = useState(false);
  const [aiQuery,     setAiQuery]     = useState("");
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiResult,    setAiResult]    = useState(null);
  const [aiError,     setAiError]     = useState("");
  const [manForm,     setManForm]     = useState({name:"",kcal:"",protein:"",carbs:"",fat:"",emoji:"🍽️"});

  const [stepInput,   setStepInput]   = useState("");
  const [stepAdding,  setStepAdding]  = useState(false);

  const [suppAdding,  setSuppAdding]  = useState(false);
  const [suppName,    setSuppName]    = useState("");

  const [toast,       setToast]       = useState(null);

  useEffect(() => {
    loadLog().then(log => {
      setDeficitLog(log);
      setLogLoaded(true);
      const t = todayStr();
      if (log.find(d=>d.date===t)) setDayLogged(true);
    });
  }, []);

  useEffect(() => {
    if (fastRunning) fastRef.current = setInterval(()=>setFastElapsed(e=>e+1),1000);
    else clearInterval(fastRef.current);
    return ()=>clearInterval(fastRef.current);
  }, [fastRunning]);

  const totalKcal    = meals.reduce((s,m)=>s+m.kcal,0);
  const totalProtein = meals.reduce((s,m)=>s+m.protein,0);
  const totalCarbs   = meals.reduce((s,m)=>s+m.carbs,0);
  const totalFat     = meals.reduce((s,m)=>s+m.fat,0);
  const deficit      = Math.max(CAL_GOAL - totalKcal, 0);
  const over         = totalKcal > CAL_GOAL;
  const overBy       = Math.max(totalKcal - CAL_GOAL, 0);
  const waterMl      = cups * 250;

  const totalDeficit    = deficitLog.reduce((s,d)=>s+d.deficit,0);
  const totalDays       = deficitLog.length;
  const avgDailyDeficit = totalDays ? Math.round(totalDeficit/totalDays) : 0;
  const kgLost          = (totalDeficit * KG_PER_KCAL).toFixed(2);
  const lbLost          = (totalDeficit * LB_PER_KCAL).toFixed(2);
  const projectedKg90   = ((avgDailyDeficit*90)*KG_PER_KCAL).toFixed(1);
  const streak          = (() => {
    let s=0, dt=new Date();
    for(let i=0;i<90;i++){
      const d=dt.toISOString().slice(0,10);
      if(deficitLog.find(x=>x.date===d)) s++;
      else if(i>0) break;
      dt.setDate(dt.getDate()-1);
    }
    return s;
  })();

  const notify = msg => { setToast(msg); setTimeout(()=>setToast(null),2400); };

  const addMeal = meal => {
    setMeals(ms=>[...ms,{...meal,id:Date.now()}]);
    notify(`${meal.emoji} ${meal.name} logged!`);
  };

  const handleAiLookup = async () => {
    if (!aiQuery.trim()) return;
    setAiLoading(true); setAiError(""); setAiResult(null);
    try { setAiResult(await estimateFood(aiQuery)); }
    catch { setAiError("Couldn't read that food — try again!"); }
    setAiLoading(false);
  };

  const confirmAi = () => { addMeal(aiResult); setAiResult(null); setAiQuery(""); setModal(false); };

  const confirmManual = () => {
    if (!manForm.name||!manForm.kcal) return;
    addMeal({name:manForm.name,kcal:+manForm.kcal,protein:+manForm.protein||0,carbs:+manForm.carbs||0,fat:+manForm.fat||0,emoji:manForm.emoji});
    setManForm({name:"",kcal:"",protein:"",carbs:"",fat:"",emoji:"🍽️"});
    setModal(false);
  };

  const closeDay = async () => {
    setClosingDay(true);
    const today = todayStr();
    const existing = deficitLog.filter(d=>d.date!==today);
    const entry = {
      date:    today,
      kcal:    totalKcal,
      deficit: Math.max(CAL_GOAL - totalKcal, 0),
      steps,
      workout: workoutDone ? workoutType : null,
      fasted:  fastedIncline,
      cups,
    };
    const newLog = [...existing, entry].sort((a,b)=>a.date.localeCompare(b.date));
    setDeficitLog(newLog);
    await saveLog(newLog);
    setDayLogged(true);
    setClosingDay(false);
    notify("📅 Day logged! Keep going 💪");
  };

  const clearHistory = async () => {
    setDeficitLog([]); setDayLogged(false);
    await saveLog([]);
    notify("🗑️ History cleared");
  };

  const fmtTime = s => {
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sc).padStart(2,"0")}`;
  };

  const mascotMood = over ? "sad" : "happy";

  const byMonth = deficitLog.reduce((acc,d) => {
    const m = d.date.slice(0,7);
    if (!acc[m]) acc[m] = [];
    acc[m].push(d);
    return acc;
  },{});

  return (
    <div style={{ fontFamily:"'Nunito',sans-serif", background:"#eef7f2", minHeight:"100vh", maxWidth:430, margin:"0 auto", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{0%{opacity:0;transform:translateX(-50%) translateY(10px)}15%,80%{opacity:1;transform:translateX(-50%) translateY(0)}100%{opacity:0;transform:translateX(-50%) translateY(-10px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(64,145,108,0.4)}70%{box-shadow:0 0 0 8px rgba(64,145,108,0)}}
        .tap:active{opacity:0.75;transform:scale(0.97)}
        input:focus{border-color:#52b788 !important;outline:none}
      `}</style>

      {toast && (
        <div style={{ position:"fixed",top:22,left:"50%",zIndex:9999,background:"#1a2e1e",color:"white",
          borderRadius:14,padding:"10px 22px",fontSize:13,fontWeight:800,pointerEvents:"none",
          animation:"toastIn 2.4s ease forwards",whiteSpace:"nowrap",boxShadow:"0 4px 24px rgba(0,0,0,0.25)" }}>
          {toast}
        </div>
      )}

      {/* ── Hero ── */}
      <div style={{ background:"linear-gradient(150deg,#1b4332 0%,#2d6a4f 45%,#52b788 100%)",
        padding:"48px 24px 88px",position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,0.04)" }}/>
        <div style={{ position:"absolute",bottom:10,left:-40,width:150,height:150,borderRadius:"50%",background:"rgba(0,0,0,0.05)" }}/>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <div style={{ fontSize:26,fontWeight:900,color:"white",letterSpacing:-0.5 }}>NutriPal 🐾</div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.65)",marginTop:3,fontWeight:600 }}>
              {new Date().toLocaleDateString("en-CA",{weekday:"long",month:"long",day:"numeric"})}
            </div>
            <div style={{ display:"flex",gap:8,marginTop:10,alignItems:"center",flexWrap:"wrap" }}>
              <div style={{ background:"rgba(255,255,255,0.15)",borderRadius:10,padding:"5px 14px",fontSize:13,fontWeight:800,color:"white" }}>
                {totalKcal} / {CAL_GOAL} kcal
              </div>
              {over
                ? <div style={{ background:"#ef4444",borderRadius:10,padding:"5px 12px",fontSize:12,fontWeight:800,color:"white" }}>⚠️ +{overBy} over</div>
                : deficit > 0 && <div style={{ background:"rgba(52,211,153,0.25)",borderRadius:10,padding:"5px 12px",fontSize:12,fontWeight:800,color:"#a7f3d0" }}>🔥 -{deficit} deficit</div>
              }
              {streak>1&&<div style={{ background:"rgba(251,191,36,0.2)",borderRadius:10,padding:"5px 12px",fontSize:12,fontWeight:800,color:"#fcd34d" }}>🔥{streak}d streak</div>}
            </div>
          </div>
          <Mascot mood={mascotMood}/>
        </div>
      </div>

      {/* ── Scrollable ── */}
      <div style={{ padding:"0 14px 120px",marginTop:-62,position:"relative",zIndex:2,overflowY:"auto",height:"calc(100vh - 70px)" }}>

        {/* ════ CALORIES ════ */}
        <div style={{...CARD,animation:"slideUp 0.3s ease"}}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div>
              <div style={LBL}>Calories Today</div>
              <div style={{ fontSize:40,fontWeight:900,lineHeight:1,color:over?"#ef4444":"#1a2e1e",transition:"color 0.3s" }}>
                {totalKcal.toLocaleString()}
                <span style={{ fontSize:16,fontWeight:600,color:"#bbb",marginLeft:5 }}>kcal</span>
              </div>
              <div style={{ fontSize:13,color:"#8a9bb0",marginTop:5,fontWeight:600 }}>
                {over ? `${overBy} kcal over — deficit lost` : `${deficit} kcal deficit today`}
              </div>
            </div>
            <Ring value={totalKcal} max={CAL_GOAL} color={over?"#ef4444":"#40916c"} size={70} stroke={7}>
              <span style={{ fontSize:22 }}>🔥</span>
            </Ring>
          </div>
          <div style={{ display:"flex",gap:8,marginTop:16 }}>
            <MacroChip label="Protein" value={totalProtein} max={120} color="#4a9eff"/>
            <MacroChip label="Carbs"   value={totalCarbs}   max={180} color="#f4a261"/>
            <MacroChip label="Fat"     value={totalFat}     max={50}  color="#e76f51"/>
          </div>
          <div style={{ fontSize:11,color:"#ccd",marginTop:12 }}>Daily limit · {CAL_GOAL} kcal</div>
        </div>

        {/* ════ FOOD LOG ════ */}
        <div style={{...CARD,animation:"slideUp 0.36s ease"}}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={LBL}>Food Log</div>
            <div style={{ display:"flex",gap:7 }}>
              <button className="tap" onClick={()=>{ setModal("ai"); setAiResult(null); setAiError(""); setAiQuery(""); }}
                style={{...btn("linear-gradient(135deg,#4a9eff,#1d6fc4)","white"),padding:"7px 13px",borderRadius:10,fontSize:12,display:"flex",alignItems:"center",gap:4}}>
                ✨ AI
              </button>
              <button className="tap" onClick={()=>{ setModal("manual"); setManForm({name:"",kcal:"",protein:"",carbs:"",fat:"",emoji:"🍽️"}); }}
                style={{...btn("#f0f7f3","#2d6a4f"),padding:"7px 13px",border:"1.5px solid #b7e4c7",borderRadius:10,fontSize:12}}>
                + Add
              </button>
            </div>
          </div>
          {meals.length===0 ? (
            <div style={{ textAlign:"center",padding:"26px 0",color:"#c0cfd8" }}>
              <div style={{ fontSize:34,marginBottom:6 }}>🍽️</div>
              <div style={{ fontSize:14,fontWeight:700 }}>No meals logged yet</div>
              <div style={{ fontSize:12,marginTop:3 }}>Tap AI or Add to log food</div>
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
              {meals.map(m=>(
                <div key={m.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:14,
                  background:"linear-gradient(90deg,#f0faf5,#f8fbf9)",border:"1.5px solid #d8f3dc" }}>
                  <div style={{ width:40,height:40,borderRadius:11,background:"#d8f3dc",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>
                    {m.emoji}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:13,fontWeight:800,color:"#1a2e1e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{m.name}</div>
                    <div style={{ fontSize:11,color:"#8a9bb0",marginTop:1 }}>{m.kcal} kcal · P {m.protein}g · C {m.carbs}g · F {m.fat}g</div>
                  </div>
                  <button onClick={()=>setMeals(ms=>ms.filter(x=>x.id!==m.id))}
                    style={{ background:"none",border:"none",color:"#fca5a5",fontSize:20,cursor:"pointer",padding:"0 4px",flexShrink:0 }}>×</button>
                </div>
              ))}
              <div style={{ textAlign:"right",fontSize:11,color:"#8a9bb0",marginTop:4 }}>
                Total: <strong>{totalKcal} kcal</strong>
              </div>
            </div>
          )}
        </div>

        {/* ════ WATER ════ */}
        <div style={{...CARD,animation:"slideUp 0.42s ease"}}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div>
              <div style={LBL}>Water</div>
              <div style={{ fontSize:36,fontWeight:900,color:"#1a2e1e",lineHeight:1 }}>
                {cups}<span style={{ fontSize:15,color:"#aab",marginLeft:4 }}>/ {WATER_CUPS} cups</span>
              </div>
              <div style={{ fontSize:12,color:"#8a9bb0",marginTop:4 }}>{waterMl} ml · {cups>=WATER_CUPS?"🎉 Hydrated!":"Keep drinking!"}</div>
            </div>
            <Ring value={cups} max={WATER_CUPS} color="#4a9eff" size={60} stroke={5}><span style={{ fontSize:20 }}>💧</span></Ring>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginTop:16 }}>
            {Array.from({length:WATER_CUPS}).map((_,i)=>{
              const filled=i<cups;
              return (
                <div key={i} className="tap" onClick={()=>{ setCups(i+1); if(i+1>cups) notify(`💧 ${(i+1)*250}ml!`); }}
                  style={{ cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2 }}>
                  <svg viewBox="0 0 32 44" width="30" height="42">
                    <path d="M5 10 L7 38 Q7 41 10 41 L22 41 Q25 41 25 38 L27 10 Z"
                      fill={filled?"#4a9eff":"#e4effe"} style={{ transition:"fill 0.25s" }}/>
                    {filled&&<path d="M7 33 Q16 30 25 33 L25 38 Q25 41 22 41 L10 41 Q7 41 7 38 Z" fill="#7ab8ff" opacity="0.5"/>}
                    <path d="M5 10 L27 10" stroke={filled?"#7ab8ff":"#c4d8ff"} strokeWidth="1.5" fill="none"/>
                  </svg>
                  <div style={{ fontSize:8,fontWeight:800,color:filled?"#4a9eff":"#c4d8ff" }}>{i+1}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14 }}>
            <div style={{ fontSize:11,color:"#bbb" }}>Goal: {WATER_CUPS} cups · {WATER_CUPS*250}ml</div>
            <div style={{ display:"flex",gap:6 }}>
              {cups>0&&<button className="tap" onClick={()=>setCups(c=>c-1)} style={{...btn("#f0f4f7","#8a9bb0"),padding:"6px 12px",borderRadius:10,fontSize:13}}>–</button>}
              <button className="tap" onClick={()=>{if(cups<WATER_CUPS){setCups(c=>c+1);notify("💧 +250ml!");}}}
                style={{...btn("#4a9eff","white"),padding:"6px 14px",borderRadius:10,fontSize:13}}>+ Cup</button>
            </div>
          </div>
        </div>

        {/* ════ STEPS ════ */}
        <div style={{...CARD,animation:"slideUp 0.48s ease"}}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div>
              <div style={LBL}>Steps</div>
              <div style={{ fontSize:36,fontWeight:900,color:"#1a2e1e",lineHeight:1 }}>
                {steps.toLocaleString()}<span style={{ fontSize:14,color:"#aab",marginLeft:4 }}>steps</span>
              </div>
              <div style={{ fontSize:12,color:"#8a9bb0",marginTop:4 }}>
                {(steps*0.000762).toFixed(2)} km · {steps>=STEP_GOAL?"🎉 Goal done!":`${(STEP_GOAL-steps).toLocaleString()} to go`}
              </div>
            </div>
            <Ring value={steps} max={STEP_GOAL} color="#f4a261" size={64} stroke={6}><span style={{ fontSize:22 }}>👟</span></Ring>
          </div>
          <div style={{ marginTop:14,height:8,borderRadius:99,background:"#edf2f7",overflow:"hidden" }}>
            <div style={{ width:`${Math.min(steps/STEP_GOAL*100,100)}%`,height:"100%",borderRadius:99,
              background:"linear-gradient(90deg,#fbbf24,#e76f51)",transition:"width 0.7s ease" }}/>
          </div>
          <div style={{ display:"flex",gap:8,marginTop:14 }}>
            <button className="tap" onClick={()=>{ setSteps(10000); notify("👟 10,000 steps logged!"); }}
              style={{ flex:1,padding:"10px 0",borderRadius:12,border:"none",
                background:"linear-gradient(135deg,#fbbf24,#e76f51)",color:"white",
                fontFamily:"Nunito,sans-serif",fontWeight:900,fontSize:14,cursor:"pointer",
                boxShadow:"0 3px 12px rgba(251,191,36,0.35)" }}>
              ✓ 10K Steps
            </button>
            <button className="tap" onClick={()=>setStepAdding(a=>!a)}
              style={{ flex:1,padding:"10px 0",borderRadius:12,border:"1.5px solid #e8eef2",
                background:"white",color:"#555",fontFamily:"Nunito,sans-serif",
                fontWeight:800,fontSize:14,cursor:"pointer" }}>
              Custom
            </button>
          </div>
          {stepAdding && (
            <div style={{ display:"flex",gap:8,marginTop:10 }}>
              <input value={stepInput} onChange={e=>setStepInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){const n=parseInt(stepInput);if(n>0){setSteps(n);notify(`👟 ${n.toLocaleString()} steps set!`);}setStepInput("");setStepAdding(false);}}}
                placeholder="Enter step count…" type="number"
                style={{ flex:1,padding:"10px 14px",borderRadius:12,border:"1.5px solid #e8eef2",fontFamily:"Nunito,sans-serif",fontSize:14 }}/>
              <button className="tap" onClick={()=>{const n=parseInt(stepInput);if(n>0){setSteps(n);notify(`👟 ${n.toLocaleString()} steps set!`);}setStepInput("");setStepAdding(false);}}
                style={{...btn("#f4a261","white"),borderRadius:12}}>Set</button>
            </div>
          )}
        </div>

        {/* ════ WORKOUT ════ */}
        <div style={{...CARD,animation:"slideUp 0.54s ease"}}>
          <div style={LBL}>Workout</div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14 }}>
            {[
              { id:"oil", label:"50 min Oil",  emoji:"🫧", color:"#9b72cf", bg:"#f5f0ff", desc:"Mobility & recovery" },
              { id:"gym", label:"50 min Gym",  emoji:"🏋️", color:"#e76f51", bg:"#fff3ef", desc:"Strength training"  },
            ].map(t=>(
              <button key={t.id} className="tap" onClick={()=>{ setWorkoutType(t.id); setWorkoutDone(false); }}
                style={{ padding:"16px 12px",borderRadius:16,border:"none",cursor:"pointer",textAlign:"center",
                  background:workoutType===t.id?t.bg:"#f8fbf9",
                  outline:workoutType===t.id?`2.5px solid ${t.color}`:"2px solid transparent",
                  transition:"all 0.2s" }}>
                <div style={{ fontSize:28,marginBottom:6 }}>{t.emoji}</div>
                <div style={{ fontSize:14,fontWeight:900,color:workoutType===t.id?t.color:"#444" }}>{t.label}</div>
                <div style={{ fontSize:11,color:"#8a9bb0",marginTop:2 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          <div className="tap" onClick={()=>{ setFastedIncline(f=>!f); if(!fastedIncline) notify("🥾 Fasted incline added!"); }}
            style={{ display:"flex",alignItems:"center",gap:14,padding:"13px 16px",borderRadius:16,
              background:fastedIncline?"linear-gradient(90deg,#fff7ed,#fef3c7)":"#f8fbf9",
              border:fastedIncline?"2px solid #fbbf24":"2px solid #f0f0f0",
              cursor:"pointer",transition:"all 0.25s",marginBottom:14 }}>
            <div style={{ width:44,height:44,borderRadius:12,
              background:fastedIncline?"#fef3c7":"#f0f4f7",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,flexShrink:0 }}>
              🥾
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14,fontWeight:900,color:fastedIncline?"#92400e":"#444" }}>Fasted 30 min Incline</div>
              <div style={{ fontSize:11,color:"#8a9bb0",marginTop:1 }}>Morning fasted cardio · treadmill incline walk</div>
            </div>
            <div style={{ width:28,height:28,borderRadius:"50%",
              background:fastedIncline?"#fbbf24":"#e8eef2",
              display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s",flexShrink:0 }}>
              {fastedIncline&&<span style={{ color:"white",fontWeight:900,fontSize:14 }}>✓</span>}
            </div>
          </div>

          {workoutDone ? (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
              padding:"12px 16px",borderRadius:14,background:"#f0faf5",border:"1.5px solid #b7e4c7" }}>
              <div style={{ fontSize:14,fontWeight:800,color:"#1a2e1e" }}>
                {workoutType==="gym"?"🏋️":"🫧"} {workoutType==="gym"?"50 min Gym":"50 min Oil"} — Done! 🎉
              </div>
              <button onClick={()=>{ setWorkoutDone(false); setWorkoutType(null); }}
                style={{...btn("#f0f4f7","#8a9bb0"),padding:"6px 12px",borderRadius:10,fontSize:12}}>Reset</button>
            </div>
          ) : (
            <button className="tap" disabled={!workoutType&&!fastedIncline}
              onClick={()=>{ if(workoutType) setWorkoutDone(true); notify(`${workoutType==="gym"?"🏋️":"🫧"} Workout logged! 💪`); }}
              style={{ width:"100%",padding:"13px",borderRadius:16,border:"none",
                background:workoutType?"linear-gradient(135deg,#2d6a4f,#52b788)":"#edf2f7",
                color:workoutType?"white":"#bbb",fontFamily:"Nunito,sans-serif",
                fontWeight:900,fontSize:15,cursor:workoutType?"pointer":"default",
                boxShadow:workoutType?"0 4px 18px rgba(52,178,120,0.35)":"none",transition:"all 0.3s" }}>
              {workoutType
                ? `Log ${workoutType==="gym"?"Gym 🏋️":"Oil Session 🫧"}`
                : fastedIncline ? "✓ Fasted Incline logged!" : "Select a workout ↑"}
            </button>
          )}
        </div>

        {/* ════ SUPPLEMENTS ════ */}
        <div style={{...CARD,animation:"slideUp 0.6s ease"}}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div style={LBL}>Supplements</div>
            <div style={{ fontSize:12,fontWeight:800,color:supplements.every(s=>s.taken)?"#40916c":"#8a9bb0" }}>
              {supplements.filter(s=>s.taken).length}/{supplements.length}
              {supplements.every(s=>s.taken)?" 🎉 All done!":""}
            </div>
          </div>
          <div style={{ display:"flex",gap:3,marginBottom:14 }}>
            {supplements.map(s=>(
              <div key={s.id} style={{ flex:1,height:5,borderRadius:99,background:s.taken?"#40916c":"#e8eef2",transition:"background 0.3s" }}/>
            ))}
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
            {supplements.map(s=>(
              <div key={s.id} className="tap"
                onClick={()=>{ setSupplements(ss=>ss.map(x=>x.id===s.id?{...x,taken:!x.taken}:x)); if(!s.taken) notify(`${s.emoji} ${s.name} taken!`); }}
                style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:14,
                  background:s.taken?"linear-gradient(90deg,#e8f7f0,#f4faf8)":"#f8fbf9",
                  border:s.taken?"1.5px solid #b7e4c7":"1.5px solid #f0f0f0",cursor:"pointer",transition:"all 0.2s" }}>
                <div style={{ width:40,height:40,borderRadius:11,background:s.taken?"#d8f3dc":"#f0f4f7",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>
                  {s.emoji}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14,fontWeight:800,color:s.taken?"#1a2e1e":"#555" }}>{s.name}</div>
                  <div style={{ fontSize:11,color:"#8a9bb0" }}>{s.taken?"✓ Taken today":"Tap to mark taken"}</div>
                </div>
                <div style={{ width:26,height:26,borderRadius:"50%",flexShrink:0,
                  background:s.taken?"#40916c":"#e8eef2",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.3s" }}>
                  {s.taken&&<span style={{ color:"white",fontSize:13,fontWeight:900 }}>✓</span>}
                </div>
              </div>
            ))}
          </div>
          {suppAdding ? (
            <div style={{ display:"flex",gap:8,marginTop:10 }}>
              <input value={suppName} onChange={e=>setSuppName(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&suppName.trim()){ setSupplements(ss=>[...ss,{id:Date.now(),name:suppName.trim(),emoji:"💊",taken:false}]); setSuppName(""); setSuppAdding(false); }}}
                placeholder="Supplement name…" autoFocus
                style={{ flex:1,padding:"9px 12px",borderRadius:12,border:"1.5px solid #e8eef2",fontFamily:"Nunito,sans-serif",fontSize:14 }}/>
              <button className="tap" onClick={()=>{ if(suppName.trim()){ setSupplements(ss=>[...ss,{id:Date.now(),name:suppName.trim(),emoji:"💊",taken:false}]); setSuppName(""); setSuppAdding(false); }}}
                style={{...btn("#40916c","white"),borderRadius:12}}>Add</button>
              <button onClick={()=>setSuppAdding(false)} style={{...btn("#f0f4f7","#8a9bb0"),borderRadius:12,padding:"9px 12px"}}>✕</button>
            </div>
          ) : (
            <button className="tap" onClick={()=>setSuppAdding(true)}
              style={{ width:"100%",marginTop:10,padding:"9px",borderRadius:12,background:"#f5f5f5",color:"#8a9bb0",border:"none",fontFamily:"Nunito,sans-serif",fontWeight:800,fontSize:13,cursor:"pointer" }}>
              + Add supplement
            </button>
          )}
        </div>

        {/* ════ FASTING ════ */}
        <div style={{...CARD,animation:"slideUp 0.66s ease"}}>
          <div style={LBL}>Fasting Timer</div>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:30,fontWeight:900,color:fastRunning?"#2d6a4f":"#bbb",fontVariantNumeric:"tabular-nums",transition:"color 0.3s" }}>
                {fmtTime(fastElapsed)}
              </div>
              <div style={{ fontSize:12,color:"#8a9bb0",marginTop:4 }}>
                {fastRunning ? `${Math.round(fastElapsed/432)}% of 12h` : "Goal: 12h fast"}
              </div>
            </div>
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:8 }}>
              <Ring value={fastElapsed} max={43200} color="#2d6a4f" size={60} stroke={5}><span style={{ fontSize:20 }}>🌙</span></Ring>
              <button className="tap" onClick={()=>{ setFastRunning(r=>!r); if(!fastRunning) setFastElapsed(0); }}
                style={{ padding:"7px 20px",borderRadius:99,border:"none",background:fastRunning?"#ef4444":"#1a2e1e",color:"white",fontFamily:"Nunito,sans-serif",fontWeight:900,fontSize:12,cursor:"pointer",letterSpacing:1 }}>
                {fastRunning?"STOP":"START"}
              </button>
            </div>
          </div>
        </div>

        {/* ════ CLOSE DAY + DEFICIT TRACKER ════ */}
        <div style={{...CARD,animation:"slideUp 0.72s ease",border:"2px solid #d8f3dc"}}>
          <div style={LBL}>End of Day · Deficit Tracker</div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16 }}>
            {[
              { label:"Eaten",   value:`${totalKcal} kcal`, color:"#4a9eff", icon:"🍽️" },
              { label:"Deficit", value:over?`-${overBy} 😞`:`${deficit} kcal`, color:over?"#ef4444":"#40916c", icon:"🔥" },
              { label:"Steps",   value:steps.toLocaleString(), color:"#f4a261", icon:"👟" },
            ].map(x=>(
              <div key={x.label} style={{ background:"#f8fbf9",borderRadius:14,padding:"12px 8px",textAlign:"center" }}>
                <div style={{ fontSize:20,marginBottom:4 }}>{x.icon}</div>
                <div style={{ fontSize:15,fontWeight:900,color:x.color }}>{x.value}</div>
                <div style={{ fontSize:10,color:"#aab",fontWeight:700,marginTop:2 }}>{x.label}</div>
              </div>
            ))}
          </div>

          <button className="tap" onClick={closeDay} disabled={closingDay}
            style={{ width:"100%",padding:"14px",borderRadius:16,border:"none",
              background:dayLogged?"#f0f4f7":"linear-gradient(135deg,#1b4332,#40916c)",
              color:dayLogged?"#8a9bb0":"white",fontFamily:"Nunito,sans-serif",
              fontWeight:900,fontSize:15,cursor:"pointer",
              boxShadow:dayLogged?"none":"0 4px 18px rgba(40,130,80,0.35)",
              animation:!dayLogged&&totalKcal>0?"pulse 2s infinite":"none",
              transition:"all 0.3s",marginBottom:16 }}>
            {closingDay?"Saving…":dayLogged?"✓ Today Logged — Update?":"📅 Close Day & Log Deficit"}
          </button>

          {logLoaded && totalDays > 0 ? (
            <>
              <div style={{ borderTop:"1px solid #edf2f7",paddingTop:16,marginBottom:14 }}>
                <div style={{ fontSize:12,fontWeight:900,color:"#1a2e1e",marginBottom:12 }}>
                  📊 3-Month Progress · {totalDays} days logged
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14 }}>
                  {[
                    { label:"Total Deficit", value:`${totalDeficit.toLocaleString()} kcal`, sub:"cumulative burn",     color:"#40916c", emoji:"🔥" },
                    { label:"Fat Lost",      value:`${kgLost} kg`,  sub:`≈ ${lbLost} lbs`,                color:"#e76f51", emoji:"⚖️" },
                    { label:"Avg Daily",     value:`${avgDailyDeficit} kcal`, sub:"avg deficit/day",       color:"#4a9eff", emoji:"📉" },
                    { label:"90-Day Proj.",  value:`${projectedKg90} kg`, sub:"projected fat loss",        color:"#9b72cf", emoji:"🎯" },
                  ].map(s=>(
                    <div key={s.label} style={{ background:"linear-gradient(135deg,#f8fbf9,#f0faf5)",borderRadius:14,padding:"14px 12px",border:"1px solid #e8f5ec" }}>
                      <div style={{ fontSize:20,marginBottom:6 }}>{s.emoji}</div>
                      <div style={{ fontSize:18,fontWeight:900,color:s.color }}>{s.value}</div>
                      <div style={{ fontSize:10,color:"#8a9bb0",fontWeight:700,marginTop:2 }}>{s.label}</div>
                      <div style={{ fontSize:10,color:"#aab",marginTop:1 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11,color:"#9aabb8",fontWeight:800,letterSpacing:1,marginBottom:8 }}>DAILY DEFICIT BARS (last 90 days)</div>
                  <DeficitChart log={deficitLog}/>
                </div>
                {Object.entries(byMonth).slice(-3).map(([month, days])=>{
                  const mDef  = days.reduce((s,d)=>s+d.deficit,0);
                  const mKg   = (mDef*KG_PER_KCAL).toFixed(2);
                  const mAvg  = Math.round(mDef/days.length);
                  const mDate = new Date(month+"-01").toLocaleDateString("en-CA",{month:"long",year:"numeric"});
                  return (
                    <div key={month} style={{ background:"#f8fbf9",borderRadius:14,padding:"12px 14px",marginBottom:8,border:"1px solid #edf2f7" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
                        <div style={{ fontSize:13,fontWeight:900,color:"#1a2e1e" }}>{mDate}</div>
                        <div style={{ fontSize:12,fontWeight:800,color:"#40916c" }}>-{mKg} kg</div>
                      </div>
                      <div style={{ display:"flex",gap:8 }}>
                        <div style={{ flex:1,textAlign:"center" }}>
                          <div style={{ fontSize:15,fontWeight:900,color:"#40916c" }}>{mDef.toLocaleString()}</div>
                          <div style={{ fontSize:10,color:"#aab" }}>kcal deficit</div>
                        </div>
                        <div style={{ flex:1,textAlign:"center" }}>
                          <div style={{ fontSize:15,fontWeight:900,color:"#4a9eff" }}>{mAvg}</div>
                          <div style={{ fontSize:10,color:"#aab" }}>avg/day</div>
                        </div>
                        <div style={{ flex:1,textAlign:"center" }}>
                          <div style={{ fontSize:15,fontWeight:900,color:"#f4a261" }}>{days.length}</div>
                          <div style={{ fontSize:10,color:"#aab" }}>days logged</div>
                        </div>
                      </div>
                      <div style={{ marginTop:10,height:5,borderRadius:99,background:"#edf2f7",overflow:"hidden" }}>
                        <div style={{ width:`${Math.min(mDef/45000*100,100)}%`,height:"100%",borderRadius:99,background:"linear-gradient(90deg,#52b788,#2d6a4f)" }}/>
                      </div>
                      <div style={{ fontSize:10,color:"#aab",marginTop:3 }}>{Math.round(mDef/45000*100)}% toward monthly 45K kcal goal</div>
                    </div>
                  );
                })}
                <div style={{ background:"linear-gradient(135deg,#1b4332,#2d6a4f)",borderRadius:16,padding:"16px",color:"white",marginTop:4 }}>
                  <div style={{ fontSize:12,fontWeight:800,opacity:0.7,letterSpacing:1,marginBottom:8 }}>AT THIS RATE IN 90 DAYS</div>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:28,fontWeight:900 }}>{projectedKg90} kg</div>
                      <div style={{ fontSize:12,opacity:0.7,marginTop:2 }}>≈ {(projectedKg90*2.205).toFixed(1)} lbs of fat</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13,fontWeight:800,opacity:0.85 }}>avg {avgDailyDeficit} kcal/day</div>
                      <div style={{ fontSize:11,opacity:0.6,marginTop:2 }}>keep it consistent 🔥</div>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={clearHistory} style={{ background:"none",border:"none",color:"#fca5a5",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%",textAlign:"center",padding:"4px 0" }}>
                Clear history
              </button>
            </>
          ) : (
            <div style={{ textAlign:"center",padding:"16px 0",color:"#c0cfd8" }}>
              <div style={{ fontSize:28,marginBottom:6 }}>📈</div>
              <div style={{ fontSize:14,fontWeight:700 }}>Log your first day to start tracking</div>
              <div style={{ fontSize:12,marginTop:3 }}>3-month progress appears here after closing the day</div>
            </div>
          )}
        </div>

      </div>

      {/* ════ AI MODAL ════ */}
      {modal==="ai" && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center" }}
          onClick={()=>{ if(!aiLoading){ setModal(false); setAiResult(null); }}}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"white",borderRadius:"26px 26px 0 0",padding:"28px 22px 48px",width:"100%",maxWidth:430,animation:"slideUp 0.22s ease" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
              <div style={{ fontSize:18,fontWeight:900,color:"#1a2e1e" }}>✨ AI Food Scanner</div>
              <button onClick={()=>setModal(false)} style={{ background:"none",border:"none",fontSize:22,color:"#bbb",cursor:"pointer" }}>×</button>
            </div>
            <div style={{ fontSize:13,color:"#8a9bb0",marginBottom:14 }}>Describe any food — specific = more accurate</div>
            <div style={{ display:"flex",gap:8,marginBottom:14 }}>
              <input value={aiQuery} onChange={e=>{ setAiQuery(e.target.value); setAiResult(null); setAiError(""); }}
                onKeyDown={e=>e.key==="Enter"&&handleAiLookup()}
                placeholder="e.g. 2 scrambled eggs with butter, 200g grilled chicken…"
                style={{ flex:1,padding:"12px 14px",borderRadius:14,border:"1.5px solid #e8eef2",fontFamily:"Nunito,sans-serif",fontSize:14 }}/>
              <button className="tap" onClick={handleAiLookup} disabled={aiLoading||!aiQuery.trim()}
                style={{ ...btn("linear-gradient(135deg,#4a9eff,#1d6fc4)","white",{borderRadius:14,padding:"0 18px"}), opacity:(aiLoading||!aiQuery.trim())?0.5:1 }}>
                {aiLoading?<span style={{ display:"inline-block",animation:"spin 0.7s linear infinite" }}>⟳</span>:"Scan"}
              </button>
            </div>
            {aiError&&<div style={{ color:"#ef4444",fontSize:13,fontWeight:700,marginBottom:12 }}>{aiError}</div>}
            {aiResult && (
              <div style={{ background:"#f0faf5",borderRadius:16,padding:"16px",border:"1.5px solid #b7e4c7",marginBottom:14 }}>
                <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
                  <span style={{ fontSize:30 }}>{aiResult.emoji}</span>
                  <div>
                    <div style={{ fontSize:15,fontWeight:900,color:"#1a2e1e" }}>{aiResult.name}</div>
                    <div style={{ fontSize:12,color:"#8a9bb0" }}>{aiResult.serving}</div>
                  </div>
                </div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8 }}>
                  {[{l:"kcal",v:aiResult.kcal,c:"#40916c"},{l:"Protein",v:`${aiResult.protein}g`,c:"#4a9eff"},{l:"Carbs",v:`${aiResult.carbs}g`,c:"#f4a261"},{l:"Fat",v:`${aiResult.fat}g`,c:"#e76f51"}].map(x=>(
                    <div key={x.l} style={{ background:"white",borderRadius:12,padding:"10px 6px",textAlign:"center" }}>
                      <div style={{ fontSize:17,fontWeight:900,color:x.c }}>{x.v}</div>
                      <div style={{ fontSize:10,color:"#aab",fontWeight:700,marginTop:2 }}>{x.l}</div>
                    </div>
                  ))}
                </div>
                <button className="tap" onClick={confirmAi} style={{...btn("linear-gradient(135deg,#40916c,#52b788)","white",{borderRadius:14,width:"100%",padding:"12px",fontSize:15,marginTop:12})}}>
                  Log This Food ✓
                </button>
              </div>
            )}
            {!aiResult&&!aiLoading&&(
              <div>
                <div style={{ fontSize:11,color:"#bbb",fontWeight:700,marginBottom:8,letterSpacing:1 }}>QUICK EXAMPLES</div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                  {["2 scrambled eggs","100g chicken breast","Greek yogurt 150g","Banana","Protein shake","Avocado toast"].map(ex=>(
                    <button key={ex} className="tap" onClick={()=>setAiQuery(ex)}
                      style={{ padding:"6px 12px",borderRadius:99,border:"1.5px solid #e8eef2",background:"#f8fbf9",color:"#555",fontFamily:"Nunito,sans-serif",fontWeight:700,fontSize:12,cursor:"pointer" }}>{ex}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ MANUAL MODAL ════ */}
      {modal==="manual" && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center" }}
          onClick={()=>setModal(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"white",borderRadius:"26px 26px 0 0",padding:"28px 22px 48px",width:"100%",maxWidth:430,animation:"slideUp 0.22s ease" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
              <div style={{ fontSize:18,fontWeight:900,color:"#1a2e1e" }}>+ Add Food Manually</div>
              <button onClick={()=>setModal(false)} style={{ background:"none",border:"none",fontSize:22,color:"#bbb",cursor:"pointer" }}>×</button>
            </div>
            {[{k:"name",l:"Food name *",p:"e.g. Chicken salad",t:"text"},{k:"kcal",l:"Calories (kcal) *",p:"e.g. 350",t:"number"},{k:"protein",l:"Protein (g)",p:"e.g. 30",t:"number"},{k:"carbs",l:"Carbs (g)",p:"e.g. 20",t:"number"},{k:"fat",l:"Fat (g)",p:"e.g. 10",t:"number"}].map(f=>(
              <div key={f.k} style={{ marginBottom:12 }}>
                <div style={{ fontSize:11,color:"#9aabb8",marginBottom:5,fontWeight:800,letterSpacing:0.5 }}>{f.l}</div>
                <input value={manForm[f.k]} onChange={e=>setManForm(fm=>({...fm,[f.k]:e.target.value}))}
                  placeholder={f.p} type={f.t}
                  style={{ width:"100%",padding:"11px 14px",borderRadius:13,border:"1.5px solid #e8eef2",fontFamily:"Nunito,sans-serif",fontSize:14 }}/>
              </div>
            ))}
            <button className="tap" onClick={confirmManual} disabled={!manForm.name||!manForm.kcal}
              style={{...btn("linear-gradient(135deg,#40916c,#52b788)","white",{borderRadius:16,width:"100%",padding:"14px",fontSize:16,marginTop:4}),opacity:(!manForm.name||!manForm.kcal)?0.5:1}}>
              Log Food 🍽️
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom Nav ── */}
      <div style={{ position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"white",borderTop:"1px solid #f0f0f0",padding:"10px 40px 22px",display:"flex",justifyContent:"space-around",zIndex:50,boxShadow:"0 -4px 24px rgba(0,0,0,0.07)" }}>
        {[{icon:"🏠",label:"Home"},{icon:"📊",label:"Progress"},{icon:"⚙️",label:"Settings"}].map(t=>(
          <button key={t.label} style={{ background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2 }}>
            <span style={{ fontSize:22 }}>{t.icon}</span>
            <span style={{ fontSize:10,fontWeight:800,color:"#8a9bb0" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
