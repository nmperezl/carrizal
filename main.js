// 1. Inicializar mapa
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

// 2. Definir capas
const añosTexto = ['2010', '2015', '2022', '2024'];
const coloresPorAño = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f']; 

// ¡ACÁ ESTÁ EL CAMBIO! Agregamos "año: 3" explícitamente por si falla la lectura del texto
const capasTechos = [
    { id: 'techos2010', archivo: 'techos_2010.geojson', año: 0 },
    { id: 'techos2015', archivo: 'techos_2015.geojson', año: 1 },
    { id: 'techos2022', archivo: 'techos_2022.geojson', año: 2 },
    { id: 'techos2024', archivo: 'techos_2024.geojson', año: 3 } // Este debería aparecer al final del slider
];

const capasExpansion = [
    { id: 'expA1', archivo: 'expansion_a1.geojson' }, 
    { id: 'expA3', archivo: 'expansion_a3.geojson' }
];

let mostrarTechos = true;
let mostrarExpansion = false;
let añoActual = 0;

map.on('load', () => {
    // --- Cargar Techos ---
    capasTechos.forEach((capa) => {
        map.addSource(capa.id, { type: 'geojson', data: capa.archivo });
        map.addLayer({
            id: capa.id, type: 'fill', source: capa.id,
            layout: { visibility: 'none' },
            paint: { 'fill-color': coloresPorAño[capa.año], 'fill-opacity': 0.75, 'fill-outline-color': '#fff' }
        });
    });

    // --- Cargar Expansión (Mejorado para que lea bien el año) ---
    capasExpansion.forEach((capa) => {
        map.addSource(capa.id, { type: 'geojson', data: capa.archivo });
        map.addLayer({
            id: capa.id, type: 'fill', source: capa.id,
            layout: { visibility: 'none' },
            paint: {
                'fill-color': [
                    'match',
                    // Busca el año dentro del texto (ej: si dice "A1_2024", encuentra "2024")
                    ['to-number', ['slice', ['get', 'layer'], 3]], 
                    2010, coloresPorAño[0],
                    2015, coloresPorAño[1],
                    2022, coloresPorAño[2],
                    2024, coloresPorAño[3],
                    '#cccccc'
                ],
                'fill-opacity': 0.5, 
                'fill-outline-color': '#333'
            }
        });

        // Popup
        map.on('click', capa.id, (e) => {
            const p = e.features[0].properties;
            const getVal = (val) => val !== undefined && val !== null ? val : 'N/A';
            const anioTexto = getVal(p.layer).split('_')[1] || 'N/A';

            const htmlTabla = `
                <div style="font-size: 14px; margin-bottom: 5px;">
                    <strong>Mancha Urbana: ${getVal(p.layer)}</strong>
                </div>
                <table class="popup-tabla">
                    <tr><th>Año</th><td>${anioTexto}</td></tr>
                    <tr><th>Área (m²)</th><td>${Number(getVal(p.area_mts)).toLocaleString('es-AR')}</td></tr>
                    <tr><th>Área (km²)</th><td>${getVal(p.km2)}</td></tr>
                </table>
            `;
            new maplibregl.Popup().setLngLat(e.lngLat).setHTML(htmlTabla).addTo(map);
        });
    });

    // --- ZOOM INICIAL ---
    map.fitBounds([[-68.80, -33.35], [-68.71, -33.29]], { padding: 40 }); 
    
    actualizarMapa();
});

// 4. Barra de tiempo
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

// 5. FUNCIÓN MAESTRA
function actualizarMapa() {
    añoActual = parseInt(slider.value);
    labelAño.innerText = añosTexto[añoActual];
    document.querySelectorAll('.punto-tiempo').forEach((p, i) => p.classList.toggle('activo', i <= añoActual));

    // Techos: Usa el número de índice directo (0,1,2,3) para evitar problemas de texto
    capasTechos.forEach(capa => {
        if (mostrarTechos && capa.año <= añoActual) {
            map.setLayoutProperty(capa.id, 'visibility', 'visible');
        } else {
            map.setLayoutProperty(capa.id, 'visibility', 'none');
        }
    });

    // Expansión: Filtro por año
    capasExpansion.forEach(capa => {
        if (mostrarExpansion) {
            map.setLayoutProperty(capa.id, 'visibility', 'visible');
            const filtroAño = [
                '<=',
                ['to-number', ['slice', ['get', 'layer'], 3]], 
                parseInt(añosTexto[añoActual])
            ];
            map.setFilter(capa.id, filtroAño);
        } else {
            map.setLayoutProperty(capa.id, 'visibility', 'none');
        }
    });
}

// 6. Botones (Orden de capas)
const btnTechos = document.getElementById('btn-techos');
const btnExpansion = document.getElementById('btn-expansion');

function traerAlFrente(idsCapas) {
    idsCapas.forEach(id => { if (map.getLayer(id)) map.moveLayer(id); });
}

btnTechos.addEventListener('click', () => {
    mostrarTechos = !mostrarTechos;
    btnTechos.classList.toggle('activo', mostrarTechos);
    actualizarMapa();
    if (mostrarTechos) traerAlFrente(capasTechos.map(c => c.id));
});

btnExpansion.addEventListener('click', () => {
    mostrarExpansion = !mostrarExpansion;
    btnExpansion.classList.toggle('activo', mostrarExpansion);
    actualizarMapa();
    if (mostrarExpansion) traerAlFrente(capasExpansion.map(c => c.id));
});
