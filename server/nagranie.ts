// Własne nagranie Dariusza jako lektor: jeden plik z całym scenariuszem,
// pocięty na kawałki odpowiadające scenom. Wynik ma ten sam kształt co lektor
// z ElevenLabs (plik + czasy słów), więc render i napisy nie widzą różnicy.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AudioSceny, Scenariusz, Slowo } from "../src/typy";
import { hashTekstu } from "../src/hash";
import { GLOSNOSC_LUFS, SZCZYT_DBTP, dlugoscAudio } from "./audio";

const BAZA = "https://api.elevenlabs.io/v1";

/** Margines przed pierwszym i po ostatnim słowie sceny — ciasno, jak u ElevenLabs. */
const PRZED_SLOWEM = 0.1;
const PO_SLOWIE = 0.15;
const PO_OSTATNIM = 0.25;
/** Niedopasowane słowa przy krawędzi nagrania zostają, jeśli lecą ciągiem z resztą. */
const CIAGLOSC = 0.6;
/** Poniżej tej zgodności ze scenariuszem scena trafia do raportu. */
const PROG_ZGODNOSCI = 0.8;

export function uruchom(program: string, argumenty: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(program, argumenty, { maxBuffer: 40 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr?.toString().slice(-500) || err.message));
      resolve(stdout.toString() + stderr.toString());
    });
  });
}

// ---- Transkrypcja ----

type SlowoNagrania = { tekst: string; start: number; koniec: number };

/**
 * Lokalna transkrypcja przez mlx_whisper (Apple Silicon): głos nie wychodzi z Maca
 * i nic nie kosztuje. whisper-cli odpadł, bo jego czasy słów są za grube na karaoke
 * (słowo potrafi „trwać" 10 ms). ElevenLabs Scribe to zapas, gdy mlx_whisper nie ma.
 */
const MODEL_MLX = process.env.WHISPER_MLX_MODEL || "mlx-community/whisper-large-v3-turbo";
const SKRYPT_MLX = `
import json, sys, mlx_whisper
r = mlx_whisper.transcribe(sys.argv[1], path_or_hf_repo=sys.argv[2], language="pl", word_timestamps=True)
print(json.dumps([{"t": w["word"], "s": w["start"], "k": w["end"]} for seg in r["segments"] for w in seg.get("words", [])]))
`;

let pythonMlx: string | null | undefined;
export async function znajdzPythonaMlx(): Promise<string | null> {
  if (pythonMlx !== undefined) return pythonMlx;
  for (const kandydat of [process.env.WHISPER_PYTHON, "/usr/bin/python3", "python3"].filter((k): k is string => !!k)) {
    try {
      await uruchom(kandydat, ["-c", "import mlx_whisper"]);
      return (pythonMlx = kandydat);
    } catch {
      /* następny */
    }
  }
  return (pythonMlx = null);
}

export async function transkrybujLokalnie(python: string, wav: string): Promise<SlowoNagrania[]> {
  const wyjscie = await new Promise<string>((resolve, reject) => {
    execFile(python, ["-c", SKRYPT_MLX, wav, MODEL_MLX], { maxBuffer: 40 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`Lokalna transkrypcja nie powiodła się: ${stderr?.toString().slice(-400) || err.message}`));
      resolve(stdout.toString());
    });
  });
  const linia = wyjscie.trim().split("\n").pop() ?? "[]";
  return (JSON.parse(linia) as { t: string; s: number; k: number }[])
    .map((w) => ({ tekst: w.t.trim(), start: w.s, koniec: Math.max(w.k, w.s + 0.05) }))
    .filter((w) => /[\p{L}\p{N}]/u.test(w.tekst));
}

/**
 * Whisper rozciąga pierwsze słowo po pauzie na całą ciszę przed nim („Moja" od 2,64 s,
 * choć głos rusza na 3,23 s). Początek albo koniec słowa, który wpada w wykrytą ciszę,
 * dosuwamy do jej krawędzi — działa tak samo dla każdego silnika.
 */
export function dosunDoCiszy(slowa: SlowoNagrania[], ciszaNagrania: [number, number][]): SlowoNagrania[] {
  return slowa.map((w) => {
    let { start, koniec } = w;
    const przedStartem = ciszaNagrania.find(([od, doKiedy]) => start >= od - 0.02 && start < doKiedy && doKiedy < koniec);
    if (przedStartem) start = przedStartem[1];
    const poKoncu = ciszaNagrania.find(([od, doKiedy]) => koniec > od && koniec <= doKiedy + 0.02 && od > start);
    if (poKoncu) koniec = poKoncu[0];
    return { ...w, start, koniec: Math.max(koniec, start + 0.05) };
  });
}

export async function transkrybujScribe(klucz: string, plik: string): Promise<SlowoNagrania[]> {
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("language_code", "pol");
  form.append("timestamps_granularity", "word");
  form.append("tag_audio_events", "false");
  form.append("file", new Blob([fs.readFileSync(plik)], { type: "audio/wav" }), path.basename(plik));
  const res = await fetch(`${BAZA}/speech-to-text`, { method: "POST", headers: { "xi-api-key": klucz }, body: form });
  if (!res.ok) {
    const tekst = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("ElevenLabs odrzucił klucz przy transkrypcji. Klucz musi mieć uprawnienie Speech to Text.");
    throw new Error(`Transkrypcja nagrania nie powiodła się (${res.status}): ${tekst.slice(0, 300)}`);
  }
  const j = (await res.json()) as { words?: { text: string; start: number; end: number; type: string }[] };
  return (j.words ?? [])
    .filter((w) => w.type === "word" && w.text.trim())
    .map((w) => ({ tekst: w.text.trim(), start: w.start, koniec: w.end }));
}

/** Przedziały ciszy w nagraniu (ffmpeg silencedetect), w sekundach. */
async function cisze(wav: string): Promise<[number, number][]> {
  const log = await uruchom("ffmpeg", ["-hide_banner", "-nostdin", "-i", wav, "-af", "silencedetect=noise=-38dB:d=0.18", "-f", "null", "-"]);
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

// ---- Dopasowanie transkrypcji do scen ----

const normuj = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let poprzedni = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, poprzedni + (a[i - 1] === b[j - 1] ? 0 : 1));
      poprzedni = tmp;
    }
  }
  return d[b.length];
}

/** 2 = to samo słowo, 1 = prawie (odmiana, literówka transkrypcji), -1 = inne. */
function podobienstwo(a: string, b: string): number {
  if (!a || !b) return -1;
  if (a === b) return 2;
  const dl = Math.max(a.length, b.length);
  return dl >= 4 && 1 - levenshtein(a, b) / dl >= 0.75 ? 1 : -1;
}

type SlowoScenariusza = { tekst: string; norma: string; scena: number };

/**
 * Wyrównanie globalne (Needleman–Wunsch) słów scenariusza i słów z nagrania.
 * Zwraca dla każdego słowa nagrania indeks dopasowanego słowa scenariusza albo -1.
 */
function wyrownaj(scenariusz: SlowoScenariusza[], nagranie: SlowoNagrania[]): number[] {
  const n = scenariusz.length;
  const m = nagranie.length;
  const LUKA = -1;
  const wynik = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) wynik[i][0] = i * LUKA;
  for (let j = 1; j <= m; j++) wynik[0][j] = j * LUKA;
  const normyN = nagranie.map((w) => normuj(w.tekst));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      wynik[i][j] = Math.max(
        wynik[i - 1][j - 1] + podobienstwo(scenariusz[i - 1].norma, normyN[j - 1]),
        wynik[i - 1][j] + LUKA,
        wynik[i][j - 1] + LUKA,
      );
    }
  }
  const para = new Array<number>(m).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const pod = podobienstwo(scenariusz[i - 1].norma, normyN[j - 1]);
    if (wynik[i][j] === wynik[i - 1][j - 1] + pod) {
      if (pod > 0) para[j - 1] = i - 1;
      i--;
      j--;
    } else if (wynik[i][j] === wynik[i - 1][j] + LUKA) i--;
    else j--;
  }
  return para;
}

/**
 * Krótki blok, w którym transkrypcja i scenariusz się rozjechały między dwoma
 * pewnymi dopasowaniami („CloudCode" zamiast „Claude Code", „Ynab" zamiast „YNAB"),
 * to prawie zawsze pisownia, nie inna treść. Taki blok dostaje słowa scenariusza
 * rozłożone na czasie tego fragmentu nagrania. Dłuższe odstępstwa zostają jak powiedziane.
 */
const MAX_PODMIANA = 4;

function podmienPisownie(
  slowaScen: SlowoScenariusza[],
  nagranie: SlowoNagrania[],
  para: number[],
): { nagranie: SlowoNagrania[]; para: number[] } {
  const noweSlowa: SlowoNagrania[] = [];
  const nowaPara: number[] = [];
  let ostatniJ = -1;
  let ostatniP = -1;
  const domknij = (doJ: number, doP: number) => {
    const blokN = nagranie.slice(ostatniJ + 1, doJ);
    const blokS = slowaScen.slice(ostatniP + 1, doP);
    const jednaScena = blokS.length > 0 && blokS.every((w) => w.scena === blokS[0].scena);
    if (ostatniJ >= 0 && blokN.length && jednaScena && blokN.length <= MAX_PODMIANA && blokS.length <= MAX_PODMIANA) {
      const start = blokN[0].start;
      const koniec = blokN[blokN.length - 1].koniec;
      const znaki = blokS.reduce((n, w) => n + w.tekst.length, 0) || 1;
      let kursor = start;
      blokS.forEach((w, n) => {
        const doKiedy = n === blokS.length - 1 ? koniec : kursor + (koniec - start) * (w.tekst.length / znaki);
        noweSlowa.push({ tekst: w.tekst, start: kursor, koniec: doKiedy });
        nowaPara.push(ostatniP + 1 + n);
        kursor = doKiedy;
      });
    } else {
      blokN.forEach((w) => {
        noweSlowa.push(w);
        nowaPara.push(-1);
      });
    }
  };
  para.forEach((p, j) => {
    if (p < 0) return;
    domknij(j, p);
    noweSlowa.push(nagranie[j]);
    nowaPara.push(p);
    ostatniJ = j;
    ostatniP = p;
  });
  // Ogon po ostatnim dopasowaniu zostaje bez zmian.
  for (let j = ostatniJ + 1; j < nagranie.length; j++) {
    noweSlowa.push(nagranie[j]);
    nowaPara.push(-1);
  }
  return { nagranie: noweSlowa, para: nowaPara };
}

type Kawalek = { od: number; do: number; slowa: Slowo[]; zgodnosc: number };

/** Dzieli nagranie na kawałki scen. Sceny bez tekstu lektora dostają `null`. */
export function podzielNaSceny(
  projekt: Scenariusz,
  surowe: SlowoNagrania[],
  dlugosc: number,
  ciszaNagrania: [number, number][] = [],
): (Kawalek | null)[] {
  let nagranie = surowe;
  let para: number[];
  const slowaScen: SlowoScenariusza[] = [];
  projekt.sceny.forEach((s, n) => {
    for (const tekst of s.lektor.trim().split(/\s+/).filter(Boolean)) {
      const norma = normuj(tekst);
      if (norma) slowaScen.push({ tekst, norma, scena: n });
    }
  });
  if (!surowe.length) throw new Error("W nagraniu nie rozpoznałem żadnych słów. Sprawdź, czy plik ma dźwięk.");

  ({ nagranie, para } = podmienPisownie(slowaScen, nagranie, wyrownaj(slowaScen, nagranie)));
  const scenaSlowa = para.map((p) => (p >= 0 ? slowaScen[p].scena : -1));

  // Pierwsze i ostatnie dopasowane słowo nagrania dla każdej sceny.
  const zakres = projekt.sceny.map(() => ({ pierwsze: -1, ostatnie: -1, trafione: 0 }));
  scenaSlowa.forEach((sc, j) => {
    if (sc < 0) return;
    const z = zakres[sc];
    if (z.pierwsze < 0) z.pierwsze = j;
    z.ostatnie = j;
    z.trafione++;
  });

  const zTekstem = projekt.sceny.map((s, n) => (s.lektor.trim() ? n : -1)).filter((n) => n >= 0);
  const pominiete = zTekstem.filter((n) => zakres[n].trafione === 0);
  if (pominiete.length) {
    throw new Error(
      `Nie znalazłem w nagraniu scen: ${pominiete.map((n) => n + 1).join(", ")}. Nagraj cały scenariusz po kolei, od pierwszej do ostatniej sceny.`,
    );
  }

  // Granice między scenami: w najdłuższej ciszy między ostatnim słowem jednej a pierwszym następnej.
  const przydzial = new Array<number>(nagranie.length).fill(-1);
  zTekstem.forEach((sc, k) => {
    for (let j = zakres[sc].pierwsze; j <= zakres[sc].ostatnie; j++) przydzial[j] = sc;
    const nastepna = zTekstem[k + 1];
    if (nastepna === undefined) return;
    const lo = zakres[sc].ostatnie;
    const hi = zakres[nastepna].pierwsze;
    let ciecie = lo;
    let najdluzsza = -Infinity;
    for (let j = lo; j < hi; j++) {
      const przerwa = nagranie[j + 1].start - nagranie[j].koniec;
      if (przerwa > najdluzsza) {
        najdluzsza = przerwa;
        ciecie = j;
      }
    }
    for (let j = lo + 1; j <= ciecie; j++) przydzial[j] = sc;
    for (let j = ciecie + 1; j < hi; j++) przydzial[j] = nastepna;
  });

  // Krawędzie nagrania: „dobra, nagrywam" odpada, ale słowo wypowiedziane ciągiem ze scenariuszem zostaje.
  const pierwszaSc = zTekstem[0];
  for (let j = zakres[pierwszaSc].pierwsze - 1; j >= 0 && nagranie[j + 1].start - nagranie[j].koniec < CIAGLOSC; j--) przydzial[j] = pierwszaSc;
  const ostatniaSc = zTekstem[zTekstem.length - 1];
  for (let j = zakres[ostatniaSc].ostatnie + 1; j < nagranie.length && nagranie[j].start - nagranie[j - 1].koniec < CIAGLOSC; j++) przydzial[j] = ostatniaSc;

  // Pierwsze i ostatnie słowo każdej sceny po przydziale — z nich wynika cięcie.
  const granice = projekt.sceny.map(() => ({ od: -1, do: -1 }));
  przydzial.forEach((sc, j) => {
    if (sc < 0) return;
    if (granice[sc].od < 0) granice[sc].od = j;
    granice[sc].do = j;
  });

  return projekt.sceny.map((_, sc) => {
    const g = granice[sc];
    if (g.od < 0) return null;
    const k = zTekstem.indexOf(sc);
    const poprzednia = k > 0 ? granice[zTekstem[k - 1]] : null;
    const nastepna = k < zTekstem.length - 1 ? granice[zTekstem[k + 1]] : null;
    const pierwsze = nagranie[g.od];
    const ostatnie = nagranie[g.do];
    // Końce słów w transkrypcji dryfują, więc koniec mowy bierzemy z pierwszej ciszy po początku ostatniego słowa.
    const cisza = ciszaNagrania.find(([od]) => od > ostatnie.start + 0.05);
    const koniecMowy = cisza && cisza[0] < (nastepna ? nagranie[nastepna.od].start : Infinity) ? Math.max(ostatnie.start + 0.1, cisza[0]) : ostatnie.koniec;
    // Cięcie nie wchodzi w słowa sąsiedniej sceny: najwyżej do połowy ciszy między nimi.
    const od = Math.max(0, pierwsze.start - PRZED_SLOWEM, poprzednia ? Math.min(pierwsze.start - 0.02, (nagranie[poprzednia.do].koniec + pierwsze.start) / 2) : 0);
    const doKiedy = Math.min(
      dlugosc,
      koniecMowy + (nastepna ? PO_SLOWIE : PO_OSTATNIM),
      nastepna ? (koniecMowy + nagranie[nastepna.od].start) / 2 : Infinity,
    );
    const slowa: Slowo[] = [];
    for (let j = g.od; j <= g.do; j++) {
      const w = nagranie[j];
      // Tam, gdzie słowo zgadza się ze scenariuszem, napis bierze pisownię scenariusza (interpunkcja, „AI").
      const tekst = para[j] >= 0 ? slowaScen[para[j]].tekst : w.tekst;
      const koniecSlowa = Math.min(w.koniec, doKiedy);
      slowa.push({ tekst, start: +(w.start - od).toFixed(3), koniec: +(Math.max(w.start + 0.05, koniecSlowa) - od).toFixed(3) });
    }
    const wszystkie = slowaScen.filter((s) => s.scena === sc).length;
    return { od, do: doKiedy, slowa, zgodnosc: wszystkie ? zakres[sc].trafione / wszystkie : 1 };
  });
}

// ---- Cały przebieg ----

export type WynikNagrania = { raport: string };

/**
 * Wyrównuje głośność całego nagrania, robi transkrypcję, tnie na sceny
 * i podpina kawałki pod `scena.audio`. Modyfikuje projekt w miejscu.
 */
export async function wgrajNagranie(opcje: {
  projekt: Scenariusz;
  katalog: string;
  dane: Buffer;
  rozszerzenie: string;
  /** Klucz ElevenLabs — potrzebny tylko wtedy, gdy na Macu nie ma modelu whispera. */
  klucz?: string;
}): Promise<WynikNagrania> {
  const { projekt, katalog, dane, klucz } = opcje;
  const rozszerzenie = /^[a-z0-9]{1,5}$/i.test(opcje.rozszerzenie) ? opcje.rozszerzenie.toLowerCase() : "bin";
  const katalogAudio = path.join(katalog, "audio");
  fs.mkdirSync(katalogAudio, { recursive: true });

  // Oryginał zostaje w projekcie, gdyby trzeba było pociąć go jeszcze raz.
  for (const f of fs.readdirSync(katalogAudio)) if (f.startsWith("nagranie-zrodlo.")) fs.rmSync(path.join(katalogAudio, f));
  const oryginal = path.join(katalogAudio, `nagranie-zrodlo.${rozszerzenie}`);
  fs.writeFileSync(oryginal, dane);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "maszynka-nagranie-"));
  try {
    // Jedna głośność dla całości, zanim potniemy — kawałki brzmią jak jedno nagranie.
    const wav = path.join(tmp, "calosc.wav");
    await uruchom("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", oryginal,
      "-vn", "-ac", "1", "-ar", "44100",
      "-af", `highpass=f=70,loudnorm=I=${GLOSNOSC_LUFS}:TP=${SZCZYT_DBTP}:LRA=11`,
      "-c:a", "pcm_s16le",
      wav,
    ]).catch((e: Error) => {
      throw new Error(`Nie umiem odczytać tego pliku audio: ${e.message}`);
    });
    const dlugosc = (await dlugoscAudio(wav)) ?? 0;

    const python = await znajdzPythonaMlx();
    if (!python && !klucz) throw new Error("Brak lokalnego mlx_whisper i klucza ElevenLabs — nie mam czym zrobić transkrypcji.");
    const surowe = python ? await transkrybujLokalnie(python, wav) : await transkrybujScribe(klucz!, wav);
    const ciszaNagrania = await cisze(wav);
    const kawalki = podzielNaSceny(projekt, dosunDoCiszy(surowe, ciszaNagrania), dlugosc, ciszaNagrania);

    const znacznik = hashTekstu(`${dane.length}-${Date.now()}`).slice(0, 8);
    for (const [n, scena] of projekt.sceny.entries()) {
      const k = kawalki[n];
      const stary = scena.audio?.plik;
      if (!k) {
        scena.audio = undefined;
      } else {
        const nazwa = `audio/${scena.id}-nagranie-${znacznik}.mp3`;
        const sciezka = path.join(katalog, nazwa);
        const trwa = k.do - k.od;
        // Krótkie wyciszenie na krawędziach, żeby cięcie nie kliknęło.
        await uruchom("ffmpeg", [
          "-hide_banner", "-loglevel", "error", "-y",
          "-ss", k.od.toFixed(3), "-t", trwa.toFixed(3), "-i", wav,
          "-af", `afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, trwa - 0.03).toFixed(3)}:d=0.03`,
          "-ar", "44100", "-b:a", "128k",
          sciezka,
        ]);
        const czas = (await dlugoscAudio(sciezka)) ?? +trwa.toFixed(3);
        const audio: AudioSceny = { plik: nazwa, czas, slowa: k.slowa, hash: hashTekstu(scena.lektor), zrodlo: "nagranie" };
        scena.audio = audio;
      }
      if (stary && stary !== scena.audio?.plik) fs.rmSync(path.join(katalog, stary), { force: true });
    }

    const slabe = kawalki
      .map((k, n) => (k && k.zgodnosc < PROG_ZGODNOSCI ? `scena ${n + 1} (${Math.round(k.zgodnosc * 100)}%)` : null))
      .filter(Boolean);
    const ile = kawalki.filter(Boolean).length;
    const raport = slabe.length
      ? `Nagranie pocięte na ${ile} scen. Mniej zgodne ze scenariuszem: ${slabe.join(", ")} — posłuchaj, czy cięcie siedzi.`
      : `Nagranie pocięte na ${ile} scen, zgodne ze scenariuszem.`;
    const silnik = python ? "transkrypcja lokalna" : "transkrypcja ElevenLabs Scribe";
    return { raport: `${raport} (${silnik})` };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
