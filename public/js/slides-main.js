// --- 1. CONFIGURACIÓN ---
// Lista de imágenes de diapositivas (puedes agregar más)
const SLIDES = [
    '/slides/1.jpg',
    '/slides/2.jpg', 
    '/slides/3.jpg',
    '/slides/4.jpg',
    '/slides/5.jpg',
    '/slides/6.jpg'
];

// --- 2. VARIABLES GLOBALES Y ELEMENTOS DEL DOM ---
let currentSlide = 0;
let isFullscreen = false;
let autoAdvanceInterval = null;
//let gestureCooldown = false; // <-- AÑADE ESTA LÍNEA

const slideImage = document.getElementById('slide-image');
const slideNumberText = document.getElementById('slide-number');
const slideTitle = document.getElementById('slide-title');
const progressBar = document.getElementById('progress-bar');
const loadingSpinner = document.getElementById('loading-spinner');

// --- 3. CONEXIÓN AL SERVIDOR DE SOCKET.IO ---
const socket = io();
let lockOverlay;

console.log("🔄 Conectando a Socket.io (Diapositivas)...");

socket.on("connect", () => {
    console.log("✅ Conectado al servidor con ID:", socket.id);
    showNotification("🟢 Conectado al sistema de control", "success");
});

socket.on("disconnect", () => {
    console.log("❌ Desconectado del servidor");
    showNotification("🔴 Conexión perdida", "error");
});

// --- 4. LÓGICA DE DIAPOSITIVAS MEJORADA ---

function updateSlide(animate = true) {
    // Validar límites
    if (currentSlide < 0) currentSlide = 0;
    if (currentSlide >= SLIDES.length) currentSlide = SLIDES.length - 1;

    // Mostrar spinner de carga
    if (loadingSpinner) {
        loadingSpinner.style.display = 'flex';
    }

    // Actualizar imagen
    if (slideImage) {
        // Efecto de transición
        if (animate) {
            slideImage.style.opacity = '0.3';
            slideImage.style.transform = 'scale(0.95)';
        }
        
        // Pre-cargar imagen
        const img = new Image();
        img.onload = () => {
            slideImage.src = SLIDES[currentSlide];
            
            // Animar entrada
            setTimeout(() => {
                slideImage.style.opacity = '1';
                slideImage.style.transform = 'scale(1)';
                if (loadingSpinner) {
                    loadingSpinner.style.display = 'none';
                }
            }, 100);
        };
        img.onerror = () => {
            console.error("❌ Error al cargar imagen:", SLIDES[currentSlide]);
            // Usar imagen de placeholder si falla
            slideImage.src = createPlaceholderSlide(currentSlide + 1);
            if (loadingSpinner) {
                loadingSpinner.style.display = 'none';
            }
        };
        img.src = SLIDES[currentSlide];
    }

    // Actualizar UI
    if (slideNumberText) {
        slideNumberText.innerText = `${currentSlide + 1} / ${SLIDES.length}`;
    }
    
    if (slideTitle) {
        slideTitle.innerText = `Diapositiva ${currentSlide + 1}`;
    }
    
    if (progressBar) {
        const progress = ((currentSlide + 1) / SLIDES.length) * 100;
        progressBar.style.width = `${progress}%`;
    }

    console.log(`📄 Mostrando slide ${currentSlide + 1}/${SLIDES.length}`);
}

function nextSlide() {
    if (currentSlide < SLIDES.length - 1) {
        currentSlide++;
        updateSlide();
        showNotification("➡️ Siguiente diapositiva", "info");
    } else {
        showNotification("📄 Fin de la presentación", "warning");
    }
}

function prevSlide() {
    if (currentSlide > 0) {
        currentSlide--;
        updateSlide();
        showNotification("⬅️ Diapositiva anterior", "info");
    } else {
        showNotification("📄 Inicio de la presentación", "warning");
    }
}

function goToSlide(index) {
    if (index >= 0 && index < SLIDES.length) {
        currentSlide = index;
        updateSlide();
        showNotification(`📄 Diapositiva ${index + 1}`, "info");
    }
}

function toggleFullscreen() {
    if (!isFullscreen) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
        isFullscreen = true;
        showNotification("🔍 Pantalla completa activada", "success");
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        isFullscreen = false;
        showNotification("🔍 Pantalla completa desactivada", "info");
    }
}

// --- 5. FUNCIÓN AUXILIAR PARA CREAR SLIDES PLACEHOLDER ---
function createPlaceholderSlide(number) {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    
    // Fondo gradiente
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Texto
    ctx.fillStyle = 'white';
    ctx.font = 'bold 120px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Diapositiva ${number}`, canvas.width / 2, canvas.height / 2 - 60);
    
    ctx.font = '48px Inter, sans-serif';
    ctx.fillText('(Imagen no encontrada)', canvas.width / 2, canvas.height / 2 + 60);
    
    return canvas.toDataURL();
}

// --- 6. ESCUCHAR GESTOS Y CONTROLES (CON LÓGICA 'FIST-TO-OPEN') ---
socket.on('control-object', (data) => {
    console.log("🤖 Gesto recibido:", data);

    // --- (NUEVO) ESCUCHAR 'FIST-TO-OPEN' ---
    if (data.type === 'fist_to_open') {
        
        if (data.hand === 'Right') {
            console.log("➡️ Siguiente slide (Mano Derecha Abierta)");
            nextSlide();
        } 
        else if (data.hand === 'Left') {
            console.log("⬅️ Anterior slide (Mano Izquierda Abierta)");
            prevSlide();
        }
    } 
    // --- FIN DEL CAMBIO ---
    
    // (Mantenemos la lógica de 'click')
    else if (data.type === 'click') {
        console.log("👆 Click detectado - siguiente slide");
        nextSlide();
    }
});



// --- 7. CONTROLES DE TECLADO ---
document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowRight':
        case ' ':
            e.preventDefault();
            nextSlide();
            break;
            
        case 'ArrowLeft':
            e.preventDefault();
            prevSlide();
            break;
            
        case 'Home':
            e.preventDefault();
            goToSlide(0);
            break;
            
        case 'End':
            e.preventDefault();
            goToSlide(SLIDES.length - 1);
            break;
            
        case 'f':
        case 'F11':
            e.preventDefault();
            toggleFullscreen();
            break;
            
        case 'Escape':
            if (isFullscreen) {
                e.preventDefault();
                toggleFullscreen();
            }
            break;
    }
});

// --- 8. CONTROLES DE PANTALLA TÁCTIL ---
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});

document.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // Swipe horizontal
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
            prevSlide();
        } else {
            nextSlide();
        }
    }
});

// --- 9. SISTEMA DE NOTIFICACIONES ---
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerText = message;
    
    // Estilos
    notification.style.cssText = `
        position: fixed;
        top: 2rem;
        right: 2rem;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Colores según tipo
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Auto-remover después de 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// --- 10. AUTO-AVANCE (OPCIONAL) ---
function startAutoAdvance(interval = 5000) {
    if (autoAdvanceInterval) {
        clearInterval(autoAdvanceInterval);
    }
    
    autoAdvanceInterval = setInterval(() => {
        if (currentSlide < SLIDES.length - 1) {
            nextSlide();
        } else {
            stopAutoAdvance();
            showNotification("⏹️ Presentación automática finalizada", "info");
        }
    }, interval);
    
    showNotification(`▶️ Presentación automática iniciada (${interval/1000}s)`, "success");
}

function stopAutoAdvance() {
    if (autoAdvanceInterval) {
        clearInterval(autoAdvanceInterval);
        autoAdvanceInterval = null;
    }
}

// --- 11. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    updateSlide(false); // Sin animación inicial
    lockOverlay = document.getElementById('lock-overlay');
    setupSlideSocketListeners();
    // Agregar estilos CSS para animaciones
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        #slide-image {
            transition: all 0.3s ease;
        }
        
        .notification {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
    `;
    document.head.appendChild(style);
    
    // Mostrar ayuda inicial
    setTimeout(() => {
        showNotification("🎮 Usa gestos, flechas del teclado o toca la pantalla", "info");
    }, 1000);
});

// --- 12. MANEJO DE ERRORES GLOBAL ---
window.addEventListener('error', (e) => {
    console.error("❌ Error global:", e.error);
    showNotification("💥 Error en la aplicación", "error");
});

// Manejar cambios de visibilidad (para pausar auto-avance)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAutoAdvance();
    }
});

function setupSlideSocketListeners() {
    // 1. Generar un código de sala único (ej: 5 dígitos)
    const roomCode = Math.floor(10000 + Math.random() * 90000).toString();

    // 2. Mostrar el código en la pantalla
    const roomDisplay = document.getElementById('room-code-display');
    if (roomDisplay) {
        roomDisplay.textContent = `Código de Sala: ${roomCode}`;
    }

    socket.emit('create-room', roomCode);
    console.log(`Creando/Uniéndose a la sala ${roomCode}`);
    

    socket.on('connect', () => {
        console.log("Slides conectadas al servidor:", socket.id);
    });

    // Este es el listener que ya deberías tener
    socket.on('control-object', (data) => {
        if (!data || !data.type) return;

        // Tu lógica actual para cambiar slides
        switch(data.type) {
            
            case 'fist_to_open':
                // Aquí va tu lógica para cambiar de slide
                // (ej: Reveal.next() o Reveal.prev())
                console.log("Gesto de slide recibido!");
                break;
            
            // --- ¡NUEVO CASE! ---
            // Escucha el evento de bloqueo del sistema
            case 'system_lock':
                console.log("Estado de bloqueo recibido:", data.isLocked);
                if (lockOverlay) {
                    // Muestra u oculta el overlay 
                    // usando la clase 'visible' que definimos en el CSS
                    lockOverlay.classList.toggle('visible', data.isLocked);
                }
                break;
            
            // Ignoramos los gestos que no son para las slides
            case 'fist_move':
            case 'open':
            default:
                // No hacer nada
                break;
        }
    });
}