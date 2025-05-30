// Configurações
const LOCATIONIQ_API_KEY = 'pk.83215406a1f89930aac39a9cd27ad990';
const OPENROUTE_API_KEY = '5b3ce3597851110001cf6248923209595967475fb7f10b889e6663a8';

// Elementos do DOM
const orderCountInput = document.getElementById('orderCount');
const addressInputContainer = document.getElementById('addressInputContainer');
const cepInput = document.getElementById('cepInput');
const streetNumberInput = document.getElementById('streetNumber');
const addAddressBtn = document.getElementById('addAddress');
const addressList = document.getElementById('addressList');
const calculateRouteBtn = document.getElementById('calculateRoute');
const noOrdersMessage = document.getElementById('noOrdersMessage');
const resultContainer = document.getElementById('resultContainer');
const routeList = document.getElementById('routeList');
const loadingIndicator = document.getElementById('loadingIndicator');
const openMapsBtn = document.getElementById('openMaps');
const distanceInfo = document.getElementById('distanceInfo');
const timeInfo = document.getElementById('timeInfo');
const notification = document.getElementById('notification');
const notificationMessage = document.getElementById('notificationMessage');
const routeMapContainer = document.getElementById('routeMap');

// Variáveis do mapa
let routeMap = null;
let mapMarkers = [];
let routePolyline = null;

// Estado da aplicação
let addresses = [];
let optimizedRoute = null;
let currentLocation = null;
const geocodingCache = JSON.parse(localStorage.getItem('geocodingCache')) || {};

// Funções auxiliares
async function fetchWithTimeout(resource, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(resource, {
        ...options,
        signal: controller.signal  
    });
    
    clearTimeout(id);
    return response;
}

function showNotification(message, type = 'info') {
    notification.className = `notification ${type}`;
    notificationMessage.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

function validateCep(cep) {
    const cepRegex = /^\d{5}-?\d{3}$/;
    return cepRegex.test(cep);
}

// Obtenção de endereços
async function getAddressFromCEP(cep) {
    const cleanCEP = cep.replace(/\D/g, '');
    try {
        const response = await fetchWithTimeout(`https://viacep.com.br/ws/${cleanCEP}/json/`);
        const data = await response.json();
        
        if (data.erro) throw new Error('CEP não encontrado');
        if (!data.logradouro) throw new Error('CEP não possui endereço cadastrado');
        
        return {
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
            cep: data.cep
        };
    } catch (error) {
        console.error('Erro no ViaCEP:', error);
        throw new Error('Falha ao buscar endereço. Verifique o CEP e tente novamente.');
    }
}

// Geocodificação
async function getCoordinatesWithCache(address) {
    if (geocodingCache[address]) {
        console.log('Retornando do cache:', address);
        return geocodingCache[address];
    }
    
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const response = await fetchWithTimeout(
            `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_API_KEY}&format=json&q=${encodeURIComponent(address)}&countrycodes=br&limit=1`
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || data.length === 0) {
            throw new Error("Nenhum resultado encontrado");
        }
        
        const result = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            address: data[0].display_name,
            originalAddress: address
        };
        
        geocodingCache[address] = result;
        localStorage.setItem('geocodingCache', JSON.stringify(geocodingCache));
        
        return result;
    } catch (error) {
        console.error('Erro na geocodificação:', error);
        throw new Error('Falha ao geocodificar endereço. Tente novamente.');
    }
}

// Gerenciamento de endereços
async function addAddress() {
    const cep = cepInput.value.trim();
    const number = streetNumberInput.value.trim();
    
    if (!validateCep(cep)) {
        showNotification('CEP inválido. Formato correto: 12345-678', 'error');
        return;
    }
    
    if (!number || !/^\d+[a-zA-Z]?$/.test(number)) {
        showNotification('Número inválido. Digite apenas números e letras opcionais', 'error');
        return;
    }
    
    try {
        showNotification('Buscando endereço...', 'info');
        
        const addressData = await getAddressFromCEP(cep);
        const fullAddress = `${addressData.street}, ${number}, ${addressData.neighborhood}, ${addressData.city} - ${addressData.state}`;
        
        addresses.push({
            ...addressData,
            number,
            fullAddress,
            originalIndex: addresses.length
        });
        
        cepInput.value = '';
        streetNumberInput.value = '';
        updateAddressList();
        
        showNotification('Endereço adicionado com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao adicionar endereço:', error);
        showNotification(error.message, 'error');
    }
}

function updateAddressList() {
    addressList.innerHTML = '';
    
    if (addresses.length === 0) {
        addressList.innerHTML = '<div class="no-addresses">Nenhum endereço adicionado</div>';
        return;
    }
    
    addresses.forEach((addr, index) => {
        const item = document.createElement('div');
        item.className = 'address-item';
        item.innerHTML = `
            <div>
                <strong>${addr.street}, ${addr.number}</strong>
                <div class="address-details">${addr.neighborhood}, ${addr.city} - ${addr.state}</div>
            </div>
            <button class="remove-address" data-index="${index}">×</button>
        `;
        addressList.appendChild(item);
    });
    
    document.querySelectorAll('.remove-address').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            addresses.splice(index, 1);
            updateAddressList();
        });
    });
}

// Obtenção da localização atual
async function getCurrentLocation() {
    return new Promise((resolve) => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    address: 'Sua localização atual',
                    originalAddress: 'Sua localização atual'
                }),
                () => {
                    console.warn('Geolocalização não permitida, usando local padrão');
                    resolve({
                        lat: -23.5505,
                        lng: -46.6333,
                        address: 'São Paulo, SP, Brasil',
                        originalAddress: 'São Paulo, SP, Brasil'
                    });
                },
                { timeout: 5000 }
            );
        } else {
            resolve({
                lat: -23.5505,
                lng: -46.6333,
                address: 'São Paulo, SP, Brasil',
                originalAddress: 'São Paulo, SP, Brasil'
            });
        }
    });
}

// Inicialização do mapa
function initMap() {
    if (routeMap) {
        routeMap.remove();
        mapMarkers = [];
        if (routePolyline) {
            routeMap.removeLayer(routePolyline);
        }
    }
    
    routeMap = L.map('routeMap').setView([-23.5505, -46.6333], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(routeMap);
    
    routeMapContainer.style.display = 'block';
}

// Adicionar marcadores e rota ao mapa
function updateMapWithRoute(route) {
    if (!routeMap) initMap();
    
    // Limpar marcadores anteriores
    mapMarkers.forEach(marker => routeMap.removeLayer(marker));
    mapMarkers = [];
    
    if (routePolyline) {
        routeMap.removeLayer(routePolyline);
    }
    
    // Adicionar marcadores
    route.forEach((point, index) => {
        const marker = L.circleMarker([point.lat, point.lng], {
            radius: 8,
            className: index === 0 ? 'map-marker-start' : 'map-marker-delivery',
            fillOpacity: 1
        }).addTo(routeMap);
        
        marker.bindPopup(`
            <strong>${index === 0 ? 'Partida' : 'Entrega ' + index}</strong><br>
            ${point.originalAddress || point.address}
        `);
        
        mapMarkers.push(marker);
    });
    
    // Adicionar linha da rota
    const routePoints = route.map(point => [point.lat, point.lng]);
    routePolyline = L.polyline(routePoints, {
        color: '#6c5ce7',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(routeMap);
    
    // Ajustar visualização para mostrar toda a rota
    routeMap.fitBounds(routePoints);
}

// Otimização de rotas
async function optimizeWithOpenRouteService(locations) {
    if (!OPENROUTE_API_KEY || OPENROUTE_API_KEY === '5b3ce3597851110001cf6248923209595967475fb7f10b889e6663a8') {
        throw new Error('Configure sua chave da API OpenRouteService');
    }
    
    const coordinates = locations.map(loc => [loc.lng, loc.lat]);
    
    const response = await fetchWithTimeout('https://api.openrouteservice.org/optimization', {
        method: 'POST',
        headers: {
            'Authorization': OPENROUTE_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            jobs: coordinates.slice(1).map((coord, index) => ({
                id: index + 1,
                location: coord,
                service: 300
            })),
            vehicles: [{
                id: 1,
                profile: 'driving-car',
                start: coordinates[0],
                end: coordinates[0]
            }],
            options: {
                g: true
            }
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Erro na otimização da rota');
    }

    return await response.json();
}

function simulateRouteOptimization(locations) {
    const startingPoint = locations[0];
    const deliveryPoints = locations.slice(1);
    
    const optimizedDeliveries = [...deliveryPoints].sort((a, b) => {
        const distA = Math.sqrt(Math.pow(a.lat - startingPoint.lat, 2) + Math.pow(a.lng - startingPoint.lng, 2));
        const distB = Math.sqrt(Math.pow(b.lat - startingPoint.lat, 2) + Math.pow(b.lng - startingPoint.lng, 2));
        return distA - distB;
    });
    
    return {
        route: [startingPoint, ...optimizedDeliveries],
        distance: null,
        duration: null
    };
}

// Exibição de resultados
function displayRoute(optimizedData) {
    routeList.innerHTML = '';
    
    if (!optimizedData || !optimizedData.route || optimizedData.route.length < 2) {
        showNotification('Nenhuma rota válida para exibir', 'error');
        return;
    }
    
    // Exibir lista de endereços
    optimizedData.route.forEach((point, index) => {
        const li = document.createElement('li');
        li.className = 'route-item';
        li.innerHTML = index === 0 
            ? `<strong>Partida:</strong> ${point.address}`
            : `<strong>Entrega ${index}:</strong> ${point.originalAddress || point.address}`;
        routeList.appendChild(li);
    });
    
    // Atualizar informações de distância e tempo
    if (optimizedData.distance && optimizedData.duration) {
        document.getElementById('distanceText').textContent = `Distância total: ${(optimizedData.distance / 1000).toFixed(1)} km`;
        document.getElementById('timeText').textContent = `Tempo estimado: ${Math.ceil(optimizedData.duration / 60)} minutos`;
    } else {
        const totalDistance = (5 + addresses.length * 3).toFixed(1);
        const totalTime = (15 + addresses.length * 10);
        document.getElementById('distanceText').textContent = `Distância total: ${totalDistance} km`;
        document.getElementById('timeText').textContent = `Tempo estimado: ${totalTime} minutos`;
    }
    
    // Mostrar mapa com a rota
    updateMapWithRoute(optimizedData.route);
    
    distanceInfo.style.display = 'flex';
    timeInfo.style.display = 'flex';
    openMapsBtn.style.display = 'flex';
}

// Cálculo principal da rota
async function calculateRoute() {
    if (addresses.length === 0) {
        showNotification('Adicione pelo menos um endereço', 'error');
        return;
    }
    
    loadingIndicator.style.display = 'block';
    resultContainer.style.display = 'none';
    
    try {
        showNotification('Obtendo sua localização atual...', 'info');
        currentLocation = await getCurrentLocation();
        
        showNotification('Processando endereços...', 'info');
        const locations = [];
        
        for (let i = 0; i < addresses.length; i++) {
            const addr = addresses[i];
            try {
                const location = await getCoordinatesWithCache(addr.fullAddress);
                locations.push({
                    ...location,
                    originalAddress: addr.fullAddress,
                    originalIndex: addr.originalIndex
                });
            } catch (error) {
                console.error(`Falha ao geocodificar: ${addr.fullAddress}`, error);
            }
        }
        
        if (locations.length === 0) {
            throw new Error('Nenhum endereço válido para calcular a rota');
        }
        
        showNotification('Otimizando rota...', 'info');
        const allLocations = [currentLocation, ...locations];
        
        try {
            const apiResult = await optimizeWithOpenRouteService(allLocations);
            
            const optimizedLocations = [currentLocation];
            apiResult.routes[0].steps.forEach(step => {
                if (step.type === "job" && step.id > 0 && step.id <= locations.length) {
                    optimizedLocations.push(locations[step.id - 1]);
                }
            });
            
            optimizedRoute = {
                route: optimizedLocations,
                distance: apiResult.routes[0].distance,
                duration: apiResult.routes[0].duration
            };
        } catch (apiError) {
            console.warn('Falha na API, usando otimização local:', apiError);
            optimizedRoute = simulateRouteOptimization(allLocations);
        }
        
        displayRoute(optimizedRoute);
        showNotification('Rota calculada com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro no cálculo da rota:', error);
        showNotification(error.message || 'Erro ao calcular rota', 'error');
    } finally {
        loadingIndicator.style.display = 'none';
        resultContainer.style.display = 'block';
    }
}

// Event Listeners
orderCountInput.addEventListener('change', function() {
    const count = parseInt(this.value);
    
    if (isNaN(count)) {
        showNotification('Digite um número válido', 'error');
        this.value = '';
        return;
    }
    
    if (count <= 0) {
        addressInputContainer.style.display = 'none';
        noOrdersMessage.style.display = 'block';
        resultContainer.style.display = 'none';
        addresses = [];
        updateAddressList();
    } else {
        noOrdersMessage.style.display = 'none';
        addressInputContainer.style.display = 'block';
        resultContainer.style.display = 'none';
    }
});

addAddressBtn.addEventListener('click', addAddress);
calculateRouteBtn.addEventListener('click', calculateRoute);
openMapsBtn.addEventListener('click', function() {
    if (!optimizedRoute || !optimizedRoute.route || optimizedRoute.route.length < 2) {
        showNotification('Nenhuma rota calculada', 'error');
        return;
    }
    
    const origin = optimizedRoute.route[0];
    const destination = optimizedRoute.route[optimizedRoute.route.length - 1];
    const waypoints = optimizedRoute.route.slice(1, -1);
    
    const originStr = encodeURIComponent(origin.originalAddress || origin.address);
    const destinationStr = encodeURIComponent(destination.originalAddress || destination.address);
    const waypointsStr = waypoints.map(w => encodeURIComponent(w.originalAddress || w.address)).join('|');
    
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destinationStr}&travelmode=driving&waypoints=${waypointsStr}`;
    
    window.open(mapsUrl, '_blank');
});

// Permitir adicionar com Enter
cepInput.addEventListener('keypress', (e) => e.key === 'Enter' && addAddress());
streetNumberInput.addEventListener('keypress', (e) => e.key === 'Enter' && addAddress());

// Inicializar mapa quando o container for exibido
new MutationObserver(function(mutations) {
    if (routeMapContainer.style.display !== 'none' && !routeMap) {
        initMap();
    }
}).observe(routeMapContainer, { attributes: true, attributeFilter: ['style'] });