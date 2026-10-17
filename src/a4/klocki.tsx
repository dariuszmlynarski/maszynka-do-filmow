// Klocki explainera: każdy ma swój wygląd w palecie DM i własną animację wejścia.
// Scena to tylko lista klocków; jak je ułożyć w dostępnym prostokącie, decyduje `UkladKlockow`.
import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { CIEN_KARTY, CIEN_NAKLEJKI, CZCIONKA, KOLOR } from "../marka";
import { E, pop, postep, wjazd, wjazdZBoku } from "../ruch";
import { Zakreslenie } from "../sceny/wspolne";
import type { Klocek } from "./typy";

type PropsKlocka = { k: Klocek; od: number; s: number; bazaUrl: string; poziomo: boolean; dlugosc: number };

const ikonaJakoObraz = (ikona: string | undefined, bazaUrl: string): string | null => {
  if (!ikona) return null;
  if (ikona.startsWith("logo:")) return staticFile(`logo/${ikona.slice(5)}.svg`);
  if (/\.(png|jpe?g|svg|webp)$/i.test(ikona)) return `${bazaUrl}/${ikona}`;
  return null;
};

const Ikona: React.FC<{ ikona?: string; rozmiar: number; bazaUrl: string }> = ({ ikona, rozmiar, bazaUrl }) => {
  if (!ikona) return null;
  const obraz = ikonaJakoObraz(ikona, bazaUrl);
  if (obraz) return <Img src={obraz} style={{ width: rozmiar, height: rozmiar, objectFit: "contain" }} />;
  return <span style={{ fontSize: rozmiar * 0.86, lineHeight: 1 }}>{ikona}</span>;
};

/** Tekst z wyróżnionym fragmentem w kolorze marki. */
const ZAkcentem: React.FC<{ tekst: string; akcent?: string }> = ({ tekst, akcent }) => {
  const i = akcent ? tekst.indexOf(akcent) : -1;
  if (!akcent || i < 0) return <>{tekst}</>;
  return (
    <>
      {tekst.slice(0, i)}
      <span style={{ color: KOLOR.accent }}>{akcent}</span>
      {tekst.slice(i + akcent.length)}
    </>
  );
};

const karta = (s: number): React.CSSProperties => ({
  backgroundColor: KOLOR.card,
  border: `2px solid ${KOLOR.line}`,
  borderRadius: 28 * s,
  boxShadow: CIEN_KARTY,
  padding: `${28 * s}px ${34 * s}px`,
});

const Naglowek: React.FC<PropsKlocka> = ({ k, od, s }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ ...wjazd(f, od, 60 * s), fontFamily: CZCIONKA.naglowek, fontSize: 84 * s, lineHeight: 1.06, letterSpacing: "-0.01em", color: KOLOR.ink }}>
      <ZAkcentem tekst={k.tekst ?? ""} akcent={k.akcent} />
    </div>
  );
};

const Etykieta: React.FC<PropsKlocka> = ({ k, od, s }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ ...pop(f, od), display: "inline-flex", alignItems: "center", gap: 12 * s, alignSelf: "flex-start", border: `2px solid ${KOLOR.accent}`, color: KOLOR.accent, borderRadius: 999, padding: `${10 * s}px ${26 * s}px`, fontFamily: CZCIONKA.tekst, fontWeight: 800, fontSize: 28 * s, letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {k.tekst}
    </div>
  );
};

const Kafel: React.FC<PropsKlocka> = ({ k, od, s, bazaUrl, poziomo }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ ...(poziomo ? wjazd(f, od, 70 * s) : wjazdZBoku(f, od, false)), ...karta(s), display: "flex", flexDirection: poziomo ? "column" : "row", alignItems: poziomo ? "flex-start" : "center", gap: 22 * s, flex: poziomo ? 1 : undefined }}>
      <Ikona ikona={k.ikona} rozmiar={(poziomo ? 84 : 88) * s} bazaUrl={bazaUrl} />
      <div>
        <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 800, fontSize: (poziomo ? 42 : 50) * s, lineHeight: 1.15, color: KOLOR.ink }}>{k.tekst}</div>
        {k.podpis && <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 500, fontSize: (poziomo ? 28 : 32) * s, lineHeight: 1.3, color: KOLOR.muted, marginTop: 8 * s }}>{k.podpis}</div>}
      </div>
    </div>
  );
};

/** Punkty listy wchodzą po kolei w pierwszych dwóch trzecich sceny. */
const odstepPunktow = (od: number, dlugosc: number, ile: number) => Math.max(6, Math.min(22, Math.floor(((dlugosc - od) * 0.6) / Math.max(1, ile))));

const Lista: React.FC<PropsKlocka> = ({ k, od, s, dlugosc }) => {
  const f = useCurrentFrame();
  const punkty = k.punkty ?? [];
  const krok = odstepPunktow(od, dlugosc, punkty.length);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 * s, minWidth: "60%" }}>
      {punkty.map((p, i) => (
        <div key={i} style={{ ...wjazdZBoku(f, od + i * krok, false), display: "flex", alignItems: "center", gap: 24 * s, ...karta(s), padding: `${26 * s}px ${34 * s}px` }}>
          <span style={{ width: 20 * s, height: 20 * s, borderRadius: 999, backgroundColor: KOLOR.accent, flexShrink: 0 }} />
          <span style={{ fontFamily: CZCIONKA.tekst, fontWeight: 700, fontSize: 50 * s, lineHeight: 1.2, color: KOLOR.ink }}>{p}</span>
        </div>
      ))}
    </div>
  );
};

const Licznik: React.FC<PropsKlocka> = ({ k, od, s, poziomo }) => {
  const f = useCurrentFrame();
  const cel = k.wartosc ?? 0;
  const p = postep(f, od, od + 32, E.outCubic);
  const ulamki = Number.isInteger(cel) ? 0 : 1;
  const liczba = (cel * p).toLocaleString("pl-PL", { minimumFractionDigits: ulamki, maximumFractionDigits: ulamki });
  return (
    <div style={{ ...pop(f, od), display: "flex", flexDirection: "column", alignItems: poziomo ? "center" : "flex-start", flex: poziomo ? 1 : undefined }}>
      <div style={{ fontFamily: CZCIONKA.naglowek, fontSize: 170 * s, lineHeight: 1, color: KOLOR.accent }}>
        {k.prefiks}
        {liczba}
        {k.sufiks}
      </div>
      {k.podpis && <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 700, fontSize: 38 * s, color: KOLOR.inkSoft, marginTop: 12 * s, textAlign: poziomo ? "center" : "left" }}>{k.podpis}</div>}
    </div>
  );
};

const Pasek: React.FC<PropsKlocka> = ({ k, od, s }) => {
  const f = useCurrentFrame();
  const cel = Math.max(0, Math.min(100, k.wartosc ?? 0));
  const p = postep(f, od + 6, od + 40, E.outCubic);
  return (
    <div style={{ ...wjazd(f, od, 40 * s), width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 * s, fontFamily: CZCIONKA.tekst, fontWeight: 700, fontSize: 38 * s, color: KOLOR.ink }}>
        <span>{k.tekst ?? k.podpis}</span>
        <span style={{ fontFamily: CZCIONKA.naglowek, color: KOLOR.accent, fontSize: 52 * s }}>{Math.round(cel * p)}%</span>
      </div>
      <div style={{ height: 34 * s, borderRadius: 999, backgroundColor: KOLOR.line, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${cel * p}%`, borderRadius: 999, backgroundColor: KOLOR.accent, boxShadow: CIEN_NAKLEJKI }} />
      </div>
    </div>
  );
};

const Strzalka: React.FC<PropsKlocka> = ({ k, od, s, poziomo }) => {
  const f = useCurrentFrame();
  const p = postep(f, od, od + 14, E.outCubic);
  const dl = 140 * s;
  const wym = poziomo ? { width: dl, height: 60 * s } : { width: 60 * s, height: dl * 0.7 };
  const d = poziomo ? `M4 ${30 * s} L${dl - 10} ${30 * s} M${dl - 34 * s} ${8 * s} L${dl - 10} ${30 * s} L${dl - 34 * s} ${52 * s}` : `M${30 * s} 4 L${30 * s} ${dl * 0.7 - 10} M${8 * s} ${dl * 0.7 - 34 * s} L${30 * s} ${dl * 0.7 - 10} L${52 * s} ${dl * 0.7 - 34 * s}`;
  return (
    <div style={{ display: "flex", flexDirection: poziomo ? "column" : "row", alignItems: "center", alignSelf: poziomo ? "center" : "flex-start", gap: 8 * s, marginLeft: poziomo ? 0 : 40 * s, opacity: postep(f, od, od + 4, E.lin) }}>
      <svg {...wym} style={{ overflow: "visible" }}>
        <path d={d} fill="none" stroke={KOLOR.accent} strokeWidth={8 * s} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
      </svg>
      {k.tekst && <span style={{ fontFamily: CZCIONKA.tekst, fontWeight: 700, fontSize: 26 * s, color: KOLOR.muted }}>{k.tekst}</span>}
    </div>
  );
};

const Podswietlenie: React.FC<PropsKlocka> = ({ k, od, s }) => {
  const f = useCurrentFrame();
  const tekst = k.tekst ?? "";
  const akcent = k.akcent && tekst.includes(k.akcent) ? k.akcent : tekst;
  const i = tekst.indexOf(akcent);
  return (
    <div style={{ ...wjazd(f, od, 40 * s), fontFamily: CZCIONKA.tekst, fontWeight: 800, fontSize: 60 * s, lineHeight: 1.25, color: KOLOR.ink }}>
      {tekst.slice(0, i)}
      <Zakreslenie opoznienie={od + 8} klatki={16}>{akcent}</Zakreslenie>
      {tekst.slice(i + akcent.length)}
    </div>
  );
};

const Cytat: React.FC<PropsKlocka> = ({ k, od, s }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ ...wjazd(f, od, 50 * s), ...karta(s), borderLeft: `${10 * s}px solid ${KOLOR.accent}`, padding: `${36 * s}px ${44 * s}px` }}>
      <div style={{ fontFamily: CZCIONKA.naglowek, fontSize: 110 * s, lineHeight: 0.6, color: KOLOR.accent, height: 52 * s }}>„</div>
      <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 600, fontSize: 50 * s, lineHeight: 1.3, color: KOLOR.ink }}>{k.tekst}</div>
      {k.podpis && <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 600, fontSize: 28 * s, color: KOLOR.muted, marginTop: 18 * s }}>{k.podpis}</div>}
    </div>
  );
};

const IkonaDuza: React.FC<PropsKlocka> = ({ k, od, s, bazaUrl, poziomo }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ ...pop(f, od), display: "flex", flexDirection: "column", alignItems: "center", alignSelf: poziomo ? undefined : "center", gap: 18 * s, flex: poziomo ? 1 : undefined }}>
      <Ikona ikona={k.ikona} rozmiar={180 * s} bazaUrl={bazaUrl} />
      {k.podpis && <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 700, fontSize: 36 * s, color: KOLOR.inkSoft, textAlign: "center" }}>{k.podpis}</div>}
    </div>
  );
};

const Obraz: React.FC<PropsKlocka> = ({ k, od, s, bazaUrl }) => {
  const f = useCurrentFrame();
  const src = ikonaJakoObraz(k.src, bazaUrl) ?? (k.src ? `${bazaUrl}/${k.src}` : null);
  return (
    <div style={{ ...wjazd(f, od, 50 * s), display: "flex", flexDirection: "column", alignItems: "center", gap: 16 * s }}>
      {src ? (
        <Img src={src} style={{ maxWidth: "100%", maxHeight: 520 * s, borderRadius: 24 * s, boxShadow: CIEN_KARTY, objectFit: "contain" }} />
      ) : (
        <div style={{ ...karta(s), width: 640 * s, height: 360 * s, display: "flex", alignItems: "center", justifyContent: "center", color: KOLOR.muted, fontFamily: CZCIONKA.tekst, fontSize: 30 * s }}>tu wstaw obraz</div>
      )}
      {k.podpis && <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 600, fontSize: 30 * s, color: KOLOR.muted }}>{k.podpis}</div>}
    </div>
  );
};

/** Punkt siatki może zaczynać się od emoji: „🔥 Szybciej”. */
const rozdzielIkone = (p: string): [string | undefined, string] => {
  const m = p.match(/^(\p{Extended_Pictographic}️?|logo:[a-z0-9-]+)\s+(.*)$/u);
  return m ? [m[1], m[2]] : [undefined, p];
};

const Siatka: React.FC<PropsKlocka> = ({ k, od, s, bazaUrl, dlugosc }) => {
  const f = useCurrentFrame();
  const punkty = k.punkty ?? [];
  const kolumny = punkty.length <= 4 ? 2 : 3;
  const krok = odstepPunktow(od, dlugosc, punkty.length);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${kolumny}, 1fr)`, gap: 24 * s, width: "100%" }}>
      {punkty.map((p, i) => {
        const [ikona, tekst] = rozdzielIkone(p);
        return (
          <div key={i} style={{ ...pop(f, od + i * krok), ...karta(s), display: "flex", alignItems: "center", gap: 18 * s, padding: `${24 * s}px ${26 * s}px` }}>
            <Ikona ikona={ikona} rozmiar={56 * s} bazaUrl={bazaUrl} />
            <span style={{ fontFamily: CZCIONKA.tekst, fontWeight: 700, fontSize: 36 * s, lineHeight: 1.2, color: KOLOR.ink }}>{tekst}</span>
          </div>
        );
      })}
    </div>
  );
};

const LiniaCzasu: React.FC<PropsKlocka> = ({ k, od, s, dlugosc }) => {
  const f = useCurrentFrame();
  const punkty = k.punkty ?? [];
  const krok = odstepPunktow(od, dlugosc, punkty.length);
  const linia = postep(f, od, od + krok * Math.max(1, punkty.length - 1) + 10, E.inOutCubic);
  return (
    <div style={{ position: "relative", width: "100%", paddingTop: 20 * s }}>
      <div style={{ position: "absolute", left: `${50 / punkty.length}%`, right: `${50 / punkty.length}%`, top: 20 * s + 22 * s, height: 6 * s, backgroundColor: KOLOR.line }}>
        <div style={{ height: "100%", width: `${linia * 100}%`, backgroundColor: KOLOR.accent }} />
      </div>
      <div style={{ display: "flex" }}>
        {punkty.map((p, i) => {
          const [ikona, tekst] = rozdzielIkone(p);
          return (
            <div key={i} style={{ ...pop(f, od + i * krok), flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * s }}>
              <div style={{ width: 50 * s, height: 50 * s, borderRadius: 999, backgroundColor: KOLOR.accent, border: `6px solid ${KOLOR.paper}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: CZCIONKA.tekst, fontWeight: 800, fontSize: 22 * s, color: "#fff" }}>
                {i + 1}
              </div>
              {ikona && <Ikona ikona={ikona} rozmiar={54 * s} bazaUrl="" />}
              <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 700, fontSize: 32 * s, lineHeight: 1.2, color: KOLOR.ink, textAlign: "center", padding: `0 ${10 * s}px` }}>{tekst}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Porownanie: React.FC<PropsKlocka> = ({ k, od, s, dlugosc }) => {
  const f = useCurrentFrame();
  const krok = Math.min(24, Math.max(10, Math.floor((dlugosc - od) * 0.3)));
  const strona = (d: { naglowek: string; punkty: string[] } | undefined, dobra: boolean, opoznienie: number) => (
    <div style={{ ...wjazd(f, opoznienie, 60 * s), ...karta(s), flex: 1, borderTop: `${8 * s}px solid ${dobra ? KOLOR.green : KOLOR.red}` }}>
      <div style={{ fontFamily: CZCIONKA.tekst, fontWeight: 800, fontSize: 40 * s, color: dobra ? KOLOR.green : KOLOR.red, marginBottom: 18 * s }}>{d?.naglowek}</div>
      {(d?.punkty ?? []).map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 14 * s, alignItems: "baseline", fontFamily: CZCIONKA.tekst, fontWeight: 600, fontSize: 34 * s, lineHeight: 1.3, color: KOLOR.inkSoft, marginTop: 10 * s }}>
          <span style={{ color: dobra ? KOLOR.green : KOLOR.red, fontWeight: 800 }}>{dobra ? "✓" : "✕"}</span>
          {p}
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 30 * s, width: "100%" }}>
      {strona(k.lewo, false, od)}
      {strona(k.prawo, true, od + krok)}
    </div>
  );
};

const KOMPONENTY: Record<Klocek["typ"], React.FC<PropsKlocka>> = {
  naglowek: Naglowek,
  etykieta: Etykieta,
  kafel: Kafel,
  lista: Lista,
  licznik: Licznik,
  pasek: Pasek,
  strzalka: Strzalka,
  podswietlenie: Podswietlenie,
  cytat: Cytat,
  ikona: IkonaDuza,
  obraz: Obraz,
  siatka: Siatka,
  "linia-czasu": LiniaCzasu,
  porownanie: Porownanie,
};

const W_RZEDZIE = new Set<Klocek["typ"]>(["kafel", "licznik", "ikona", "strzalka"]);

/**
 * Reguła układu: dwa do czterech kafli, liczników albo ikon (ze strzałkami między nimi) stają w rzędzie,
 * reszta w kolumnie. Rząd zaczyna się od etykiety albo nagłówka, jeśli są pierwsze.
 */
export function podzialNaRzad(klocki: Klocek[]): { gora: Klocek[]; rzad: Klocek[] } {
  const gora: Klocek[] = [];
  let i = 0;
  while (i < klocki.length && (klocki[i].typ === "etykieta" || klocki[i].typ === "naglowek")) gora.push(klocki[i++]);
  const reszta = klocki.slice(i);
  const glowne = reszta.filter((k) => k.typ !== "strzalka").length;
  if (reszta.length && reszta.every((k) => W_RZEDZIE.has(k.typ)) && glowne >= 2 && glowne <= 4) return { gora, rzad: reszta };
  return { gora: klocki, rzad: [] };
}

export const UkladKlockow: React.FC<{
  klocki: Klocek[];
  wejscia: Record<string, number>;
  szerokosc: number;
  wysrodkuj: boolean;
  bazaUrl: string;
  dlugosc: number;
}> = ({ klocki, wejscia, szerokosc, wysrodkuj, bazaUrl, dlugosc }) => {
  const s = Math.max(0.75, Math.min(1.4, szerokosc / 1000));
  const { gora, rzad } = podzialNaRzad(klocki);
  const rysuj = (k: Klocek, poziomo: boolean) => {
    const K = KOMPONENTY[k.typ];
    return K ? <K key={k.id} k={k} od={wejscia[k.id] ?? 0} s={s} bazaUrl={bazaUrl} poziomo={poziomo} dlugosc={dlugosc} /> : null;
  };
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: wysrodkuj ? "center" : "flex-start", gap: 34 * s, textAlign: wysrodkuj ? "center" : "left" }}>
      {gora.map((k) => rysuj(k, false))}
      {rzad.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 26 * s, width: "100%" }}>{rzad.map((k) => rysuj(k, true))}</div>}
    </div>
  );
};
