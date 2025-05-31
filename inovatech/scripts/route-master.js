// Configurações
const OPENROUTE_API_KEY = '5b3ce3597851110001cf6248923209595967475fb7f10b889e6663a8';
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw';

// Elementos do DOM
const elements = {
    orderCountInput: document.getElementById('orderCount'),
    addressInputContainer: document.getElementById('addressInputContainer'),
    cepInput: document.getElementById('cepInput'),
    streetNumberInput: document.getElementById('streetNumber'),
    addressComplementInput: document.getElementById('addressComplement'),
    addAddressBtn: document.getElementById('addAddress'),
    addressList: document.getElementById('addressList'),
    calculateRouteBtn: document.getElementById('calculateRoute'),
    noOrdersMessage: document.getElementById('noOrdersMessage'),
    resultContainer: document.getElementById('resultContainer'),
    routeList: document.getElementById('routeList'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    openMapsBtn: document.getElementById('openMaps'),
    exportRouteBtn: document.getElementById('exportRoute'),
    distanceInfo: document.getElementById('distanceInfo'),
    timeInfo: document.getElementById('timeInfo'),
    distanceText: document.getElementById('distanceText'),
    timeText: document.getElementById('timeText'),
    routeMap: document.getElementById('routeMap'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    toastIcon: document.getElementById('toastIcon')
};

// Estado da aplicação
const state = {
    map: null,
    routeControl: null,
    addresses: [],
    optimizedRoute: null,
    currentLocation: null,
    geocodingCache: JSON.parse(localStorage.getItem('geocodingCache')) || {},
    efficiencyStats: {
        distanceSaved: 0,
        timeSaved: 0,
        fuelSaved: 0
    }
};

// Funções auxiliares
const helpers = {
    showNotification: (message, type = 'info') => {
        const iconMap = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle'
        };
        
        elements.toastIcon.className = `fas ${iconMap[type] || 'fa-info-circle'}`;
        elements.notificationMessage.textContent = message;
        elements.notification.className = `notification-toast ${type} show`;
        
        setTimeout(() => {
            elements.notification.classList.remove('show');
        }, 3000);
    },

    validateCEP: (cep) => /^\d{5}-?\d{3}$/.test(cep),

    formatAddress: (addressData, number, complement) => {
        const parts = [
            addressData.logradouro,
            number,
            complement ? ` - ${complement}` : '',
            `, ${addressData.bairro}`,
            `, ${addressData.localidade} - ${addressData.uf}`
        ];
        return parts.join('');
    },

    fetchWithTimeout: async (resource, options = {}, timeout = 10000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(resource, {
                ...options,
                signal: controller.signal  
            });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }
};

// Serviços de geocodificação e rotas
const services = {
    getAddressFromCEP: async (cep) => {
        const cleanCEP = cep.replace(/\D/g, '');
        try {
            const response = await helpers.fetchWithTimeout(`https://viacep.com.br/ws/${cleanCEP}/json/`);
            const data = await response.json();
            
            if (data.erro) throw new Error('CEP não encontrado');
            if (!data.logradouro) throw new Error('CEP não possui endereço cadastrado');
            
            return data;
        } catch (error) {
            console.error('Erro no ViaCEP:', error);
            throw new Error('Falha ao buscar endereço. Verifique o CEP e tente novamente.');
        }
    },

    geocodeAddress: async (address) => {
        if (state.geocodingCache[address]) {
            console.log('Retornando do cache:', address);
            return state.geocodingCache[address];
        }
        
        try {
            const response = await helpers.fetchWithTimeout(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=BR&access_token=${MAPBOX_ACCESS_TOKEN}`
            );
            
            const data = await response.json();
            
            if (!data.features || data.features.length === 0) {
                throw new Error("Nenhum resultado encontrado");
            }
            
            const result = {
                lat: data.features[0].center[1],
                lng: data.features[0].center[0],
                address: data.features[0].place_name,
                originalAddress: address
            };
            
            state.geocodingCache[address] = result;
            localStorage.setItem('geocodingCache', JSON.stringify(state.geocodingCache));
            
            return result;
        } catch (error) {
            console.error('Erro na geocodificação:', error);
            throw new Error('Falha ao geocodificar endereço. Tente novamente.');
        }
    },

    getCurrentLocation: () => {
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
    },

    calculateRouteEfficiency: (optimizedRoute, originalRoute) => {
        if (!originalRoute || originalRoute.length < 2) return {};
        
        // Calcula distância original (ordem de entrada)
        const originalDistance = originalRoute.reduce((total, point, index) => {
            if (index === 0) return total;
            const prev = originalRoute[index - 1];
            return total + helpers.calculateDistance(prev.lat, prev.lng, point.lat, point.lng);
        }, 0);
        
        // Calcula distância otimizada
        const optimizedDistance = optimizedRoute.reduce((total, point, index) => {
            if (index === 0) return total;
            const prev = optimizedRoute[index - 1];
            return total + helpers.calculateDistance(prev.lat, prev.lng, point.lat, point.lng);
        }, 0);
        
        // Estimativas de economia
        const distanceSaved = originalDistance - optimizedDistance;
        const timeSaved = distanceSaved / 50 * 60; // 50km/h média
        const fuelSaved = distanceSaved * 0.1; // 10L/100km
        
        return {
            distanceSaved,
            timeSaved,
            fuelSaved,
            originalDistance,
            optimizedDistance
        };
    },

    calculateDistance: (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Raio da Terra em km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
};

// Gerenciamento de endereços
const addressManager = {
    addAddress: async () => {
        const cep = elements.cepInput.value.trim();
        const number = elements.streetNumberInput.value.trim();
        const complement = elements.addressComplementInput.value.trim();
        
        if (!helpers.validateCEP(cep)) {
            helpers.showNotification('CEP inválido. Formato correto: 12345-678', 'error');
            return;
        }
        
        if (!number || !/^\d+[a-zA-Z]?$/.test(number)) {
            helpers.showNotification('Número inválido. Digite apenas números e letras opcionais', 'error');
            return;
        }
        
        try {
            helpers.showNotification('Buscando endereço...', 'info');
            
            const addressData = await services.getAddressFromCEP(cep);
            const fullAddress = helpers.formatAddress(addressData, number, complement);
            
            state.addresses.push({
                ...addressData,
                number,
                complement,
                fullAddress,
                originalIndex: state.addresses.length
            });
            
            elements.cepInput.value = '';
            elements.streetNumberInput.value = '';
            elements.addressComplementInput.value = '';
            addressManager.updateAddressList();
            
            helpers.showNotification('Endereço adicionado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro ao adicionar endereço:', error);
            helpers.showNotification(error.message, 'error');
        }
    },

    updateAddressList: () => {
        elements.addressList.innerHTML = '';
        
        if (state.addresses.length === 0) {
            elements.addressList.innerHTML = '<div class="no-addresses">Nenhum endereço adicionado</div>';
            return;
        }
        
        state.addresses.forEach((addr, index) => {
            const item = document.createElement('div');
            item.className = 'address-item';
            item.innerHTML = `
                <div class="address-text">
                    <strong>${addr.logradouro}, ${addr.number}${addr.complement ? ' - ' + addr.complement : ''}</strong>
                    <div class="address-details">${addr.bairro}, ${addr.localidade} - ${addr.uf}</div>
                </div>
                <button class="remove-address" data-index="${index}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
            elements.addressList.appendChild(item);
        });
        
        document.querySelectorAll('.remove-address').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                state.addresses.splice(index, 1);
                addressManager.updateAddressList();
                helpers.showNotification('Endereço removido', 'info');
            });
        });
    },

    clearAllAddresses: () => {
        state.addresses = [];
        addressManager.updateAddressList();
        elements.orderCountInput.value = '';
        elements.addressInputContainer.style.display = 'none';
        elements.noOrdersMessage.style.display = 'block';
        elements.resultContainer.style.display = 'none';
        
        if (state.map) {
            state.map.eachLayer(layer => {
                if (layer instanceof L.Marker || layer instanceof L.Routing.Control) {
                    state.map.removeLayer(layer);
                }
            });
        }
        
        helpers.showNotification('Todos os dados foram limpos', 'info');
    }
};

// Gerenciamento do mapa
const mapManager = {
    initMap: () => {
        if (state.map) {
            state.map.remove();
            if (state.routeControl) {
                state.map.removeControl(state.routeControl);
            }
        }
        
        state.map = L.map(elements.routeMap, {
            zoomControl: false,
            preferCanvas: true
        }).setView([-23.5505, -46.6333], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }).addTo(state.map);
        
        // Adicionar controle de zoom personalizado
        L.control.zoom({
            position: 'topright'
        }).addTo(state.map);
        
        // Ajustar tamanho do mapa quando o container for exibido
        setTimeout(() => {
            state.map.invalidateSize();
        }, 300);
    },

    showRouteOnMap: (route) => {
        if (!state.map) mapManager.initMap();
        
        // Limpar rota anterior se existir
        if (state.routeControl) {
            state.map.removeControl(state.routeControl);
        }
        
        // Converter para waypoints do Leaflet Routing Machine
        const waypoints = route.map(point => L.latLng(point.lat, point.lng));
        
        // Configuração do visual da rota
        state.routeControl = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: false,
            showAlternatives: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: true,
            collapsible: true,
            lineOptions: {
                styles: [
                    {
                        color: '#2E7D32',
                        opacity: 0.8,
                        weight: 6,
                        className: 'animated-route'
                    }
                ]
            },
            createMarker: (i, wp, n) => {
                const icon = i === 0 
                    ? L.divIcon({
                        className: 'start-marker',
                        html: '<i class="fas fa-play"></i>',
                        iconSize: [30, 30]
                    })
                    : i === n - 1
                        ? L.divIcon({
                            className: 'end-marker',
                            html: '<i class="fas fa-flag-checkered"></i>',
                            iconSize: [30, 30]
                        })
                        : L.divIcon({
                            className: 'waypoint-marker',
                            html: `<span>${i}</span>`,
                            iconSize: [25, 25]
                        });
                
                return L.marker(wp.latLng, { icon });
            }
        }).addTo(state.map);
        
        // Ajustar visualização para mostrar toda a rota
        state.map.fitBounds(waypoints, { padding: [50, 50] });
        
        // Adicionar evento para quando a rota for calculada
        state.routeControl.on('routesfound', function(e) {
            const routes = e.routes;
            const summary = routes[0].summary;
            
            // Atualizar informações de distância e tempo
            elements.distanceText.textContent = `${(summary.totalDistance / 1000).toFixed(1)} km`;
            elements.timeText.textContent = `${Math.ceil(summary.totalTime / 60)} minutos`;
            
            elements.distanceInfo.style.display = 'inline-flex';
            elements.timeInfo.style.display = 'inline-flex';
        });
    },

    exportRoute: () => {
        if (!state.optimizedRoute) {
            helpers.showNotification('Calcule uma rota primeiro', 'error');
            return;
        }
        
        let routeText = 'ROTA OTIMIZADA - INOVATECH VIAMASTER\n\n';
        routeText += `Distância total: ${elements.distanceText.textContent}\n`;
        routeText += `Tempo estimado: ${elements.timeText.textContent}\n\n`;
        
        if (state.efficiencyStats.distanceSaved > 0) {
            routeText += `Economia estimada:\n`;
            routeText += `- Distância: ${state.efficiencyStats.distanceSaved.toFixed(1)} km\n`;
            routeText += `- Tempo: ${Math.ceil(state.efficiencyStats.timeSaved)} minutos\n`;
            routeText += `- Combustível: ${state.efficiencyStats.fuelSaved.toFixed(1)} litros\n\n`;
        }
        
        routeText += 'ORDEM DE ENTREGA:\n\n';
        
        state.optimizedRoute.forEach((point, index) => {
            routeText += `${index === 0 ? 'PARTIDA' : index + '.'} ${point.originalAddress || point.address}\n`;
        });
        
        // Criar blob e fazer download
        const blob = new Blob([routeText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rota-inovatech-${new Date().toLocaleDateString('pt-BR')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        helpers.showNotification('Rota exportada com sucesso!', 'success');
    },

    openInGoogleMaps: () => {
        if (!state.optimizedRoute || !state.optimizedRoute.length) {
            helpers.showNotification('Nenhuma rota calculada', 'error');
            return;
        }
        
        const origin = state.optimizedRoute[0];
        const destination = state.optimizedRoute[state.optimizedRoute.length - 1];
        const waypoints = state.optimizedRoute.slice(1, -1);
        
        const originStr = encodeURIComponent(origin.originalAddress || origin.address);
        const destinationStr = encodeURIComponent(destination.originalAddress || destination.address);
        const waypointsStr = waypoints.map(w => encodeURIComponent(w.originalAddress || w.address)).join('|');
        
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destinationStr}&travelmode=driving${waypoints.length ? '&waypoints=' + waypointsStr : ''}`;
        
        window.open(mapsUrl, '_blank');
    }
};

// Gerenciamento de rotas
const routeManager = {
    calculateRoute: async () => {
        if (state.addresses.length < 1) {
            helpers.showNotification('Adicione pelo menos um endereço', 'error');
            return;
        }
        
        elements.loadingIndicator.style.display = 'flex';
        elements.resultContainer.style.display = 'none';
        
        try {
            // 1. Obter localização atual
            helpers.showNotification('Obtendo sua localização atual...', 'info');
            state.currentLocation = await services.getCurrentLocation();
            
            // 2. Geocodificar todos os endereços
            helpers.showNotification('Processando endereços...', 'info');
            const locations = [state.currentLocation];
            
            for (const address of state.addresses) {
                try {
                    const location = await services.geocodeAddress(address.fullAddress);
                    locations.push({
                        ...location,
                        originalAddress: address.fullAddress
                    });
                } catch (error) {
                    console.error(`Falha ao geocodificar: ${address.fullAddress}`, error);
                }
            }
            
            if (locations.length < 2) {
                throw new Error('Nenhum endereço válido para calcular a rota');
            }
            
            // 3. Calcular rota não otimizada (para comparação)
            const originalRoute = [state.currentLocation, ...locations.slice(1)];
            
            // 4. Otimizar rota
            helpers.showNotification('Otimizando rota...', 'info');
            const optimizedRoute = await routeManager.optimizeRoute(locations);
            
            // 5. Calcular eficiência
            state.efficiencyStats = services.calculateRouteEfficiency(optimizedRoute, originalRoute);
            
            // 6. Exibir resultados
            state.optimizedRoute = optimizedRoute;
            routeManager.displayRoute(optimizedRoute);
            
            // 7. Mostrar estatísticas de eficiência
            if (state.efficiencyStats.distanceSaved > 0) {
                const efficiencyMsg = `Rota otimizada! Economia estimada: ${state.efficiencyStats.distanceSaved.toFixed(1)} km, ${Math.ceil(state.efficiencyStats.timeSaved)} minutos`;
                helpers.showNotification(efficiencyMsg, 'success');
            } else {
                helpers.showNotification('Rota calculada com sucesso!', 'success');
            }
            
        } catch (error) {
            console.error('Erro no cálculo da rota:', error);
            helpers.showNotification(error.message || 'Erro ao calcular rota', 'error');
        } finally {
            elements.loadingIndicator.style.display = 'none';
            elements.resultContainer.style.display = 'block';
        }
    },

    optimizeRoute: async (locations) => {
        // Se tivermos poucos pontos, usar algoritmo simples
        if (locations.length <= 5) {
            return routeManager.simpleOptimization(locations);
        }
        
        // Para mais pontos, tentar usar API externa
        try {
            const response = await helpers.fetchWithTimeout('https://api.openrouteservice.org/optimization', {
                method: 'POST',
                headers: {
                    'Authorization': OPENROUTE_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jobs: locations.slice(1).map((loc, index) => ({
                        id: index + 1,
                        location: [loc.lng, loc.lat],
                        service: 300 // 5 minutos por parada
                    })),
                    vehicles: [{
                        id: 1,
                        profile: 'driving-car',
                        start: [locations[0].lng, locations[0].lat],
                        end: [locations[0].lng, locations[0].lat]
                    }]
                })
            });

            if (!response.ok) {
                throw new Error('API de otimização indisponível');
            }

            const data = await response.json();
            
            // Reconstruir rota na ordem otimizada
            const optimizedOrder = [locations[0]]; // Começa com a origem
            
            data.routes[0].steps.forEach(step => {
                if (step.type === "job" && step.id > 0 && step.id <= locations.length - 1) {
                    optimizedOrder.push(locations[step.id]);
                }
            });
            
            return optimizedOrder;
            
        } catch (apiError) {
            console.warn('Falha na API, usando otimização local:', apiError);
            return routeManager.simpleOptimization(locations);
        }
    },

    simpleOptimization: (locations) => {
        const startingPoint = locations[0];
        const deliveryPoints = locations.slice(1);
        
        // Algoritmo simples do vizinho mais próximo
        const optimizedDeliveries = [];
        let currentPoint = startingPoint;
        let remainingPoints = [...deliveryPoints];
        
        while (remainingPoints.length > 0) {
            // Encontrar o ponto mais próximo
            let nearestIndex = 0;
            let nearestDistance = Infinity;
            
            remainingPoints.forEach((point, index) => {
                const distance = services.calculateDistance(
                    currentPoint.lat, currentPoint.lng,
                    point.lat, point.lng
                );
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = index;
                }
            });
            
            // Adicionar à rota e atualizar ponto atual
            optimizedDeliveries.push(remainingPoints[nearestIndex]);
            currentPoint = remainingPoints[nearestIndex];
            remainingPoints.splice(nearestIndex, 1);
        }
        
        return [startingPoint, ...optimizedDeliveries];
    },

    displayRoute: (route) => {
        elements.routeList.innerHTML = '';
        
        route.forEach((point, index) => {
            const li = document.createElement('li');
            li.className = 'route-item';
            
            if (index === 0) {
                li.innerHTML = `<i class="fas fa-play"></i> <strong>Partida:</strong> ${point.address}`;
            } else {
                li.innerHTML = `<span class="step-number">${index}</span> ${point.originalAddress || point.address}`;
            }
            
            elements.routeList.appendChild(li);
        });
        
        // Mostrar mapa com a rota
        mapManager.showRouteOnMap(route);
        
        // Mostrar botões de ação
        elements.openMapsBtn.style.display = 'flex';
        elements.exportRouteBtn.style.display = 'flex';
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Event listeners
    elements.orderCountInput.addEventListener('change', function() {
        const count = parseInt(this.value);
        
        if (isNaN(count) || count <= 0) {
            elements.addressInputContainer.style.display = 'none';
            elements.noOrdersMessage.style.display = 'block';
            elements.resultContainer.style.display = 'none';
            state.addresses = [];
            addressManager.updateAddressList();
        } else {
            elements.noOrdersMessage.style.display = 'none';
            elements.addressInputContainer.style.display = 'block';
        }
    });
    
    elements.addAddressBtn.addEventListener('click', addressManager.addAddress);
    elements.calculateRouteBtn.addEventListener('click', routeManager.calculateRoute);
    elements.clearAllBtn.addEventListener('click', addressManager.clearAllAddresses);
    elements.openMapsBtn.addEventListener('click', mapManager.openInGoogleMaps);
    elements.exportRouteBtn.addEventListener('click', mapManager.exportRoute);
    
    // Permitir adicionar com Enter
    elements.cepInput.addEventListener('keypress', (e) => e.key === 'Enter' && addressManager.addAddress());
    elements.streetNumberInput.addEventListener('keypress', (e) => e.key === 'Enter' && addressManager.addAddress());
    elements.addressComplementInput.addEventListener('keypress', (e) => e.key === 'Enter' && addressManager.addAddress());
    
    // Inicializar mapa quando o container for exibido
    new MutationObserver(() => {
        if (elements.routeMap.style.display !== 'none' && !state.map) {
            mapManager.initMap();
        }
    }).observe(elements.routeMap, { attributes: true });
});