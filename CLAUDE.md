# Maszynka do filmów — instrukcja dla Claude

Fork `AIBiz-Automatyzacje/maszynka-do-shortsow` (Kacper Trzepieciński) przemalowany na markę Dariusza Młynarskiego. Silnik i format scenariusza zostają jak w oryginale; nasze jest to, co widać i słychać: paleta, czcionki, ton głosu, domena.

To jest **ścieżka A3 fabryki wideo DM** — rolka bez twarzy, złożona z animowanej grafiki. Mapa fabryki: `~/.claude/commands/video-factory.md`, skill prowadzący: `/video-maszynka`.

Właściciel jest osobą nietechniczną. Pisz krótko, po polsku, bez żargonu. Nie tłumacz, jak działa kod, chyba że poprosi.

🔴 Marka jest źródłem zewnętrznym: `3-DM/Content/Brand/Identyfikacja-Wizualna.md` i `Tone-of-Voice-Essentials.md` w sejfie dmOS. Gdy reguła z sejfu kłóci się z tym plikiem, wygrywa sejf — a ten plik poprawiasz.

## Co tu jest

- `` — cała aplikacja (Remotion + lokalny serwer + dashboard).
- `projekty/<id>/scenariusz.json` — jeden folder = jedna rolka. Dashboard czyta je co 4 s, więc zapis pliku od razu pojawia się w przeglądarce.
- `projekty/<id>/audio/` — lektor z ElevenLabs (generuje dashboard, nie Claude).
- `projekty/<id>/rolka_<data>_<godzina>.mp4` — gotowe rolki; każdy render tworzy nowy plik, dashboard pokazuje je w Galerii.
- `docs/styl-marki.md` — paleta i czcionki marki DM przełożone na kadr pionowy.
- `docs/jak-uzywac.md` — instrukcja dla właściciela.

Uruchomienie: `npm install --legacy-peer-deps` (raz), potem `npm start` (albo dwuklik na `Uruchom maszynkę.command`). Gdy użytkownik prosi „pobierz i uruchom”: sklonuj repo, zainstaluj, odpal `npm start` w tle i otwórz http://localhost:5757 w przeglądarce. Dashboard: http://localhost:5757, serwer: http://localhost:4545.

## Explainer z kamery (ścieżka A4)

Drugi typ projektu (`"typ": "explainer"`): nagranie Dariusza do kamery → plan scen → film 16:9 z animacjami na słowo. Dane siedzą w `scenariusz.json` pod kluczem `a4` (format w `src/a4/typy.ts`), przebieg w `server/a4.ts`, kompozycja `ExplainerA4` w `src/a4/`. Zasady planu scen są w funkcji `zasadyPlanu()` w `server/a4.ts` — zmieniasz je w rozmowie, zmieniasz i tam. Prowadzenie krok po kroku: skill `/video-explainer`.

## Scenariusze pisze też sam dashboard

Serwer uruchamia `claude -p` w tle (`server/scenarzysta.ts`): przycisk „Napisz scenariusz” (z linku/pomysłu) i „Zastosuj uwagi” (poprawki wg pola `uwagi`). Zasady scenariusza żyją w funkcji `zasady()` w tym pliku — jeśli zmieniasz zasady poniżej, zmień je też tam.

## Główne zadanie Claude w rozmowie: pisanie scenariuszy

Gdy użytkownik poda link, tekst albo pomysł na rolkę:

1. Pobierz treść (WebFetch dla linku). Wyciągnij 1 główną myśl i 3–5 konkretów.
2. Zapytaj TYLKO jeśli brakuje: docelowej długości (domyślnie 45 s). Nie zadawaj innych pytań, tylko pisz.
3. Zapisz `projekty/<slug>/scenariusz.json` (utwórz też pusty folder `audio/`). Slug: małe litery, bez polskich znaków, myślniki.
4. Odpowiedz krótką tabelą: numer sceny, co widać, co mówi lektor, szacowany czas. Powiedz, że rolka jest już w dashboardzie.

Te same zasady są zaszyte w funkcji `zasady()` w `server/scenarzysta.ts`. Zmieniasz jedno, zmień drugie.

Kontrola jakości: `server/kontrola.ts` sprawdza gotowy scenariusz (długość, budżet słów, teksty na ekranie, rytm zdań). Dashboard pokazuje wynik przy podglądzie. Przed oddaniem scenariusza warto sprawdzić `GET /api/projekty/<id>/kontrola`.

Zasady dobrego scenariusza:
- Pierwsza scena to hak: mocne zdanie, które zatrzymuje kciuk. Typ `tytul` z `akcent`.
- Jedna myśl na scenę. 5–9 słów na ekranie, maks. 25 słów lektora na scenę.
- Lektor mówi naturalnie, po polsku, jak do jednej osoby („Ty"). Bez „w dzisiejszym filmie".
- Ton to Dariusz: mądry kolega, nie guru. „Szczerze namawiam", „warto", anegdota z własnego życia (także porażka), metafora z życia codziennego (samochód, basen, pogoda). Kolokwializm mile widziany, wulgaryzm najwyżej jeden i nigdy w haku.
- 🔴 Zero tików AI: triada negacji („Nie tysiąc. Nie sto."), „To nie X. To Y.", „Wyobraź sobie…", nadużyta reguła trójki, izolowane jednowyrazowce jako puenta, „Podsumowując". Dariusz wyłapuje je natychmiast.
- Przy zdrowiu i formie: „tworzysz zdrowie", nie „budujesz".
- Tempo: 170 słów na minutę. Budżet liczy `budzetSlow()` z `src/czas.ts`: 30 s ≈ 72 słowa, 45 s ≈ 108, 60 s ≈ 145, 90 s ≈ 217.
- Struktura: hak, setup, rozwinięcie z co najmniej jednym zwrotem „ale”, puenta, zdanie szczerości, zakończenie bez pożegnania.
- Zero długich myślników. Zero słów: szok, rewolucja, gamechanger. Liczby w mowie lektora słownie, na ekranie cyframi.
- Najwyżej jedna trzecia zdań krótsza niż 6 słów, inaczej lektor brzmi jak robot.
- Linie w scenie `kod`: maks. 38 znaków i 4 linie.
- Ostatnia scena zawsze `cta` z przyciskiem `Obserwuj po więcej`. Adres i dopisek „link w opisie" tylko wtedy, gdy rolka naprawdę odsyła pod konkretny URL.
- Mieszaj typy scen. W jednej rolce maks. jedna scena `3d` i jedna `kod`.
- Liczby pokazuj typem `liczba`. Kontrasty typem `porownanie`. Wyliczenia typem `lista` (3–4 punkty).
- `akcent` w scenie `tytul` musi być dosłownym fragmentem `naglowek`.
- Scena 1 (`tytul`): `naglowek` maks. 14 znaków, czyli mniej więcej dwa słowa. Dłuższy łamie się na dwie linie i zakreślenie `akcent` rozpada się na pół — puentę przenieś do `dopisek`.
- Emoji w `ikona` — jedno, proste.
- **Logotyp marki zamiast emoji:** `"ikona": "logo:claude"` bierze plik z `public/logo/claude.svg`. Dostępne: `claude`, `todoist`, `ynab`, `obsidian`, `n8n`. Używaj, gdy punkt listy albo karta mówi o konkretnym produkcie — widz rozpozna narzędzie bez czytania podpisu. Nowe logo dokładasz jako SVG w oryginalnych barwach do `public/logo/`.

## Format scenariusza (JSON)

```json
{
  "id": "slug-rolki",
  "tytul": "Tytuł roboczy",
  "zrodlo": "https://... albo opis pomysłu",
  "docelowaDlugosc": 45,
  "status": "scenariusz",
  "utworzono": "2026-09-11T10:00:00.000Z",
  "zmieniono": "2026-09-11T10:00:00.000Z",
  "napisy": true,
  "sceny": [
    { "id": "s1", "lektor": "Tekst lektora.", "ekran": { "typ": "tytul", "naglowek": "Cały nagłówek z AKCENTEM", "akcent": "AKCENTEM", "dopisek": "odręczny dopisek", "etykieta": "mała etykieta" } },
    { "id": "s2", "lektor": "...", "ekran": { "typ": "lista", "naglowek": "opcjonalny", "punkty": [{ "ikona": "⚡", "tekst": "punkt" }] }, "przejscie": "slide" },
    { "id": "s3", "lektor": "...", "ekran": { "typ": "karta", "ikona": "💡", "etykieta": "opcjonalna", "naglowek": "...", "tekst": "opcjonalny" } },
    { "id": "s4", "lektor": "...", "ekran": { "typ": "liczba", "wartosc": 80, "prefiks": "", "sufiks": "%", "podpis": "podpis" } },
    { "id": "s5", "lektor": "...", "ekran": { "typ": "porownanie", "lewo": { "naglowek": "Źle", "punkty": ["..."] }, "prawo": { "naglowek": "Dobrze", "punkty": ["..."] } } },
    { "id": "s6", "lektor": "...", "ekran": { "typ": "3d", "ksztalt": "kostki", "naglowek": "...", "dopisek": "..." } },
    { "id": "s7", "lektor": "...", "ekran": { "typ": "kod", "tytul": "terminal", "naglowek": "...", "linie": ["linia 1", "linia 2"] } },
    { "id": "s8", "lektor": "...", "ekran": { "typ": "cta", "naglowek": "...", "przycisk": "Obserwuj po więcej" } },
    { "id": "s9", "lektor": "...", "ekran": { "typ": "telefon", "naglowek": "...", "tytulEkranu": "...", "powiadomienie": { "tytul": "...", "tekst": "..." }, "wiersze": [{ "ikona": "📩", "tytul": "...", "podtytul": "..." }], "przycisk": "..." } },
    { "id": "s10", "lektor": "...", "ekran": { "typ": "czat", "rozmowca": "Klient", "wiadomosci": [{ "tekst": "..." }, { "odNas": true, "tekst": "..." }] } },
    { "id": "s11", "lektor": "...", "ekran": { "typ": "przegladarka", "adres": "dariuszmlynarski.pl/...", "tytulStrony": "...", "opis": "...", "obrazTekst": "...", "przycisk": "Czytaj przepis" } },
    { "id": "s12", "lektor": "...", "ekran": { "typ": "formularz", "tytul": "...", "pola": [{ "etykieta": "E-mail", "wartosc": "anna@firma.pl" }], "przycisk": "Zapisz się", "potwierdzenie": "Miejsce zarezerwowane" } }
  ]
}
```

Makiety (`telefon`, `czat`, `przegladarka`, `formularz`) pokazują rzecz w działaniu, więc używaj ich zamiast opisywania słowami. Maks. dwie na rolkę. Limity: cztery wiadomości na czacie (do 70 znaków), trzy pola formularza, cztery wiersze na telefonie.

Animacje elementów same przypinają się do słów lektora (`src/kotwice.ts`), więc nie podawaj czasów ani opóźnień. Bez nagrania działa równomierne rozłożenie.

Każda scena ma też pole `opis`: jedno zdanie po polsku, co widać na ekranie (użytkownik widzi je w edytorze zamiast pól technicznych). Musi zgadzać się z `ekran`. Zawsze je wypełniaj.

Pola opcjonalne sceny: `przejscie` (`fade` domyślnie, `slide`, `wipe`, `brak`), `efekt` (opis efektu dźwiękowego, np. „krótki whoosh"), `minCzas` (sekundy). Kształty 3D: `kostki`, `kula`, `torus`, `pierscienie`, `kartki`.

Pełne typy: `src/typy.ts`. Przykład: `src/przyklad.ts`.

## Poprawki

- Gdy użytkownik mówi „przeczytaj uwagi do rolki X": otwórz `scenariusz.json`, przeczytaj pole `uwagi`, wprowadź zmiany, wyczyść `uwagi`, zaktualizuj `zmieniono`.
- Przy edycji istniejącego scenariusza NIE usuwaj pól `audio` i `efektAudio` ze scen, których tekst lektora się nie zmienił. Jeśli zmieniasz `lektor`, usuń `audio` tej sceny (dashboard pokaże „wygeneruj ponownie").
- Nie edytuj `scenariusz.json`, gdy użytkownik właśnie generuje lektora lub renderuje.
- Zapis przez `PUT /api/projekty/:id` wysyłaj z polem `zmieniono` z odczytu (`GET`). Gdy projekt zmienił się w międzyczasie, serwer odpowiada 409 i odsyła aktualną wersję: nanieś na nią swoje zmiany i zapisz ponownie. Otwarty dashboard robi to samo i scala różnice, więc zamykanie zakładki nie jest potrzebne. Zapisując plik bezpośrednio na dysk, zawsze podbijaj `zmieniono`, bo po nim dashboard poznaje, że coś się zmieniło.

## Zmiany w wyglądzie scen

Kod scen: `src/sceny/`. Styl: `src/marka.ts`. Po zmianie kodu podgląd w dashboardzie odświeża się sam, a render użyje nowej wersji przy następnym uruchomieniu.
Animacje wyłącznie przez `useCurrentFrame()` (bez CSS transitions). Sprawdzaj wygląd renderem klatki:

```bash
cd maszynka && npx remotion still Short --frame=60 --scale=0.3 /tmp/klatka.png
```
