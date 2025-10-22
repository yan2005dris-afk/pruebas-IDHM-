// /public/js/camera-main.js

// Importa las clases necesarias desde el bundle de MediaPipe
import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

// --- 1. DEFINICIÓN DE VARIABLES GLOBALES ---

let handLandmarker = undefined;
let runningMode = "VIDEO"; // El modo 'VIDEO' es necesario para 'detectForVideo'
let webcamRunning = false;
let lastVideoTime = -1;

const MAX_FPS = 30; // limitar detecciones a 30 fps
let lastInferenceTime = 0;
let lastEmitTime = 0;
const EMIT_INTERVAL = 100; // emitir datos cada 100 ms
let lastGestureType = '';


//variables que reemplazan a las swipe

let gestureState = 'none'; // 'none', 'pinch_start', 'pinch_hoold'
let pinchStartPos = null; // almacena la posición inicial del pinch
let gestureCooldown = 0; // frames de cooldown entre gestos

/*
//nuevas variables globales
let lastHandX = -1; // Para almacenar la última posición X de la mano
let swipeCooldown = 0; // Para evitar múltiples swipes en poco tiempo

const SWIPE_THRESHOLD = 0.08; // Umbral de movimiento para detectar swipe
const SWIPE_COOLDOWN_FRAMES = 30; // Frames de cooldown entre swipes
*/

//nuevas constante de gestos
const PINCH_THRESHOLD = 0.05; // Umbral de distancia para detectar pinch
const MOVE_THRESHOLD = 0.1; // Umbral de movimiento para detectar move
const COOLDOWN_FRAMES = 5; // Frames de cooldown entre swipes
// Elementos del DOM
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureStatus = document.getElementById("gesture-status");

// Conexión al servidor de Socket.io
const socket = io();
console.log("Conectando a Socket.io...");

socket.on("connect", () => {
    console.log("¡Conectado al servidor con ID:", socket.id);
});

// --- 2. FUNCIÓN PRINCIPAL DE INICIALIZACIÓN ---

async function runDemo() {
    // Carga las librerías y modelos de MediaPipe
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    
    // Configura el HandLandmarker
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            // Apunta al modelo de manos de MediaPipe
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU" // Usa GPU para mejor rendimiento
        },
        runningMode: runningMode,
        numHands: 2 // Detectar hasta 2 manos
    });

    console.log("HandLandmarker cargado y listo.");
    
    // Inicia la cámara
    enableCam();
}

runDemo(); // Inicia todo el proceso

// --- 3. CONFIGURACIÓN DE LA WEBCAM ---

function enableCam() {
    if (webcamRunning) {
        webcamRunning = false;
        // (Aquí podrías añadir lógica para apagar la cámara)
    }

    // Restricciones para obtener el video
    const constraints = {
        video: { width: 480, height: 360, frameRate: { ideal: 30, max: 30 } }
    };
    // Pide permiso y accede a la cámara
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        // Cuando el video carga sus datos, empieza el bucle de predicción
        video.addEventListener("loadeddata", () => {
            webcamRunning = true;
            console.log("Webcam iniciada. Empezando predicción.");
            predictWebcam(); // Inicia el bucle
        });
    }).catch((err) => {
        console.error("Error al acceder a la webcam: ", err);
        alert("Error al acceder a la webcam. Asegúrate de dar permisos.");
    });
}

// --- 4. BUCLE DE PREDICCIÓN Y RENDERIZADO ---

async function predictWebcam() {
    // Ajusta el tamaño del canvas al del video (por si acaso)
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    const now = performance.now();

    const delta = now - lastInferenceTime;
    if (delta < (1000 / MAX_FPS)) {
        // Si no ha pasado suficiente tiempo, espera al siguiente frame
        window.requestAnimationFrame(predictWebcam);
        return;
    }
    const startTimeMs = now;    
    lastInferenceTime = now;

    // <-- ¡CORRECCIÓN 1! Reducimos el enfriador en cada frame
    if (gestureCooldown > 0) {
        gestureCooldown--;
    }
    try{
    // Solo detecta si el video se ha actualizado
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        
        // Llama a la función principal de detección de MediaPipe
        const results = await handLandmarker.detectForVideo(video, startTimeMs);

        // Limpia el canvas antes de dibujar
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // Si se detectaron manos...
        if (results.landmarks && results.landmarks.length > 0) {
            
            // --- MÓDULO 1: DIBUJAR ---
            const firstHand = results.landmarks[0];
            drawHand(firstHand);

            // --- MÓDULO 2: PROCESAR GESTO ---
            // Solo procesamos la primera mano detectada
            const gestureData = processGesture(firstHand); 
            
            if (gestureData) {
    // Enviar solo si ha pasado el intervalo mínimo
    if (now - lastEmitTime > EMIT_INTERVAL) {
        socket.emit('gesture-data', gestureData);
        lastEmitTime = now;
    }

        // Actualizar UI solo si cambió el gesto
        if (gestureData.type !== lastGestureType) {
            lastGestureType = gestureData.type;
            let status = `Gesto: ${gestureData.type}`;
            if (gestureData.type === 'pinch_hold') {
                status += ` (Dist: ${gestureData.distance.toFixed(2)})`;
            } else if (gestureData.type === 'pinch_move') {
                status += ` (Dir: ${gestureData.direction})`;
            }
            gestureStatus.innerText = status;
        }
    } else if (lastGestureType !== 'none') {
        lastGestureType = 'none';
        gestureStatus.innerText = "Gesto detectado: Ninguno";
    }
        } else {
            // Si no hay manos, reseteamos la posición del swipe
            gestureState = 'none';
            pinchStartPos = null;
        }
        
        canvasCtx.restore();
    }
    } catch (error) {
        console.error("Error durante la predicción:", error);
    }
    // Vuelve a llamar a esta función en el próximo frame
    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// --- 5. FUNCIÓN DE DIBUJO ---
// (Esta función dibuja los puntos y líneas en el canvas local)

function drawHand(landmarks) {
    // Dibujar los conectores (líneas entre los puntos)
    // Estos son los índices de los puntos que deben conectarse
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],       // Pulgar
        [0, 5], [5, 6], [6, 7], [7, 8],       // Índice
        [5, 9], [9, 10], [10, 11], [11, 12],  // Medio
        [9, 13], [13, 14], [14, 15], [15, 16], // Anular
        [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Meñique y Palma
    ];

    canvasCtx.strokeStyle = 'rgba(0, 255, 0, 0.7)'; // Verde
    canvasCtx.lineWidth = 3;

    for (const conn of connections) {
        const p1 = landmarks[conn[0]];
        const p2 = landmarks[conn[1]];
        if (p1 && p2) {
            canvasCtx.beginPath();
            canvasCtx.moveTo(p1.x * canvasElement.width, p1.y * canvasElement.height);
            canvasCtx.lineTo(p2.x * canvasElement.width, p2.y * canvasElement.height);
            canvasCtx.stroke();
        }
    }

    // Dibujar los landmarks (puntos)
    canvasCtx.fillStyle = 'rgba(255, 0, 0, 0.7)'; // Rojo
    for (const point of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 5, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}

// --- 6. FUNCIÓN DE PROCESAMIENTO DE GESTOS ---
// (Este es el "traductor" de landmarks a acciones simples)

function processGesture(landmarks) {
    
    if(gestureCooldown > 0){
        return null; // Si estamos en cooldown, no procesamos gestos
    }
    
    // Verifica si la mano está apuntando hacia abajo (ignoramos esos casos)
    const wrist_y = landmarks[0].y;
    const middle_tip_y = landmarks[12].y;

    if (middle_tip_y > wrist_y) {
        gestureStatus.innerText = "Estado: Mano apuntando abajo (ignorando)";
        gestureState = 'none'; // Resetea el estado del gesto
        return null; // No proceses ningún gesto
    }
    
    
    // Landmark 4: Punta del pulgar
    // Landmark 8: Punta del dedo índice
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    // Calcula la distancia 2D (podríamos usar 3D con 'z', pero 2D es más simple)
    const distance = distance2D(thumbTip, indexTip);
    const midPoint = midpoint2D(thumbTip, indexTip);
    
    const pinchThreshold = 0.05;

    const handX = landmarks[9].x;
    // Define un umbral para el "pellizco"
    // Este valor (0.05) tendrás que ajustarlo probando
 
    
    if (distance < pinchThreshold) {
        if (gestureState === 'none' ){
            gestureState = 'pinch_start';
            pinchStartPos = midPoint;
            return null;
        }
    else if (gestureState === 'pinch_start' || gestureState === 'pinch_hold'){
        gestureState = 'pinch_hold';

        const deltaX = midPoint.x - pinchStartPos.x;
        
        if(deltaX > MOVE_THRESHOLD){
            gestureState = 'none';
            gestureCooldown = COOLDOWN_FRAMES;
            return { type: 'pinch_move', direction: 'right'};
        }
        else if(deltaX < -MOVE_THRESHOLD){
            gestureState = 'none';
            gestureCooldown = COOLDOWN_FRAMES;
            return { type: 'pinch_move', direction: 'left'};
        }
        return {
            type: 'pinch_hold',
            distance: distance,
            midpoint: midPoint
        };
    }

    }
    else {
        if(gestureState === 'pinch_start' || gestureState === 'pinch_hold'){
            gestureState = 'none';
            pinchStartPos = null;
        }
        gestureState = 'none';
        return null;
    }
    // No se detectó ningún gesto
    return null;


// --- Funciones auxiliares ---
function distance2D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
}

function midpoint2D(p1, p2) {
    return { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
}


}

