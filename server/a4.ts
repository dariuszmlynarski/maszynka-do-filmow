// Explainer z nagrania kamery (ścieżka A4): wgranie → konwersja → transkrypt → czyszczenie → plan scen.
// Długie kroki idą w tle; dashboard odpytuje stan. Wynik zapisujemy scalając z tym, co jest na dysku,
// bo Dariusz może w tym czasie poprawiać projekt.
import fs from "node:fs";
import path from "node:path";
import type { Scenariusz } from "../src/typy";
import {
  NAZWY_UKLADOW,
  TYPY_KLOCKOW,
  UKLADY,
  osOdcinkow,
  slowaFilmu,
  type DaneA4,
  type Klocek,
  type Odcinek,
  type ScenaA4,
  type SlowoZrodla,
  type Uklad,
  type Zrodlo,
} from "../src/a4/typy";
import { katalogProjektu, kluczApi, kopia, wczytajProjekt, zapiszScalajac } from "./magazyn";
import { dosunDoCiszy, transkrybujLokalnie, transkrybujScribe, uruchom, znajdzPythonaMlx } from "./nagranie";
import { uruchomClaude, wyciagnijJson } from "./scenarzysta";

export type StanA4 = { stan: "pracuje" | "gotowe" | "blad"; etap: string; komunikat: string; start: number; koniec?: number };
const stany = new Map<string, StanA4>();
export const stanA4 = (id: string) => stany.get(id);
export const trwaA4 = (id: string) => stany.get(id)?.stan === "pracuje";

function ustaw(id: string, etap: string, komunikat: string): StanA4 {
  const s: StanA4 = { stan: "pracuje", etap, komunikat, start: stany.get(id)?.stan === "pracuje" ? stany.get(id)!.start : Date.now() };
  stany.set(id, s);
  return s;
}
function zakoncz(id: string, komunikat: string, blad = false) {
  const s = stany.get(id);
  stany.set(id, { stan: blad ? "blad" : "gotowe", etap: s?.etap ?? "", komunikat, start: s?.start ?? Date.now(), koniec: Date.now() });
}

/** Zapis kroku: bierze świeży projekt z dysku, nanosi zmianę i zapisuje ze scalaniem. */
function zmienDane(id: string, zmiana: (d: DaneA4, p: Scenariusz) => void): Scenariusz {
  const p = wczytajProjekt(id);
  if (!p) throw new Error("Nie ma takiego projektu.");
  const baza = kopia(p);
  p.a4 = p.a4 ?? { sceny: [] };
  zmiana(p.a4, p);
  return zapiszScalajac(baza, p);
}

// ---- Wideo: sprawdzenie i konwersja ----

type Info = { szer: number; wys: number; czas: number; obrot: number; hdr: boolean; maDzwiek: boolean };

async function sprawdzWideo(plik: string): Promise<Info> {
  const json = await uruchom("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", plik]);
  const d = JSON.parse(json.slice(json.indexOf("{"))) as {
    streams: { codec_type: string; width?: number; height?: number; color_transfer?: string; side_data_list?: { rotation?: number }[]; tags?: { rotate?: string } }[];
    format: { duration?: string };
  };
  const v = d.streams.find((s) => s.codec_type === "video");
  if (!v?.width || !v.height) throw new Error("W pliku nie ma obrazu wideo.");
  const obrot = Number(v.side_data_list?.find((x) => x.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0);
  return {
    szer: v.width,
    wys: v.height,
    czas: Number(d.format.duration ?? 0),
    obrot: ((Math.round(obrot) % 360) + 360) % 360,
    hdr: ["arib-std-b67", "smpte2084"].includes(v.color_transfer ?? ""),
    maDzwiek: d.streams.some((s) => s.codec_type === "audio"),
  };
}

const parzyste = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Konwersja na stałe 30 kl./s, H.264, kolory SDR i obraz już obrócony. Remotion tnie wtedy co do klatki,
 * a iPhone'owe HDR i zmienny klatkaż przestają być problemem. Najpierw sprzętowo (VideoToolbox
 * mapuje HDR na SDR), a gdy się nie uda — programowo.
 */
async function konwertuj(wejscie: string, wyjscie: string): Promise<Info> {
  const info = await sprawdzWideo(wejscie);
  const skala = Math.min(1, 1920 / Math.max(info.szer, info.wys));
  const w = parzyste(info.szer * skala);
  const h = parzyste(info.wys * skala);
  const obrot = info.obrot === 90 ? "transpose=cclock," : info.obrot === 270 ? "transpose=clock," : info.obrot === 180 ? "hflip,vflip," : "";
  const dzwiek = info.maDzwiek ? ["-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2"] : ["-an"];
  const kolory = ["-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709"];
  const tmp = wyjscie + ".tmp.mp4";
  fs.mkdirSync(path.dirname(wyjscie), { recursive: true });
  try {
    await uruchom("ffmpeg", [
      "-v", "error", "-y", "-noautorotate", "-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox_vld", "-i", wejscie,
      "-vf", `scale_vt=w=${w}:h=${h}:color_matrix=bt709:color_primaries=bt709:color_transfer=bt709,hwdownload,format=p010le,format=yuv420p,${obrot}fps=30`,
      "-c:v", "h264_videotoolbox", "-b:v", "10M", ...kolory, ...dzwiek, "-movflags", "+faststart", "-metadata:s:v", "rotate=0", tmp,
    ]);
  } catch {
    await uruchom("ffmpeg", [
      "-v", "error", "-y", "-i", wejscie,
      "-vf", `scale='if(gt(iw,ih),min(1920,iw),-2)':'if(gt(iw,ih),-2,min(1920,ih))',fps=30,format=yuv420p`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", ...kolory, ...dzwiek, "-movflags", "+faststart", tmp,
    ]);
  }
  fs.renameSync(tmp, wyjscie);
  return sprawdzWideo(wyjscie);
}

export type RodzajWideo = "kamera" | "ekran";

/** Wgrany plik leży już w folderze projektu; konwertujemy go i (dla kamery) od razu jedziemy dalej. */
export async function przyjmijWideo(id: string, rodzaj: RodzajWideo, oryginal: string, nazwa: string, usunOryginal: boolean): Promise<void> {
  ustaw(id, "konwersja", rodzaj === "kamera" ? "Przygotowuję nagranie z kamery…" : "Przygotowuję nagranie ekranu…");
  try {
    const kat = katalogProjektu(id);
    const wzgledna = `zrodlo/${rodzaj}.mp4`;
    const info = await konwertuj(oryginal, path.join(kat, wzgledna));
    if (usunOryginal) fs.rmSync(oryginal, { force: true });
    const zrodlo: Zrodlo = { plik: wzgledna, czas: info.czas, szer: info.szer, wys: info.wys, nazwa };
    if (rodzaj === "kamera") {
      zmienDane(id, (d) => {
        d.kamera = zrodlo;
        // Nowe nagranie unieważnia stary transkrypt i plan.
        d.slowa = undefined;
        d.odcinki = [{ od: 0, do: info.czas }];
        d.sceny = [];
        d.raport = undefined;
      });
      await przetworz(id);
    } else {
      ustaw(id, "synchronizacja", "Szukam, jak nagranie ekranu pasuje do kamery…");
      const p = wczytajProjekt(id);
      const kamera = p?.a4?.kamera;
      let przesuniecie = 0;
      let pewnosc = 0;
      if (kamera) ({ przesuniecie, pewnosc } = await zsynchronizuj(path.join(kat, kamera.plik), path.join(kat, wzgledna)));
      zmienDane(id, (d) => (d.ekran = { ...zrodlo, przesuniecie, pewnosc }));
      zakoncz(id, kamera ? `Nagranie ekranu dopasowane (przesunięcie ${przesuniecie.toFixed(2)} s, pewność ${Math.round(pewnosc * 100)}%). Popraw suwakiem, jeśli trzeba.` : "Nagranie ekranu wgrane. Wgraj kamerę, żeby je zsynchronizować.");
    }
  } catch (e) {
    zakoncz(id, e instanceof Error ? e.message : String(e), true);
  }
}

// ---- Synchronizacja dwóch źródeł po dźwięku ----

const HZ = 100; // obwiednia w setnych sekundy

async function obwiednia(plik: string, sekund: number): Promise<Float32Array> {
  const surowe = await new Promise<Buffer>((resolve, reject) => {
    import("node:child_process").then(({ execFile }) =>
      execFile("ffmpeg", ["-v", "error", "-i", plik, "-t", String(sekund), "-ac", "1", "-ar", "8000", "-f", "f32le", "-"], { encoding: "buffer", maxBuffer: 1024 * 1024 * 1024 }, (err, stdout) =>
        err ? reject(err) : resolve(stdout as Buffer),
      ),
    );
  });
  const probki = new Float32Array(surowe.buffer, surowe.byteOffset, Math.floor(surowe.byteLength / 4));
  const okno = 8000 / HZ;
  const n = Math.floor(probki.length / okno);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < okno; j++) s += probki[i * okno + j] ** 2;
    env[i] = Math.log(1e-6 + Math.sqrt(s / okno));
  }
  // Pochodna dodatnia: początki sylab, niezależne od głośności i barwy mikrofonu.
  const nar = new Float32Array(n);
  for (let i = 1; i < n; i++) nar[i] = Math.max(0, env[i] - env[i - 1]);
  const sr = nar.reduce((a, b) => a + b, 0) / n;
  for (let i = 0; i < n; i++) nar[i] -= sr;
  return nar;
}

/** Przesunięcie (s), przy którym dźwięk ekranu najlepiej pokrywa się z kamerą: ekran_t = kamera_t + przesuniecie. */
export async function zsynchronizuj(kamera: string, ekran: string): Promise<{ przesuniecie: number; pewnosc: number }> {
  const a = await obwiednia(kamera, 300);
  const b = await obwiednia(ekran, 600);
  const maxLag = Math.min(b.length - 1, 300 * HZ);
  const minLag = -Math.min(a.length - 1, 120 * HZ);
  let najlepszy = 0;
  let wynik = -Infinity;
  const wyniki: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    const od = Math.max(0, -lag);
    const doI = Math.min(a.length, b.length - lag);
    for (let i = od; i < doI; i++) s += a[i] * b[i + lag];
    const norm = s / Math.max(1, doI - od);
    wyniki.push(norm);
    if (norm > wynik) {
      wynik = norm;
      najlepszy = lag;
    }
  }
  // Pewność: o ile szczyt odstaje od drugiego najlepszego miejsca poza jego otoczeniem.
  let drugi = -Infinity;
  wyniki.forEach((v, i) => {
    if (Math.abs(i + minLag - najlepszy) > HZ && v > drugi) drugi = v;
  });
  const pewnosc = wynik > 0 ? Math.max(0, Math.min(1, 1 - drugi / wynik)) : 0;
  return { przesuniecie: najlepszy / HZ, pewnosc };
}

// ---- Transkrypt i czyszczenie ----

async function przedzialyCiszy(wav: string, prog: number, minimum: number): Promise<[number, number][]> {
  const log = await uruchom("ffmpeg", ["-hide_banner", "-nostdin", "-i", wav, "-af", `silencedetect=noise=${prog}dB:d=${minimum}`, "-f", "null", "-"]);
  const wynik: [number, number][] = [];
  let od: number | null = null;
  for (const m of log.matchAll(/silence_(start|end):\s*(-?[\d.]+)/g)) {
    const t = Number(m[2]);
    if (m[1] === "start") od = Math.max(0, t);
    else {
      wynik.push([od ?? 0, t]);
      od = null;
    }
  }
  if (od !== null) wynik.push([od, Infinity]);
  return wynik;
}

/**
 * Próg ciszy dopasowany do nagrania: tło 5 dB nad dziesiątym percentylem głośności.
 * Stałe -30 dB nie działało na zewnątrz, gdzie szum wiatru i miasta leży wyżej.
 */
async function progCiszy(wav: string): Promise<number> {
  const log = await uruchom("ffmpeg", ["-hide_banner", "-nostdin", "-i", wav, "-af", "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level", "-f", "null", "-"]);
  const poziomy = [...log.matchAll(/RMS_level=(-?[\d.]+)/g)].map((m) => Number(m[1])).filter((v) => isFinite(v)).sort((a, b) => a - b);
  if (!poziomy.length) return -30;
  return Math.max(-45, Math.min(-22, poziomy[Math.floor(poziomy.length * 0.1)] + 5));
}

/** Przerwy między słowami transkryptu dłuższe niż próg — drugie źródło pauz, gdy szum zagłusza ciszę. */
function przerwyMiedzySlowami(slowa: SlowoZrodla[], minimum: number): [number, number][] {
  const wynik: [number, number][] = [];
  for (let i = 0; i < slowa.length - 1; i++) {
    const a = slowa[i].koniec + 0.05;
    const b = slowa[i + 1].start - 0.03;
    if (b - a >= minimum) wynik.push([a, b]);
  }
  return wynik;
}

/** Parametry cięcia jak w `/video-czysc`: pauza od 0,6 s wypada, zostaje oddech przed i po słowie. */
const CZYSZCZENIE = { minPauza: 0.6, przed: 0.08, po: 0.22, minFragment: 0.3 };

function zostawiane(dlugosc: number, cisze: [number, number][], ciecia: [number, number][]): Odcinek[] {
  // Słyszalne = dopełnienie długich cisz.
  let czesci: [number, number][] = [];
  let kursor = 0;
  for (const [a, b] of cisze.filter(([a, b]) => Math.min(b, dlugosc) - a >= CZYSZCZENIE.minPauza)) {
    if (a > kursor) czesci.push([kursor, a]);
    kursor = Math.max(kursor, Math.min(b, dlugosc));
  }
  if (kursor < dlugosc) czesci.push([kursor, dlugosc]);
  // Odejmij cięcia Claude'a (powtórki, „yyy").
  for (const [ca, cb] of ciecia) {
    czesci = czesci.flatMap(([a, b]): [number, number][] => {
      if (cb <= a || ca >= b) return [[a, b]];
      const r: [number, number][] = [];
      if (ca > a) r.push([a, ca]);
      if (cb < b) r.push([cb, b]);
      return r;
    });
  }
  const zOddechem = czesci
    .filter(([a, b]) => b - a >= CZYSZCZENIE.minFragment)
    .map(([a, b]): [number, number] => [Math.max(0, a - CZYSZCZENIE.przed), Math.min(dlugosc, b + CZYSZCZENIE.po)]);
  const wynik: Odcinek[] = [];
  for (const [a, b] of zOddechem) {
    const ost = wynik[wynik.length - 1];
    if (ost && a <= ost.do + 0.04) ost.do = Math.max(ost.do, b);
    else wynik.push({ od: +a.toFixed(3), do: +b.toFixed(3) });
  }
  return wynik.length ? wynik : [{ od: 0, do: dlugosc }];
}

const WTRACENIA = /^(y+|e+|ee+m*|yy+m*|hm+|mhm+|eh+|uh+|um+)$/;

/** Claude wskazuje powtórzone podejścia i wtrącenia; zostaje ostatnie, najczystsze podejście. */
async function cieciaClaude(slowa: SlowoZrodla[]): Promise<{ ciecia: [number, number][]; powody: string[] }> {
  const zapis = slowa
    .map((w, i) => {
      const pauza = i > 0 ? w.start - slowa[i - 1].koniec : 0;
      return `${pauza > 0.6 ? `\n(pauza ${pauza.toFixed(1)} s)\n` : ""}[${i}] ${w.tekst}`;
    })
    .join(" ");
  const prompt = `Czyścisz transkrypt nagrania, w którym Dariusz Młynarski mówi do kamery. Pauzy wytnie automat. Twoje zadanie: wskazać fragmenty do wycięcia, których automat nie rozpozna:
- powtórzone podejścia: Dariusz zaczyna zdanie, przerywa i mówi je jeszcze raz. Wycinasz WCZEŚNIEJSZE, nieudane podejście w całości, zostaje ostatnie;
- wtrącenia bez treści: „yyy”, „eee”, „no więc” na początku zdania, zająknięcia, urwane słowa;
- prośby i komentarze poza filmem („jeszcze raz”, „dobra, od nowa”, „nagrywa się?”).
Nie wycinaj niczego, co niesie treść. Lepiej zostawić wątpliwy fragment niż uciąć myśl. Nie zmieniaj kolejności.

TRANSKRYPT (słowa ponumerowane):
${zapis}

ODPOWIEDZ WYŁĄCZNIE JSON: {"ciecia":[{"od":12,"do":18,"powod":"powtórzone podejście"}]}. "od" i "do" to numery pierwszego i ostatniego wycinanego słowa (włącznie). Brak cięć: {"ciecia":[]}.`;
  const odp = wyciagnijJson(await uruchomClaude(prompt)) as { ciecia?: { od: number; do: number; powod?: string }[] };
  const ciecia: [number, number][] = [];
  const powody: string[] = [];
  for (const c of odp.ciecia ?? []) {
    const a = Math.max(0, Math.floor(c.od));
    const b = Math.min(slowa.length - 1, Math.floor(c.do));
    if (!(b >= a)) continue;
    // Koniec cięcia na początku następnego słowa: początki whispera są pewne, końce dryfują.
    const koniec = slowa[b + 1] ? slowa[b + 1].start - 0.03 : slowa[b].koniec + 0.1;
    ciecia.push([Math.max(0, slowa[a].start - 0.03), koniec]);
    powody.push(c.powod ?? "cięcie");
  }
  return { ciecia, powody };
}

function cieciaWtracen(slowa: SlowoZrodla[]): [number, number][] {
  return slowa
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => WTRACENIA.test(w.tekst.toLowerCase().replace(/[^\p{L}]/gu, "")))
    .map(({ w, i }) => [w.start - 0.02, slowa[i + 1] ? slowa[i + 1].start - 0.03 : w.koniec + 0.05] as [number, number]);
}

// ---- Podział na sceny ----

/** Zdanie = scena. Bardzo krótkie zdania doklejamy do następnego, bardzo długie dzielimy po pauzie. */
export function podzielNaSceny(dane: DaneA4): ScenaA4[] {
  const slowa = slowaFilmu(dane);
  const os = osOdcinkow(dane.odcinki);
  const koniecFilmu = os.length ? (os[os.length - 1].klatkaWyjscia + os[os.length - 1].klatki) / 30 : 0;
  const zdania: { od: number; do: number; tekst: string[] }[] = [];
  let biez: typeof slowa = [];
  const zamknij = () => {
    if (biez.length) zdania.push({ od: biez[0].start, do: biez[biez.length - 1].koniec, tekst: biez.map((w) => w.tekst) });
    biez = [];
  };
  slowa.forEach((w, i) => {
    biez.push(w);
    const nast = slowa[i + 1];
    const koniecZdania = /[.!?…]$/.test(w.tekst);
    const pauza = nast ? nast.start - w.koniec : 0;
    if (koniecZdania || pauza > 0.5 || biez.length >= 26) zamknij();
  });
  zamknij();
  const scalone: typeof zdania = [];
  for (const z of zdania) {
    const ost = scalone[scalone.length - 1];
    if (ost && (ost.do - ost.od < 1.6 || z.do - z.od < 1.0) && ost.tekst.length + z.tekst.length <= 30) {
      ost.do = z.do;
      ost.tekst.push(...z.tekst);
    } else scalone.push({ ...z, tekst: [...z.tekst] });
  }
  return scalone.map((z, i) => ({
    id: `s${i + 1}`,
    od: i === 0 ? 0 : +Math.max(0, z.od - 0.12).toFixed(3),
    do: i === scalone.length - 1 ? +koniecFilmu.toFixed(3) : +Math.max(0, scalone[i + 1].od - 0.12).toFixed(3),
    tekst: z.tekst.join(" "),
    uklad: "twarz" as Uklad,
    klocki: [],
  }));
}

// ---- Plan scen ----

const SPECYFIKACJA_KLOCKOW = `
KLOCKI (pola wspólne: "typ", opcjonalnie "wejscie" = słowo z wypowiedzi, przy którym klocek wchodzi):
- naglowek: {"tekst": "2–6 słów", "akcent": "fragment tekst w kolorze marki"}
- etykieta: {"tekst": "1–3 słowa, mała etykieta nad treścią"}
- kafel: {"ikona": "emoji albo logo:claude|logo:todoist|logo:ynab|logo:obsidian|logo:n8n", "tekst": "2–5 słów", "podpis": "opcjonalnie do 8 słów"}
- lista: {"punkty": ["2–5 słów", ...]} — 2 do 4 punktów
- licznik: {"wartosc": 80, "prefiks": "", "sufiks": "%", "podpis": "co to za liczba"} — liczba cyframi
- pasek: {"wartosc": 0–100, "tekst": "czego dotyczy"}
- strzalka: {"tekst": "opcjonalnie 1–2 słowa"} — między dwoma kaflami/licznikami, pokazuje przejście albo skutek
- podswietlenie: {"tekst": "zdanie do 10 słów", "akcent": "fragment do zakreślenia"}
- cytat: {"tekst": "do 14 słów", "podpis": "opcjonalnie źródło"}
- ikona: {"ikona": "emoji albo logo:…", "podpis": "1–4 słowa"}
- siatka: {"punkty": ["🔥 2–4 słowa", ...]} — 4 do 6 pól, każde może zaczynać się od emoji
- linia-czasu: {"punkty": ["krok 1–4 słowa", ...]} — 3 do 5 kroków po kolei
- porownanie: {"lewo": {"naglowek": "Źle", "punkty": ["..."]}, "prawo": {"naglowek": "Dobrze", "punkty": ["..."]}}`;

function zasadyPlanu(maEkran: boolean, pion = false): string {
  const uklady = UKLADY.filter((u) => maEkran || !u.startsWith("ekran"))
    .map((u) => `- ${u}: ${NAZWY_UKLADOW[u]}`)
    .join("\n");
  return `Planujesz obraz do filmu explainer ${pion ? "pionowego 9:16 na Reels i Shorts (klocki stoją w wąskiej kolumnie, więc najwyżej 3 na scenę i krótkie teksty)" : "16:9 na YouTube"}, w którym Dariusz Młynarski (marka osobista, „mądry kolega, nie guru”) tłumaczy temat do kamery. Jego twarz przeplata się z animowanymi grafikami, które pokazują to, o czym akurat mówi, zsynchronizowane ze słowami.

Dla każdej sceny (jedno zdanie Dariusza) wybierasz UKŁAD KADRU i skład KLOCKÓW.

UKŁADY:
${uklady}
${SPECYFIKACJA_KLOCKOW}

ZASADY
- Film zaczyna się od twarzy (pierwsza scena "twarz"), kończy się twarzą. Zdania osobiste, emocjonalne, anegdoty i zwroty do widza to "twarz" bez klocków albo z jedną etykietą.
- Grafika pojawia się tam, gdzie pomaga zrozumieć: liczby, wyliczenia, porównania, kroki, nazwy narzędzi, pojęcia. Nie ilustruj na siłę każdego zdania.
- Zmieniaj układ co 1–3 sceny, żeby obraz żył, ale nie skacz bez powodu. "grafika" (sama grafika) najwyżej na kilka scen z rzędu.
- W układzie "twarz" najwyżej jeden mały klocek (etykieta albo krótki naglowek). W pozostałych od 1 do 4 klocków.
- Treść klocków wynika z tego, co Dariusz mówi w tej scenie, i jest krótka. Ekran podsumowuje, nie powtarza zdania słowo w słowo.
- "wejscie" ustawiaj na słowo z wypowiedzi tej sceny, przy którym dana rzecz pada — wtedy klocek wchodzi dokładnie z mową. Kopiuj słowo tak, jak jest w zapisie.
- Po polsku. Bez długich myślników. Bez słów: szok, rewolucja, gamechanger. Liczby cyframi.
- "opis": jedno zdanie po polsku, co widać w scenie (Dariusz czyta je w tabeli zamiast JSON-a). Musi zgadzać się z klockami.
${maEkran ? '- Układy "ekran" i "ekran-okienko" pokazują nagranie ekranu (prezentację, Zoom) — wybieraj je, gdy Dariusz mówi o tym, co jest na slajdzie albo na ekranie. Klocków tam nie dawaj.' : ""}`;
}

let licznikKlockow = 0;
const nowyIdKlocka = () => `k${Date.now().toString(36)}${(licznikKlockow++).toString(36)}`;

const krotko = (v: unknown, max = 120) => (typeof v === "string" ? v.replace(/\s+[—–]\s+/g, ", ").trim().slice(0, max) : undefined);

/** Odsiewa z odpowiedzi modelu wszystko, czego renderer nie zna. Plan zawsze daje się narysować. */
export function oczyscKlocki(surowe: unknown): Klocek[] {
  if (!Array.isArray(surowe)) return [];
  const wynik: Klocek[] = [];
  for (const r of surowe.slice(0, 5)) {
    const k = r as Record<string, unknown>;
    if (!(TYPY_KLOCKOW as readonly string[]).includes(String(k.typ))) continue;
    const punkty = Array.isArray(k.punkty) ? k.punkty.map((p) => krotko(p, 60)).filter((p): p is string => !!p).slice(0, 6) : undefined;
    const strona = (s: unknown) => {
      const o = s as { naglowek?: unknown; punkty?: unknown } | undefined;
      return o ? { naglowek: krotko(o.naglowek, 40) ?? "", punkty: Array.isArray(o.punkty) ? o.punkty.map((p) => krotko(p, 60) ?? "").filter(Boolean).slice(0, 4) : [] } : undefined;
    };
    wynik.push({
      id: typeof k.id === "string" && /^[a-z0-9]+$/i.test(k.id) ? k.id : nowyIdKlocka(),
      typ: k.typ as Klocek["typ"],
      wejscie: krotko(k.wejscie, 40),
      tekst: krotko(k.tekst),
      akcent: krotko(k.akcent, 60),
      podpis: krotko(k.podpis, 80),
      ikona: krotko(k.ikona, 30),
      wartosc: typeof k.wartosc === "number" && isFinite(k.wartosc) ? k.wartosc : undefined,
      prefiks: krotko(k.prefiks, 6),
      sufiks: krotko(k.sufiks, 8),
      punkty,
      lewo: strona(k.lewo),
      prawo: strona(k.prawo),
      src: krotko(k.src, 200),
    });
  }
  // Pola puste wyrzucamy, żeby JSON w projekcie był czytelny.
  return wynik.map((k) => Object.fromEntries(Object.entries(k).filter(([, v]) => v !== undefined && v !== "")) as Klocek);
}

const poprawnyUklad = (u: unknown, maEkran: boolean): Uklad | null =>
  (UKLADY as readonly string[]).includes(String(u)) && (maEkran || !String(u).startsWith("ekran")) ? (u as Uklad) : null;

/** Plan dla wszystkich scen, partiami po 40, żeby długi film nie rozsadził odpowiedzi. */
async function zaplanuj(sceny: ScenaA4[], maEkran: boolean, pion: boolean, postep: (n: number) => void): Promise<ScenaA4[]> {
  const wynik = sceny.map((s) => ({ ...s }));
  const PARTIA = 40;
  for (let start = 0; start < sceny.length; start += PARTIA) {
    postep(start);
    const partia = sceny.slice(start, start + PARTIA);
    const kontekst = start > 0 ? `\nPOPRZEDNIE SCENY (już zaplanowane, dla ciągłości): ${wynik.slice(Math.max(0, start - 3), start).map((s) => `[${s.id}] ${s.uklad}`).join(", ")}\n` : "";
    const prompt = `${zasadyPlanu(maEkran, pion)}
${kontekst}
SCENY (id, czas trwania, co mówi Dariusz):
${partia.map((s) => `[${s.id}] (${(s.do - s.od).toFixed(1)} s) ${s.tekst}`).join("\n")}
${start === 0 ? "" : "\n(To środek filmu — pierwsza scena tej partii nie musi być twarzą.)"}${start + PARTIA < sceny.length ? "\n(Film trwa dalej — ostatnia scena tej partii nie musi być twarzą.)" : ""}

ODPOWIEDZ WYŁĄCZNIE JSON: {"sceny":[{"id":"s1","uklad":"twarz","opis":"...","klocki":[...]}]} — dokładnie jedna pozycja na każdą scenę powyżej, w tej samej kolejności.`;
    const odp = wyciagnijJson(await uruchomClaude(prompt)) as { sceny?: { id?: string; uklad?: string; opis?: string; klocki?: unknown }[] };
    for (const o of odp.sceny ?? []) {
      const s = wynik.find((x) => x.id === o.id);
      if (!s) continue;
      s.uklad = poprawnyUklad(o.uklad, maEkran) ?? s.uklad;
      s.klocki = oczyscKlocki(o.klocki);
      s.opis = krotko(o.opis, 200);
    }
  }
  return wynik;
}

/** Zapas, gdy Claude nie odpowie: twarz na zmianę z okienkiem i nagłówkiem z pierwszych słów zdania. */
function planZapasowy(sceny: ScenaA4[]): ScenaA4[] {
  return sceny.map((s, i) => {
    if (i === 0 || i === sceny.length - 1 || i % 3 === 0) return { ...s, uklad: "twarz" as Uklad, klocki: [], opis: "Twarz na pełnym ekranie." };
    const slowa = s.tekst.split(/\s+/).slice(0, 5).join(" ").replace(/[,.!?…]+$/, "");
    return { ...s, uklad: "okienko" as Uklad, klocki: [{ id: nowyIdKlocka(), typ: "naglowek", tekst: slowa }], opis: `Nagłówek „${slowa}”, twarz w okienku.` };
  });
}

// ---- Cały przebieg ----

export async function przetworz(id: string, tylkoPlan = false): Promise<void> {
  try {
    const p = wczytajProjekt(id);
    const kamera = p?.a4?.kamera;
    if (!p || !kamera) throw new Error("Najpierw wgraj nagranie z kamery.");
    const kat = katalogProjektu(id);
    let dane = p.a4!;
    const raport: string[] = [];

    if (!tylkoPlan || !dane.slowa?.length) {
      ustaw(id, "transkrypt", "Spisuję, co mówisz (lokalnie, na Macu)…");
      const robocze = path.join(kat, "_robocze");
      fs.mkdirSync(robocze, { recursive: true });
      const wav = path.join(robocze, "audio16k.wav");
      await uruchom("ffmpeg", ["-v", "error", "-y", "-i", path.join(kat, kamera.plik), "-ar", "16000", "-ac", "1", wav]);
      const python = await znajdzPythonaMlx();
      const klucz = kluczApi();
      let slowa: SlowoZrodla[];
      if (python) slowa = await transkrybujLokalnie(python, wav);
      else if (klucz) slowa = await transkrybujScribe(klucz, wav);
      else throw new Error("Brak silnika transkrypcji: zainstaluj mlx_whisper albo wpisz klucz ElevenLabs.");
      if (!slowa.length) throw new Error("W nagraniu nie słychać mowy.");
      const drobneCisze = await przedzialyCiszy(wav, -38, 0.18);
      slowa = dosunDoCiszy(slowa, drobneCisze);

      ustaw(id, "czyszczenie", "Wycinam pauzy, „yyy” i powtórzone podejścia…");
      const cisze = [...(await przedzialyCiszy(wav, await progCiszy(wav), CZYSZCZENIE.minPauza)), ...przerwyMiedzySlowami(slowa, CZYSZCZENIE.minPauza)].sort((a, b) => a[0] - b[0]);
      let ciecia: [number, number][] = [];
      try {
        const c = await cieciaClaude(slowa);
        ciecia = c.ciecia;
        if (c.powody.length) raport.push(`Claude wyciął ${c.powody.length} fragmentów (${[...new Set(c.powody)].join(", ")}).`);
      } catch (e) {
        ciecia = cieciaWtracen(slowa);
        raport.push(`Claude nie odpowiedział (${e instanceof Error ? e.message : e}), wycięte tylko „yyy”: ${ciecia.length}.`);
      }
      const odcinki = zostawiane(kamera.czas, cisze, ciecia);
      const zostalo = odcinki.reduce((n, o) => n + o.do - o.od, 0);
      raport.unshift(`Z ${kamera.czas.toFixed(1)} s zostało ${zostalo.toFixed(1)} s (wycięte ${(kamera.czas - zostalo).toFixed(1)} s w ${Math.max(0, odcinki.length - 1)} cięciach).`);
      dane = { ...dane, slowa, odcinki };
    }

    const sceny = podzielNaSceny(dane);
    ustaw(id, "plan", `Planuję obraz do ${sceny.length} scen…`);
    let plan: ScenaA4[];
    try {
      plan = await zaplanuj(sceny, !!dane.ekran, p.format === "pion", (n) => ustaw(id, "plan", `Planuję obraz: sceny ${n + 1}–${Math.min(sceny.length, n + 40)} z ${sceny.length}…`));
    } catch (e) {
      plan = planZapasowy(sceny);
      raport.push(`Plan zapasowy, bo Claude nie odpowiedział: ${e instanceof Error ? e.message : e}`);
    }
    zmienDane(id, (d) => {
      if (!tylkoPlan || !d.slowa?.length) {
        d.slowa = dane.slowa;
        d.odcinki = dane.odcinki;
        d.raport = raport.join(" ");
      }
      d.sceny = plan;
    });
    zakoncz(id, `Plan gotowy: ${plan.length} scen. Przejrzyj tabelę i popraw, co chcesz.`);
  } catch (e) {
    console.error(`Błąd explainera ${id}:`, e);
    zakoncz(id, e instanceof Error ? e.message : String(e), true);
  }
}

/** Przebudowa jednej sceny według opisu, który Dariusz wpisał w tabeli. */
export async function przebudujScene(id: string, scenaId: string, opis: string): Promise<void> {
  ustaw(id, "scena", "Claude przebudowuje scenę…");
  try {
    const p = wczytajProjekt(id);
    const s = p?.a4?.sceny.find((x) => x.id === scenaId);
    if (!p || !s) throw new Error("Nie ma takiej sceny.");
    const prompt = `${zasadyPlanu(!!p.a4?.ekran, p.format === "pion")}

PRZEBUDOWUJESZ JEDNĄ SCENĘ.
CO MÓWI DARIUSZ: ${s.tekst}
OBECNIE: ${JSON.stringify({ uklad: s.uklad, klocki: s.klocki })}
CZEGO CHCE DARIUSZ: ${opis}

Jeśli prośba jest częściowo niewykonalna przy dostępnych klockach, zrób najbliższą wersję i napisz w "opis", czego nie dało się zrobić.
ODPOWIEDZ WYŁĄCZNIE JSON: {"uklad":"...","opis":"...","klocki":[...]}`;
    const odp = wyciagnijJson(await uruchomClaude(prompt)) as { uklad?: string; opis?: string; klocki?: unknown };
    zmienDane(id, (d) => {
      const sc = d.sceny.find((x) => x.id === scenaId);
      if (!sc) return;
      sc.uklad = poprawnyUklad(odp.uklad, !!d.ekran) ?? sc.uklad;
      sc.klocki = oczyscKlocki(odp.klocki);
      sc.opis = krotko(odp.opis, 200) ?? opis;
    });
    zakoncz(id, "Scena przebudowana.");
  } catch (e) {
    zakoncz(id, e instanceof Error ? e.message : String(e), true);
  }
}

// ---- Muzyka (ElevenLabs Music, licencja czysta) ----

export async function generujMuzyke(id: string, opis: string): Promise<void> {
  ustaw(id, "muzyka", "ElevenLabs komponuje podkład…");
  try {
    const klucz = kluczApi();
    if (!klucz) throw new Error("Brak klucza ElevenLabs. Wpisz go w ustawieniach albo wgraj własny plik muzyki.");
    const p = wczytajProjekt(id);
    if (!p) throw new Error("Nie ma takiego projektu.");
    const os = osOdcinkow(p.a4?.odcinki);
    const sekundy = os.length ? (os[os.length - 1].klatkaWyjscia + os[os.length - 1].klatki) / 30 : 60;
    // Utwór do 5 minut; dłuższy film zapętla podkład.
    const ms = Math.round(Math.min(300, Math.max(15, sekundy + 8)) * 1000);
    const prompt = `${opis.trim() || "Spokojny, nowoczesny podkład pod film edukacyjny, lekki puls, ciepłe klawisze"}. Instrumental only, no vocals, background music for a spoken explainer video, steady, unobtrusive.`;
    const res = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": klucz, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, music_length_ms: ms, model_id: "music_v1" }),
    });
    if (!res.ok) throw new Error(`ElevenLabs Music: ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const plik = `audio/muzyka-${Date.now().toString(36)}.mp3`;
    fs.mkdirSync(path.join(katalogProjektu(id), "audio"), { recursive: true });
    fs.writeFileSync(path.join(katalogProjektu(id), plik), Buffer.from(await res.arrayBuffer()));
    zmienDane(id, (d) => (d.muzyka = { plik, glosnosc: d.muzyka?.glosnosc ?? 0.12, opis }));
    zakoncz(id, "Podkład gotowy. Głośność ustawisz suwakiem.");
  } catch (e) {
    zakoncz(id, e instanceof Error ? e.message : String(e), true);
  }
}
