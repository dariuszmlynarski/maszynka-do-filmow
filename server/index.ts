// Lokalny serwer maszynki: projekty, lektor, efekty, render.
import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import type { Scenariusz } from "../src/typy";
import {
  audioAktualne,
  hashTekstu,
  katalogProjektu,
  KATALOG_GLOWNY,
  KATALOG_PROJEKTOW,
  kluczApi,
  listaProjektow,
  utworzProjekt,
  wczytajProjekt,
  wczytajUstawienia,
  sprzatnijKosz,
  kopia,
  zapiszProjekt,
  zapiszScalajac,
  zapiszUstawienia,
} from "./magazyn";
import { generujEfekt, generujLektora, listaGlosow } from "./elevenlabs";
import { dlugoscAudio, wyrownajGlosnosc } from "./audio";
import { wgrajNagranie } from "./nagranie";
import { odswiezPaczke, renderuj, stanRenderu, trwaRender } from "./render";
import { napiszScenariusz, poprawScene, stanPisania, trwaPisanie } from "./scenarzysta";
import { podsumowanie } from "./kontrola";
import { audioRekordu, rolkiDoNagrania, sejfDostepny } from "./plan";
import { generujMuzyke, przebudujScene, przetworz, przyjmijWideo, stanA4, trwaA4, zsynchronizuj, type RodzajWideo } from "./a4";

const PORT = Number(process.env.PORT ?? 4545);
const app = express();
// Dostęp tylko z lokalnego dashboardu.
app.use(cors({ origin: [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/] }));
app.use(express.json({ limit: "5mb" }));
app.use("/projekty", express.static(KATALOG_PROJEKTOW, { setHeaders: (res) => res.setHeader("Cache-Control", "no-store") }));

const bazaUrl = (id: string) => `http://localhost:${PORT}/projekty/${id}`;
const POPRAWNY_ID = /^[a-z0-9][a-z0-9-]{0,79}$/i;

// Odrzuć podejrzane identyfikatory projektu i sceny, zanim trafią do jakiegokolwiek handlera.
app.param("id", (_req, res, next, id) => (POPRAWNY_ID.test(id) ? next() : res.status(400).json({ blad: "Nieprawidłowa nazwa projektu." })));
app.param("scenaId", (_req, res, next, id) => (POPRAWNY_ID.test(id) ? next() : res.status(400).json({ blad: "Nieprawidłowa nazwa sceny." })));

type Odp = express.Response;
const blad = (res: Odp, e: unknown, kod = 500) => {
  const komunikat = e instanceof Error ? e.message : String(e);
  console.error(komunikat);
  res.status(kod).json({ blad: komunikat });
};

// ---- Status i ustawienia ----
app.get("/api/status", (_req, res) => {
  const u = wczytajUstawienia();
  res.json({
    maKlucz: !!kluczApi(),
    kluczZEnv: !!process.env.ELEVENLABS_API_KEY,
    voiceId: u.voiceId,
    voiceName: u.voiceName,
    model: u.model ?? "eleven_multilingual_v2",
    stabilnosc: u.stabilnosc ?? 0.5,
    podobienstwo: u.podobienstwo ?? 0.8,
    styl: u.styl ?? 0.2,
    katalogProjektow: KATALOG_PROJEKTOW,
  });
});

app.put("/api/ustawienia", (req, res) => {
  const u = wczytajUstawienia();
  const b = req.body ?? {};
  if (typeof b.elevenLabsApiKey === "string" && b.elevenLabsApiKey.trim()) u.elevenLabsApiKey = b.elevenLabsApiKey.trim();
  if (typeof b.voiceId === "string") u.voiceId = b.voiceId;
  if (typeof b.voiceName === "string") u.voiceName = b.voiceName;
  if (typeof b.model === "string") u.model = b.model;
  for (const k of ["stabilnosc", "podobienstwo", "styl"] as const) {
    if (typeof b[k] === "number") u[k] = b[k];
  }
  zapiszUstawienia(u);
  res.json({ ok: true });
});

app.get("/api/glosy", async (_req, res) => {
  const klucz = kluczApi();
  if (!klucz) return blad(res, new Error("Brak klucza API ElevenLabs. Wpisz go w ustawieniach."), 400);
  try {
    res.json(await listaGlosow(klucz));
  } catch (e) {
    blad(res, e);
  }
});

// ---- Plan social media (sejf dmOS, tylko odczyt) ----
app.get("/api/plan", (_req, res) => {
  if (!sejfDostepny()) return res.json({ dostepny: false, pozycje: [] });
  res.json({ dostepny: true, pozycje: rolkiDoNagrania() });
});

// ---- Projekty ----
app.get("/api/projekty", (_req, res) => res.json(listaProjektow()));

app.post("/api/projekty", (req, res) => {
  const { tytul, zrodlo, docelowaDlugosc, rekord, typ } = req.body ?? {};
  if (!tytul || typeof tytul !== "string") return blad(res, new Error("Podaj tytuł rolki."), 400);
  res.json(utworzProjekt(tytul, zrodlo, Number(docelowaDlugosc) || 45, typeof rekord === "string" && rekord ? rekord : undefined, typ === "explainer" ? "explainer" : "rolka"));
});

app.get("/api/projekty/:id", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  res.json(p);
});

app.put("/api/projekty/:id", (req, res) => {
  const stary = wczytajProjekt(req.params.id);
  if (!stary) return blad(res, new Error("Nie ma takiego projektu."), 404);
  if (trwaPisanie(stary.id)) return blad(res, new Error("Claude właśnie pisze ten scenariusz. Poczekaj chwilę."), 409);
  const nowy = req.body as Scenariusz;
  if (nowy.id !== stary.id) return blad(res, new Error("Nie można zmienić identyfikatora projektu."), 400);
  // Zapis musi znać wersję, na której pracował (`zmieniono` z odczytu). Gdy na dysku jest już nowsza,
  // odsyłamy ją z kodem 409 zamiast nadpisywać: dashboard scala różnice, a Claude czyta jeszcze raz.
  // Bez tego ostatni zapis wygrywał i otwarta zakładka kasowała zapisy robione przez API (19.09.2026).
  if (nowy.zmieniono && nowy.zmieniono !== stary.zmieniono) {
    return res.status(409).json({ blad: "Projekt zmienił się w międzyczasie. Wczytaj go ponownie i nanieś zmiany.", konflikt: true, projekt: stary });
  }
  // Zachowaj audio ze starego projektu, jeśli tekst się nie zmienił, a klient go nie przysłał.
  for (const scena of nowy.sceny) {
    const staraScena = stary.sceny.find((s) => s.id === scena.id);
    if (staraScena?.audio && !scena.audio && (staraScena.audio.hash === hashTekstu(scena.lektor) || staraScena.audio.zrodlo === "nagranie")) {
      scena.audio = staraScena.audio;
    }
  }
  res.json(zapiszProjekt(nowy));
});

app.delete("/api/projekty/:id", (req, res) => {
  if (trwaRender(req.params.id)) return blad(res, new Error("Trwa render tego projektu, spróbuj za chwilę."), 409);
  const kat = katalogProjektu(req.params.id);
  if (!fs.existsSync(kat)) return blad(res, new Error("Nie ma takiego projektu."), 404);
  const kosz = path.join(KATALOG_PROJEKTOW, "_kosz");
  fs.mkdirSync(kosz, { recursive: true });
  fs.renameSync(kat, path.join(kosz, `${req.params.id}-${Date.now()}`));
  res.json({ ok: true });
});

app.post("/api/projekty/:id/otworz-folder", (req, res) => {
  const kat = katalogProjektu(req.params.id);
  if (!fs.existsSync(kat)) return blad(res, new Error("Nie ma takiego projektu."), 404);
  execFile("open", [kat]);
  res.json({ ok: true });
});

// ---- Scenariusz pisany przez Claude Code ----
app.post("/api/projekty/:id/scenariusz", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  if (trwaPisanie(p.id)) return res.json(stanPisania(p.id));
  const tryb = req.body?.tryb === "poprawki" ? "poprawki" : "nowy";
  const baza = kopia(p);
  void napiszScenariusz(p, tryb, (nowy) => zapiszScalajac(baza, nowy));
  res.json(stanPisania(p.id));
});

app.post("/api/projekty/:id/scena/:scenaId/popraw", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  if (trwaPisanie(p.id)) return res.json(stanPisania(p.id));
  const scena = p.sceny.find((s) => s.id === req.params.scenaId);
  if (!scena) return blad(res, new Error("Nie ma takiej sceny."), 404);
  if (typeof req.body?.opis === "string") {
    scena.opis = req.body.opis;
    zapiszProjekt(p);
  }
  const baza = kopia(p);
  void poprawScene(p, scena.id, (nowy) => zapiszScalajac(baza, nowy));
  res.json(stanPisania(p.id));
});

app.get("/api/projekty/:id/scenariusz", (req, res) => {
  res.json(stanPisania(req.params.id) ?? { stan: "brak" });
});

// ---- Kontrola jakości ----
app.get("/api/projekty/:id/kontrola", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  res.json(podsumowanie(p));
});

// ---- Galeria: wszystkie wygenerowane rolki ----
const POPRAWNY_MP4 = /^(rolka|film)[a-z0-9_-]*\.mp4$/i;

app.get("/api/galeria", (_req, res) => {
  const wynik: { projektId: string; tytul: string; plik: string; rozmiar: number; data: string }[] = [];
  for (const p of listaProjektow()) {
    const kat = katalogProjektu(p.id);
    for (const f of fs.readdirSync(kat)) {
      if (!POPRAWNY_MP4.test(f)) continue;
      const st = fs.statSync(path.join(kat, f));
      wynik.push({ projektId: p.id, tytul: p.tytul, plik: f, rozmiar: st.size, data: st.mtime.toISOString() });
    }
  }
  wynik.sort((a, b) => b.data.localeCompare(a.data));
  res.json(wynik);
});

app.delete("/api/projekty/:id/rolki/:plik", (req, res) => {
  const plik = String(req.params.plik);
  if (!POPRAWNY_MP4.test(plik)) return blad(res, new Error("Nieprawidłowa nazwa pliku."), 400);
  const sciezka = path.join(katalogProjektu(req.params.id), plik);
  if (!fs.existsSync(sciezka)) return blad(res, new Error("Nie ma takiego pliku."), 404);
  const kosz = path.join(KATALOG_PROJEKTOW, "_kosz");
  fs.mkdirSync(kosz, { recursive: true });
  fs.renameSync(sciezka, path.join(kosz, `${req.params.id}-${plik}`));
  res.json({ ok: true });
});

// ---- Lektor ----
const maNagranie = (p: Scenariusz) => p.sceny.some((s) => s.audio?.zrodlo === "nagranie");

/**
 * `wymus` przełącza rolkę z własnego nagrania z powrotem na ElevenLabs. Bez niego
 * serwer nie dorobi syntetycznego głosu jednej sceny w środku Twojego nagrania.
 */
async function lektorDlaSceny(projekt: Scenariusz, scenaId: string, wymus = false) {
  const klucz = kluczApi();
  const u = wczytajUstawienia();
  if (!klucz) throw new Error("Brak klucza API ElevenLabs. Wpisz go w ustawieniach.");
  if (!u.voiceId) throw new Error("Nie wybrano głosu. Wybierz głos w ustawieniach.");
  const scena = projekt.sceny.find((s) => s.id === scenaId);
  if (!scena) throw new Error(`Nie ma sceny ${scenaId}.`);
  if (!wymus && maNagranie(projekt)) {
    throw new Error("Ta rolka ma Twoje nagranie. Wgraj je ponownie albo wróć do ElevenLabs dla całej rolki — pojedyncza scena innym głosem zgrzyta.");
  }
  if (!scena.lektor.trim()) {
    scena.audio = undefined;
    return;
  }
  const wynik = await generujLektora({
    klucz,
    voiceId: u.voiceId,
    tekst: scena.lektor,
    model: u.model,
    stabilnosc: u.stabilnosc,
    podobienstwo: u.podobienstwo,
    styl: u.styl,
  });
  const nazwa = `audio/${scena.id}-${hashTekstu(scena.lektor)}.mp3`;
  const sciezka = path.join(katalogProjektu(projekt.id), nazwa);
  fs.mkdirSync(path.dirname(sciezka), { recursive: true });
  // Wyrównanie głośności do -16 LUFS, żeby wszystkie sceny brzmiały tak samo głośno.
  fs.writeFileSync(sciezka, await wyrownajGlosnosc(wynik.audio));
  if (scena.audio?.plik && scena.audio.plik !== nazwa) fs.rmSync(path.join(katalogProjektu(projekt.id), scena.audio.plik), { force: true });
  const zmierzony = await dlugoscAudio(sciezka);
  scena.audio = { plik: nazwa, czas: zmierzony ?? +wynik.czas.toFixed(3), slowa: wynik.slowa, hash: hashTekstu(scena.lektor) };
}

app.post("/api/projekty/:id/lektor/:scenaId", async (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  const baza = kopia(p);
  try {
    await lektorDlaSceny(p, req.params.scenaId);
    res.json(zapiszScalajac(baza, p));
  } catch (e) {
    blad(res, e);
  }
});

app.post("/api/projekty/:id/lektor", async (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  const bledy: string[] = [];
  const baza = kopia(p);
  for (const s of p.sceny) {
    if (audioAktualne(s) && !req.body?.wszystkie) continue;
    try {
      await lektorDlaSceny(p, s.id, !!req.body?.wszystkie);
      zapiszScalajac(baza, p);
    } catch (e) {
      bledy.push(`${s.id}: ${e instanceof Error ? e.message : e}`);
      break;
    }
  }
  const zapisany = zapiszScalajac(baza, p);
  if (bledy.length) return res.status(500).json({ blad: bledy.join("\n"), projekt: zapisany });
  res.json(zapisany);
});

// ---- Własne nagranie ----
async function pocnijNagranie(res: Odp, id: string, dane: Buffer, nazwaPliku: string) {
  const p = wczytajProjekt(id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  if (trwaRender(p.id)) return blad(res, new Error("Trwa render tego projektu, spróbuj za chwilę."), 409);
  const klucz = kluczApi() || undefined;
  if (!dane.length) return blad(res, new Error("Nie dotarł żaden plik audio."), 400);
  if (!p.sceny.some((s) => s.lektor.trim())) return blad(res, new Error("Scenariusz nie ma tekstu lektora, nie ma do czego dopasować nagrania."), 400);
  const baza = kopia(p);
  try {
    const { raport } = await wgrajNagranie({
      projekt: p,
      katalog: katalogProjektu(p.id),
      dane,
      rozszerzenie: path.extname(nazwaPliku).slice(1),
      klucz,
    });
    res.json({ projekt: zapiszScalajac(baza, p), raport });
  } catch (e) {
    blad(res, e);
  }
}

// Surowy plik w ciele żądania (m4a z Dyktafonu, wav, mp3), nazwa w nagłówku.
app.post("/api/projekty/:id/nagranie", express.raw({ type: () => true, limit: "300mb" }), async (req, res) => {
  const dane = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  await pocnijNagranie(res, req.params.id, dane, decodeURIComponent(String(req.get("x-nazwa-pliku") ?? "")));
});

// Nagranie leżące obok rekordu w sejfie — ten sam przebieg, tylko plik bierzemy z folderu rekordu.
app.get("/api/projekty/:id/rekord", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  const audio = p.rekord ? audioRekordu(p.rekord) : undefined;
  res.json({ rekord: p.rekord ?? null, audio: audio ? path.basename(audio) : null });
});

app.post("/api/projekty/:id/nagranie-z-rekordu", async (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  const audio = p.rekord ? audioRekordu(p.rekord) : undefined;
  if (!audio) return blad(res, new Error("W folderze rekordu nie ma pliku audio. Przeciągnij nagranie do notatki rekordu w Obsidianie."), 404);
  await pocnijNagranie(res, p.id, fs.readFileSync(audio), audio);
});

// ---- Efekty dźwiękowe ----
app.post("/api/projekty/:id/efekt/:scenaId", async (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  const klucz = kluczApi();
  if (!klucz) return blad(res, new Error("Brak klucza API ElevenLabs."), 400);
  const scena = p.sceny.find((s) => s.id === req.params.scenaId);
  if (!scena) return blad(res, new Error("Nie ma takiej sceny."), 404);
  if (!scena.efekt?.trim()) {
    scena.efektAudio = undefined;
    return res.json(zapiszProjekt(p));
  }
  const baza = kopia(p);
  try {
    const audio = await generujEfekt(klucz, scena.efekt, Number(req.body?.sekundy) || 1.5);
    const nazwa = `audio/${scena.id}-efekt-${hashTekstu(scena.efekt)}.mp3`;
    fs.writeFileSync(path.join(katalogProjektu(p.id), nazwa), audio);
    scena.efektAudio = { plik: nazwa, hash: hashTekstu(scena.efekt) };
    res.json(zapiszScalajac(baza, p));
  } catch (e) {
    blad(res, e);
  }
});

// ---- Explainer z kamery (ścieżka A4) ----
const rodzajWideo = (v: unknown): RodzajWideo => (v === "ekran" ? "ekran" : "kamera");

app.get("/api/projekty/:id/a4", (req, res) => {
  res.json(stanA4(req.params.id) ?? { stan: "brak" });
});

// Plik wideo w ciele żądania, strumieniowo prosto na dysk (nagrania mają gigabajty).
app.post("/api/projekty/:id/a4/wideo", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  if (trwaA4(p.id)) return blad(res, new Error("Trwa przetwarzanie, poczekaj chwilę."), 409);
  const rodzaj = rodzajWideo(req.query.rodzaj);
  const nazwa = decodeURIComponent(String(req.get("x-nazwa-pliku") ?? "nagranie.mov"));
  const kat = path.join(katalogProjektu(p.id), "zrodlo");
  fs.mkdirSync(kat, { recursive: true });
  const cel = path.join(kat, `oryginal-${rodzaj}${path.extname(nazwa).toLowerCase() || ".mov"}`);
  const zapis = fs.createWriteStream(cel);
  req.pipe(zapis);
  zapis.on("finish", () => {
    void przyjmijWideo(p.id, rodzaj, cel, nazwa, true);
    res.json(stanA4(p.id));
  });
  zapis.on("error", (e) => blad(res, e));
});

// Plik leżący na dysku Maca — bez kopiowania przez przeglądarkę.
app.post("/api/projekty/:id/a4/wideo-z-dysku", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  if (trwaA4(p.id)) return blad(res, new Error("Trwa przetwarzanie, poczekaj chwilę."), 409);
  const sciezka = String(req.body?.sciezka ?? "").trim().replace(/^~(?=\/)/, process.env.HOME ?? "~");
  if (!sciezka || !fs.existsSync(sciezka)) return blad(res, new Error("Nie widzę takiego pliku na dysku."), 400);
  void przyjmijWideo(p.id, rodzajWideo(req.body?.rodzaj), sciezka, path.basename(sciezka), false);
  res.json(stanA4(p.id));
});

app.post("/api/projekty/:id/a4/przetworz", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  if (!trwaA4(p.id)) void przetworz(p.id, !!req.body?.tylkoPlan);
  res.json(stanA4(p.id) ?? { stan: "pracuje" });
});

app.post("/api/projekty/:id/a4/scena/:scenaId/przebuduj", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  if (trwaA4(p.id)) return res.json(stanA4(p.id));
  void przebudujScene(p.id, req.params.scenaId, String(req.body?.opis ?? ""));
  res.json(stanA4(p.id));
});

app.post("/api/projekty/:id/a4/muzyka", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  if (trwaA4(p.id)) return res.json(stanA4(p.id));
  void generujMuzyke(p.id, String(req.body?.opis ?? ""));
  res.json(stanA4(p.id));
});

// Własny plik muzyki zamiast generowanej.
app.post("/api/projekty/:id/a4/muzyka-plik", express.raw({ type: () => true, limit: "100mb" }), (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  const dane = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!dane.length) return blad(res, new Error("Nie dotarł żaden plik."), 400);
  const ext = path.extname(decodeURIComponent(String(req.get("x-nazwa-pliku") ?? ""))).toLowerCase() || ".mp3";
  const plik = `audio/muzyka-${Date.now().toString(36)}${ext}`;
  fs.mkdirSync(path.join(katalogProjektu(p.id), "audio"), { recursive: true });
  fs.writeFileSync(path.join(katalogProjektu(p.id), plik), dane);
  const baza = kopia(p);
  p.a4 = p.a4 ?? { sceny: [] };
  p.a4.muzyka = { plik, glosnosc: p.a4.muzyka?.glosnosc ?? 0.12, opis: "własny plik" };
  res.json(zapiszScalajac(baza, p));
});

app.post("/api/projekty/:id/a4/synchronizuj", async (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p?.a4?.kamera || !p.a4.ekran) return blad(res, new Error("Potrzebne są oba nagrania: kamera i ekran."), 400);
  try {
    const kat = katalogProjektu(p.id);
    const wynik = await zsynchronizuj(path.join(kat, p.a4.kamera.plik), path.join(kat, p.a4.ekran.plik));
    const baza = kopia(p);
    p.a4.ekran = { ...p.a4.ekran, ...wynik };
    res.json(zapiszScalajac(baza, p));
  } catch (e) {
    blad(res, e);
  }
});

// ---- Render ----
app.post("/api/projekty/:id/render", (req, res) => {
  const p = wczytajProjekt(req.params.id);
  if (!p) return blad(res, new Error("Nie ma takiego projektu."), 404);
  if (trwaRender(p.id)) return res.json(stanRenderu(p.id));
  if (!p.sceny.length) return blad(res, new Error("Scenariusz nie ma żadnych scen."), 400);
  void renderuj(p, bazaUrl(p.id));
  res.json(stanRenderu(p.id));
});

app.get("/api/projekty/:id/render", (req, res) => {
  res.json(stanRenderu(req.params.id) ?? { stan: "czeka", postep: 0 });
});

// Po zmianie kodu scen (folder src/) zbuduj paczkę wideo od nowa przy następnym renderze.
fs.watch(path.join(KATALOG_GLOWNY, "src"), { recursive: true }, () => odswiezPaczke());

app.listen(PORT, "127.0.0.1", () => {
  const wKoszu = sprzatnijKosz();
  if (wKoszu) console.log(`Kosz: usunięto ${wKoszu} pozycji starszych niż 7 dni.`);
  console.log(`Serwer maszynki działa: http://localhost:${PORT}`);
  console.log(`Projekty w: ${KATALOG_PROJEKTOW}`);
});
