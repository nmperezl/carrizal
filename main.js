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
    zoom: 14.5
});

// 2. Definir capas
const capasTechos = [
    { id: 'techos2010', archivo: 'techos_2010.geojson', color: '#e63946', año: 0 },
    { id: 'techos2015', archivo: 'techos_2015.geojson', color: '#f4a261', año: 1 },
    { id: 'techos2022', archivo: 'techos_2022.geojson', color: '#e9c46a', año: 2 },
    { id: 'techos2024', archivo: 'techos_2024.geojson', color: '#2a9d8f', año: 3 }
];

// Nota: Los archivos de expansión deben llamarse así en tu GitHub
const capasExpansion = [
    { id: 'exp1', archivo: 'expansion_a1.geojson', color: '#ff0000' }, 
    { id: 'exp3', archivo: 'expansion_a3.geojson', color: '#0000ff' }
];

let vistaActual = 'techos';
let añoActual = 0;

// 3. Cargar TODO
map.on('load', () => {
    
    // --- Cargar Techos ---
    capasTechos.forEach((capa) => {
        map.addSource(capa.id, { type: 'geojson', data: capa.archivo });
        map.addLayer({
            id: capa.id, type: 'fill', source: capa.id,
            layout: { visibility: 'none' },
            paint: { 'fill-color': capa.color, 'fill-opacity': 0.75, 'fill-outline-color': '#fff' }
        });

        // Popup para Techos (opcional, muestra el año)
        map.on('click', capa.id, (e) => {
            const props = e.features[0].properties;
            new maplibregl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(`<strong>Techo del año ${añosTexto[capa.año]}</strong>`)
                .addTo(map);
        });
    });

    // --- Cargar Expansión ---
    capasExpansion.forEach((capa) => {
        map.addSource(capa.id, { type: 'geojson', data: capa.archivo });
        map.addLayer({
            id: capa.id, type: 'fill', source: capa.id, // Usamos fill para que se pueda clickear fácil
            layout: { visibility: 'none' },
            paint: { 'fill-color': capa.color, 'fill-opacity': 0.5, 'fill-outline-color': capa.color }
        });

        // Popup para Expansión (Muestra la tabla de atributos que pediste)
        map.on('click', capa.id, (e) => {
            // Extraemos las propiedades. OJO: los nombres deben coincidir con tu tabla de QGIS
            const p = e.features[0].properties;
            
            // Función auxiliar por si algún campo viene vacío o con otro nombre
            const getVal = (val) => val !== undefined && val !== null ? val : 'N/A';

            // Creamos el HTML de la tablita
            const htmlTabla = `
                <div style="font-size: 14px; margin-bottom: 5px;">
                    <strong>Expansión: ${getVal(p.layer)}</strong>
                </div>
                <table class="popup-tabla">
                    <tr><th>Año</th><td>${getVal(p.layer).split('_')[1] || 'N/A'}</td></tr>
                    <tr><th>Área (m²)</th><td>${Number(getVal(p.area_mts)).toLocaleString('es-AR')}</td></tr>
                    <tr><th>Área (km²)</th><td>${getVal(p.km2)}</td></tr>
                </table>
            `;

            new maplibregl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(htmlTabla)
                .addTo(map);
        });
    });

    actualizarMapa(añoActual);
    
    // Cambiar el cursor a "manito" cuando pasa por arriba de las capas
    map.on('mouseenter', capasExpansion.map(c => c.id), () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', capasExpansion.map(c => c.id), () => map.getCanvas().style.cursor = '');
});

// 4. Barra de tiempo (Igual)
const slider = document.getElementById('timeline');
const labelAño = document.getElementById('año-actual');
const contenedorPuntos = document.getElementById('puntos-tiempo');
const añosTexto = ['2010', '2015', '2022', '2024'];

añosTexto.forEach((texto, index) => {
    const punto = document.createElement('div');
    punto.className = 'punto-tiempo';
    punto.innerText = texto;
    punto.addEventListener('click', () => { slider.value = index; actualizarMapa(index); });
    contenedorPuntos.appendChild(punto);
});

slider.addEventListener('input', (e) => actualizarMapa(parseInt(e.target.value)));

// 5. Actualizar Mapa
function actualizarMapa(valor) {
    añoActual = valor;
    labelAño.innerText = añosTexto[valor];
    document.querySelectorAll('.punto-tiempo').forEach((p, i) => p.classList.toggle('activo', i <= valor));

    if (vistaActual === 'techos') {
        capasTechos.forEach(capa => {
            map.setLayoutProperty(capa.id, 'visibility', capa.año <= valor ? 'visible' : 'none');
        });
        capasExpansion.forEach(capa => map.setLayoutProperty(capa.id, 'visibility', 'none'));
    } else if (vistaActual === 'expansion') {
        capasTechos.forEach(capa => map.setLayoutProperty(capa.id, 'visibility', 'none'));
        capasExpansion.forEach(capa => map.setLayoutProperty(capa.id, 'visibility', 'visible'));
    }
}

// 6. Botones
document.getElementById('btn-techos').addEventListener('click', () => {
    vistaActual = 'techos';
    document.getElementById('btn-techos').classList.add('activo');
    document.getElementById('btn-expansion').classList.remove('activo');
    actualizarMapa(añoActual);
});

document.getElementById('btn-expansion').addEventListener('click', () => {
    vistaActual = 'expansion';
    document.getElementById('btn-expansion').classList.add('activo');
    document.getElementById('btn-techos').classList.remove('activo');
    actualizarMapa(añoActual);
});
