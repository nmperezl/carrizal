// ============ DATOS PARA GRÁFICOS (editables) ============
const serieSuperficie = {
    labels: ['2010', '2015', '2022', '2024'],
    valores: [106.68, 114.34, 153.63, 171.89]  // ha construidas
};
const serieTasas = {
    labels: ['2010-2015', '2015-2022', '2022-2024'],
    valores: [1.53, 5.61, 9.13]  // ha/año
};

// ============ 1. Inicializar mapa ============
const map = new maplibregl.Map({
    container: 'map',
    style: {
        'version': 8,
        'sources': {
            'satelite': {
                'type': 'raster',
                'tiles': ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                'tileSize': 256
            }
        },
        'layers': [{
            'id': 'fondo-satelital', 'type': 'raster', 'source': 'satelite',
            'paint': { 'raster-saturation': -0.7, 'raster-contrast': 0.1, 'raster-brightness-min': 0.1 }
        }]
    },
    center: [-68.7598031, -33.3217114],
    zoom: 12
});

// ============ 2. Definir capas ============
const añosTexto = ['2010', '2015', '2022', '2024'];
const coloresPorAño = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f'];

const capasTechos = [
    { id: 'techos2010', archivo: 'techos_2010.geojson', año: 0 },
    { id: 'techos2015', archivo: 'techos_2015.geojson', año: 1 },
    { id: 'techos2022', archivo: 'techos_2022.geojson', año: 2 },
    { id: 'techos2024', archivo: 'techos_2024.geojson', año: 3 }
];

const capasExpansion = [
    { id: 'expA1', archivo: 'expansion_a1.geojson' },
    { id: 'expA3', archivo: 'expansion_a3.geojson' }
];

// Estado de visibilidad por capa (independiente)
const visibilidad = {
    techos: false,
    expA1: true,   // prendido por defecto
    expA3: true    // prendido por defecto
};

let añoActual = 0;

// Utilidad: extrae el año de un string tipo "A1_2024"
function extraerAnio(valor) {
    if (!valor) return null;
    const m = String(valor).match(/(20\d{2})/);
    return m ? parseInt(m[1]) : null;
}

// Filtro MapLibre: año del feature <= año del slider
function filtroPorAnio(anioLimite) {
    return ['<=', ['to-number', ['get', '_anio']], anioLimite];
}

map.on('load', () => {
    // --- Techos (sin popup) ---
    capasTechos.forEach((capa) => {
        map.addSource(capa.id, { type: 'geojson', data: capa.archivo });
        map.addLayer({
            id: capa.id, type: 'fill', source: capa.id,
            layout: { visibility: 'none' },
            paint: { 'fill-color': coloresPorAño[capa.año], 'fill-opacity': 0.75, 'fill-outline-color': '#fff' }
        });
    });

    // --- Expansión A1 y A3 (con popup) ---
    capasExpansion.forEach((capa) => {
        map.addSource(capa.id, { type: 'geojson', data: capa.archivo });
        map.addLayer({
            id: capa.id, type: 'fill', source: capa.id,
            layout: { visibility: 'none' },
            paint: {
                'fill-color': [
                    'match', ['to-number', ['get', '_anio']],
                    2010, coloresPorAño[0], 2015, coloresPorAño[1],
                    2022, coloresPorAño[2], 2024, coloresPorAño[3],
                    '#cccccc'
                ],
                'fill-opacity': 0.5,
                'fill-outline-color': '#333'
            }
        });
        map.on('click', capa.id, (e) => {
            const p = e.features[0].properties;
            const getVal = (v) => (v !== undefined && v !== null ? v : 'N/A');
            const anio = extraerAnio(p.layer) || 'N/A';
            const html = `
                <div style="font-size:14px;margin-bottom:5px;"><strong>${getVal(p.layer)}</strong></div>
                <table class="popup-tabla">
                    <tr><th>Año</th><td>${anio}</td></tr>
                    <tr><th>Área (m²)</th><td>${Number(getVal(p.area_mts)).toLocaleString('es-AR')}</td></tr>
                    <tr><th>Área (km²)</th><td>${getVal(p.km2)}</td></tr>
                </table>`;
            new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
        });
    });

    // Precalcular _anio para filtro robusto
    capasExpansion.forEach((capa) => {
        const src = map.getSource(capa.id);
        if (src && src._data && src._data.features) {
            src._data.features.forEach(f => {
                f.properties._anio = extraerAnio(f.properties.layer);
            });
            src.setData(src._data);
        }
    });

    map.fitBounds([[-68.80, -33.35], [-68.71, -33.29]], { padding: 40 });
    actualizarMapa();
    inicializarGraficos();
});

// ============ 3. Slider ============
const slider = document.getElementById('timeline');
const labelAño = document.getElementById('año-actual');
const contenedorPuntos = document.getElementById('puntos-tiempo');

añosTexto.forEach((texto, index) => {
    const punto = document.createElement('div');
    punto.className = 'punto-tiempo';
    punto.innerText = texto;
    punto.addEventListener('click', () => { slider.value = index; actualizarMapa(); });
    contenedorPuntos.appendChild(punto);
});
slider.addEventListener('input', () => actualizarMapa());

// ============ 4. Función maestra ============
function actualizarMapa() {
    añoActual = parseInt(slider.value);
    labelAño.innerText = añosTexto[añoActual];
    document.querySelectorAll('.punto-tiempo').forEach((p, i) => p.classList.toggle('activo', i <= añoActual));

    const anioLimite = parseInt(añosTexto[añoActual]);

    // Techos: acumulado hasta el año, si el botón está prendido
    capasTechos.forEach(capa => {
        const visible = visibilidad.techos && capa.año <= añoActual;
        map.setLayoutProperty(capa.id, 'visibility', visible ? 'visible' : 'none');
    });

    // Expansión A1
    map.setLayoutProperty('expA1', 'visibility', visibilidad.expA1 ? 'visible' : 'none');
    if (visibilidad.expA1) map.setFilter('expA1', filtroPorAnio(anioLimite));

    // Expansión A3
    map.setLayoutProperty('expA3', 'visibility', visibilidad.expA3 ? 'visible' : 'none');
    if (visibilidad.expA3) map.setFilter('expA3', filtroPorAnio(anioLimite));

    // Orden: techos arriba, luego expansión
    capasTechos.forEach(c => { if (map.getLayer(c.id)) map.moveLayer(c.id); });
    capasExpansion.forEach(c => { if (map.getLayer(c.id)) map.moveLayer(c.id); });
}

// ============ 5. Botones ============
const btnTechos = document.getElementById('btn-techos');
const btnExpA1 = document.getElementById('btn-exp-a1');
const btnExpA3 = document.getElementById('btn-exp-a3');
const btnGraficos = document.getElementById('btn-graficos');
const panelGraficos = document.getElementById('panel-graficos');

btnTechos.addEventListener('click', () => {
    visibilidad.techos = !visibilidad.techos;
    btnTechos.classList.toggle('activo', visibilidad.techos);
    actualizarMapa();
});

btnExpA1.addEventListener('click', () => {
    visibilidad.expA1 = !visibilidad.expA1;
    btnExpA1.classList.toggle('activo', visibilidad.expA1);
    actualizarMapa();
});

btnExpA3.addEventListener('click', () => {
    visibilidad.expA3 = !visibilidad.expA3;
    btnExpA3.classList.toggle('activo', visibilidad.expA3);
    actualizarMapa();
});

btnGraficos.addEventListener('click', () => {
    panelGraficos.classList.toggle('visible');
    btnGraficos.classList.toggle('activo', panelGraficos.classList.contains('visible'));
});

// ============ 6. Gráficos ============
let chartSuperficie, chartTasas;

function inicializarGraficos() {
    const ctx1 = document.getElementById('chartSuperficie').getContext('2d');
    chartSuperficie = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: serieSuperficie.labels,
            datasets: [{
                label: 'Superficie construida (ha)',
                data: serieSuperficie.valores,
                borderColor: '#e63946',
                backgroundColor: 'rgba(230,57,70,0.15)',
                fill: true, tension: 0.25, pointRadius: 5,
                pointBackgroundColor: '#e63946'
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: false, title: { display: true, text: 'ha' } } }
        }
    });

    const ctx2 = document.getElementById('chartTasas').getContext('2d');
    chartTasas = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: serieTasas.labels,
            datasets: [{
                label: 'Tasa (ha/año)',
                data: serieTasas.valores,
                backgroundColor: ['#f4a261', '#e9c46a', '#2a9d8f']
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'ha/año' } } }
        }
    });
}

// Resaltar el año actual en el gráfico de línea
const _actualizarOriginal = actualizarMapa;
actualizarMapa = function () {
    _actualizarOriginal();
    if (chartSuperficie) {
        chartSuperficie.data.datasets[0].pointRadius =
            serieSuperficie.labels.map((_, i) => (i === añoActual ? 9 : 5));
        chartSuperficie.data.datasets[0].pointBackgroundColor =
            serieSuperficie.labels.map((_, i) => (i === añoActual ? '#c1121f' : '#e63946'));
        chartSuperficie.update();
    }
};
