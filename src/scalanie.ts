// Scalanie trzech wersji projektu: wspólnej bazy, mojej i tej, która w międzyczasie trafiła na dysk.
// Dzięki temu dwa zapisy z różnych miejsc (dashboard, Claude przez API, długa operacja serwera)
// nie kasują się nawzajem — każdy wnosi tylko to, co sam zmienił względem bazy.

type Wartosc = unknown;

const czyObiekt = (v: Wartosc): v is Record<string, Wartosc> => typeof v === "object" && v !== null && !Array.isArray(v);

export function rowne(a: Wartosc, b: Wartosc): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => rowne(x, b[i]));
  if (czyObiekt(a) && czyObiekt(b)) {
    const klucze = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of klucze) if (!rowne(a[k], b[k])) return false;
    return true;
  }
  return false;
}

const zId = (v: Wartosc): v is { id: string } & Record<string, Wartosc> => czyObiekt(v) && typeof v.id === "string";
const listaZId = (v: Wartosc): v is ({ id: string } & Record<string, Wartosc>)[] => Array.isArray(v) && v.every(zId);

/** Lista elementów z `id` (sceny, klocki): scalana po identyfikatorze, nie po pozycji. */
function scalListe(
  baza: ({ id: string } & Record<string, Wartosc>)[],
  moja: ({ id: string } & Record<string, Wartosc>)[],
  dysk: ({ id: string } & Record<string, Wartosc>)[],
) {
  const idBazy = new Set(baza.map((x) => x.id));
  const idMoje = new Set(moja.map((x) => x.id));
  const idDysku = new Set(dysk.map((x) => x.id));
  // Usunięte po którejkolwiek stronie znikają, chyba że druga strona je w tym czasie zmieniła.
  const usuniete = new Set<string>();
  for (const id of idBazy) {
    const b = baza.find((x) => x.id === id);
    if (!idMoje.has(id) && (!idDysku.has(id) || rowne(dysk.find((x) => x.id === id), b))) usuniete.add(id);
    if (!idDysku.has(id) && (!idMoje.has(id) || rowne(moja.find((x) => x.id === id), b))) usuniete.add(id);
  }
  const kolejnoscBazy = baza.map((x) => x.id).filter((id) => idMoje.has(id));
  const mojaKolejnosc = moja.map((x) => x.id).filter((id) => idBazy.has(id));
  const zmienilemKolejnosc = !rowne(kolejnoscBazy, mojaKolejnosc);
  const glowna = zmienilemKolejnosc ? moja : dysk;
  const druga = zmienilemKolejnosc ? dysk : moja;
  const ids = glowna.map((x) => x.id);
  // Elementy dodane po drugiej stronie: dopisane na końcu zostają na końcu, reszta idzie za swoim poprzednikiem.
  druga.forEach((x, i) => {
    if (ids.includes(x.id) || idBazy.has(x.id)) return;
    if (i === druga.length - 1) return void ids.push(x.id);
    const poprzednik = druga[i - 1]?.id;
    const gdzie = poprzednik ? ids.indexOf(poprzednik) : -1;
    ids.splice(gdzie + 1, 0, x.id);
  });
  return ids
    .filter((id) => !usuniete.has(id))
    .map((id) => scal(baza.find((x) => x.id === id), moja.find((x) => x.id === id), dysk.find((x) => x.id === id)));
}

/**
 * Scalanie trójstronne. Gdzie zmieniła się tylko jedna strona, wygrywa ona; gdzie obie
 * zmieniły to samo pole różnie, wygrywa „moja” (ten, kto właśnie zapisuje), bo to jego świeża decyzja.
 */
export function scal<T>(baza: T | undefined, moja: T | undefined, dysk: T | undefined): T {
  if (rowne(moja, baza)) return dysk as T;
  if (rowne(dysk, baza) || rowne(moja, dysk)) return moja as T;
  if (listaZId(moja) && listaZId(dysk)) return scalListe(listaZId(baza) ? baza : [], moja, dysk) as T;
  if (czyObiekt(moja) && czyObiekt(dysk)) {
    const b: Record<string, Wartosc> = czyObiekt(baza) ? baza : {};
    const wynik: Record<string, Wartosc> = {};
    for (const k of new Set([...Object.keys(moja), ...Object.keys(dysk)])) {
      const v = scal(b[k], moja[k], dysk[k]);
      if (v !== undefined) wynik[k] = v;
    }
    return wynik as T;
  }
  return moja as T;
}
