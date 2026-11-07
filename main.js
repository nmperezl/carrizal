// ============================================================
// DATOS PARA GRÁFICOS (fijos, del informe)
// NO se recalculan desde las capas: son la serie total del área
// de estudio (suma de techos por año) y las tasas por período.
// ============================================================
const serieSuperficie = {
    labels: ['2010', '2015', '2022', '2024'],
    valores: [106.68, 114.34, 153.63, 171.89]  // ha construidas
};
const serieTasas = {
    labels: ['2010-2015', '2015-2022', '2022-2024'],
    valores: [1.53, 5.61, 9.13]  // ha/año
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
// 2. Definir capas y paleta
// ============================================================
const añosTexto = ['2010', '2015', '2022', '2024'];

// Paleta desaturada pensada para fondo satelital en gris
const coloresPorAño = ['#b5544a', '#c98a4b', '#b8a54a', '#4a8f7b'];

// Estilos diferenciados A1 / A3 (se distinguen cuando están juntas)
const estiloA1 = { opacidad: 0.55, borde: '#ffffff', grosor: 1.5 };
const estiloA3 = { opacidad: 0.40, borde: '#1f2d3d', grosor: 2.5 };

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

// Estado de visibilidad por capa (toggles independientes)
const visibilidad = {
    techos: false,
    expA1: true,   // prendido por defecto
    expA3: true    // prendido por defecto
};

let añoActual = 0;

// ============================================================
// Utilidades
// ============================================================

// Extrae el año de un string tipo "A1_2024" o "Expansión_A1_2024"
function extraerAnio(valor) {
    if (!valor) return null;
    const m = String(valor).match(/(20\d{2})/);
    return m ? parseInt(m[1]) : null;
}

// Filtro MapLibre: año del feature <= año del slider (acumulado)
function filtroPorAnio(anioLimite) {
    return ['<=', ['to-number', ['get', '_anio']], anioLimite];
}

// Expresión de color por año (reutilizable)
function colorPorAnioExpresion() {
    return [
        'match', ['to-number', ['get', '_anio']],
        2010, coloresPorAño[0],
        2015, coloresPorAño[1],
        2022, coloresPorAño[2],
        2024, coloresPorAño[3],
        '#9aa5b1'
    ];
}

// ============================================================
// 3. Carga de capas
// ============================================================
map.on('load', () => {

    // --- Techos (sin popup) ---
    capasTechos.forEach((capa) => {
        map.addSource(capa.id, { type: 'geojson', data: capa.archivo });
        map.addLayer({
            id: capa.id,
            type: 'fill',
            source: capa.id,
            layout: { visibility: 'none' },
            paint: {
                'fill-color': coloresPorAño[capa.año],
                'fill-opacity': 0.75,
                'fill-outline-color': '#ffffff'
            }
        });
    });

    // --- Expansión A1 y A3 (con popup) ---
    capasExpansion.forEach((capa) => {
        const est = capa.estilo;

        map.addSource(capa.id, { type: 'geojson', data: capa.archivo });

        // Relleno
        map.addLayer({
            id: capa.id,
            type: 'fill',
            source: capa.id,
            layout: { visibility: 'none' },
            paint: {
                'fill-color': colorPorAnioExpresion(),
                'fill-opacity': est.opacidad
            }
        });

        // Borde (line encima del fill)
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

        // Popup solo para expansión
        map.on('click', capa.id, (e) => {
            const p = e.features[0].properties;
            const getVal = (v) => (v !== undefined && v !== null ? v : 'N/A');
            const anio = extraerAnio(p.layer) || 'N/A';
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
    });

    // Precalcular _anio en features de expansión (para filtro robusto)
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
// 5. Función maestra de actualización
// ============================================================
function actualizarMapa() {
    añoActual = parseInt(slider.value);
    labelAño.innerText = añosTexto[añoActual];

    document.querySelectorAll('.punto-tiempo').forEach((p, i) => {
        p.classList.toggle('activo', i <= añoActual);
    });

    const anioLimite = parseInt(añosTexto[añoActual]);

    // --- Techos: acumulado hasta el año, si el botón está prendido ---
    capasTechos.forEach(capa => {
        const visible = visibilidad.techos && capa.año <= añoActual;
        map.setLayoutProperty(capa.id, 'visibility', visible ? 'visible' : 'none');
    });

    // --- Expansión A1 ---
    const visA1 = visibilidad.expA1;
    map.setLayoutProperty('expA1', 'visibility', visA1 ? 'visible' : 'none');
    map.setLayoutProperty('expA1-outline', 'visibility', visA1 ? 'visible' : 'none');
    if (visA1) {
        map.setFilter('expA1', filtroPorAnio(anioLimite));
        map.setFilter('expA1-outline', filtroPorAnio(anioLimite));
    }

    // --- Expansión A3 ---
    const visA3 = visibilidad.expA3;
    map.setLayoutProperty('expA3', 'visibility', visA3 ? 'visible' : 'none');
    map.setLayoutProperty('expA3-outline', 'visibility', visA3 ? 'visible' : 'none');
    if (visA3) {
        map.setFilter('expA3', filtroPorAnio(anioLimite));
        map.setFilter('expA3-outline', filtroPorAnio(anioLimite));
    }

    // --- Orden de capas: techos arriba, luego expansión ---
    capasTechos.forEach(c => { if (map.getLayer(c.id)) map.moveLayer(c.id); });
    capasExpansion.forEach(c => {
        if (map.getLayer(c.id)) map.moveLayer(c.id);
        if (map.getLayer(c.id + '-outline')) map.moveLayer(c.id + '-outline');
    });

    // Resaltar año actual en el gráfico
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
// 7. Gráficos (fijos, serie total del informe)
// ============================================================
let chartSuperficie = null;
let chartTasas = null;

function inicializarGraficos() {
    const ctx1 = document.getElementById('chartSuperficie').getContext('2d');
    chartSuperficie = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: serieSuperficie.labels,
            datasets: [{
                label: 'Superficie construida (ha)',
                data: serieSuperficie.valores,
                borderColor: '#5b7a99',
                backgroundColor: 'rgba(91,122,153,0.15)',
                fill: true,
                tension: 0.25,
                pointRadius: 5,
                pointBackgroundColor: '#5b7a99',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, title: { display: true, text: 'ha', color: '#666' } }
            }
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
                backgroundColor: ['#b5544a', '#c98a4b', '#4a8f7b'],
                borderColor: '#ffffff',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'ha/año', color: '#666' } }
            }
        }
    });
}

// Resalta el punto del año actual en el gráfico de línea
function resaltarEnGrafico() {
    if (!chartSuperficie) return;
    chartSuperficie.data.datasets[0].pointRadius =
        serieSuperficie.labels.map((_, i) => (i === añoActual ? 9 : 5));
    chartSuperficie.data.datasets[0].pointBackgroundColor =
        serieSuperficie.labels.map((_, i) => (i === añoActual ? '#2c3e50' : '#5b7a99'));
    chartSuperficie.update();
}
