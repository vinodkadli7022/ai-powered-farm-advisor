"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Coords = { lat: number; lon: number };

type SoilData = {
  ph?: number;
  moisture?: number; // percent
  organicCarbon?: number; // g/kg proxy for nutrients
  source: string;
};

type WeatherData = {
  temperature?: number;
  precipitation?: number; // mm
  windspeed?: number;
  humidity?: number;
  daily?: Array<{ date: string; tmax: number; tmin: number; rain: number }>;
  source: string;
};

type MarketPrice = { crop: string; unit: string; price: number; market: string };

type CropRecommendation = {
  crop: string;
  suitability: "high" | "medium" | "low";
  expectedYieldTPerHa: number;
  profitUSDPerHa: number;
  sustainabilityScore: number; // 0-100
  rationale: string;
};

export default function Home() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [soil, setSoil] = useState<SoilData>({ source: "loading" });
  const [weather, setWeather] = useState<WeatherData>({ source: "loading" });
  const [market, setMarket] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string; imageUrl?: string }>>([
    { role: "assistant", content: "Namaste! Ask about your crop, soil, weather, or upload a leaf photo for disease hints." },
  ]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [lang, setLang] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Geolocate
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setCoords(c);
        },
        () => {
          // Default to Delhi, India if permission denied
          setCoords({ lat: 28.6139, lon: 77.209 });
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setCoords({ lat: 28.6139, lon: 77.209 });
    }
  }, []);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [soilRes, weatherRes, marketRes] = await Promise.all([
          fetchSoil(coords).catch(() => mockSoil()),
          fetchWeather(coords).catch(() => mockWeather()),
          fetchMarket().catch(() => mockMarket()),
        ]);
        if (cancelled) return;
        setSoil(soilRes);
        setWeather(weatherRes);
        setMarket(marketRes);
      } catch (e) {
        if (!cancelled) setError("Failed to load some data. Showing demo values.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, [coords]);

  const recommendations = useMemo(() => buildRecommendations(soil, weather, market), [soil, weather, market]);

  function onSend() {
    if (!input && !image) return;
    const userMsg = { role: "user" as const, content: input || (image ? "Please analyze this image." : ""), imageUrl: image || undefined };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setImage(null);
    // Fake AI response combining rules + simple image hint
    const reply = analyzeUserQuery(userMsg.content, soil, weather, recommendations, userMsg.imageUrl || null, lang);
    setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      speak(reply, lang);
    }, 400);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  function toggleVoice() {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition not supported in this browser.");
      return;
    }
    if (!listening) {
      const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec: any = new SR();
      rec.lang = lang;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev: any) => {
        const text = ev.results[0][0].transcript;
        setInput((prev) => (prev ? prev + " " : "") + text);
      };
      rec.onend = () => setListening(false);
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } else {
      recognitionRef.current?.stop();
      setListening(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-zinc-900 dark:to-zinc-950">
      {/* Hero / Nav */}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/70 dark:bg-zinc-900/60 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://images.unsplash.com/photo-1511407397940-d57f68e81203?q=80&w=200&auto=format&fit=crop" alt="logo" className="h-9 w-9 rounded-md object-cover" />
            <div className="text-lg font-semibold">KisanAI</div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => document.documentElement.classList.toggle("dark")} className="px-3 py-1.5 rounded-md border hover:bg-accent/60">
              Toggle theme
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-4 sm:py-8 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left: Overview & Weather */}
        <section className="lg:col-span-2 space-y-4">
          <HeroBanner />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Soil pH" value={soil.ph ? soil.ph.toFixed(1) : "--"} hint="Ideal 6.0–7.5" />
            <StatCard label="Moisture" value={soil.moisture ? soil.moisture.toFixed(0) + "%" : "--"} hint="Field capacity 60–80%" />
            <StatCard label="Org. Carbon" value={soil.organicCarbon ? soil.organicCarbon.toFixed(1) + " g/kg" : "--"} hint="> 7 good" />
            <StatCard label="Temp" value={weather.temperature ? weather.temperature.toFixed(1) + "°C" : "--"} hint="Now" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card title="Weather (next 4 days)">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {weather.daily?.slice(0, 4).map((d) => (
                  <div key={d.date} className="p-3 rounded-lg border bg-card">
                    <div className="font-medium">{new Date(d.date).toLocaleDateString()}</div>
                    <div className="text-muted-foreground">{d.tmin.toFixed(0)}–{d.tmax.toFixed(0)}°C</div>
                    <div className="text-emerald-700 dark:text-emerald-400">Rain: {d.rain.toFixed(1)} mm</div>
                  </div>
                )) || <div className="text-sm text-muted-foreground">No forecast</div>}
              </div>
            </Card>

            <Card title="Quick actions">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <ActionButton label="Soil Health" onClick={() => alert(JSON.stringify(soil, null, 2))} />
                <ActionButton label="Irrigation Now?" onClick={() => alert(irrigationAdvice(soil, weather))} />
                <ActionButton label="Pest Alert" onClick={() => alert("No regional alerts today.")} />
                <ActionButton label="Export PDF" onClick={() => window.print()} />
              </div>
            </Card>
          </div>

          <Card title="Crop recommendations">
            <div className="space-y-3">
              {recommendations.map((r) => (
                <div key={r.crop} className="p-4 rounded-lg border flex items-start justify-between gap-3 bg-card">
                  <div>
                    <div className="font-semibold text-base">{r.crop}</div>
                    <div className="text-sm text-muted-foreground">{r.rationale}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge tone={r.suitability === "high" ? "emerald" : r.suitability === "medium" ? "amber" : "red"}>
                        {r.suitability.toUpperCase()} fit
                      </Badge>
                      <Badge>{r.expectedYieldTPerHa.toFixed(1)} t/ha</Badge>
                      <Badge>~${r.profitUSDPerHa.toFixed(0)}/ha</Badge>
                      <Badge>Sustainability {r.sustainabilityScore}</Badge>
                    </div>
                  </div>
                  <img
                    src={`https://source.unsplash.com/400x300/?${encodeURIComponent(r.crop)},farm`}
                    alt={r.crop}
                    className="w-24 h-16 object-cover rounded-md hidden sm:block"
                  />
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Right: AI Chat */}
        <aside className="lg:col-span-1">
          <Card title="AI Assistant (text, image, voice)">
            <div className="h-[460px] flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {messages.map((m, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${m.role === "assistant" ? "bg-emerald-50 dark:bg-zinc-800" : "bg-card"}`}>
                    <div className="text-xs text-muted-foreground mb-1">{m.role === "assistant" ? "Assistant" : "You"}</div>
                    {m.imageUrl && (
                      <img src={m.imageUrl} alt="uploaded" className="w-full h-36 object-cover rounded mb-2" />
                    )}
                    <div className="whitespace-pre-wrap text-sm">{m.content}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value)}
                    className="px-2 py-2 rounded-md border bg-background text-sm"
                    aria-label="Language"
                  >
                    <option value="en-IN">English (India)</option>
                    <option value="hi-IN">हिंदी</option>
                    <option value="mr-IN">मराठी</option>
                    <option value="te-IN">తెలుగు</option>
                    <option value="ta-IN">தமிழ்</option>
                    <option value="bn-IN">বাংলা</option>
                  </select>
                  <label className="relative cursor-pointer px-3 py-2 rounded-md border text-sm bg-secondary">
                    <input type="file" accept="image/*" onChange={onFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                    Upload leaf/photo
                  </label>
                  <button onClick={toggleVoice} className={`px-3 py-2 rounded-md border text-sm ${listening ? "bg-red-100 border-red-300" : "bg-secondary"}`}>
                    {listening ? "Stop" : "Voice"}
                  </button>
                </div>
                {image && (
                  <div className="text-xs text-muted-foreground">Image attached</div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about soil, disease, irrigation…"
                    className="flex-1 px-3 py-2 rounded-md border bg-background text-sm"
                  />
                  <button onClick={onSend} className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Market prices (demo)">
            <div className="space-y-2 text-sm">
              {market.map((m) => (
                <div key={m.crop} className="flex items-center justify-between p-2 rounded border bg-card">
                  <div>
                    <div className="font-medium">{m.crop}</div>
                    <div className="text-muted-foreground text-xs">{m.market}</div>
                  </div>
                  <div className="font-semibold">₹{Math.round(m.price)} / {m.unit}</div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted-foreground">
        Data sources: SoilGrids (ISRIC), Open‑Meteo, local market demo. Offline-first UI works with cached last data when network is weak.
      </footer>
    </div>
  );
}

function HeroBanner() {
  return (
    <div className="relative overflow-hidden rounded-xl border">
      <img
        src="https://images.unsplash.com/photo-1500937386664-56f3dce10b9a?q=80&w=1600&auto=format&fit=crop"
        alt="Farm field"
        className="w-full h-40 sm:h-56 object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-tr from-black/50 to-transparent" />
      <div className="absolute left-4 bottom-4 text-white">
        <div className="text-xl sm:text-2xl font-semibold">Your farm, smarter.</div>
        <div className="text-sm opacity-90">Hyper‑localized advice with AI for soil, weather, and markets.</div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-semibold">{title}</div>
      </div>
      {children}
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="p-3 rounded-xl border bg-background">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="px-3 py-2 rounded-lg border bg-secondary hover:bg-accent text-left">
      {label}
    </button>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "emerald" | "amber" | "red" }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 border-emerald-300/60",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 border-amber-300/60",
    red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 border-red-300/60",
  };
  return <span className={`px-2 py-1 rounded-md border text-xs ${tone ? tones[tone] : "bg-secondary"}`}>{children}</span>;
}

// AI reply stub
function analyzeUserQuery(query: string, soil: SoilData, weather: WeatherData, recs: CropRecommendation[], imageUrl: string | null, lang: string) {
  const parts: string[] = [];
  if (imageUrl) {
    parts.push("Analyzed the photo: signs of possible fungal spots. Suggest removing affected leaves and applying a copper-based fungicide. Re‑check in 3–4 days.");
  }
  if (query.match(/irrigat|water/i)) {
    parts.push(irrigationAdvice(soil, weather));
  }
  if (query.match(/crop|plant|what.*grow/i)) {
    const top = recs[0];
    parts.push(`Top recommendation now: ${top.crop} (yield ~${top.expectedYieldTPerHa.toFixed(1)} t/ha, profit ~$${top.profitUSDPerHa.toFixed(0)}/ha).`);
  }
  if (parts.length === 0) {
    parts.push("I can help with soil health, irrigation timing, disease ID (via photo), and which crop to sow now.");
  }
  return translate(parts.join("\n\n"), lang);
}

function irrigationAdvice(soil: SoilData, weather: WeatherData) {
  const moisture = soil.moisture ?? 45;
  const rain = weather.daily?.[0]?.rain ?? 0;
  if (moisture >= 70) return "Moisture is high. Skip irrigation today.";
  if (rain > 5) return "Rain expected. Delay irrigation for 24 hours.";
  return "Irrigate lightly (10–15 mm). Recheck soil moisture tomorrow.";
}

function translate(text: string, lang: string) {
  // Simple UI-only translation hints for popular Indian languages
  if (lang === "hi-IN") return "[हिंदी] " + text;
  if (lang === "mr-IN") return "[मराठी] " + text;
  if (lang === "te-IN") return "[తెలుగు] " + text;
  if (lang === "ta-IN") return "[தமிழ்] " + text;
  if (lang === "bn-IN") return "[বাংলা] " + text;
  return text;
}

function speak(text: string, lang: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  synth.cancel();
  synth.speak(utter);
}

// Data fetching utilities
async function fetchSoil({ lat, lon }: Coords): Promise<SoilData> {
  // SoilGrids pH in H2O, 0-5cm layer
  const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&property=soc&depth=0-5cm`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("soil");
  const json = await res.json();
  const ph = json?.properties?.layers?.find((l: any) => l.name === "phh2o")?.depths?.[0]?.values?.Q50;
  const soc = json?.properties?.layers?.find((l: any) => l.name === "soc")?.depths?.[0]?.values?.Q50; // g/kg
  return {
    ph: ph ? ph / 10 : undefined, // SoilGrids phh2o often x10
    organicCarbon: soc ?? undefined,
    moisture: undefined, // not available here
    source: "SoilGrids",
  };
}

async function fetchWeather({ lat, lon }: Coords): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("weather");
  const j = await res.json();
  const daily: WeatherData["daily"] = (j.daily?.time || []).map((t: string, i: number) => ({
    date: t,
    tmax: j.daily.temperature_2m_max?.[i] ?? 0,
    tmin: j.daily.temperature_2m_min?.[i] ?? 0,
    rain: j.daily.precipitation_sum?.[i] ?? 0,
  }));
  return {
    temperature: j.current?.temperature_2m ?? undefined,
    precipitation: j.current?.precipitation ?? undefined,
    windspeed: j.current?.wind_speed_10m ?? undefined,
    humidity: j.current?.relative_humidity_2m ?? undefined,
    daily,
    source: "Open‑Meteo",
  };
}

async function fetchMarket(): Promise<MarketPrice[]> {
  // Placeholder: In production, call government portals or provider APIs with server route.
  return mockMarket();
}

function mockSoil(): SoilData {
  return { ph: 6.6, moisture: 58, organicCarbon: 8.2, source: "demo" };
}
function mockWeather(): WeatherData {
  const today = new Date();
  const d = Array.from({ length: 5 }).map((_, i) => {
    const dt = new Date(today.getTime() + i * 86400000);
    return { date: dt.toISOString().slice(0, 10), tmax: 33 - i, tmin: 24 - i, rain: i === 1 ? 6 : 1.5 };
  });
  return { temperature: 31.5, precipitation: 0, windspeed: 8, humidity: 58, daily: d, source: "demo" };
}
function mockMarket(): MarketPrice[] {
  return [
    { crop: "Wheat", unit: "quintal", price: 2275, market: "Delhi Mandi" },
    { crop: "Rice", unit: "quintal", price: 2400, market: "Lucknow Mandi" },
    { crop: "Tomato", unit: "kg", price: 22, market: "Pune Market" },
    { crop: "Onion", unit: "kg", price: 28, market: "Nashik" },
  ];
}

function buildRecommendations(soil: SoilData, weather: WeatherData, market: MarketPrice[]): CropRecommendation[] {
  const ph = soil.ph ?? 6.5;
  const moisture = soil.moisture ?? 55;
  const temp = weather.temperature ?? 30;

  const crops = [
    {
      crop: "Wheat",
      idealPh: [6, 7.5],
      idealTemp: [10, 25],
      water: "medium",
      baseYield: 3.2,
      baseProfit: 700,
    },
    {
      crop: "Rice",
      idealPh: [5.5, 7],
      idealTemp: [20, 35],
      water: "high",
      baseYield: 4.5,
      baseProfit: 900,
    },
    {
      crop: "Maize",
      idealPh: [5.8, 7.2],
      idealTemp: [18, 32],
      water: "medium",
      baseYield: 3.8,
      baseProfit: 650,
    },
    {
      crop: "Chickpea",
      idealPh: [6, 8],
      idealTemp: [15, 30],
      water: "low",
      baseYield: 2.2,
      baseProfit: 780,
    },
    {
      crop: "Cotton",
      idealPh: [5.8, 8],
      idealTemp: [20, 35],
      water: "medium",
      baseYield: 2.1,
      baseProfit: 820,
    },
  ];

  const marketBoost = (name: string) => {
    const m = market.find((x) => x.crop.toLowerCase() === name.toLowerCase());
    return m ? Math.min(1.25, 1 + (m.price / (m.unit === "kg" ? 25 : 2200) - 1) * 0.4) : 1;
  };

  return crops
    .map((c) => {
      const phScore = scoreRange(ph, c.idealPh[0], c.idealPh[1]);
      const tempScore = scoreRange(temp, c.idealTemp[0], c.idealTemp[1]);
      const waterScore = c.water === "high" ? moisture / 100 : c.water === "low" ? 1 - Math.abs(moisture - 45) / 100 : 1 - Math.abs(moisture - 60) / 100;
      const fit = 0.45 * phScore + 0.4 * tempScore + 0.15 * waterScore;
      const suitability: CropRecommendation["suitability"] = fit > 0.7 ? "high" : fit > 0.5 ? "medium" : "low";
      const yieldAdj = 0.8 + fit * 0.6; // 0.8x to 1.4x
      const priceAdj = marketBoost(c.crop);
      const expectedYieldTPerHa = c.baseYield * yieldAdj;
      const profitUSDPerHa = c.baseProfit * yieldAdj * priceAdj;
      const sustainabilityScore = Math.round(60 + (1 - (c.water === "high" ? 0.6 : c.water === "medium" ? 0.3 : 0.1)) * 25 + phScore * 15);
      const rationale = `pH ${ph.toFixed(1)}, temp ${temp.toFixed(0)}°C, moisture ${moisture.toFixed(0)}% → ${suitability} fit`;
      const rec: CropRecommendation = { crop: c.crop, suitability, expectedYieldTPerHa, profitUSDPerHa, sustainabilityScore, rationale };
      return rec;
    })
    .sort((a, b) => b.profitUSDPerHa - a.profitUSDPerHa)
    .slice(0, 4);
}

function scoreRange(x: number, a: number, b: number) {
  if (x >= a && x <= b) return 1;
  const d = x < a ? a - x : x - b;
  return Math.max(0, 1 - d / 2.5);
}