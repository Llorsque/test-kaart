import streamlit as st
import pandas as pd
import pgeocode
from io import BytesIO
from streamlit_folium import st_folium
import folium

st.set_page_config(page_title="Verenigingenkaart Friesland", layout="wide")

st.title("Verenigingenkaart Friesland")
st.caption("Upload een CSV/Excel met kolommen: **Vereniging, sport, bond, adres, postcode, plaats, gemeente**")

# --- Helpers ---
@st.cache_data
def load_file(file):
    name = getattr(file, "name", "").lower()
    if name.endswith(".csv"):
        return pd.read_csv(file)
    return pd.read_excel(file)

@st.cache_data
def geocode_pc4(df: pd.DataFrame, pc_col="postcode"):
    nomi = pgeocode.Nominatim("NL")
    out = df.copy()
    out["_pc4"] = out[pc_col].astype(str).str.extract(r"(\d{4})", expand=False)
    geo = nomi.query_postal_code(out["_pc4"])
    out["lat"] = geo["latitude"].values
    out["lng"] = geo["longitude"].values
    return out

def ensure_columns(df):
    needed = ["Vereniging","sport","bond","adres","postcode","plaats","gemeente"]
    missing = [c for c in needed if c not in df.columns]
    if missing:
        st.error("Ontbrekende kolommen: " + ", ".join(missing))
        st.stop()
    return df[needed].copy()

# --- Sidebar ---
with st.sidebar:
    st.header("Instellingen")
    use_demo = st.toggle("Gebruik meegeleverde demo-dataset", value=False, help="Laad /data/sportverenigingen_friesland_dummy.csv uit de repo")

uploaded = st.file_uploader("Upload CSV of Excel", type=["csv","xlsx"])

# --- Load data ---
df = None
if uploaded is not None:
    df = load_file(uploaded)
elif use_demo:
    try:
        df = pd.read_csv("data/sportverenigingen_friesland_dummy.csv")
    except Exception as e:
        st.error("Kon demo-data niet laden uit ./data/. Is de file meegecommit?")
        st.stop()

if df is None:
    st.info("Upload een bestand of zet de demo-toggle **aan** in de sidebar.")
    st.stop()

df = ensure_columns(df)

# --- Enrich: geocode via pc4 centroid ---
df_geo = geocode_pc4(df, pc_col="postcode")

# --- Filters ---
left, mid, right = st.columns([1,1,1.4])
with left:
    gemeenten = sorted(df_geo["gemeente"].dropna().unique().tolist())
    sel_gem = st.multiselect("Gemeente", gemeenten, default=gemeenten)

with mid:
    sporten = sorted(df_geo["sport"].dropna().unique().tolist())
    sel_sport = st.multiselect("Sport", sporten)

with right:
    q = st.text_input("Zoek (Vereniging / Plaats / Postcode)").strip().lower()

flt = df_geo.copy()
if sel_gem:
    flt = flt[flt["gemeente"].isin(sel_gem)]
if sel_sport:
    flt = flt[flt["sport"].isin(sel_sport)]
if q:
    flt = flt[
        flt["Vereniging"].str.lower().str.contains(q) |
        flt["plaats"].str.lower().str.contains(q) |
        flt["postcode"].str.lower().str.contains(q)
    ]

st.markdown(f"**Totaal:** {len(df_geo)}  |  **Gefilterd:** {len(flt)}")

# --- Map ---
m = folium.Map(location=[53.1, 5.8], zoom_start=9, tiles="OpenStreetMap")
for _, r in flt.dropna(subset=["lat","lng"]).iterrows():
    popup = folium.Popup(
        f"<b>{r['Vereniging']}</b><br>{r['adres']}<br>{r['postcode']} {r['plaats']}<br>"
        f"Gemeente: {r['gemeente']}<br>Sport: {r['sport']}<br>Bond: {r['bond']}",
        max_width=300
    )
    folium.Marker([r["lat"], r["lng"]], popup=popup).add_to(m)

st_folium(m, width=None, height=600)

# --- Table + download ---
st.subheader("Data")
st.dataframe(flt, use_container_width=True)

csv = flt.to_csv(index=False).encode("utf-8")
st.download_button("Download gefilterde data (CSV)", data=csv, file_name="verenigingen_friesland_filtered.csv", mime="text/csv")
