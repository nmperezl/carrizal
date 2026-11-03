// 1. Inicializar el mapa con fondo satelital (usando Esri como base gratuita)
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
        'layers': [{ 'id': 'satelite', 'type': 'raster', 'source': 'satelite' }]
    },
    center: [-68.747037, -33.326260], // <-- ¡CAMBIA ESTO! Pon tu Longitud y Latitud reales-33.326260, -68.747037


    zoom: 14 // <-- Ajusta el zoom (13 o 15) según qué tan grande sea tu área
});

// 2. Configurar los años y colores
const años = [
    { año: '2010', archivo: 'techos_2010.geojson', color: '#ff0000' }, // Rojo
    { año: '2015', archivo: 'techos_2015.geojson', color: '#ffa500' }, // Naranja
    { año: '2022', archivo: 'techos_2022.geojson', color: '#ffff00' }, // Amarillo
    { año: '2024', archivo: 'techos_2024.geojson', color: '#00ff00' }  // Verde
];

// 3. Cargar las capas al mapa
map.on('load', () => {
    años.forEach((item, index) => {
        // Cargar el archivo GeoJSON
        map.addSource(`fuente_${item.año}`, {
            type: 'geojson',
            data: item.archivo // Asume que los archivos están en la misma carpeta que index.html
        });

        // Añadir la capa de polígonos (oculta al inicio, excepto 2010)
        map.addLayer({
            id: `capa_${item.año}`,
            type: 'fill',
            source: `fuente_${item.año}`,
            layout: { visibility: index === 0 ? 'visible' : 'none' },
            paint: {
                'fill-color': item.color,
                'fill-opacity': 0.6,
                'fill-outline-color': '#000000'
            }
        });
    });
});

// 4. Lógica de la barra cronológica (Timeline)
const slider = document.getElementById('timeline');
const labelAño = document.getElementById('año-actual');

slider.addEventListener('input', (e) => {
    const valor = parseInt(e.target.value);
    
    // Lógica de acumulación: Mostrar el año seleccionado y todos los anteriores
    años.forEach((item, index) => {
        const visibilidad = index <= valor ? 'visible' : 'none';
        map.setLayoutProperty(`capa_${item.año}`, 'visibility', visibilidad);
    });

    // Actualizar el texto del año
    labelAño.innerText = años[valor].año;
});
