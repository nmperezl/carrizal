// 1. Inicializar el mapa en las coordenadas exactas de El Carrizal
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
        'layers': [
            {
                'id': 'fondo-satelital',
                'type': 'raster',
                'source': 'satelite',
                // TRUCO: Desaturamos el fondo para que resalten los colores de tus vectores
                'paint': {
                    'raster-saturation': -0.7, // -1 es blanco y negro, 0 es color original
                    'raster-contrast': 0.1,    // Un poco de contraste para que no se vea lavado
                    'raster-brightness-min': 0.1
                }
            }
        ]
    },
    center: [-68.7598031, -33.3217114], // Coordenadas exactas de tu link de Google Maps
    zoom: 14.5
});

// 2. Configurar los años y colores (Ajustados para que se distingan bien)
const años = [
    { año: '2010', archivo: 'techos_2010.geojson', color: '#e63946' }, // Rojo
    { año: '2015', archivo: 'techos_2015.geojson', color: '#f4a261' }, // Naranja
    { año: '2022', archivo: 'techos_2022.geojson', color: '#e9c46a' }, // Amarillo
    { año: '2024', archivo: 'techos_2024.geojson', color: '#2a9d8f' }  // Verde agua
];

// 3. Cargar las capas al mapa
map.on('load', () => {
    años.forEach((item, index) => {
        map.addSource(`fuente_${item.año}`, {
            type: 'geojson',
            data: item.archivo
        });

        map.addLayer({
            id: `capa_${item.año}`,
            type: 'fill',
            source: `fuente_${item.año}`,
            layout: { visibility: index === 0 ? 'visible' : 'none' },
            paint: {
                'fill-color': item.color,
                'fill-opacity': 0.75,
                'fill-outline-color': '#ffffff' // Borde blanco para que se vea limpio
            }
        });
    });
});

// 4. Lógica de la barra cronológica
const slider = document.getElementById('timeline');
const labelAño = document.getElementById('año-actual');
const contenedorPuntos = document.getElementById('puntos-tiempo');

// Creamos los puntitos de la barra temporal dinámicamente
años.forEach((item, index) => {
    const punto = document.createElement('div');
    punto.className = 'punto-tiempo';
    punto.innerText = item.año;
    
    // Al hacer clic en un año, movemos el slider
    punto.addEventListener('click', () => {
        slider.value = index;
        actualizarMapa(index);
    });
    
    contenedorPuntos.appendChild(punto);
});

// Función que actualiza el mapa y los estilos de los puntitos
function actualizarMapa(valor) {
    // Acumular capas (muestra la actual y todas las anteriores)
    años.forEach((item, index) => {
        const visibilidad = index <= valor ? 'visible' : 'none';
        map.setLayoutProperty(`capa_${item.año}`, 'visibility', visibilidad);
    });

    // Actualizar texto del año
    labelAño.innerText = años[valor].año;

    // Actualizar color de los puntos (resaltar el activo)
    const puntos = document.querySelectorAll('.punto-tiempo');
    puntos.forEach((punto, index) => {
        if (index <= valor) {
            punto.classList.add('activo');
        } else {
            punto.classList.remove('activo');
        }
    });
}

slider.addEventListener('input', (e) => {
    actualizarMapa(parseInt(e.target.value));
});

// Inicializar la primera vez
actualizarMapa(0);
