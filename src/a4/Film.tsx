// Kompozycja explainera 16:9. Warstwy od spodu: tło · nagranie ekranu · kamera · klocki · napisy,
// do tego dźwięk z kamery, podkład i świsty na zmianach układu. Wszystko składa Remotion, bez CapCuta.
import React, { useMemo } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { CZCIONKA, KOLOR } from "../marka";
import { E, postep } from "../ruch";
import { Tlo } from "../sceny/wspolne";
import type { Scenariusz, Slowo } from "../typy";
import { UkladKlockow } from "./klocki";
import { kadr, mieszaj, type Prostokat } from "./uklady";
import { A4_FPS, wymiaryA4, normujSlowo, osOdcinkow, slowaFilmu, type DaneA4, type OdcinekWOsi, type ScenaA4, type Uklad } from "./typy";

export type PropsA4 = { projekt: Scenariusz; bazaUrl: string; bezNapisow?: boolean };

/** Przejście między układami trwa 14 klatek, symetrycznie wokół cięcia. */
const POL_PRZEJSCIA = 7;

const klatka = (s: number) => Math.round(s * A4_FPS);
export const czyPionowa = (dane: DaneA4) => !!dane.kamera && dane.kamera.wys > dane.kamera.szer;

/** Indeks sceny trwającej w danej klatce (ostatnia, która już się zaczęła). */
function scenaWKlatce(sceny: ScenaA4[], f: number): number {
  let i = 0;
  for (let j = 0; j < sceny.length; j++) if (klatka(sceny[j].od) <= f) i = j;
  return i;
}

/** Prostokąt warstwy w danej klatce, z płynnym przejściem między układem poprzedniej i bieżącej sceny. */
type Format = "pion" | "poziom";

function useProstokat(sceny: ScenaA4[], warstwa: "kamera" | "ekran", pionowa: boolean, format: Format): Prostokat {
  const f = useCurrentFrame();
  if (!sceny.length) return kadr("twarz", pionowa, format)[warstwa];
  // Przejście zaczyna się chwilę przed cięciem, więc patrzymy na scenę, która zacznie się za pół przejścia.
  const i = scenaWKlatce(sceny, f + POL_PRZEJSCIA);
  const start = klatka(sceny[i].od);
  const teraz = kadr(sceny[i].uklad, pionowa, format)[warstwa];
  if (i === 0) return teraz;
  const przed = kadr(sceny[i - 1].uklad, pionowa, format)[warstwa];
  return mieszaj(przed, teraz, postep(f, start - POL_PRZEJSCIA, start + POL_PRZEJSCIA, E.inOutCubic));
}

const Okno: React.FC<{ p: Prostokat; obwodka?: boolean; children: React.ReactNode }> = ({ p, obwodka, children }) => {
  const kolko = obwodka && p.r >= Math.min(p.w, p.h) / 2 - 1;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        width: p.w,
        height: p.h,
        borderRadius: p.r,
        overflow: "hidden",
        opacity: p.widoczny,
        backgroundColor: KOLOR.paper2,
        border: kolko ? `8px solid ${KOLOR.card}` : undefined,
        boxShadow: kolko ? `0 0 0 4px ${KOLOR.accent}, 0 24px 60px rgba(0,0,0,.45)` : p.r > 0 ? "0 24px 60px rgba(0,0,0,.45)" : undefined,
      }}
    >
      {children}
    </div>
  );
};

/** Odcinki surówki ułożone jeden za drugim. Wycięte pauzy i powtórki po prostu nie istnieją w osi. */
const Odcinki: React.FC<{ os: OdcinekWOsi[]; src: string; przesuniecie?: number; wycisz?: boolean; kadrTwarzy?: boolean }> = ({ os, src, przesuniecie = 0, wycisz, kadrTwarzy }) => (
  <>
    {os.map((o, i) => (
      <Sequence key={i} from={o.klatkaWyjscia} durationInFrames={o.klatki} layout="none">
        <OffthreadVideo
          src={src}
          trimBefore={Math.max(0, klatka(o.od + przesuniecie))}
          muted={wycisz}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: kadrTwarzy ? "cover" : "contain", objectPosition: kadrTwarzy ? "50% 28%" : "50% 50%" }}
        />
      </Sequence>
    ))}
  </>
);

const Kamera: React.FC<{ dane: DaneA4; os: OdcinekWOsi[]; bazaUrl: string; format: Format }> = ({ dane, os, bazaUrl, format }) => {
  const p = useProstokat(dane.sceny, "kamera", czyPionowa(dane), format);
  if (!dane.kamera) return null;
  return (
    <Okno p={p} obwodka>
      <Odcinki os={os} src={`${bazaUrl}/${dane.kamera.plik}`} kadrTwarzy />
    </Okno>
  );
};

const Ekran: React.FC<{ dane: DaneA4; os: OdcinekWOsi[]; bazaUrl: string; format: Format }> = ({ dane, os, bazaUrl, format }) => {
  const p = useProstokat(dane.sceny, "ekran", czyPionowa(dane), format);
  if (!dane.ekran || p.widoczny === 0) return null;
  return (
    <Okno p={p}>
      <Odcinki os={os} src={`${bazaUrl}/${dane.ekran.plik}`} przesuniecie={dane.ekran.przesuniecie} wycisz />
    </Okno>
  );
};

/** Klatka (względem początku sceny), w której wchodzi każdy klocek: na swoim słowie albo po kolei. */
export function wejsciaKlockow(scena: ScenaA4, slowa: Slowo[]): Record<string, number> {
  const wSceny = slowa.filter((w) => w.start >= scena.od - 0.05 && w.start < scena.do);
  const wynik: Record<string, number> = {};
  const bez: string[] = [];
  let szukajOd = 0;
  for (const k of scena.klocki) {
    const cel = k.wejscie ? normujSlowo(k.wejscie) : "";
    const idx = cel ? wSceny.findIndex((w, i) => i >= szukajOd && normujSlowo(w.tekst).startsWith(cel)) : -1;
    if (idx >= 0) {
      wynik[k.id] = Math.max(0, klatka(wSceny[idx].start - scena.od) - 3);
      szukajOd = idx;
    } else bez.push(k.id);
  }
  // Klocki bez słowa wchodzą równo w pierwszej połowie sceny.
  const dlugosc = klatka(scena.do - scena.od);
  bez.forEach((id, i) => (wynik[id] = 4 + Math.round((i * dlugosc * 0.5) / Math.max(1, bez.length))));
  return wynik;
}

const SAMOTNE = new Set(["kafel", "ikona", "licznik", "cytat", "obraz", "naglowek", "podswietlenie"]);

const KlockiSceny: React.FC<{ scena: ScenaA4; slowa: Slowo[]; bazaUrl: string; dlugosc: number; pionowa: boolean; format: Format }> = ({ scena, slowa, bazaUrl, dlugosc, pionowa, format }) => {
  const f = useCurrentFrame();
  const k = kadr(scena.uklad, pionowa, format);
  const { wys } = wymiaryA4(format);
  const wejscia = useMemo(() => wejsciaKlockow(scena, slowa), [scena, slowa]);
  if (!k.klocki || !scena.klocki.length) return null;
  const r = k.klocki;
  const wyjscie = 1 - postep(f, dlugosc - 2, dlugosc + 6, E.lin);
  const wysrodkuj = scena.uklad === "grafika" || (scena.klocki.length === 1 && SAMOTNE.has(scena.klocki[0].typ) && !k.tloKlockow);
  const tresc = <UkladKlockow klocki={scena.klocki} wejscia={wejscia} szerokosc={r.w - (k.tloKlockow ? 68 : 0)} wysrodkuj={wysrodkuj} bazaUrl={bazaUrl} dlugosc={dlugosc} />;
  if (!k.tloKlockow) {
    return <div style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, opacity: wyjscie }}>{tresc}</div>;
  }
  // Plansza na obrazie z kamery: przylega do treści, stoi nad napisami i pojawia się razem z pierwszym klockiem.
  const pierwszy = Math.min(...Object.values(wejscia));
  const p = postep(f, pierwszy - 2, pierwszy + 8, E.outCubic);
  return (
    <div style={{ position: "absolute", left: r.x, bottom: wys - r.y - r.h, width: "fit-content", minWidth: 360, maxWidth: r.w, maxHeight: r.h, opacity: Math.min(p, wyjscie), transform: `translateY(${(1 - p) * 20}px)`, padding: 34, borderRadius: r.r, backgroundColor: "rgba(18,10,5,.84)", boxShadow: "0 24px 60px rgba(0,0,0,.45)" }}>
      {tresc}
    </div>
  );
};

// ---- Napisy w presecie Dariusza: Montserrat, pomarańczowy box na wymawianym słowie ----

type Linia = { slowa: Slowo[]; start: number; koniec: number };

function linieNapisow(slowa: Slowo[]): Linia[] {
  const linie: Linia[] = [];
  let biez: Slowo[] = [];
  const zamknij = () => {
    if (biez.length) linie.push({ slowa: biez, start: biez[0].start, koniec: biez[biez.length - 1].koniec });
    biez = [];
  };
  for (const w of slowa) {
    const ostatnie = biez[biez.length - 1];
    const znaki = biez.reduce((n, x) => n + x.tekst.length + 1, 0) + w.tekst.length;
    if (ostatnie && (biez.length >= 7 || znaki > 42 || w.start - ostatnie.koniec > 0.6 || /[.!?…]$/.test(ostatnie.tekst))) zamknij();
    biez.push(w);
  }
  zamknij();
  return linie;
}

const Napisy: React.FC<{ slowa: Slowo[]; format: Format }> = ({ slowa, format }) => {
  const f = useCurrentFrame();
  const t = f / A4_FPS;
  const linie = useMemo(() => linieNapisow(slowa), [slowa]);
  const linia = linie.find((l, i) => t >= l.start - 0.05 && t < Math.min(l.koniec + 0.7, linie[i + 1]?.start ?? Infinity));
  if (!linia) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: format === "pion" ? 390 : 56, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: format === "pion" ? 940 : 1500, padding: "16px 26px", borderRadius: 24, backgroundColor: "rgba(32,32,32,.92)", border: `2px solid ${KOLOR.line}`, fontFamily: CZCIONKA.napisy, fontWeight: 800, fontSize: 46, lineHeight: 1.2, color: KOLOR.ink }}>
        {linia.slowa.map((w, i) => {
          const teraz = t >= w.start - 0.03 && t < w.koniec + 0.06;
          return (
            <span key={i} style={{ padding: "2px 10px", margin: "0 1px", borderRadius: 10, backgroundColor: teraz ? KOLOR.accent : "transparent" }}>
              {w.tekst}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ---- Dźwięk: podkład i świsty ----

/** Świst wpada tam, gdzie zmienia się układ kadru, chyba że scena mówi inaczej. */
export function swistyFilmu(dane: DaneA4): number[] {
  const wynik: number[] = [];
  dane.sceny.forEach((s, i) => {
    if (i === 0 || s.przejscie === "brak") return;
    const zmiana = s.uklad !== dane.sceny[i - 1].uklad;
    if (s.przejscie === "swist" || (dane.swisty !== false && zmiana)) wynik.push(klatka(s.od));
  });
  return wynik;
}

const Podklad: React.FC<{ dane: DaneA4; bazaUrl: string; klatki: number }> = ({ dane, bazaUrl, klatki }) => {
  if (!dane.muzyka) return null;
  const g = dane.muzyka.glosnosc;
  return (
    <Audio
      src={`${bazaUrl}/${dane.muzyka.plik}`}
      loop
      volume={(f) => g * interpolate(f, [0, 45, klatki - 60, klatki], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
  );
};

export const FilmA4: React.FC<PropsA4> = ({ projekt, bazaUrl, bezNapisow }) => {
  const dane: DaneA4 = projekt.a4 ?? { sceny: [] };
  const os = useMemo(() => osOdcinkow(dane.odcinki), [dane.odcinki]);
  const slowa = useMemo(() => slowaFilmu(dane), [dane]);
  const klatki = os.length ? os[os.length - 1].klatkaWyjscia + os[os.length - 1].klatki : A4_FPS * 5;
  const swisty = useMemo(() => swistyFilmu(dane), [dane]);
  const format: Format = projekt.format ?? "poziom";
  return (
    <AbsoluteFill>
      <Tlo />
      <Ekran dane={dane} os={os} bazaUrl={bazaUrl} format={format} />
      <Kamera dane={dane} os={os} bazaUrl={bazaUrl} format={format} />
      {dane.sceny.map((s, i) => {
        const od = klatka(s.od);
        const dlugosc = Math.max(1, klatka(dane.sceny[i + 1]?.od ?? s.do) - od);
        return (
          <Sequence key={s.id} from={od} durationInFrames={dlugosc + 8} layout="none">
            <KlockiSceny scena={s} slowa={slowa} bazaUrl={bazaUrl} dlugosc={dlugosc} pionowa={czyPionowa(dane)} format={format} />
          </Sequence>
        );
      })}
      {projekt.napisy !== false && !bezNapisow && <Napisy slowa={slowa} format={format} />}
      <Podklad dane={dane} bazaUrl={bazaUrl} klatki={klatki} />
      {swisty.map((f) => (
        <Sequence key={f} from={Math.max(0, f - 8)} durationInFrames={30} layout="none">
          <Audio src={staticFile("dzwieki/whoosh.mp3")} volume={0.45} />
        </Sequence>
      ))}
      {!dane.kamera && <BrakNagrania />}
    </AbsoluteFill>
  );
};

const BrakNagrania: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: CZCIONKA.tekst, fontSize: 48, fontWeight: 700, color: KOLOR.muted }}>
    Wgraj nagranie z kamery, żeby zobaczyć podgląd.
  </AbsoluteFill>
);

export const klatkiA4 = (projekt: Scenariusz) => {
  const os = osOdcinkow(projekt.a4?.odcinki);
  return os.length ? os[os.length - 1].klatkaWyjscia + os[os.length - 1].klatki : A4_FPS * 5;
};

export type { Uklad };
