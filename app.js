(function(){
  'use strict';

  // --- CONSTANTEN ---
  const FR_BOUNDS = { // ruwe bounding box van Friesland (ongeveer)
    minLat: 52.8, maxLat: 53.7, minLng: 4.6, maxLng: 6.7
  };
  const FR_GEMEENTEN = [
    "Achtkarspelen","Ameland","Dantumadiel","De Fryske Marren","Harlingen","Heerenveen","Leeuwarden",
    "Noardeast-Fryslân","Ooststellingwerf","Opsterland","Schiermonnikoog","Smallingerland","Súdwest-Fryslân",
    "Terschelling","Tytsjerksteradiel","Waadhoeke","Weststellingwerf"
  ];

  // --- STATE ---
  let map;
  let allRows = [];        // originele rows met {.., _lat, _lng}
  let markers = [];        // google.maps.Marker[]
  let cache = {};          // postcode -> {lat,lng}
  let googleKey = null;

  // -- DOM --
  const elFile = document.getElementById('file');
  const elUseDemo = document.getElementById('use-demo');
  const elStatus = document.getElementById('status');
  const elProgress = document.getElementById('progress');
  const elBar = document.getElementById('bar');
  const elGem = document.getElementById('filter-gemeente');
  const elSport = document.getElementById('filter-sport');
  const elQ = document.getElementById('filter-q');
  const elReset = document.getElementById('reset-filters');
  const elCountTotal = document.getElementById('count-total');
  const elCountVisible = document.getElementById('count-visible');

  // --- INIT ---
  document.addEventListener('DOMContentLoaded', init);

  function init(){
    googleKey = (typeof window.GOOGLE_MAPS_API_KEY === 'string') ? window.GOOGLE_MAPS_API_KEY : null;
    if(!googleKey || googleKey.includes("PASTE_HIER_JE_API_KEY")){
      elStatus.innerText = "⚠️ Geen geldige Google Maps API key gevonden in config.js. Kopieer config.example.js → config.js en vul je key in.";
    }
    loadCache();
    attachEvents();
    loadGoogleMaps(googleKey);
  }

  function attachEvents(){
    elFile.addEventListener('change', handleFile);
    elUseDemo.addEventListener('click', handleLoadDemo);
    elGem.addEventListener('change', applyFilters);
    elSport.addEventListener('change', applyFilters);
    elQ.addEventListener('input', debounce(applyFilters, 200));
    elReset.addEventListener('click', resetFilters);
  }

  // --- MAP LOADER ---
  function loadGoogleMaps(key){
    if(!key) return;
    if(window.google && window.google.maps){
      window.initMap();
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    window.initMap = () => {
      map = new google.maps.Map(document.getElementById('map'), {
        center: {lat: 53.1, lng: 5.8},
        zoom: 9,
        mapTypeControl: false,
        streetViewControl: false,
      });
    };
  }

  // --- FILE HANDLING ---
  async function handleLoadDemo(){
    try{
      const res = await fetch('data/sportverenigingen_friesland_dummy.csv');
      const text = await res.text();
      const wb = XLSX.read(text, { type: 'string' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      onRowsLoaded(rows);
    }catch(e){
      console.error(e);
      elStatus.innerText = "Kon demo-data niet laden. Staat data/sportverenigingen_friesland_dummy.csv in de repo?";
    }
  }

  function handleFile(ev){
    const file = ev.target.files && ev.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      onRowsLoaded(rows);
    };
    reader.readAsArrayBuffer(file);
  }

  function onRowsLoaded(rows){
    // Validatie kolommen
    const needed = ["Vereniging","sport","bond","adres","postcode","plaats","gemeente"];
    const cols = new Set(Object.keys(rows[0] || {}));
    const missing = needed.filter(c => !cols.has(c));
    if(missing.length){
      elStatus.innerText = "Ontbrekende kolommen: " + missing.join(", ");
      return;
    }
    allRows = rows.map((r,i) => ({
      id: i+1,
      Vereniging: r.Vereniging, sport: r.sport, bond: r.bond,
      adres: r.adres, postcode: normalizePostcode(r.postcode),
      plaats: r.plaats, gemeente: r.gemeente,
      _lat: null, _lng: null
    }));
    elStatus.innerText = `Bestand geladen: ${allRows.length} rijen. Bezig met geocoderen…`;
    geocodeMissing(allRows).then(() => {
      elStatus.innerText = "Geocoderen gereed.";
      renderFilters();
      renderMarkers();
      applyFilters();
    });
  }

  // --- POSTCODE NORMALISATIE ---
  function normalizePostcode(pc){
    if(!pc) return "";
    const s = String(pc).toUpperCase().replace(/\s+/g, "");
    if(/^\d{4}[A-Z]{2}$/.test(s)){
      return s.slice(0,4) + " " + s.slice(4);
    }
    // fallback: pak de eerste 4 cijfers
    const pc4 = s.match(/(\d{4})/);
    if(pc4) return pc4[1];
    return s;
  }

  // --- GEOCODING ---
  function loadCache(){
    try{
      cache = JSON.parse(localStorage.getItem("gmaps_pc_cache_nl") || "{}");
    }catch{ cache = {}; }
  }
  function saveCache(){
    try{
      localStorage.setItem("gmaps_pc_cache_nl", JSON.stringify(cache));
    }catch{}
  }

  async function geocodeMissing(rows){
    const todo = rows.filter(r => !r._lat || !r._lng);
    if(!todo.length) return;
    showProgress(0, todo.length);
    let done = 0;

    // Throttle ~5 req/sec
    const queue = [];
    let active = 0, maxPerSec = 5;

    function enqueue(job){
      queue.push(job);
      pump();
    }
    function pump(){
      while(active < maxPerSec && queue.length){
        const job = queue.shift();
        active++;
        job().finally(() => {
          active--;
          setTimeout(pump, 200); // light pacing
        });
      }
    }

    await new Promise((resolve) => {
      todo.forEach((r) => {
        const key = r.postcode + (r.plaats ? "|" + r.plaats : "");
        if(cache[key]){
          const {lat, lng} = cache[key];
          r._lat = lat; r._lng = lng;
          done++; showProgress(done, todo.length);
        } else {
          enqueue(async () => {
            try{
              const coords = await geocodePostcodeNL(r.postcode, r.plaats);
              if(coords){
                r._lat = coords.lat; r._lng = coords.lng;
                cache[key] = coords; saveCache();
              }
            }catch(e){ /* ignore */ }
            finally{
              done++; showProgress(done, todo.length);
            }
          });
        }
      });

      const iv = setInterval(() => {
        if(done >= todo.length){
          clearInterval(iv);
          hideProgress();
          resolve();
        }
      }, 200);
    });
  }

  async function geocodePostcodeNL(postcode, plaats){
    // Als enkel 4-cijferig -> toch proberen met components (NL)
    const pc = encodeURIComponent(postcode);
    const comps = `components=country:NL|postal_code=${pc}`;
    const addr = encodeURIComponent(`${postcode} ${plaats || ""} Netherlands`);
    const urls = [
      `https://maps.googleapis.com/maps/api/geocode/json?${comps}&key=${googleKey}`,
      `https://maps.googleapis.com/maps/api/geocode/json?address=${addr}&key=${googleKey}&region=nl`
    ];
    for(const url of urls){
      const r = await fetch(url);
      if(!r.ok) continue;
      const data = await r.json();
      if(data.status === "OK" && data.results && data.results.length){
        const loc = data.results[0].geometry.location;
        // Filter grofweg op Friesland-bounds
        if(inFriesland(loc.lat, loc.lng)){
          return { lat: loc.lat, lng: loc.lng };
        } else {
          // Ook als buiten bounds: toch teruggeven (maar later gefilterd)
          return { lat: loc.lat, lng: loc.lng };
        }
      }
    }
    return null;
  }

  function inFriesland(lat, lng){
    return lat >= FR_BOUNDS.minLat && lat <= FR_BOUNDS.maxLat && lng >= FR_BOUNDS.minLng && lng <= FR_BOUNDS.maxLng;
  }

  function showProgress(done, total){
    elProgress.hidden = false;
    elBar.style.width = Math.round((done/total)*100) + "%";
  }
  function hideProgress(){
    elProgress.hidden = true;
    elBar.style.width = "0%";
  }

  // --- FILTERS ---
  function renderFilters(){
    // unieke lijsten
    const gems = uniq(allRows.map(r => r.gemeente).filter(Boolean)).sort((a,b)=>a.localeCompare(b,'nl'));
    const sports = uniq(allRows.map(r => r.sport).filter(Boolean)).sort((a,b)=>a.localeCompare(b,'nl'));
    fillMulti(elGem, gems);
    fillMulti(elSport, sports);
    elCountTotal.textContent = `Totaal: ${allRows.length}`;
  }

  function fillMulti(select, values){
    select.innerHTML = "";
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      select.appendChild(opt);
    });
  }

  function getSelected(select){
    return Array.from(select.selectedOptions).map(o => o.value);
  }

  function resetFilters(){
    Array.from(elGem.options).forEach(o => o.selected = false);
    Array.from(elSport.options).forEach(o => o.selected = false);
    elQ.value = "";
    applyFilters();
  }

  function applyFilters(){
    const selGem = new Set(getSelected(elGem));
    const selSport = new Set(getSelected(elSport));
    const q = elQ.value.trim().toLowerCase();

    let visible = 0;
    markers.forEach(m => m.setMap(null)); // clear
    markers = [];

    const filtered = allRows.filter(r => {
      if(selGem.size && !selGem.has(r.gemeente)) return False;
      if(selSport.size && !selSport.has(r.sport)) return False;
      if(q){
        const hay = `${r.Vereniging} ${r.plaats} ${r.postcode}`.toLowerCase();
        if(!hay.includes(q)) return False;
      }
      // Friesland-only zichtbaarheid? We tonen alles met coords; je kunt desgewenst FR-only afdwingen:
      return true;
    }).filter(r => r._lat && r._lng);

    filtered.forEach(r => {
      const marker = new google.maps.Marker({
        position: {lat: r._lat, lng: r._lng},
        map,
        title: r.Vereniging
      });
      const info = new google.maps.InfoWindow({
        content: `<div class="infow">
          <div><strong>${escapeHtml(r.Vereniging)}</strong></div>
          <div>${escapeHtml(r.adres)}</div>
          <div>${escapeHtml(r.postcode)} ${escapeHtml(r.plaats)}</div>
          <div style="margin-top:4px;font-size:12px;color:#475569">
            Gemeente: ${escapeHtml(r.gemeente)}<br/>
            Sport: ${escapeHtml(r.sport)}<br/>
            Bond: ${escapeHtml(r.bond)}
          </div>
        </div>`
      });
      marker.addListener('click', () => info.open({anchor: marker, map}));
      markers.push(marker);
      visible++;
    });

    elCountVisible.textContent = `Zichtbaar: ${visible}`;
    if(visible){
      // Fit bounds
      const bounds = new google.maps.LatLngBounds();
      markers.forEach(m => bounds.extend(m.getPosition()));
      map.fitBounds(bounds, 60);
    }
  }

  // --- MARKERS RENDER INIT (after geocoding) ---
  function renderMarkers(){
    // initial populate without filtering -> applyFilters() doet de rest
  }

  // --- UTILS ---
  function uniq(arr){ return Array.from(new Set(arr)); }
  function debounce(fn, ms){
    let t; return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), ms); };
  }
  function escapeHtml(s){ return String(s || "").replace(/[&<>"']/g, (m)=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

})();