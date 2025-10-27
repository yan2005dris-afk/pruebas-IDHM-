// /public/js/slides-main.js

// --- 1. CONFIGURACIÓN ---
// ¡¡IMPORTANTE!! Lista aquí tus imágenes
const SLIDES = [
    '/slides/1.jpg',
    '/slides/2.jpg',
    '/slides/3.jpg',
    '/slides/4.jpg',
    '/slides/5.jpg',
    '/slides/6.jpg'
    // ... añade todas tus diapositivas
];

// --- 2. VARIABLES GLOBALES Y ELEMENTOS DEL DOM ---
let currentSlide = 0;
const slideImage = document.getElementById('slide-image');
const slideNumberText = document.getElementById('slide-number');

// --- 3. CONEXIÓN AL SERVIDOR DE SOCKET.IO ---
const socket = io();
console.log("Conectando a Socket.io (Diapositivas)...");

socket.on("connect", () => {
    console.log("¡Conectado al servidor con ID:", socket.id);
});

// --- 4. LÓGICA DE DIAPOSITIVAS ---

function updateSlide() {
    // Asegurarse de que el número de slide no se salga del rango
    if (currentSlide < 0) {
        currentSlide = 0;
    }
    if (currentSlide >= SLIDES.length) {
        currentSlide = SLIDES.length - 1;
    }

    // Actualizar la imagen
    slideImage.src = SLIDES[currentSlide];

    // Actualizar el texto
    slideNumberText.innerText = `${currentSlide + 1} / ${SLIDES.length}`;
    console.log(`Mostrando slide ${currentSlide}`);
}

function nextSlide() {
    if (currentSlide < SLIDES.length - 1) {
        currentSlide++;
        updateSlide();
    }
}

function prevSlide() {
    if (currentSlide > 0) {
        currentSlide--;
        updateSlide();
    }
}

// --- 5. MÓDULO DE COMUNICACIÓN (ESCUCHAR GESTOS) ---

socket.on('control-object', (data) => {
    console.log("Gesto recibido:", data);

    // Solo reaccionar a gestos de 'swipe'
    if (data.type === 'swipe') {

        // --- LÓGICA DE TU SOLICITUD ---

        // "si la mano derecha... va a la izquierda o deliza hacia la derecha cambia la diapos"
        if (data.hand === 'Right') {
            if (data.direction === 'right') {
                console.log("Acción: Siguiente slide (Mano Derecha)");
                nextSlide();
            } else if (data.direction === 'left') {
                console.log("Acción: Anterior slide (Mano Derecha)");
                prevSlide();
            }
        }

        // "y si la mano izquierda va para la derecha"
        if (data.hand === 'Left' && data.direction === 'right') {
            console.log("Acción: Siguiente slide (Mano Izquierda)");
            nextSlide();
        }

        // (Nota: Un swipe a la izquierda con la mano izquierda no hará nada)
    }
});

// --- 6. INICIALIZACIÓN ---
// Carga la primera diapositiva al iniciar
updateSlide();

// (Opcional) Añadir control por teclado para probar
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
        nextSlide();
    } else if (e.key === 'ArrowLeft') {
        prevSlide();
    }
});