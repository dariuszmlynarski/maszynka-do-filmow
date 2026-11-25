// Film „Jira w pięć minut” dla zespołu marketingu WellU (16:9, głos z klonu ElevenLabs Dariusza, 25.11.2026).
// Scenariusz: dmOS 01-Inbox/Wideo Jira dla Angeliki — scenariusz do akceptacji (na 26.11).md. Media (poza repo): public/film-jira/.
// Makieta Jiry w barwach WellU, a nie zrzut: prawdziwe zadania MARK niosą nazwiska, ceny i pliki marki.
import React from "react";
import { AbsoluteFill, Audio, Easing, interpolate, staticFile } from "remotion";
import { AtSign, Bell, Check, ChevronDown, FileImage, FileText, Mail, MousePointer2, Paperclip, Plus, Search, Star, ArrowRightLeft, User } from "lucide-react";
import { Awatar, Naglowek, useT, zrobFilm, type Os } from "./fabryka";
import { CZCIONKA } from "../marka";
import OS from "./os-jira.json";

// Paleta WellU (02-WU/About/Branding/Identyfikacja-Wizualna.md): granat, ciepła szarość, złoto.
const W = {
  bg: "#EAEBE6",
  card: "#FFFFFF",
  ink: "#1A1A1A",
  mut: "#6B6B6B",
  line: "#D6D7D1",
  a: "#2D3858",
  dark: "#1B262C",
  gold: "#EBB92F",
  goldT: "#FBF1D3",
  tint: "#E4E7EF",
  ok: "#4E9A3A",
};

const F = zrobFilm(OS as Os, { tlo: "rgba(27,38,44,.9)", akcent: W.gold });
export const jiraKlatki = F.klatki;
const { kiedy, start, Scena } = F;
const kl = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
const tx = (size: number, weight = 700, color: string = W.ink): React.CSSProperties => ({ fontFamily: CZCIONKA.tekst, fontSize: size, fontWeight: weight, color, lineHeight: 1.25 });
const Nag: React.FC<{ e: string; t: string }> = ({ e, t }) => <Naglowek eyebrow={e} tytul={t} kolor={W.gold} tusz={W.a} />;

// Obszar makiety: lewa część kadru, awatar i napisy mają swoje miejsce.
const L = 110, T = 250, SZ = 1300, WY = 640;

const OSOBY: Record<string, { bg: string; fg: string }> = {
  A: { bg: W.gold, fg: W.dark },
  K: { bg: W.a, fg: "#fff" },
  B: { bg: "#8A9A7B", fg: "#fff" },
};
const Kolko: React.FC<{ o: string; d?: number; ring?: number }> = ({ o, d = 34, ring = 0 }) => (
  <div style={{ width: d, height: d, borderRadius: 999, background: OSOBY[o].bg, color: OSOBY[o].fg, display: "flex", alignItems: "center", justifyContent: "center", ...tx(d * 0.45, 800, OSOBY[o].fg), boxShadow: ring ? `0 0 0 ${3 * ring}px #fff, 0 0 0 ${6 * ring}px ${W.gold}` : "none", flexShrink: 0 }}>{o}</div>
);

const Kursor: React.FC<{ x: number; y: number; klik?: number }> = ({ x, y, klik = 0 }) => (
  <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
    {klik > 0 && klik < 1 && <div style={{ position: "absolute", left: -22, top: -22, width: 44, height: 44, borderRadius: 999, border: `3px solid ${W.gold}`, transform: `scale(${0.4 + klik})`, opacity: 1 - klik }} />}
    <MousePointer2 size={40} color={W.dark} fill="#fff" strokeWidth={1.8} />
  </div>
);

/** Pasek Jiry u góry makiety: logo, szukaj, Utwórz, dzwonek. */
const Pasek: React.FC<{ hlUtworz?: number; dzwonek?: number }> = ({ hlUtworz = 0, dzwonek = 0 }) => (
  <div style={{ height: 64, background: W.a, borderRadius: "18px 18px 0 0", display: "flex", alignItems: "center", padding: "0 24px", gap: 20 }}>
    <div style={tx(26, 800, "#fff")}>Jira</div>
    <div style={{ flex: 1, height: 38, borderRadius: 10, background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", gap: 10, padding: "0 14px", maxWidth: 420 }}>
      <Search size={20} color="#fff" opacity={0.7} />
      <span style={tx(17, 500, "rgba(255,255,255,.7)")}>Szukaj</span>
    </div>
    <div style={{ background: W.gold, borderRadius: 10, padding: "8px 18px", display: "flex", alignItems: "center", gap: 8, transform: `scale(${1 + 0.12 * hlUtworz})`, boxShadow: hlUtworz ? `0 0 0 ${5 * hlUtworz}px rgba(235,185,47,.4)` : "none" }}>
      <Plus size={20} color={W.dark} strokeWidth={3} /><span style={tx(18, 800, W.dark)}>Utwórz</span>
    </div>
    <div style={{ flex: 1 }} />
    <div style={{ position: "relative", transform: `scale(${1 + 0.3 * dzwonek})` }}>
      <Bell size={28} color="#fff" />
      {dzwonek > 0.05 && <div style={{ position: "absolute", top: -8, right: -10, minWidth: 24, height: 24, borderRadius: 99, background: W.gold, ...tx(14, 800, W.dark), display: "flex", alignItems: "center", justifyContent: "center", opacity: dzwonek }}>3</div>}
    </div>
    <Kolko o="A" d={36} />
  </div>
);

// ---------- Tablica ----------
type Karta = { key: string; tytul: string; o: string; kol: number; idx: number };
const KARTY: Karta[] = [
  { key: "MARK-1012", tytul: "Post na premierę: tekst i grafika", o: "A", kol: 0, idx: 0 },
  { key: "MARK-1009", tytul: "Sety świąteczne: opisy produktów", o: "B", kol: 0, idx: 1 },
  { key: "MARK-1007", tytul: "Make Up Days: plakaty do salonów", o: "A", kol: 0, idx: 2 },
  { key: "MARK-1001", tytul: "Premiera rozświetlacza: komunikacja", o: "K", kol: 1, idx: 0 },
  { key: "MARK-1004", tytul: "Newsletter grudzień: zdjęcia", o: "A", kol: 1, idx: 1 },
  { key: "MARK-998", tytul: "Katalog digital: korekta", o: "K", kol: 2, idx: 0 },
  { key: "MARK-995", tytul: "Konkurs sprzedażowy: regulamin", o: "B", kol: 2, idx: 1 },
];
const KOLUMNY = ["Do zrobienia", "W trakcie realizacji", "Gotowe"];
const KX = (k: number) => 24 + k * 418, KW = 400, KY = (i: number) => 196 + i * 112, KH = 98;

const Tablica: React.FC<{
  wejscie?: number; hlKol?: number[]; filtr?: number; hlZdjecie?: number;
  ruch?: { key: string; doKol: number; doIdx: number; p: number }[]; dodana?: { karta: Karta; p: number }; hlUtworz?: number; dzwonek?: number; hlKarta?: string; przestaw?: Record<string, { kol: number; idx: number }>;
}> = ({ wejscie = 1, hlKol = [0, 0, 0], filtr = 0, hlZdjecie = 0, ruch = [], dodana, hlUtworz = 0, dzwonek = 0, hlKarta, przestaw = {} }) => {
  const karty = (dodana ? [...KARTY, dodana.karta] : KARTY).map((c) => (przestaw[c.key] ? { ...c, ...przestaw[c.key] } : c));
  return (
    <div style={{ position: "absolute", left: L, top: T, width: SZ, height: WY, background: W.card, borderRadius: 18, boxShadow: "0 18px 50px rgba(27,38,44,.14)", overflow: "hidden", isolation: "isolate" }}>
      <Pasek hlUtworz={hlUtworz} dzwonek={dzwonek} />
      <div style={{ position: "absolute", left: 24, top: 82, ...tx(15, 700, W.mut) }}>Projekty / Marketing</div>
      <div style={{ position: "absolute", left: 24, top: 104, ...tx(30, 800, W.a) }}>Tablica MARK</div>
      <div style={{ position: "absolute", left: 300, top: 108, display: "flex", gap: 6, alignItems: "center" }}>
        {["A", "K", "B"].map((o) => <Kolko key={o} o={o} d={36} ring={o === "A" ? hlZdjecie : 0} />)}
      </div>
      {KOLUMNY.map((n, k) => (
        <div key={n} style={{ position: "absolute", left: KX(k), top: 158, width: KW, height: WY - 172, background: hlKol[k] ? `rgba(235,185,47,${0.22 * hlKol[k]})` : "#F4F4F1", borderRadius: 14, border: hlKol[k] ? `2.5px solid rgba(235,185,47,${hlKol[k]})` : "2.5px solid transparent" }}>
          <div style={{ padding: "12px 16px", ...tx(15, 800, W.mut), letterSpacing: "0.06em", textTransform: "uppercase" }}>{n}</div>
        </div>
      ))}
      {karty.map((c, i) => {
        const p = kl(wejscie, i * 0.08, i * 0.08 + 0.4);
        const r = ruch.find((x) => x.key === c.key);
        let x = KX(c.kol) + 12, y = KY(c.idx);
        if (r) { x = interpolate(r.p, [0, 1], [x, KX(r.doKol) + 12]); y = interpolate(r.p, [0, 1], [y, KY(r.doIdx)]); }
        const dp = dodana && c.key === dodana.karta.key ? dodana.p : 1;
        const blada = c.o !== "A" ? 1 - 0.8 * filtr : 1;
        const lift = r && r.p > 0 && r.p < 1 ? 1 : 0;
        const hl = hlKarta === c.key;
        return (
          <div key={c.key} style={{ position: "absolute", left: x, top: y + (1 - p) * 30 - (1 - dp) * 60, width: KW - 24, height: KH, background: W.card, borderRadius: 12, border: `2px solid ${filtr > 0.5 && c.o === "A" ? W.gold : W.line}`, boxShadow: lift || hl ? "0 16px 30px rgba(27,38,44,.25)" : "0 2px 4px rgba(27,38,44,.06)", opacity: p * blada * dp, padding: "12px 14px", transform: `rotate(${lift * 2}deg) scale(${hl ? 1.04 : 1})`, zIndex: lift ? 5 : 1 }}>
            <div style={tx(18, 700)}>{c.tytul}</div>
            <div style={{ position: "absolute", left: 14, bottom: 10, ...tx(14, 700, W.mut) }}>{c.key}</div>
            <div style={{ position: "absolute", right: 12, bottom: 8 }}><Kolko o={c.o} d={28} /></div>
          </div>
        );
      })}
    </div>
  );
};

// ---------- Zadanie od środka ----------
const Ramka: React.FC<{ p: number; x: number; y: number; w: number; h: number }> = ({ p, x, y, w, h }) =>
  p > 0.01 ? <div style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: 14, border: `4px solid ${W.gold}`, boxShadow: `0 0 0 8px rgba(235,185,47,.25)`, opacity: p }} /> : null;

const Zadanie: React.FC<{
  wejscie?: number; hl?: [number, number, number]; pisanie?: number; podpowiedz?: number; wybrano?: number; wyslano?: number; zalacznik?: number; status?: string; menu?: number;
}> = ({ wejscie = 1, hl = [0, 0, 0], pisanie = 0, podpowiedz = 0, wybrano = 0, wyslano = 0, zalacznik = 0, status = "Do zrobienia", menu = 0 }) => {
  const reszta = "grafiki gotowe, zerkniesz?";
  const znaki = Math.floor(pisanie * 4);
  const tekstKom = wybrano > 0.5 ? reszta.slice(0, Math.floor(Math.max(0, (wybrano - 0.5) * 2) * reszta.length)) : "";
  const wTrakcie = status !== "Do zrobienia";
  return (
    <div style={{ position: "absolute", left: L, top: T, width: SZ, height: WY, background: W.card, borderRadius: 18, boxShadow: "0 18px 50px rgba(27,38,44,.14)", overflow: "hidden", opacity: wejscie, transform: `scale(${0.96 + 0.04 * wejscie})` }}>
      <Pasek />
      <div style={{ position: "absolute", left: 36, top: 84, ...tx(15, 700, W.mut) }}>Marketing / MARK-1012</div>
      <div style={{ position: "absolute", left: 36, top: 108, width: 780, ...tx(34, 800, W.a) }}>Post na premierę: tekst i grafika</div>
      <div style={{ position: "absolute", left: 36, top: 162, display: "flex", alignItems: "center", gap: 8, background: wTrakcie ? W.goldT : W.tint, border: `2px solid ${wTrakcie ? W.gold : W.a}`, borderRadius: 10, padding: "6px 14px" }}>
        <span style={tx(16, 800, W.a)}>{status}</span><ChevronDown size={18} color={W.a} />
      </div>
      {menu > 0.01 && (
        <div style={{ position: "absolute", left: 36, top: 206, width: 300, background: W.card, borderRadius: 12, boxShadow: "0 14px 34px rgba(27,38,44,.22)", border: `1.5px solid ${W.line}`, opacity: menu, zIndex: 9 }}>
          {KOLUMNY.map((n, i) => (
            <div key={n} style={{ padding: "12px 16px", ...tx(17, 700), background: i === 1 && menu > 0.6 ? W.goldT : "transparent" }}>{n}</div>
          ))}
        </div>
      )}
      <div style={{ position: "absolute", left: 36, top: 218, width: 780, ...tx(18, 500, W.ink) }}>
        <div style={tx(15, 800, W.mut)}>OPIS</div>
        Post na Facebooka i Instagram na dzień premiery. Tekst do 600 znaków, grafika 1080 × 1350, zdjęcie produktu z sesji.
      </div>
      <div style={{ position: "absolute", left: 36, top: 326, ...tx(15, 800, W.mut) }}>ZAŁĄCZNIKI</div>
      <div style={{ position: "absolute", left: 36, top: 352, display: "flex", gap: 12 }}>
        {["brief.pdf", "sesja_01.jpg"].map((n, i) => (
          <div key={n} style={{ width: 132, height: 70, borderRadius: 10, background: "#F4F4F1", border: `1.5px solid ${W.line}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {i === 0 ? <FileText size={24} color={W.a} /> : <FileImage size={24} color={W.a} />}<span style={tx(13, 700, W.mut)}>{n}</span>
          </div>
        ))}
        {zalacznik > 0.01 && (
          <div style={{ width: 132, height: 70, borderRadius: 10, background: W.goldT, border: `2px solid ${W.gold}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, opacity: zalacznik, transform: `scale(${0.6 + 0.4 * zalacznik})` }}>
            <FileImage size={24} color={W.a} /><span style={tx(13, 700, W.a)}>post_premiera.png</span>
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: 36, top: 440, ...tx(15, 800, W.mut) }}>KOMENTARZE</div>
      <div style={{ position: "absolute", left: 36, top: 466, width: 780, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><Kolko o="K" d={30} /><div><span style={tx(15, 800)}>Kasjana Serafin</span><div style={tx(16, 500)}>Brief w załącznikach, publikacja w piątek rano.</div></div></div>
        {wyslano > 0.01 ? (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", opacity: wyslano }}><Kolko o="A" d={30} /><div><span style={tx(15, 800)}>Angelika</span><div style={tx(16, 500)}><span style={{ background: W.tint, color: W.a, borderRadius: 6, padding: "0 6px", fontWeight: 800 }}>@Kasjana Serafin</span> {reszta}</div></div></div>
        ) : (
          <div style={{ position: "relative", border: `2px solid ${pisanie > 0 ? W.a : W.line}`, borderRadius: 10, padding: "10px 14px", ...tx(17, 500, pisanie > 0 ? W.ink : W.mut) }}>
            {pisanie <= 0 && wybrano <= 0 ? "Dodaj komentarz…" : wybrano > 0.5 ? <><span style={{ background: W.tint, color: W.a, borderRadius: 6, padding: "0 6px", fontWeight: 800 }}>@Kasjana Serafin</span> {tekstKom}</> : "@Kas".slice(0, znaki)}
            {podpowiedz > 0.01 && wybrano < 0.5 && (
              <div style={{ position: "absolute", left: 14, bottom: 52, width: 300, background: W.card, borderRadius: 12, boxShadow: "0 14px 34px rgba(27,38,44,.22)", border: `1.5px solid ${W.line}`, opacity: podpowiedz }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", background: wybrano > 0.2 ? W.goldT : "transparent" }}><Kolko o="K" d={28} /><span style={tx(17, 700)}>Kasjana Serafin</span></div>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ position: "absolute", left: 880, top: 96, width: 380, background: "#F7F7F4", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        {[
          { e: "Osoba przypisana", o: "A", n: "Angelika" },
          { e: "Zgłaszający", o: "K", n: "Kasjana Serafin" },
        ].map((r) => (
          <div key={r.e}>
            <div style={tx(14, 800, W.mut)}>{r.e.toUpperCase()}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6 }}><Kolko o={r.o} d={32} /><span style={tx(19, 700)}>{r.n}</span></div>
          </div>
        ))}
        <div><div style={tx(14, 800, W.mut)}>PROJEKT</div><div style={{ ...tx(19, 700), marginTop: 6 }}>Marketing</div></div>
      </div>
      <Ramka p={hl[0]} x={22} y={98} w={820} h={212} />
      <Ramka p={hl[1]} x={866} y={82} w={408} h={190} />
      <Ramka p={hl[2]} x={22} y={316} w={820} h={300} />
    </div>
  );
};

// ---------- Sceny ----------
const S1: React.FC = () => {
  const t = useT();
  const z = kl(t, kiedy("s1", "jedna") - 0.2, kiedy("s1", "jedna") + 0.9);
  const maile = ["RE: RE: premiera rozświetlacza", "FW: grafika do posta — nowa wersja", "RE: FW: premiera, poprawki", "RE: a gdzie jest brief?", "RE: RE: RE: premiera"];
  return (
    <>
      <Nag e="Witaj w Jirze" t="Jedna sprawa, jedno miejsce" />
      <div style={{ position: "absolute", left: 160, top: 300 }}>
        {maile.map((m, i) => {
          const p = kl(t, start("s1") + 0.3 + i * 0.25, start("s1") + 0.7 + i * 0.25);
          return (
            <div key={m} style={{ position: "absolute", top: i * 76 * (1 - z) + 120 * z, left: (i % 2) * 40 * (1 - z) + 0 * z, width: 620, height: 62, background: W.card, borderRadius: 12, border: `1.5px solid ${W.line}`, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", opacity: p * (1 - z), transform: `rotate(${(i - 2) * 1.5 * (1 - z)}deg)` }}>
              <Mail size={26} color={W.mut} /><span style={tx(21, 700)}>{m}</span>
            </div>
          );
        })}
        <div style={{ position: "absolute", top: 40, left: 700 * (1 - z) + 180 * z, width: 760, background: W.card, borderRadius: 18, border: `3px solid ${W.gold}`, padding: "24px 28px", opacity: z, transform: `scale(${0.85 + 0.15 * z})`, boxShadow: "0 18px 50px rgba(27,38,44,.16)" }}>
          <div style={tx(20, 800, W.mut)}>MARK-1001</div>
          <div style={{ ...tx(42, 800, W.a), marginTop: 8 }}>Premiera rozświetlacza: komunikacja</div>
          <div style={{ display: "flex", gap: 28, marginTop: 22, ...tx(24, 700, W.mut) }}>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}><Paperclip size={20} /> 12 plików</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}><AtSign size={20} /> 24 komentarze</span>
          </div>
        </div>
      </div>
    </>
  );
};

const S2: React.FC = () => {
  const t = useT();
  const klik = kl(t, kiedy("s2", "klikasz"), kiedy("s2", "klikasz") + 0.5);
  const pasek = kl(t, kiedy("s2", "zapisz") - 0.5, kiedy("s2", "zapisz"));
  const gw = kl(t, kiedy("s2", "zakładkach") - 0.2, kiedy("s2", "zakładkach") + 0.4);
  const p0 = kl(t, start("s2"), start("s2") + 0.5);
  return (
    <>
      <Nag e="Pierwszy krok" t="Zaproszenie i zakładka" />
      <div style={{ position: "absolute", left: 160, top: 300, width: 620, background: W.card, borderRadius: 18, padding: "26px 30px", opacity: p0 * (1 - 0.6 * pasek), boxShadow: "0 18px 50px rgba(27,38,44,.12)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}><Mail size={30} color={W.a} /><span style={tx(18, 700, W.mut)}>Atlassian · do: Angelika</span></div>
        <div style={{ ...tx(30, 800, W.a), marginTop: 14 }}>Zaproszenie do Jira w WellU</div>
        <div style={{ marginTop: 20, display: "inline-block", background: W.a, borderRadius: 10, padding: "12px 26px", ...tx(20, 800, "#fff"), transform: `scale(${1 + 0.1 * Math.sin(klik * Math.PI)})` }}>Dołącz</div>
      </div>
      {klik > 0 && klik < 1 && <Kursor x={300} y={490} klik={klik} />}
      <div style={{ position: "absolute", left: 160, top: 640, width: 1080, height: 76, background: W.card, borderRadius: 16, display: "flex", alignItems: "center", gap: 18, padding: "0 24px", opacity: pasek, transform: `translateY(${(1 - pasek) * 30}px)`, boxShadow: "0 18px 50px rgba(27,38,44,.12)" }}>
        <div style={{ flex: 1, height: 46, borderRadius: 999, background: "#F1F1EE", display: "flex", alignItems: "center", padding: "0 22px", ...tx(24, 700, W.a) }}>wellu.atlassian.net</div>
        <Star size={40} color={gw > 0.5 ? W.gold : W.mut} fill={gw > 0.5 ? W.gold : "none"} style={{ transform: `scale(${1 + 0.4 * Math.sin(gw * Math.PI)})` }} />
      </div>
    </>
  );
};

const S3: React.FC = () => {
  const t = useT();
  const hl = [kl(t, kiedy("s3", "do"), kiedy("s3", "do") + 0.3), kl(t, kiedy("s3", "trakcie"), kiedy("s3", "trakcie") + 0.3), kl(t, kiedy("s3", "gotowe"), kiedy("s3", "gotowe") + 0.3)];
  return (
    <>
      <Nag e="Projekt Marketing" t="Tablica: karta to zadanie" />
      <Tablica wejscie={kl(t, kiedy("s3", "tablica") - 0.4, kiedy("s3", "karta") + 0.6)} hlKol={hl} />
    </>
  );
};

const S4: React.FC = () => {
  const t = useT();
  const k = kiedy("s4", "kliknij");
  const mv = kl(t, k - 0.8, k);
  const klik = kl(t, k, k + 0.5);
  return (
    <>
      <Nag e="Twój dzień" t="Tylko Twoje zadania" />
      <Tablica hlZdjecie={klik} filtr={kl(t, kiedy("s4", "zostaje") - 0.3, kiedy("s4", "zostaje") + 0.4)} />
      {t < kiedy("s4", "zostaje") + 0.5 && <Kursor x={interpolate(mv, [0, 1], [L + 700, L + 312])} y={interpolate(mv, [0, 1], [T + 400, T + 120])} klik={klik} />}
    </>
  );
};

const S5: React.FC = () => {
  const t = useT();
  const otw = kl(t, kiedy("s5", "otworzy") - 0.2, kiedy("s5", "otworzy") + 0.4);
  const hl: [number, number, number] = [
    kl(t, kiedy("s5", "góry"), kiedy("s5", "góry") + 0.3) * (1 - kl(t, kiedy("s5", "prawej") - 0.2, kiedy("s5", "prawej"))),
    kl(t, kiedy("s5", "prawej"), kiedy("s5", "prawej") + 0.3) * (1 - kl(t, kiedy("s5", "niżej") - 0.2, kiedy("s5", "niżej"))),
    kl(t, kiedy("s5", "niżej"), kiedy("s5", "niżej") + 0.3),
  ];
  return (
    <>
      <Nag e="Zadanie od środka" t="Co, kto i cała rozmowa" />
      {otw < 1 && <div style={{ opacity: 1 - otw }}><Tablica hlKarta="MARK-1012" /><Kursor x={L + 200} y={T + 230} klik={kl(t, start("s5"), start("s5") + 0.5)} /></div>}
      {otw > 0 && <Zadanie wejscie={otw} hl={hl} />}
    </>
  );
};

const S6: React.FC = () => {
  const t = useT();
  const pis = kl(t, kiedy("s6", "małpy") - 0.2, kiedy("s6", "imię") + 0.2);
  const pod = kl(t, kiedy("s6", "imię"), kiedy("s6", "imię") + 0.3);
  const wyb = interpolate(t, [kiedy("s6", "wybierasz"), kiedy("s6", "piszesz") + 1.0], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wys = kl(t, kiedy("s6", "powiadomienie") - 0.6, kiedy("s6", "powiadomienie") - 0.2);
  const dz = kl(t, kiedy("s6", "powiadomienie"), kiedy("s6", "powiadomienie") + 0.4);
  return (
    <>
      <Nag e="Najważniejszy ruch" t="Komentarz z @ imieniem" />
      <Zadanie pisanie={pis} podpowiedz={pod} wybrano={wyb} wyslano={wys} />
      {dz > 0.01 && (
        <div style={{ position: "absolute", left: L + 900, top: T + 330, width: 360, background: W.dark, borderRadius: 16, padding: "16px 18px", display: "flex", gap: 12, alignItems: "center", opacity: dz, transform: `translateY(${(1 - dz) * 20}px)`, boxShadow: "0 18px 40px rgba(27,38,44,.3)" }}>
          <Bell size={28} color={W.gold} />
          <div><div style={tx(15, 800, W.gold)}>Kasjana dostaje</div><div style={tx(17, 700, "#fff")}>Angelika wspomniała o Tobie w MARK-1012</div></div>
        </div>
      )}
    </>
  );
};

const S7: React.FC = () => {
  const t = useT();
  const k = kiedy("s7", "przeciągając");
  const mv = kl(t, k - 0.3, k + 1.2);
  const zal = kl(t, k + 1.2, k + 1.6);
  return (
    <>
      <Nag e="Pliki przy sprawie" t="Przeciągnij plik na zadanie" />
      <Zadanie wyslano={1} zalacznik={zal} />
      {zal < 1 && t > k - 0.3 && (
        <div style={{ position: "absolute", left: interpolate(mv, [0, 1], [L + 1000, L + 340]), top: interpolate(mv, [0, 1], [T + 560, T + 352]), width: 132, height: 70, borderRadius: 10, background: W.goldT, border: `2px dashed ${W.gold}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 1 - zal, boxShadow: "0 14px 30px rgba(27,38,44,.2)", transform: "rotate(-3deg)" }}>
          <FileImage size={24} color={W.a} /><span style={tx(13, 700, W.a)}>post_premiera.png</span>
          <div style={{ position: "absolute", right: -26, bottom: -30 }}><MousePointer2 size={36} color={W.dark} fill="#fff" /></div>
        </div>
      )}
    </>
  );
};

const S8: React.FC = () => {
  const t = useT();
  const zm = kiedy("s8", "zmień");
  const menu = kl(t, zm, zm + 0.3) * (1 - kl(t, zm + 1.6, zm + 1.9));
  const naTablice = kl(t, kiedy("s8", "możesz") - 0.3, kiedy("s8", "możesz") + 0.2);
  const r1 = kl(t, kiedy("s8", "przeciągnąć"), kiedy("s8", "przeciągnąć") + 0.9);
  const r2 = kl(t, kiedy("s8", "przesuwasz"), kiedy("s8", "przesuwasz") + 0.9);
  const status = t > zm + 1.4 ? "W trakcie realizacji" : "Do zrobienia";
  const ruch = r2 > 0 ? [{ key: "MARK-1012", doKol: 2, doIdx: 2, p: r2 }] : [{ key: "MARK-1012", doKol: 1, doIdx: 2, p: r1 }];
  // Po pierwszym ruchu karta startuje z kolumny „W trakcie”.
  const KartaPoRuchu = r2 > 0;
  return (
    <>
      <Nag e="Status" t="Do zrobienia → W trakcie → Gotowe" />
      {naTablice < 1 && <div style={{ opacity: 1 - naTablice }}><Zadanie wyslano={1} zalacznik={1} status={status} menu={menu} /></div>}
      {naTablice > 0 && (
        <div style={{ opacity: naTablice }}>
          {KartaPoRuchu ? (
            <TablicaPoRuchu p={r2} />
          ) : (
            <Tablica ruch={ruch} hlKol={[0, r1 > 0 && r1 < 1 ? 1 : 0, 0]} />
          )}
        </div>
      )}
    </>
  );
};
/** Tablica, na której MARK-1012 stoi już w „W trakcie” i jedzie do „Gotowe”. */
const TablicaPoRuchu: React.FC<{ p: number }> = ({ p }) => (
  <Tablica przestaw={{ "MARK-1012": { kol: 1, idx: 2 } }} ruch={[{ key: "MARK-1012", doKol: 2, doIdx: 2, p }]} hlKol={[0, 0, p > 0 && p < 1 ? 1 : 0]} />
);

const NOWA: Karta = { key: "MARK-1013", tytul: "Post na premierę: zapowiedź w stories", o: "K", kol: 0, idx: 3 };
const S9: React.FC = () => {
  const t = useT();
  const hlU = kl(t, kiedy("s9", "utwórz") - 0.3, kiedy("s9", "utwórz")) * (1 - kl(t, kiedy("s9", "utwórz") + 0.6, kiedy("s9", "utwórz") + 0.9));
  const okno = kl(t, kiedy("s9", "utwórz") + 0.5, kiedy("s9", "utwórz") + 0.9) * (1 - kl(t, kiedy("s9", "dobry") - 0.4, kiedy("s9", "dobry")));
  const pola = [kiedy("s9", "projekt"), kiedy("s9", "tytuł"), kiedy("s9", "opisie"), kiedy("s9", "przypisujesz")].map((x) => kl(t, x, x + 0.4));
  const ladowanie = kl(t, kiedy("s9", "dobry") - 0.2, kiedy("s9", "dobry") + 0.5);
  const wiersze = [
    { e: "Projekt", v: "Marketing" },
    { e: "Tytuł", v: "Post na premierę: zapowiedź w stories" },
    { e: "Opis", v: "3 klatki stories, termin: czwartek" },
    { e: "Osoba przypisana", v: "Kasjana Serafin" },
  ];
  return (
    <>
      <Nag e="Nowe zadanie" t="Przycisk „Utwórz”" />
      <Tablica hlUtworz={hlU} dodana={{ karta: NOWA, p: ladowanie }} />
      {okno > 0.01 && (
        <>
          <div style={{ position: "absolute", left: L, top: T, width: SZ, height: WY, background: "rgba(27,38,44,.35)", borderRadius: 18, opacity: okno }} />
          <div style={{ position: "absolute", left: L + 300, top: T + 70, width: 700, background: W.card, borderRadius: 18, padding: "26px 30px", opacity: okno, transform: `scale(${0.94 + 0.06 * okno})`, boxShadow: "0 24px 60px rgba(27,38,44,.3)" }}>
            <div style={tx(28, 800, W.a)}>Utwórz zadanie</div>
            {wiersze.map((w, i) => (
              <div key={w.e} style={{ marginTop: 16 }}>
                <div style={tx(14, 800, W.mut)}>{w.e.toUpperCase()}</div>
                <div style={{ marginTop: 6, border: `2px solid ${pola[i] > 0.5 ? W.gold : W.line}`, borderRadius: 10, padding: "10px 14px", ...tx(19, 700), minHeight: 46, display: "flex", alignItems: "center", gap: 10 }}>
                  {i === 3 && pola[i] > 0.3 && <Kolko o="K" d={28} />}
                  <span style={{ opacity: pola[i] }}>{w.v}</span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
              <div style={{ background: W.a, borderRadius: 10, padding: "10px 24px", ...tx(19, 800, "#fff") }}>Utwórz</div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

const S10: React.FC = () => {
  const t = useT();
  const dz = kl(t, kiedy("s10", "dzwonkiem") - 0.2, kiedy("s10", "dzwonkiem") + 0.3);
  const lista = kl(t, kiedy("s10", "dzwonkiem") + 0.3, kiedy("s10", "dzwonkiem") + 0.8);
  const maile = kl(t, kiedy("s10", "mailach"), kiedy("s10", "mailach") + 0.4);
  const rano = kl(t, kiedy("s10", "pięć") - 0.2, kiedy("s10", "pięć") + 0.4);
  const pow = ["Kasjana skomentowała MARK-1012", "Przypisano Ci MARK-1015", "MARK-1004 → Gotowe"];
  return (
    <>
      <Nag e="Powiadomienia" t="Dzwonek i maile od Jiry" />
      <Tablica dzwonek={dz} filtr={0} />
      {lista > 0.01 && (
        <div style={{ position: "absolute", left: L + SZ - 470, top: T + 70, width: 440, background: W.card, borderRadius: 14, boxShadow: "0 18px 44px rgba(27,38,44,.28)", border: `1.5px solid ${W.line}`, opacity: lista, padding: "8px 0" }}>
          {pow.map((p, i) => (
            <div key={p} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 18px", opacity: kl(t, kiedy("s10", "dzwonkiem") + 0.4 + i * 0.2, kiedy("s10", "dzwonkiem") + 0.7 + i * 0.2) }}>
              <Bell size={22} color={W.a} /><span style={tx(18, 700)}>{p}</span>
            </div>
          ))}
        </div>
      )}
      {maile > 0.01 && (
        <div style={{ position: "absolute", left: L + SZ - 470, top: T + 300, width: 440, background: W.card, borderRadius: 14, boxShadow: "0 18px 44px rgba(27,38,44,.2)", padding: "14px 18px", display: "flex", gap: 12, alignItems: "center", opacity: maile }}>
          <Mail size={26} color={W.a} /><span style={tx(18, 700)}>Jira: 3 nowe sprawy dla Ciebie</span>
        </div>
      )}
      {rano > 0.01 && (
        <div style={{ position: "absolute", left: L + 40, top: T + WY - 130, background: W.gold, borderRadius: 16, padding: "18px 28px", ...tx(32, 800, W.dark), opacity: rano, transform: `scale(${0.9 + 0.1 * rano})`, boxShadow: "0 18px 40px rgba(27,38,44,.25)" }}>Zajrzyj rano. Pięć minut.</div>
      )}
    </>
  );
};

const S11: React.FC = () => {
  const t = useT();
  const ik = [
    { I: User, n: "Twoje zadania", r: "swoje" },
    { I: AtSign, n: "Komentarz z @", r: "komentarz" },
    { I: Paperclip, n: "Plik", r: "plik" },
    { I: ArrowRightLeft, n: "Status", r: "status" },
    { I: Plus, n: "Nowe zadanie", r: "nowe" },
  ];
  const kon = kl(t, kiedy("s11", "resztę") - 0.2, kiedy("s11", "resztę") + 0.4);
  return (
    <>
      <Nag e="Podstawy w pigułce" t="Pięć ruchów i jedziesz" />
      <div style={{ position: "absolute", left: 120, top: 330, display: "flex", gap: 26 }}>
        {ik.map(({ I, n, r }, i) => {
          const p = kl(t, kiedy("s11", r), kiedy("s11", r) + 0.4);
          return (
            <div key={n} style={{ width: 230, height: 220, background: W.card, borderRadius: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, opacity: p, transform: `translateY(${(1 - p) * 30}px)`, boxShadow: "0 14px 34px rgba(27,38,44,.12)", border: `2.5px solid ${p > 0.9 ? W.gold : "transparent"}` }}>
              <div style={{ width: 84, height: 84, borderRadius: 999, background: i % 2 ? W.goldT : W.tint, display: "flex", alignItems: "center", justifyContent: "center" }}><I size={44} color={W.a} strokeWidth={2.2} /></div>
              <span style={tx(22, 800, W.a)}>{n}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 120, top: 620, display: "flex", gap: 16, alignItems: "center", opacity: kon, transform: `translateY(${(1 - kon) * 20}px)` }}>
        <Check size={36} color={W.ok} strokeWidth={3} />
        <span style={tx(34, 800, W.a)}>Pytania? Kasjana pokaże resztę.</span>
      </div>
    </>
  );
};

export const JiraFilm: React.FC<{ zAwatarem?: boolean; bezNapisow?: boolean }> = ({ zAwatarem, bezNapisow }) => (
  <AbsoluteFill style={{ background: W.bg }}>
    <Audio src={staticFile("film-jira/lektor.mp3")} />
    <Scena id="s1"><S1 /></Scena>
    <Scena id="s2"><S2 /></Scena>
    <Scena id="s3"><S3 /></Scena>
    <Scena id="s4"><S4 /></Scena>
    <Scena id="s5"><S5 /></Scena>
    <Scena id="s6"><S6 /></Scena>
    <Scena id="s7"><S7 /></Scena>
    <Scena id="s8"><S8 /></Scena>
    <Scena id="s9"><S9 /></Scena>
    <Scena id="s10"><S10 /></Scena>
    <Scena id="s11"><S11 /></Scena>
    {bezNapisow ? null : <F.Napisy />}
    {zAwatarem ? <Awatar src={staticFile("film-jira/awatar.mp4")} ramka={W.gold} tlo={W.dark} /> : null}
  </AbsoluteFill>
);
