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

// Variables para gestos mejorados
let rightHandState = { lastX: -1, lastY: -1, cooldown: 0, gestureHistory: [] };
let leftHandState = { lastX: -1, lastY: -1, cooldown: 0, gestureHistory: [] };

// Constantes para detección de gestos
const SWIPE_THRESHOLD = 0.08;
const SWIPE_VERTICAL_THRESHOLD = 0.06;
const COOLDOWN_FRAMES = 30;
const OPEN_PALM_THRESHOLD = 0.1;
const PINCH_THRESHOLD = 0.05;

// Elementos del DOM


let video;
let canvasElement;
let canvasCtx;
let gestureStatus;
let connectionStatus;
/*
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureStatus = document.getElementById("gesture-status");
const connectionStatus = document.getElementById("connection-status");
*/
// Conexión al servidor de Socket.io
const socket = io();
console.log("🔄 Conectando a Socket.io...");
/*
socket.on("connect", () => {
    console.log("✅ Conectado al servidor con ID:", socket.id);
    connectionStatus.innerHTML = "🟢 Conectado";
    connectionStatus.className = "status connected";
});

socket.on("disconnect", () => {
    console.log("❌ Desconectado del servidor");
    connectionStatus.innerHTML = "🔴 Desconectado";
    connectionStatus.className = "status disconnected";
});
*/
// --- 2. FUNCIÓN PRINCIPAL DE INICIALIZACIÓN ---

async function runDemo() {
    // ✅ ¡ASIGNA LOS ELEMENTOS DEL DOM AQUÍ!
    // Ahora es seguro porque el DOM está cargado.
    video = document.getElementById("webcam");
    canvasElement = document.getElementById("output_canvas");
    canvasCtx = canvasElement.getContext("2d");
    gestureStatus = document.getElementById("gesture-status");
    connectionStatus = document.getElementById("connection-status");

    // ✅ ¡MUEVE TUS LISTENERS DE SOCKET AQUÍ!
    // Ahora, 'connectionStatus' SÍ existe.
    socket.on("connect", () => {
        console.log("✅ Conectado al servidor con ID:", socket.id);
        connectionStatus.innerHTML = "🟢 Conectado"; // <-- Esto funcionará
        connectionStatus.className = "status connected";
    });

    socket.on("disconnect", () => {
        console.log("❌ Desconectado del servidor");
        connectionStatus.innerHTML = "🔴 Desconectado"; // <-- Esto también
        connectionStatus.className = "status disconnected";
    });
    
    try {
        console.log("🚀 Inicializando MediaPipe HandLandmarker...");
        
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                //modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                //modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/latest/hand_landmarker.task`,
                modelAssetPath: `/models/hand_landmarker_lite.task`,
                //modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/latest/hand_landmarker.task`,
                //modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/latest/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2,
            enableHandClassification: true
        });

        console.log("✅ HandLandmarker cargado exitosamente");
        enableCam();
    } catch (error) {
        console.error("❌ Error al inicializar MediaPipe:", error);
        alert("Error al cargar el modelo de detección de manos. Por favor, recarga la página.");
    }
}

// --- 3. CONFIGURACIÓN DE LA WEBCAM ---

function enableCam() {
    if (webcamRunning) {
        webcamRunning = false;
        return;
    }
    
    const constraints = {
        video: { 
            width: 640, 
            height: 480, 
            frameRate: { ideal: 30, max: 30 } 
        }
    };
    
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", async () => {
            webcamRunning = true;
            console.log("📷 Webcam iniciada. Empezando predicción...");
            /*
            if (handLandmarker) {
                await handLandmarker.setOptions({ runningMode: "VIDEO" });
                console.log("🔁 Modelo configurado en modo VIDEO");
            }
            */
            predictWebcam();
        });
    }).catch((err) => {
        console.error("❌ Error al acceder a la webcam:", err);
        alert("Error al acceder a la webcam. Asegúrate de dar permisos de cámara.");
    });
}

// --- 4. BUCLE DE PREDICCIÓN MEJORADO ---

async function predictWebcam() {
    if (!webcamRunning) return;
    
    canvasElement.width = video.videoWidth;
    canvasElement.height = video.videoHeight;

    const now = performance.now();
    const delta = now - lastInferenceTime;

    // Control de FPS
    if (delta < (1000 / MAX_FPS)) {
        requestAnimationFrame(predictWebcam);
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

            let gestureToShow = 'Esperando gestos...';

            // Si hay manos detectadas...
            if (results && results.landmarks && results.landmarks.length > 0) {
                
                // Iterar sobre CADA mano detectada
                for (let i = 0; i < results.landmarks.length; i++) {
                    if (results.handedness && results.handedness[i] && results.handedness[i][0]) {
              
                  const landmarks = results.landmarks[i];
                  // ✅ Esta línea (la 187) ahora es segura
                  const hand = results.handedness[i][0].categoryName;
                    
                    // Dibujar la mano
                    drawHand(landmarks, hand);

                    // Procesar múltiples tipos de gestos
                    const gestureData = processAdvancedGestures(landmarks, hand);
                    
                    if (gestureData) {
                        // Enviar datos con throttling
                        if (now - lastEmitTime > EMIT_INTERVAL) {
                            socket.emit('gesture-data', gestureData);
                            lastEmitTime = now;
                        }
                        
                        // Actualizar UI
                        gestureToShow = `🤖 ${gestureData.hand}: ${gestureData.type} ${gestureData.direction || ''}`;
                        
                        // Añadir efecto visual
                        addGestureEffect(gestureData);
                    }
                }
                }
                
            } else {
                // Si no hay manos, resetear estados
                rightHandState.lastX = -1;
                leftHandState.lastX = -1;
            }

            // Actualizar el texto en la UI
            if (gestureToShow !== lastGestureType) {
                lastGestureType = gestureToShow;
                gestureStatus.innerText = gestureToShow;
            }

            canvasCtx.restore();
        }
    } catch (error) {
        console.error("❌ Error durante la predicción:", error);
    }
    
    if (webcamRunning) {
        requestAnimationFrame(predictWebcam);
    }
}

// --- 5. FUNCIÓN DE DIBUJO MEJORADA ---
function drawHand(landmarks, handType) {
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],       // Pulgar
        [0, 5], [5, 6], [6, 7], [7, 8],       // Índice
        [5, 9], [9, 10], [10, 11], [11, 12],  // Medio
        [9, 13], [13, 14], [14, 15], [15, 16], // Anular
        [13, 17], [0, 17], [17, 18], [18, 19], [19, 20] // Meñique y Palma
    ];
    
    // Color diferente para cada mano
    const color = handType === 'Right' ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 255, 0.8)';
    
    canvasCtx.strokeStyle = color;
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
    
    canvasCtx.fillStyle = color;
    for (const point of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(point.x * canvasElement.width, point.y * canvasElement.height, 4, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}

// --- 6. FUNCIÓN DE PROCESAMIENTO DE GESTOS AVANZADA ---
function processAdvancedGestures(landmarks, hand) {
    let state = (hand === 'Right') ? rightHandState : leftHandState;
    
    // Si estamos en cooldown, no hacer nada
    if (state.cooldown > 0) {
        return null;
    }
    
    const handX = landmarks[9].x;
    const handY = landmarks[9].y;
    
    // Detectar diferentes tipos de gestos
    let gesture = null;
    
    // 1. Swipe horizontal
    if (state.lastX !== -1) {
        const deltaX = handX - state.lastX;
        
        if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
            if (deltaX > 0) {
                gesture = { type: 'swipe', hand: hand, direction: 'right' };
            } else {
                gesture = { type: 'swipe', hand: hand, direction: 'left' };
            }
            state.cooldown = COOLDOWN_FRAMES;
        }
    }
    
    // 2. Swipe vertical (si no hay swipe horizontal)
    if (!gesture && state.lastY !== -1) {
        const deltaY = handY - state.lastY;
        
        if (Math.abs(deltaY) > SWIPE_VERTICAL_THRESHOLD) {
            if (deltaY > 0) {
                gesture = { type: 'swipe', hand: hand, direction: 'down' };
            } else {
                gesture = { type: 'swipe', hand: hand, direction: 'up' };
            }
            state.cooldown = COOLDOWN_FRAMES;
        }
    }
    
    // 3. Pinch/Click (distancia entre pulgar e índice)
    if (!gesture) {
        const thumb = landmarks[4];
        const index = landmarks[8];
        const distance = Math.sqrt(
            Math.pow(thumb.x - index.x, 2) + Math.pow(thumb.y - index.y, 2)
        );
        
        if (distance < PINCH_THRESHOLD) {
            gesture = { type: 'click', hand: hand };
            state.cooldown = COOLDOWN_FRAMES * 2; // Cooldown más largo para clicks
        }
    }
    
    // Actualizar posiciones
    state.lastX = handX;
    state.lastY = handY;
    
    return gesture;
}

// --- 7. FUNCIÓN AUXILIAR PARA EFECTOS VISUALES ---
function addGestureEffect(gestureData) {
    // Crear un efecto visual temporal
    const effect = document.createElement('div');
    effect.className = 'gesture-effect';
    effect.innerText = gestureData.type === 'swipe' ? 
        `👉 ${gestureData.direction}` : 
        '👆 click';
    
    effect.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 2rem;
        pointer-events: none;
        animation: fadeOut 1s ease-out forwards;
        z-index: 1000;
    `;
    
    document.body.appendChild(effect);
    
    setTimeout(() => {
        document.body.removeChild(effect);
    }, 1000);
}

// --- 8. INICIALIZACIÓN ---
// Agregar estilos CSS para efectos
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
    }
`;
document.head.appendChild(style);

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runDemo);
} else {
    runDemo();
}



/*
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
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest"
    );
    
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "IMAGE",
        numHands: 2, // ¡Importante! Asegurarse de que detecte 2 manos

        enableHandClassification: true
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
        video.addEventListener("loadeddata",async () => {

            webcamRunning = true;
            console.log("Webcam iniciada. Empezando predicción.");
            if (handLandmarker) {
            await handLandmarker.setOptions({ runningMode: "VIDEO" }); // 👈 Aquí el cambio
            console.log("🔁 Modelo configurado en modo VIDEO.");
    }

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
            // ✅ Verificar que haya manos detectadas
            if (
                !results ||
                !results.handedness ||
                results.handedness.length === 0 ||
                !results.handedness[0]
            ) {
                // No se detectaron manos: salir sin error
                return;
            }
            const handedness = results.handedness[0][0].categoryName;
            const landmarks = results.landmarks[0];

            // ...tu lógica de envío de gestos
            

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
    const isOpen = isHandOpen(landmarks); // 
    console.log('Mano:', hand, 'Abierta:', isOpen);

    // 1. Verificar si la palma está abierta
    //if (!isHandOpen(landmarks)) {
    if(!isOpen){    
    
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


function isHandOpen(landmarks) {
    const palm = landmarks[9];      // Base del dedo medio
    const middleTip = landmarks[12]; // Punta del dedo medio
    const pinkyTip = landmarks[20];  // Punta del meñique

    const distMiddle = Math.abs(palm.y - middleTip.y);
    const distPinky = Math.abs(palm.y - pinkyTip.y);
    
    // Si la distancia 'y' es grande, los dedos están extendidos
    return distMiddle > OPEN_PALM_THRESHOLD && distPinky > OPEN_PALM_THRESHOLD;
}
*/
