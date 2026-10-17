# Maszynka do filmów — DMProsper

Lokalna aplikacja, która z linku albo pomysłu robi gotową rolkę (pion 1080×1920, 30 kl/s) na Reels, TikToka i Shorts. Scenariusz pisze Claude Code, lektora czyta ElevenLabs sklonowanym głosem Dariusza, wideo składa Remotion. Wszystko dzieje się lokalnie.

> **Fork** [`AIBiz-Automatyzacje/maszynka-do-shortsow`](https://github.com/AIBiz-Automatyzacje/maszynka-do-shortsow) (Kacper Trzepieciński, Akademia Automatyzacji). Silnik, format scenariusza i typy scen pochodzą z oryginału. Nasze jest to, co widać i słychać: ciemna paleta marki DM, Archivo Black / Inter / Montserrat, ton głosu Dariusza, domena `dariuszmlynarski.pl`.

W fabryce wideo DM to **ścieżka A3 — rolka bez twarzy**: zero kamery, zero awatara, zero CapCuta. Mapa fabryki: `~/.claude/commands/video-factory.md`, skill prowadzący: `/video-maszynka`.

## Co potrzebujesz

- macOS (na Windowsie działa przez `npm start`, bez pliku `.command`)
- Node.js 20 lub nowszy: https://nodejs.org
- Apka Claude z zalogowanym Claude Code (scenariusze pisze `claude -p` na Twoim koncie, bez dodatkowych kluczy)
- Konto ElevenLabs z klonem Twojego głosu (klucz API wpisujesz w dashboardzie)

## Uruchomienie

Najprościej: otwórz Claude Code, wklej link do tego repo i napisz:

```
Pobierz ten projekt i uruchom go: https://github.com/dariuszmlynarski/maszynka-do-rolek
```

Claude sam sklonuje kod, zainstaluje biblioteki i otworzy dashboard w przeglądarce (http://localhost:5757). Potem kliknij **Ustawienia głosu**, wklej klucz ElevenLabs i wybierz swój głos.

Ręcznie, bez Claude'a:

1. `git clone https://github.com/dariuszmlynarski/maszynka-do-rolek.git` albo „Code → Download ZIP".
2. Kliknij dwa razy **Uruchom maszynkę.command** (macOS; za pierwszym razem prawy klik → „Otwórz"). Na Windowsie: `npm install --legacy-peer-deps && npm start`.
3. W przeglądarce otworzy się http://localhost:5757. Okno Terminala zostaw otwarte.

## Jak robić rolki

Krok po kroku, typy scen i co robić, gdy coś nie działa: [docs/jak-uzywac.md](docs/jak-uzywac.md).

W skrócie: **+ Nowa rolka** → wklej link → **Utwórz i napisz scenariusz** → popraw teksty → **Generuj lektora** → **Renderuj MP4**. Gotowy plik ląduje w `projekty/<nazwa-rolki>/`.

## Co jest w środku

| Folder | Co robi |
|---|---|
| `dashboard/` | panel w przeglądarce (React + Vite) |
| `server/` | lokalny serwer: scenariusze (Claude Code), lektor (ElevenLabs), render |
| `src/` | kompozycja wideo w Remotion, typy scen, napisy, marka |
| `docs/` | instrukcja obsługi i styl marki DM |
| `projekty/` | Twoje rolki (nie trafiają do repo) |
| `dane/` | ustawienia i klucz ElevenLabs (nie trafiają do repo) |
| `CLAUDE.md` | instrukcja dla Claude Code: jak pisać scenariusze w tym projekcie |

## Porty

Dashboard `5757`, serwer `4545`. Zmiana portu serwera: `PORT` w pliku `.env` (wzór w `.env.example`).

## Podmiana marki

Cała warstwa wizualna siedzi w `src/marka.ts` (paleta, czcionki, cienie, podpis, domena) i `docs/styl-marki.md`. Ton głosu lektora żyje w **dwóch miejscach naraz**: `CLAUDE.md` oraz funkcja `zasady()` w `server/scenarzysta.ts` — zmieniasz jedno, zmieniasz drugie.

Źródłem prawdy dla marki jest sejf dmOS: `3-DM/Content/Brand/Identyfikacja-Wizualna.md` i `Tone-of-Voice-Essentials.md`.

---

Oryginał: [Akademia Automatyzacji](https://akademiaautomatyzacji.com) · Kacper Trzepieciński
Fork i przemalowanie: Dariusz Młynarski · [dariuszmlynarski.pl](https://dariuszmlynarski.pl)
