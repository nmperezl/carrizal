// ============================================================
// DATOS PARA GRÁFICOS (fijos, del informe)
// Serie total del área de estudio (suma de techos por año)
// ============================================================
const serieSuperficie = {
    labels: ['2010', '2015', '2022', '2024'],
    valores: [106.68, 114.34, 153.63, 171.89]
};
const serieTasas = {
    labels: ['2010-2015', '2015-2022', '2022-2024'],
    valores: [1.53, 5.61, 9.13]
};

// ============================================================
// 1. Inicializar mapa
// ============================================================
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
            'paint': {
                'raster-saturation': -0.7,
                'raster-contrast': 0.1,
                'raster-brightness-min': 0.1
            }
        }]
    },
    center: [-68.7598031, -33.3217114],
    zoom: 12
});

// ============================================================
// 2. Paleta y estilos
// ============================================================
const añosTexto = ['2010', '2015', '2022', '2024'];

// Techos: colores con más presencia (se leen sobre gris)
const coloresTechos = ['#c0504d', '#d98b3a', '#c9b03e', '#3f8f7a'];

// Expansión: misma familia pero más apagada (relleno)
const coloresExpansion = ['#a86b68', '#b98a5e', '#a89a5e', '#5e8a7c'];

// A1 vs A3: A1 relleno más presente + borde blanco; A3 más tenue + borde oscuro
const estiloA1 = { opacidad: 0.55, borde: '#ffffff', grosor: 1.8 };
const estiloA3 = { opacidad: 0.35, borde: '#2c3e50', grosor: 2.2 };

const capasTechos = [
    { id: 'techos2010', archivo: 'techos_2010.geojson', año: 0 },
    { id: 'techos2015', archivo: 'techos_2015.geojson', año: 1 },
    { id: 'techos2022', archivo: 'techos_2022.geojson', año: 2 },
    { id: 'techos2024', archivo: 'techos_2024.geojson', año: 3 }
];

const capasExpansion = [
    { id: 'expA1', archivo: 'expansion_a1.geojson', estilo: estiloA1 },
    { id: 'expA3', archivo: 'expansion_a3.geojson', estilo: estiloA3 }
];

const visibilidad = { techos: false, expA1: true, expA3: true };
let añoActual = 0;

// ============================================================
// Utilidades
// ============================================================
function extraerAnio(valor) {
    if (!valor) return null;
    const m = String(valor).match(/(20\d{2})/);
    return m ? parseInt(m[1]) : null;
}

function filtroPorAnio(anioLimite) {
    return ['<=', ['to-number', ['get', '_anio']], anioLimite];
}

// Expresión de color usando _anio ya inyectado
function colorExpresion(paleta) {
    return [
        'match', ['to-number', ['get', '_anio']],
        2010, paleta[0],
        2015, paleta[1],
        2022, paleta[2],
        2024, paleta[3],
        '#9aa5b1'
    ];
}

// Carga un GeoJSON y le inyecta _anio en cada feature
async function cargarGeoJSONConAnio(url) {
    const resp = await fetch(url);
    const data = await resp.json();
    data.features.forEach(f => {
        f.properties = f.properties || {};
        f.properties._anio = extraerAnio(f.properties.layer);
    });
    return data;
}

// ============================================================
// 3. Carga de capas (async, con _anio inyectado ANTES de addSource)
// ============================================================
map.on('load', async () => {

    // --- Techos (sin popup) ---
    for (const capa of capasTechos) {
        const data = await cargarGeoJSONConAnio(capa.archivo);
        map.addSource(capa.id, { type: 'geojson', data });

        map.addLayer({
            id: capa.id,
            type: 'fill',
            source: capa.id,
            layout: { visibility: 'none' },
            paint: {
                'fill-color': coloresTechos[capa.año],
                'fill-opacity': 0.85
            }
        });

        // Contorno para destacar techos sobre el gris
        map.addLayer({
            id: capa.id + '-outline',
            type: 'line',
            source: capa.id,
            layout: { visibility: 'none' },
            paint: {
                'line-color': '#ffffff',
                'line-width': 1.2,
                'line-opacity': 0.95
            }
        });
    }

    // --- Expansión A1 y A3 (con popup) ---
    for (const capa of capasExpansion) {
        const est = capa.estilo;
        const data = await cargarGeoJSONConAnio(capa.archivo);
        map.addSource(capa.id, { type: 'geojson', data });

        map.addLayer({
            id: capa.id,
            type: 'fill',
            source: capa.id,
            layout: { visibility: 'none' },
            paint: {
                'fill-color': colorExpresion(coloresExpansion),
                'fill-opacity': est.opacidad
            }
        });

        map.addLayer({
            id: capa.id + '-outline',
            type: 'line',
            source: capa.id,
            layout: { visibility: 'none' },
            paint: {
                'line-color': est.borde,
                'line-width': est.grosor,
                'line-opacity': 0.9
            }
        });

        map.on('click', capa.id, (e) => {
            const p = e.features[0].properties;
            const getVal = (v) => (v !== undefined && v !== null ? v : 'N/A');
            const anio = p._anio || extraerAnio(p.layer) || 'N/A';
            const html = `
                <div style="font-size:14px;margin-bottom:5px;">
                    <strong>${getVal(p.layer)}</strong>
                </div>
                <table class="popup-tabla">
                    <tr><th>Año</th><td>${anio}</td></tr>
                    <tr><th>Área (m²)</th><td>${Number(getVal(p.area_mts)).toLocaleString('es-AR')}</td></tr>
                    <tr><th>Área (km²)</th><td>${getVal(p.km2)}</td></tr>
                </table>`;
            new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
        });
    }

    map.fitBounds([[-68.80, -33.35], [-68.71, -33.29]], { padding: 40 });

    actualizarMapa();
    inicializarGraficos();
});

// ============================================================
// 4. Barra de tiempo
// ============================================================
const slider = document.getElementById('timeline');
const labelAño = document.getElementById('año-actual');
const contenedorPuntos = document.getElementById('puntos-tiempo');

añosTexto.forEach((texto, index) => {
    const punto = document.createElement('div');
    punto.className = 'punto-tiempo';
    punto.innerText = texto;
    punto.addEventListener('click', () => {
        slider.value = index;
        actualizarMapa();
    });
    contenedorPuntos.appendChild(punto);
});

slider.addEventListener('input', () => actualizarMapa());

// ============================================================
// 5. Función maestra
// ============================================================
function actualizarMapa() {
    añoActual = parseInt(slider.value);
    labelAño.innerText = añosTexto[añoActual];

    document.querySelectorAll('.punto-tiempo').forEach((p, i) => {
        p.classList.toggle('activo', i <= añoActual);
    });

    const anioLimite = parseInt(añosTexto[añoActual]);

    // Techos: acumulado hasta el año, solo si el botón está prendido
    capasTechos.forEach(capa => {
        const visible = visibilidad.techos && capa.año <= añoActual;
        map.setLayoutProperty(capa.id, 'visibility', visible ? 'visible' : 'none');
        map.setLayoutProperty(capa.id + '-outline', 'visibility', visible ? 'visible' : 'none');
    });

    // Expansión A1
    map.setLayoutProperty('expA1', 'visibility', visibilidad.expA1 ? 'visible' : 'none');
    map.setLayoutProperty('expA1-outline', 'visibility', visibilidad.expA1 ? 'visible' : 'none');
    if (visibilidad.expA1) {
        map.setFilter('expA1', filtroPorAnio(anioLimite));
        map.setFilter('expA1-outline', filtroPorAnio(anioLimite));
    }

    // Expansión A3
    map.setLayoutProperty('expA3', 'visibility', visibilidad.expA3 ? 'visible' : 'none');
    map.setLayoutProperty('expA3-outline', 'visibility', visibilidad.expA3 ? 'visible' : 'none');
    if (visibilidad.expA3) {
        map.setFilter('expA3', filtroPorAnio(anioLimite));
        map.setFilter('expA3-outline', filtroPorAnio(anioLimite));
    }

    // Orden: techos arriba, luego expansión
    capasTechos.forEach(c => {
        if (map.getLayer(c.id)) map.moveLayer(c.id);
        if (map.getLayer(c.id + '-outline')) map.moveLayer(c.id + '-outline');
    });
    capasExpansion.forEach(c => {
        if (map.getLayer(c.id)) map.moveLayer(c.id);
        if (map.getLayer(c.id + '-outline')) map.moveLayer(c.id + '-outline');
    });

    resaltarEnGrafico();
}

// ============================================================
// 6. Botones
// ============================================================
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

// ============================================================
// 7. Gráficos (sobrios, profesionales)
// ============================================================
let chartSuperficie = null;
let chartTasas = null;

function inicializarGraficos() {
    // Línea: azul grisáceo monocromático
    const ctx1 = document.getElementById('chartSuperficie').getContext('2d');
    chartSuperficie = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: serieSuperficie.labels,
            datasets: [{
                label: 'Superficie construida (ha)',
                data: serieSuperficie.valores,
                borderColor: '#5b7a99',
                backgroundColor: 'rgba(91,122,153,0.12)',
                fill: true,
                tension: 0.25,
                pointRadius: 5,
                pointBackgroundColor: '#5b7a99',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    title: { display: true, text: 'ha', color: '#8a97a5' },
                    ticks: { color: '#8a97a5' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8a97a5' }
                }
            }
        }
    });

    // Barras: tonos tierra apagados, sobrios
    const ctx2 = document.getElementById('chartTasas').getContext('2d');
    chartTasas = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: serieTasas.labels,
            datasets: [{
                label: 'Tasa (ha/año)',
                data: serieTasas.valores,
                backgroundColor: ['#9a8a7a', '#a89a8a', '#7a8a8a'],
                borderColor: 'rgba(0,0,0,0.08)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    title: { display: true, text: 'ha/año', color: '#8a97a5' },
                    ticks: { color: '#8a97a5' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8a97a5' }
                }
            }
        }
    });
}

function resaltarEnGrafico() {
    if (!chartSuperficie) return;
    chartSuperficie.data.datasets[0].pointRadius =
        serieSuperficie.labels.map((_, i) => (i === añoActual ? 8 : 5));
    chartSuperficie.data.datasets[0].pointBackgroundColor =
        serieSuperficie.labels.map((_, i) => (i === añoActual ? '#2c3e50' : '#5b7a99'));
    chartSuperficie.update();
}
