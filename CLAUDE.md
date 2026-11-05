# denic-shop — pravila za razvoj

## 1. Mali koraci, ne sve odjednom

Gradi jednu stvar, pokreni je, proveri da radi, pa nastavi. Ne pisati veliki blok koda pa tek onda testirati.

## 2. Automatski testovi za svaku važnu logiku

Svaka kritična logika mora imati unit testove pre nego što se merge-uje:

- IPS QR builder (format stringa, separator `|`, mod 97 kontrolni broj)
- Validacija broja računa (18 cifara, mod 97)
- Obračun cena, popusta i dostave
- Upravljanje zalihama (dekrement pri porudžbini, rezervacija)
- Statusi porudžbine (dozvoljene tranzicije)
- Checkout flow (validacija korpe, kreiranje porudžbine, plaćanje)

Pokrenuti testove pre svakog push-a: `pnpm test`

## 3. Svaki ekran dashboard-a proveriti u browseru (Playwright)

Pre nego što se javi da je ekran gotov:

- Pokrenuti Playwright test koji otvara ekran
- Proveriti da se podaci učitavaju
- Proveriti da navigacija radi
- Proveriti edge case-ove (prazna lista, greška API-ja)

## 4. GitHub Actions — testovi na svaki push

CI pipeline u `.github/workflows/ci.yml` mora da:

- Pokreće `pnpm test` (unit testovi)
- Pokreće Playwright testove
- Blokira merge ako testovi ne prolaze

## 5. Kad javljaš da je nešto gotovo, napiši šta si proverio

Format izveštaja:

```
Gotovo. Provereno:
- [x] Unit test: <naziv testa> → PASS
- [x] Browser: <ekran> — podaci se učitavaju, navigacija radi
- [x] Edge case: <opis> → ispravno se ponaša
- [x] CI: zeleno na GitHub Actions
```

Nije dovoljno reći "trebalo bi da radi" — mora biti provereno.
