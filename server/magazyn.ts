// Zapis i odczyt projektów oraz ustawień na dysku.
import fs from "node:fs";
import path from "node:path";
import type { Scenariusz } from "../src/typy";
import { audioAktualne, hashTekstu } from "../src/hash";
import { scal } from "../src/scalanie";
export { audioAktualne, hashTekstu };

export const KATALOG_GLOWNY = path.resolve(import.meta.dirname, "..");
export const KATALOG_PROJEKTOW = path.join(KATALOG_GLOWNY, "projekty");
export const KATALOG_DANYCH = path.join(KATALOG_GLOWNY, "dane");
const PLIK_USTAWIEN = path.join(KATALOG_DANYCH, "ustawienia.json");

export type Ustawienia = {
  elevenLabsApiKey?: string;
  voiceId?: string;
  voiceName?: string;
  model?: string;
  stabilnosc?: number;
  podobienstwo?: number;
  styl?: number;
};

fs.mkdirSync(KATALOG_PROJEKTOW, { recursive: true });
fs.mkdirSync(KATALOG_DANYCH, { recursive: true });

export function wczytajUstawienia(): Ustawienia {
  try {
    return JSON.parse(fs.readFileSync(PLIK_USTAWIEN, "utf8"));
  } catch {
    return {};
  }
}

export function zapiszUstawienia(u: Ustawienia) {
  fs.writeFileSync(PLIK_USTAWIEN, JSON.stringify(u, null, 2));
}

export function kluczApi(): string | undefined {
  return process.env.ELEVENLABS_API_KEY || wczytajUstawienia().elevenLabsApiKey;
}

export function slug(tekst: string): string {
  const mapa: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
  return tekst
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) => mapa[c])
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "rolka";
}

const POPRAWNY_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

/** Zwraca folder projektu. Odrzuca identyfikatory, które mogłyby wskazać poza folder projektów. */
/** Kosz: tu lądują usunięte rolki i projekty, zamiast znikać od razu. */
export const KATALOG_KOSZA = path.join(KATALOG_PROJEKTOW, "_kosz");

/**
 * Sprząta kosz przy starcie serwera: wyrzuca wszystko starsze niż tydzień.
 * Bez tego kosz rośnie bez końca — jeden dzień intensywnej pracy zostawił w nim
 * 23 pliki i 317 MB, bo każdy render poprawkowy trafiał tam po podmianie.
 * Tydzień wystarczy, żeby zauważyć pomyłkę i cofnąć usunięcie ręcznie.
 */
export function sprzatnijKosz(dniRetencji = 7): number {
  if (!fs.existsSync(KATALOG_KOSZA)) return 0;
  const prog = Date.now() - dniRetencji * 24 * 60 * 60 * 1000;
  let usuniete = 0;
  for (const wpis of fs.readdirSync(KATALOG_KOSZA)) {
    const sciezka = path.join(KATALOG_KOSZA, wpis);
    try {
      if (fs.statSync(sciezka).mtimeMs < prog) {
        fs.rmSync(sciezka, { recursive: true, force: true });
        usuniete += 1;
      }
    } catch {
      /* plik zniknął w międzyczasie — nic nie szkodzi */
    }
  }
  return usuniete;
}

export function katalogProjektu(id: string) {
  if (!POPRAWNY_ID.test(id)) throw new Error("Nieprawidłowa nazwa projektu.");
  const kat = path.resolve(KATALOG_PROJEKTOW, id);
  if (!kat.startsWith(path.resolve(KATALOG_PROJEKTOW) + path.sep)) throw new Error("Nieprawidłowa nazwa projektu.");
  return kat;
}

export function listaProjektow(): Scenariusz[] {
  if (!fs.existsSync(KATALOG_PROJEKTOW)) return [];
  return fs
    .readdirSync(KATALOG_PROJEKTOW)
    .filter((d) => POPRAWNY_ID.test(d) && fs.existsSync(path.join(KATALOG_PROJEKTOW, d, "scenariusz.json")))
    .map((d) => wczytajProjekt(d))
    .filter((p): p is Scenariusz => p !== null)
    .sort((a, b) => b.zmieniono.localeCompare(a.zmieniono));
}

export function wczytajProjekt(id: string): Scenariusz | null {
  if (!POPRAWNY_ID.test(id)) return null;
  const plik = path.join(katalogProjektu(id), "scenariusz.json");
  if (!fs.existsSync(plik)) return null;
  try {
    const s = JSON.parse(fs.readFileSync(plik, "utf8")) as Scenariusz;
    return uzupelnijStatus(s);
  } catch (e) {
    console.error(`Uszkodzony scenariusz ${id}:`, e);
    return null;
  }
}

/**
 * Czyści niewidoczne śmieci z tekstu wklejanego do edytora: twarda spacja (U+00A0),
 * spacja zerowej szerokości, wąska spacja. Wchodzą przy kopiowaniu z Obsidiana albo
 * przeglądarki i psują dwie rzeczy naraz — ElevenLabs dostaje inny token niż widać,
 * a porównanie tekstu z zapisanym audio przestaje się zgadzać mimo identycznego wyglądu.
 */
function bezNiewidzialnychSpacji(tekst: string): string {
  return tekst.replace(/[\u00A0\u2007\u202F\u200B\uFEFF]/g, " ");
}

export function zapiszProjekt(s: Scenariusz): Scenariusz {
  const kat = katalogProjektu(s.id);
  fs.mkdirSync(path.join(kat, "audio"), { recursive: true });
  for (const scena of s.sceny) {
    if (typeof scena.lektor === "string") scena.lektor = bezNiewidzialnychSpacji(scena.lektor);
  }
  s.zmieniono = new Date().toISOString();
  uzupelnijStatus(s);
  fs.writeFileSync(path.join(kat, "scenariusz.json"), JSON.stringify(s, null, 2));
  return s;
}

/**
 * Zapis po długiej operacji (lektor, nagranie, Claude piszący scenariusz). Operacja pracowała
 * na kopii sprzed kilkudziesięciu sekund, a w tym czasie projekt mógł zmienić dashboard albo
 * zapis przez API. Wnosimy więc tylko to, co operacja zmieniła względem `baza`, na to, co jest na dysku.
 */
export function zapiszScalajac(baza: Scenariusz, nowy: Scenariusz): Scenariusz {
  const dysk = wczytajProjekt(nowy.id);
  return zapiszProjekt(dysk ? scal(baza, nowy, dysk) : nowy);
}

export const kopia = <T>(v: T): T => structuredClone(v);

export function utworzProjekt(tytul: string, zrodlo?: string, docelowaDlugosc = 45, rekord?: string, typ: Scenariusz["typ"] = "rolka"): Scenariusz {
  let id = slug(tytul);
  let n = 2;
  while (fs.existsSync(katalogProjektu(id))) id = `${slug(tytul)}-${n++}`;
  const teraz = new Date().toISOString();
  return zapiszProjekt({
    id,
    tytul,
    zrodlo,
    rekord,
    docelowaDlugosc,
    status: "scenariusz",
    utworzono: teraz,
    zmieniono: teraz,
    napisy: true,
    sceny: [],
    ...(typ === "explainer" ? { typ, a4: { sceny: [], swisty: true } } : {}),
  });
}

/** Najnowszy plik rolka*.mp4 w folderze projektu (każdy render tworzy osobny plik). */
export function najnowszyMp4(id: string): string | undefined {
  const kat = katalogProjektu(id);
  if (!fs.existsSync(kat)) return undefined;
  const pliki = fs
    .readdirSync(kat)
    .filter((f) => /^(rolka|film).*\.mp4$/.test(f))
    .map((f) => ({ f, t: fs.statSync(path.join(kat, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  return pliki[0]?.f;
}

/** Status wynika ze stanu: wszystkie audio aktualne → "lektor"; jest też MP4 → "gotowe". */
function uzupelnijStatus(s: Scenariusz): Scenariusz {
  const mp4 = najnowszyMp4(s.id);
  const wszystkieAudio = s.sceny.length > 0 && s.sceny.every(audioAktualne);
  s.plikMp4 = mp4;
  if (s.typ === "explainer") {
    // Explainer nie ma lektora: „lektor” znaczy tu „plan gotowy, można renderować”.
    const plan = !!s.a4?.sceny.length;
    s.status = mp4 && plan ? "gotowe" : plan ? "lektor" : "scenariusz";
    return s;
  }
  s.status = mp4 && wszystkieAudio ? "gotowe" : wszystkieAudio ? "lektor" : "scenariusz";
  return s;
}
