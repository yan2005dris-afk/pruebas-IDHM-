// /public/js/camera-main.js

// Importa las clases necesarias desde el bundle de MediaPipe
import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

// --- 1. DEFINICIÓN DE VARIABLES GLOBALES ---

let handLandmarker = undefined;
let runningMode = "VIDEO";
let webcamRunning = false;
let lastVideoTime = -1;

const MAX_FPS = 30;
let lastInferenceTime = 0;
let lastEmitTime = 0;
const EMIT_INTERVAL = 100;
let lastGestureType = 'Ninguno';

// --- ¡NUEVAS VARIABLES PARA GESTOS DE SWIPE POR MANO! ---
// (Reemplazan toda la lógica de 'pinch' y 'gestureState')
let rightHandState = { lastX: -1, cooldown: 0 };
let leftHandState = { lastX: -1, cooldown: 0 };

// Constantes para el nuevo gesto
const SWIPE_THRESHOLD = 0.08; // Umbral de movimiento para detectar swipe
const COOLDOWN_FRAMES = 30; // Frames de cooldown (0.5 seg a 60fps)
const OPEN_PALM_THRESHOLD = 0.1; // Qué tan "abierta" debe estar la mano

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
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: runningMode,
        numHands: 2 // ¡Importante! Asegurarse de que detecte 2 manos
    });

    console.log("HandLandmarker cargado y listo.");
    enableCam();
}
runDemo();

// --- 3. CONFIGURACIÓN DE LA WEBCAM ---

function enableCam() {
    if (webcamRunning) {
        webcamRunning = false;
    }
    const constraints = {
        video: { width: 480, height: 360, frameRate: { ideal: 30, max: 30 } }
    };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
            webcamRunning = true;
            console.log("Webcam iniciada. Empezando predicción.");
            predictWebcam();
        });
    }).catch((err) => {
        console.error("Error al acceder a la webcam: ", err);
        alert("Error al acceder a la webcam. Asegúrate de dar permisos.");
    });
}

// --- 4. BUCLE DE PREDICCIÓN (TOTALMENTE NUEVO) ---

async function predictWebcam() {
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    const now = performance.now();
    const delta = now - lastInferenceTime;

    if (delta < (1000 / MAX_FPS)) {
        window.requestAnimationFrame(predictWebcam);
        return;
    }
    lastInferenceTime = now;

    // Reducir cooldowns
    if (rightHandState.cooldown > 0) rightHandState.cooldown--;
    if (leftHandState.cooldown > 0) leftHandState.cooldown--;

    try {
        if (lastVideoTime !== video.currentTime) {
            lastVideoTime = video.currentTime;
            const results = await handLandmarker.detectForVideo(video, now);

            canvasCtx.save();
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

            let gestureToShow = 'Gesto detectado: Ninguno';

            // Si hay manos detectadas...
            if (results.landmarks && results.landmarks.length > 0) {
                
                // Iterar sobre CADA mano detectada
                for (let i = 0; i < results.landmarks.length; i++) {
                    const landmarks = results.landmarks[i];
                    // Obtener si es 'Left' o 'Right'
                    const hand = results.handedness[i][0].categoryName;
                    
                    // Dibujar la mano
                    drawHand(landmarks);

                    // Procesar el gesto para ESTA mano
                    const gestureData = processHandSwipe(landmarks, hand);
                    
                    if (gestureData) {
                        // Enviar datos (con throttling)
                        if (now - lastEmitTime > EMIT_INTERVAL) {
                            socket.emit('gesture-data', gestureData);
                            lastEmitTime = now;
                        }
                        // Actualizar UI
                        gestureToShow = `Gesto: ${gestureData.hand} ${gestureData.type} ${gestureData.direction}`;
                    }
                }
                
            } else {
                // Si no hay manos, resetear estados
                rightHandState.lastX = -1;
                leftHandState.lastX = -1;
            }

            // Actualizar el texto en la UI (solo si cambia)
            if (gestureToShow !== lastGestureType) {
                lastGestureType = gestureToShow;
                gestureStatus.innerText = gestureToShow;
            }

            canvasCtx.restore();
        }
    } catch (error) {
        console.error("Error durante la predicción:", error);
    }
    
    if (webcamRunning) {
        window.requestAnimationFrame(predictWebcam);
    }
}

// --- 5. FUNCIÓN DE DIBUJO (Sin cambios) ---
function drawHand(landmarks) {
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],       // Pulgar
        [0, 5], [5, 6], [6, 7], [7, 8],       // Índice
        [5, 9], [9, 10], [10, 11], [11, 12],  // Medio
        [9, 13], [13, 14], [14, 15], [15, 16], // Anular
        [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Meñique y Palma
    ];
    canvasCtx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
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
    canvasCtx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    for (const point of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 5, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}

// --- 6. NUEVA FUNCIÓN DE PROCESAMIENTO DE GESTOS ---
// (Reemplaza la antigua 'processGesture')

function processHandSwipe(landmarks, hand) {
    // 1. Verificar si la palma está abierta
    if (!isHandOpen(landmarks)) {
        // Si la mano no está abierta, resetear la posición para el swipe
        if (hand === 'Right') {
            rightHandState.lastX = -1;
        } else {
            leftHandState.lastX = -1;
        }
        return null;
    }

    // 2. Obtener el estado correcto (derecho o izquierdo)
    let state = (hand === 'Right') ? rightHandState : leftHandState;

    // 3. Si estamos en cooldown, no hacer nada
    if (state.cooldown > 0) {
        return null;
    }

    // 4. Lógica de Swipe
    const handX = landmarks[9].x; // Usamos la base de la palma (landmark 9)

    // Si ya teníamos una posición guardada...
    if (state.lastX !== -1) {
        const deltaX = handX - state.lastX;

        // Swipe a la derecha
        if (deltaX > SWIPE_THRESHOLD) {
            state.cooldown = COOLDOWN_FRAMES; // Activar cooldown
            state.lastX = -1; // Resetear posición
            return { type: 'swipe', hand: hand, direction: 'right' };
        }
        // Swipe a la izquierda
        else if (deltaX < -SWIPE_THRESHOLD) {
            state.cooldown = COOLDOWN_FRAMES; // Activar cooldown
            state.lastX = -1; // Resetear posición
            return { type: 'swipe', hand: hand, direction: 'left' };
        }
    }

    // 5. Guardar la posición actual para el próximo frame
    state.lastX = handX;
    return null;
}

// --- 7. NUEVA FUNCIÓN AUXILIAR ---
/**
 * Revisa si la mano está extendida (palma abierta).
 * Compara la distancia Y de las puntas de los dedos con la palma.
 */
function isHandOpen(landmarks) {
    const palm = landmarks[9];      // Base del dedo medio
    const middleTip = landmarks[12]; // Punta del dedo medio
    const pinkyTip = landmarks[20];  // Punta del meñique

    const distMiddle = Math.abs(palm.y - middleTip.y);
    const distPinky = Math.abs(palm.y - pinkyTip.y);
    
    // Si la distancia 'y' es grande, los dedos están extendidos
    return distMiddle > OPEN_PALM_THRESHOLD && distPinky > OPEN_PALM_THRESHOLD;
}