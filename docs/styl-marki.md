# Styl marki — Dariusz Młynarski / DMProsper

> Źródło prawdy: `3-DM/Content/Brand/Identyfikacja-Wizualna.md` w sejfie dmOS.
> Ten plik jest przełożeniem tamtych reguł na kadr pionowy. Gdy się rozjadą, wygrywa sejf.

## Kolory

| Rola w kadrze | Kolor | Hex |
|---|---|---|
| Tło kadru (baza) | Ciemna czekolada | `#1E110A` |
| Tło głębsze | Prawie czarny | `#120A05` |
| Karty i kafelki | Ciemny szary | `#202020` |
| Tekst główny | Biały | `#FFFFFF` |
| Tekst przygaszony | Jasny beż | `#E8E2DC` |
| Tekst wyciszony | Szarobeżowy | `#9C938A` |
| Obramowania | Ciepły ciemny | `#3A2E24` / `#574636` |
| **Akcent główny** | **Pomarańczowy** | **`#FC5400`** |
| Wypełnienie akcentowe | Przygaszony pomarańcz | `#3A1B08` |
| Poświata tła | Ciepła czekolada | `#965A30` |
| Powodzenie | Zieleń | `#3FAE5A` |
| Błąd | Czerwień | `#FF5A4E` |

Pomarańcz `#FC5400` jest kolorem dominującym marki: akcenty, przyciski, zakreślenia, kreski kickerów.

🔴 **Jasnych teł nie stosujemy.** „Pastelowe kolory" i „jasne tła" stoją na czarnej liście identyfikacji. Oryginał maszynki był jasny (kremowy papier) — ten fork jest ciemny i taki zostaje.

Zieleń marki to `#1a5c2a`, ale na ciemnym tle znika, więc w kadrze używamy jaśniejszego `#3FAE5A`. Ten sam powód dotyczy czerwieni.

## Czcionki

| Zastosowanie | Font |
|---|---|
| Nagłówki scen | **Schibsted Grotesk Black** (od 05.11.2026, wcześniej Archivo Black) |
| Treść, etykiety, kafelki | **Figtree** (600–800, od 05.11.2026, wcześniej Inter) |
| Napisy na wideo | **Montserrat** |
| Dopiski i drobne etykiety | Montserrat |
| Kod i terminal | Menlo / SF Mono |

🔴 **Montserrat zostaje przy napisach na wideo** (decyzja 01.09.2026). Nagłówki na ekranie to grafika, nie napisy — tam idzie Schibsted Grotesk Black, tak jak na grafikach social.

Odręcznego kroju (Caveat w oryginale) nie używamy — estetyka DM jest techniczna i płaska, nie notatnikowa.

## Cienie i głębia

Na ciemnym tle czarny cień nie istnieje, więc głębię niesie ciepła poświata `#965A30`:

- Cień karty: `0 3px 8px rgba(0,0,0,.55), 0 16px 52px rgba(150,90,48,.16)`
- Cień uniesiony: `0 8px 18px rgba(0,0,0,.6), 0 38px 96px rgba(150,90,48,.24)`
- Cień naklejki (przyciski): `8px 8px 0 rgba(252,84,0,.38)` — przesunięty, bez rozmycia

Tło kadru ma dodatkowo poświatę radialną w górnej połowie, odpowiednik `tlo-czekolada-poswiata.png` z konwencji grafik.

## Elementy

- Zaokrąglenie kart: 38 px, kafelków: 26 px
- Karta: tło `#202020`, obramowanie 2 px `#3A2E24`
- Przycisk główny: tło `#FC5400`, biały tekst, cień naklejki
- Zakreślenia: pomarańcz pod tekstem, lekki obrót
- Tło z kratką `rgba(255,255,255,.055)`, która powoli płynie w górę

## Estetyka

Minimalizm, tech/modern, flat design, klimat terminala i interfejsu. Dużo ciemnej przestrzeni, kompozycja oddycha. Bez przeładowania.
