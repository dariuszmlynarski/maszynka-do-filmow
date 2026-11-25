// Film 16:9 bez nagrania Dariusza: lektor z klonu ElevenLabs scena po scenie -> nagranie/sN.mp3 + os.json + lektor.mp3.
// Ten sam wynik co film-tnij.py (który tnie nagranie Dariusza), więc dalej idzie film-wydaj.sh.
// Użycie: npx tsx scripts/film-lektor.ts projekty/<film> [s3 s5 ...]   (lista scen = wygeneruj tylko te, resztę weź z dysku)
// Wejście: projekty/<film>/lektor.json = { "s1": "tekst lektora", ... }. Klucz i głos z dane/ustawienia.json.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generujLektora } from "../server/elevenlabs";

const d = process.argv[2];
const tylko = new Set(process.argv.slice(3));
const ust = JSON.parse(readFileSync("dane/ustawienia.json", "utf8"));
const teksty: Record<string, string> = JSON.parse(readFileSync(join(d, "lektor.json"), "utf8"));
const PRE = 0.4, GAP = 0.7, END = 1.8;

const sekundy = (plik: string) =>
  +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", plik]).toString().trim();

async function main() {
  type Sc = { id: string; start: number; audio: string; czas: number; slowa: { tekst: string; start: number; koniec: number }[] };
  const sceny: Sc[] = [];
  let t = PRE;
  const ids = Object.keys(teksty);
  for (const [i, id] of ids.entries()) {
    const mp3 = join(d, `nagranie/${id}.mp3`);
    const js = join(d, `nagranie/${id}.json`);
    if (tylko.size === 0 || tylko.has(id) || !existsSync(js)) {
      const w = await generujLektora({
        klucz: ust.elevenLabsApiKey, voiceId: ust.voiceId, tekst: teksty[id],
        model: ust.model, stabilnosc: 0.45, podobienstwo: 0.85, styl: ust.styl,
      });
      writeFileSync(mp3, w.audio);
      writeFileSync(js, JSON.stringify(w.slowa, null, 1));
      console.log("wygenerowano", id);
    }
    const slowa = JSON.parse(readFileSync(js, "utf8"));
    const czas = +(sekundy(mp3)).toFixed(3);
    sceny.push({ id, start: +t.toFixed(3), audio: `nagranie/${id}.mp3`, czas, slowa });
    t += czas + (i < ids.length - 1 ? GAP : END);
  }
  writeFileSync(join(d, "os.json"), JSON.stringify({ sceny, calosc: +t.toFixed(3) }, null, 1));
  const inp: string[] = [], flt: string[] = [];
  sceny.forEach((s, i) => {
    inp.push("-i", join(d, s.audio));
    const ms = Math.round(s.start * 1000);
    flt.push(`[${i}:a]adelay=${ms}|${ms}[a${i}]`);
  });
  flt.push(sceny.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${sceny.length}:normalize=0,apad=whole_dur=${t},loudnorm=I=-16:TP=-1.5:LRA=11[out]`);
  execFileSync("ffmpeg", ["-y", "-v", "error", ...inp, "-filter_complex", flt.join(";"), "-map", "[out]", "-ar", "44100", "-ac", "2", "-b:a", "192k", join(d, "lektor.mp3")]);
  console.log("całość", t.toFixed(2), "s");
  for (const s of sceny) console.log(s.id, s.start, s.czas);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
