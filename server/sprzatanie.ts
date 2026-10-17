// „Posprzątaj maszynkę”: kasuje na stałe to, co nie poszło w świat i da się odtworzyć.
// Działa wyłącznie po regułach poniżej — niczego nie zgaduje. Dashboard najpierw pokazuje listę, kasowanie idzie po potwierdzeniu.
import fs from "node:fs";
import path from "node:path";
import { KATALOG_GLOWNY, KATALOG_KOSZA, KATALOG_PROJEKTOW, listaProjektow } from "./magazyn";

export type PozycjaSprzatania = { sciezka: string; powod: string; rozmiar: number };
export type PlanSprzatania = { pozycje: PozycjaSprzatania[]; razem: number };

function rozmiar(p: string): number {
  try {
    const st = fs.statSync(p);
    if (!st.isDirectory()) return st.size;
    return fs.readdirSync(p).reduce((n, f) => n + rozmiar(path.join(p, f)), 0);
  } catch {
    return 0;
  }
}

const FILM = /^(rolka|film)[a-z0-9_-]*\.mp4$/i;
/** Audio, które maszynka sama generuje i odtworzy na żądanie. Twojego nagrania źródłowego (`nagranie-zrodlo.*`) nie ruszamy. */
const AUDIO_GENEROWANE = /^(s[0-9a-z]+-.+\.mp3|muzyka-[a-z0-9]+\.\w+)$/i;

export function planSprzatania(): PlanSprzatania {
  const pozycje: PozycjaSprzatania[] = [];
  const dodaj = (pelna: string, powod: string) => pozycje.push({ sciezka: path.relative(KATALOG_GLOWNY, pelna), powod, rozmiar: rozmiar(pelna) });

  // Filmy z dashboardu: zostaje najnowsza wersja, reszta to próby.
  for (const p of listaProjektow()) {
    const kat = path.join(KATALOG_PROJEKTOW, p.id);
    const filmy = fs
      .readdirSync(kat)
      .filter((f) => FILM.test(f))
      .map((f) => ({ f, t: fs.statSync(path.join(kat, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of filmy.slice(1)) dodaj(path.join(kat, f), `starsza wersja „${p.tytul}” (zostaje ${filmy[0].f})`);

    const uzywane = new Set<string>();
    for (const s of p.sceny) {
      if (s.audio?.plik) uzywane.add(s.audio.plik);
      if (s.efektAudio?.plik) uzywane.add(s.efektAudio.plik);
    }
    if (p.a4?.muzyka?.plik) uzywane.add(p.a4.muzyka.plik);
    const katAudio = path.join(kat, "audio");
    if (fs.existsSync(katAudio)) {
      for (const f of fs.readdirSync(katAudio)) {
        if (AUDIO_GENEROWANE.test(f) && !uzywane.has(`audio/${f}`)) dodaj(path.join(katAudio, f), `nieużywane audio „${p.tytul}” (stary lektor albo podkład)`);
      }
    }

    const robocze = path.join(kat, "_robocze");
    if (fs.existsSync(robocze)) dodaj(robocze, `pliki robocze transkrypcji „${p.tytul}”`);
    const zrodlo = path.join(kat, "zrodlo");
    if (fs.existsSync(zrodlo)) {
      for (const f of fs.readdirSync(zrodlo)) {
        if (/^oryginal-|\.tmp\.mp4$/.test(f)) dodaj(path.join(zrodlo, f), `pozostałość po konwersji nagrania „${p.tytul}”`);
      }
    }
  }

  // Filmy serii robione skryptem (folder z os.json): render przed wyrównaniem głośności i kopia awatara leżąca też w public/.
  for (const d of fs.readdirSync(KATALOG_PROJEKTOW)) {
    const kat = path.join(KATALOG_PROJEKTOW, d);
    if (!fs.existsSync(path.join(kat, "os.json")) || fs.existsSync(path.join(kat, "scenariusz.json"))) continue;
    const render = path.join(kat, "render.mp4");
    if (fs.existsSync(render) && fs.existsSync(path.join(kat, `${d}.mp4`))) dodaj(render, `render pośredni serii (gotowy film to ${d}.mp4)`);
    const awatar = path.join(kat, "awatar.mp4");
    const wPublic = path.join(KATALOG_GLOWNY, "public", d, "awatar.mp4");
    if (fs.existsSync(awatar) && fs.existsSync(wPublic) && rozmiar(awatar) === rozmiar(wPublic)) dodaj(awatar, `druga kopia awatara (render bierze public/${d}/awatar.mp4)`);
  }

  // Kosz: wszystko, co już raz zostało wyrzucone.
  if (fs.existsSync(KATALOG_KOSZA)) for (const f of fs.readdirSync(KATALOG_KOSZA)) dodaj(path.join(KATALOG_KOSZA, f), "kosz");

  return { pozycje, razem: pozycje.reduce((n, p) => n + p.rozmiar, 0) };
}

/** Kasuje na stałe wszystko z planu. Plan liczony jest od nowa w chwili kasowania, więc nic spoza reguł nie wpadnie. */
export function posprzataj(): PlanSprzatania & { bledy: string[] } {
  const plan = planSprzatania();
  const bledy: string[] = [];
  for (const p of plan.pozycje) {
    const pelna = path.resolve(KATALOG_GLOWNY, p.sciezka);
    // Bezpiecznik: kasujemy wyłącznie wewnątrz folderu projektów.
    if (!pelna.startsWith(path.resolve(KATALOG_PROJEKTOW) + path.sep)) {
      bledy.push(`${p.sciezka}: poza folderem projektów, pominięte`);
      continue;
    }
    try {
      fs.rmSync(pelna, { recursive: true, force: true });
    } catch (e) {
      bledy.push(`${p.sciezka}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return { ...plan, bledy };
}
