# Verenigingenkaart Friesland (Streamlit)

Kaart-app om verenigingen/klanten in **Friesland** te visualiseren en te filteren op **gemeente** en **sport** (of je eigen parameters).

## ✅ Features
- Upload **CSV of Excel** met kolommen: `Vereniging, sport, bond, adres, postcode, plaats, gemeente`
- Automatisch coördinaten via **pgeocode** (pc4-centroid)
- Filter op **Gemeente** en **Sport**, plus zoekbalk (vereniging/plaats/postcode)
- Interactieve kaart (OpenStreetMap) met popups
- Download **gefilterde CSV**

## 🚀 Lokale installatie
```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```
Open de link die Streamlit toont (meestal `http://localhost:8501`).

## ☁️ Streamlit Cloud
1. Push deze repo naar GitHub
2. Ga naar https://share.streamlit.io/ en koppel je repo
3. Kies `streamlit_app.py` als entrypoint
4. (Optioneel) Zet **demo-data** aan in de sidebar

## 📁 Data
- Demo-bestand staat in `data/sportverenigingen_friesland_dummy.csv`
- Eigen bestand moet minimaal deze kolommen hebben:
  - `Vereniging, sport, bond, adres, postcode, plaats, gemeente`

> Tip: Gebruik volledige NL-postcodes (bijv. `9203 AA`). Voor geocoding wordt de 4-cijferige pc (`9203`) gebruikt (centroid).

## 🛠️ Aanpassen
- Extra filters toevoegen? Voeg kolommen toe in je CSV en breid de filtersectie in `streamlit_app.py` uit.
- Kleurcodering of gemeentegrenzen (polygons)? Folium ondersteunt dit makkelijk — geef een seintje als je een voorbeeld wilt.

## 🔒 Privacy
Alle verwerking is client-side; er is geen externe database of API nodig.
