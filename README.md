# Verenigingenkaart Friesland — Google Maps (static site)

Plot NL-postcodes (Friesland) op **Google Maps** vanuit een **Excel/CSV upload**. Pins zijn filterbaar op **Gemeente** en **Sport**, en je kunt zoeken op vereniging/plaats/postcode.

## 🚀 Snel starten
1. **Download of clone** deze repo en open de map.
2. Maak een kopie van `config.example.js` → **`config.js`** en vul je **Google Maps API key** in.
   - Beperk de key op **HTTP referers** (bijv. `http://localhost/*` en `https://<jouw-user>.github.io/*`).
   - Beperk de API's tot **Maps JavaScript API** en **Geocoding API**.
3. Open **`index.html`** lokaal (of host via GitHub Pages) en:
   - Upload je CSV/Excel **óf** klik op **Laad demo-data**.

> De app geocodeert postcodes client-side via de Google Geocoding API (met caching in `localStorage`).

## 🗂️ Bestanden
- `index.html` — UI en containers
- `styles.css` — eenvoudige styling
- `app.js` — logica (upload/parsen, geocoding, markers, filters, caching)
- `config.example.js` — voorbeeld om je **API key** te zetten (kopieer naar `config.js`)
- `data/sportverenigingen_friesland_dummy.csv` — demo-dataset (100 rijen, echte Friese postcodes)
- `.gitignore` — sluit `config.js` uit je commits

## 🔑 Google Maps API key (belangrijk)
- **Billing** en API key verplicht voor Geocoding. Zie Google’s docs: gebruiksuitgaven & key aanmaken/beperken.
- Officiële stappen: enable **Geocoding API**, maak key en beperk ‘m.  
  - Usage/billing: https://developers.google.com/maps/documentation/geocoding/usage-and-billing  
  - Get API key & enable API: https://developers.google.com/maps/documentation/geocoding/get-api-key  
  - Key restricties: https://cloud.google.com/docs/authentication/api-keys

## 📦 GitHub Pages
Je kunt deze statische site zo hosten op **GitHub Pages**:
- Docs: https://pages.github.com/ of Quickstart: https://docs.github.com/en/pages/quickstart

## 🔍 Dataformat
Vereiste kolommen (exacte kolomnamen):
```
Vereniging, sport, bond, adres, postcode, plaats, gemeente
```
- Postcode mag `1234 AB` of `1234AB`. De app normaliseert naar `1234 AB` en geocodeert in **Nederland**.
- We tonen alles met coördinaten; je kunt desgewenst Friesland-only afdwingen via filters.

## ⚙️ Tips
- **Caching**: geocode-resultaten worden lokaal opgeslagen per `postcode|plaats`. Herladen is daarna sneller en goedkoper.
- **Throttling**: we limiteren tot ~5 requests/sec om spikes en limieten te vermijden.
- **Datakwaliteit**: voeg waar mogelijk **plaats** en **gemeente** toe om ambiguïteit te beperken.

## 🧱 Roadmap (optioneel)
- Marker-clustering
- Kleuren per sport/bond
- FR-gemeente-grenzen (GeoJSON) + click-to-filter
- Export van gefilterde set
