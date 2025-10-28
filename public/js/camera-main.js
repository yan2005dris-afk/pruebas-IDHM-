console.log("🚀 Inicializando MediaPipe HandLandmarker...");

// --- VARIABLES GLOBALES ---
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");

// Comprobación segura para canvasElement
let canvasCtx = null;
if (canvasElement) {
    canvasCtx = canvasElement.getContext("2d");
} else {
    console.error("❌ Error: No se encontró el elemento canvas con id 'output_canvas'");
}

const gestureStatus = document.getElementById("gesture-status");
const connectionStatus = document.getElementById("connection-status");

let handLandmarker = null;
let webcamRunning = false;
let lastGestureData = null;
let lastGestureType = "Ninguno";
let lastVideoTime = -1;
let socket = null;
let drawingUtils = null;

let isLocked = false;
let lockCooldown = 0;
const LOCK_COOLDOWN_FRAMES = 10;
let currentTarget = 'lienzo';

let targetLienzoButton;
let targetSlidesButton;

let rightHandState = { lastX: -1, lastY: -1, cooldown: 0 };
let leftHandState = { lastX: -1, lastY: -1, cooldown: 0 };
const SWIPE_THRESHOLD = 0.07;
const COOLDOWN_FRAMES = 5;

// --- CARGAR DESDE OBJETO GLOBAL ---
// Comprobación segura de que las librerías existen
if (!window.HandLandmarker || !window.FilesetResolver || !window.DrawingUtils) {
    console.error("❌ Error: Librería MediaPipe Tasks Vision no cargada. ¿Falta el <script> en el HTML?");
    alert("Error: Librería MediaPipe no cargada. Revisa la consola.");
    // Detener ejecución si faltan librerías
    throw new Error("MediaPipe library not loaded.");
}
const { HandLandmarker, FilesetResolver, DrawingUtils } = window;

// --- CONFIGURAR SOCKET.IO ---
if (typeof io !== 'undefined') {
    socket = io();
    socket.on("connect", () => {
        console.log(`✅ Conectado al servidor con ID: ${socket.id}`);
        if (connectionStatus) connectionStatus.innerText = `🟢 Conectado`;
    });
    socket.on("disconnect", () => {
        console.log("❌ Desconectado del servidor");
        if (connectionStatus) connectionStatus.innerText = "🔴 Desconectado";
    });
} else {
    console.error("❌ Error: Librería Socket.IO no cargada.");
    alert("Error: Librería Socket.IO no cargada. Revisa la consola.");
    throw new Error("Socket.IO library not loaded.");
}

// --- LÓGICA PARA CAMBIAR DESTINO ---
function setTarget(target) {
    console.log(`🖱️ setTarget llamado con: ${target}`);
    currentTarget = target;
    console.log(`🎯 Nuevo destino AHORA es: ${currentTarget}`);
    if (targetLienzoButton && targetSlidesButton) {
        targetLienzoButton.classList.toggle('active', target === 'lienzo');
        targetSlidesButton.classList.toggle('active', target === 'slides');
    }
}

// --- CONFIGURAR BOTONES ---
function setupTargetButtons() {
    console.log("🛠️ Configurando botones...");
    targetLienzoButton = document.getElementById('target-lienzo');
    targetSlidesButton = document.getElementById('target-slides');
    if (targetLienzoButton) {
        targetLienzoButton.addEventListener('click', () => {
            console.log("🖱️ Click en Botón Lienzo");
            setTarget('lienzo');
        });
        console.log(" L- Listener añadido a Lienzo");
    } else {
        console.warn(" Botón Lienzo no encontrado");
    }
    if (targetSlidesButton) {
        targetSlidesButton.addEventListener('click', () => {
            console.log("🖱️ Click en Botón Slides");
            setTarget('slides');
        });
        console.log(" S- Listener añadido a Slides");
    } else {
        console.warn(" Botón Slides no encontrado");
    }
    setTarget(currentTarget); // Estado inicial
}

// --- INICIALIZAR MODELO ---
async function runDemo() {
    // Salir si canvasCtx no se pudo obtener
    if (!canvasCtx) {
        alert("Error crítico: No se pudo obtener el contexto del canvas.");
        return;
    }

    console.log("🚀 Inicializando MediaPipe HandLandmarker...");
    try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                // ✅ ¡USA EL MODELO V2 COMPATIBLE!
                modelAssetPath:
                // "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/latest/hand_landmarker.task",
                // ❌ Comenta o borra el modelo v1
                // modelAssetPath:
                  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.6,
            minHandPresenceConfidence: 0.6,
            minTrackingConfidence: 0.6,
        });

        drawingUtils = new DrawingUtils(canvasCtx);
        console.log("✅ HandLandmarker cargado exitosamente");
        enableCam();
    } catch (error) {
        console.error("❌ Error al inicializar MediaPipe:", error);
        alert("Error al cargar el modelo. Revisa la consola y recarga.");
    }
}

// --- ACTIVAR CÁMARA ---
async function enableCam() {
    if (webcamRunning || !video) return;

    const constraints = { video: { width: 640, height: 480 } };
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        video.addEventListener("loadeddata", () => {
            webcamRunning = true;
            if (canvasElement && video) {
                canvasElement.width = video.videoWidth;
                canvasElement.height = video.videoHeight;
            }
            console.log("📷 Webcam iniciada. Empezando predicción...");
            predictWebcam();
        });
    } catch (err) {
        console.error("❌ Error al acceder a la webcam:", err);
        alert("Error al acceder a la webcam. ¿Diste permisos?");
    }
}

// --- DETECCIÓN CONTINUA ---
let lastProcessedTime = 0;
const FRAME_INTERVAL = 1000 / 20; // Procesar ~20 FPS

async function predictWebcam() {
    if (!handLandmarker || !webcamRunning || !video || video.readyState < 2) {
        if (webcamRunning) requestAnimationFrame(predictWebcam);
        return
    };

    const now = performance.now();
    if (now - lastProcessedTime < FRAME_INTERVAL) {
        requestAnimationFrame(predictWebcam);
        return;
    }
    lastProcessedTime = now;

    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        try {
            const results = handLandmarker.detectForVideo(video, now);
            if (results && drawingUtils) {
                drawResults(results);
                processGestures(results); // Llamada única aquí
            }
        } catch(error) {
            console.error("Error en detectForVideo:", error);
        }
    }

    if (webcamRunning) {
        requestAnimationFrame(predictWebcam);
    }
}

// --- DIBUJAR RESULTADOS ---
function drawResults(results) {
    if (!canvasCtx || !drawingUtils) return;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.landmarks) {
        for (let i = 0; i < results.landmarks.length; i++) {
            const landmarks = results.landmarks[i];
            if (results.handedness && results.handedness[i] && results.handedness[i][0]) {
                const hand = results.handedness[i][0].categoryName;
                const color = hand === 'Right' ? '#00FF00' : '#FF00FF';
                drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: color, lineWidth: 3 });
                drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', radius: 4 });
            } else {
                drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, { color: '#CCCCCC', lineWidth: 3 });
                drawingUtils.drawLandmarks(landmarks, { color: '#FF0000', radius: 4 });
            }
        }
    }
    canvasCtx.restore();
}

// --- PROCESAR GESTOS ---
function processGestures(results) {
    // ❌ QUITAR EL BLOQUE if (document.readyState...) DE AQUÍ

    if (!socket) return;

    let detectedGestureData = null;
    let currentGestureText = "🙌 No se detectan manos...";
    let fistCount = 0;

    if (rightHandState.cooldown > 0) rightHandState.cooldown--;
    if (leftHandState.cooldown > 0) leftHandState.cooldown--;
    if (lockCooldown > 0) lockCooldown--;

    if (results && results.landmarks && results.landmarks.length > 0) {
        currentGestureText = "🖐️ Mano detectada";

        for (let i = 0; i < results.landmarks.length; i++) {
            if (results.handedness && results.handedness[i] && results.handedness[i][0]) {
                const landmarks = results.landmarks[i];
                const handState = detectFistOrOpen(landmarks);
                if (handState === 'fist') {
                    fistCount++;
                }
            }
        }

        if (fistCount === 2 && lockCooldown === 0) {
            isLocked = !isLocked;
            lockCooldown = LOCK_COOLDOWN_FRAMES;
            currentGestureText = isLocked ? "🔒 Bloqueado" : "🔓 Desbloqueado";
            console.log(`Sistema ${currentGestureText}`);
            if (gestureStatus && currentGestureText !== lastGestureType) {
                gestureStatus.innerText = currentGestureText;
                lastGestureType = currentGestureText;
            }
            lastGestureData = null;
            return;
        }

        if (isLocked) {
            currentGestureText = "🔒 Bloqueado";
            detectedGestureData = null;
        } else if (lockCooldown === 0) {
            for (let i = 0; i < results.landmarks.length; i++) {
                if (results.handedness && results.handedness[i] && results.handedness[i][0]) {
                    const landmarks = results.landmarks[i];
                    const hand = results.handedness[i][0].categoryName;

                    if (currentTarget === 'slides') {
                        const swipeGesture = detectSwipe(landmarks, hand);
                        if (swipeGesture) {
                            detectedGestureData = swipeGesture;
                            currentGestureText = `👉 ${hand} ${swipeGesture.direction} (a Slides)`;
                            break;
                        }
                    } else if (currentTarget === 'lienzo') {
                        const handState = detectFistOrOpen(landmarks);
                        if (handState === 'fist') {
                            if (!detectedGestureData) {
                                detectedGestureData = { type: 'fist', hand: hand };
                                currentGestureText = `👊 ${hand} Puño (a Lienzo)`;
                            }
                        }
                    }
                }
            }
            if (!detectedGestureData && currentTarget === 'lienzo') {
                detectedGestureData = { type: 'open' };
            }
        } else {
            currentGestureText = isLocked ? "🔒 Bloqueado" : "🔓 Desbloqueado";
            detectedGestureData = null;
        }
    } else {
        if (isLocked) {
            currentGestureText = "🔒 Bloqueado (sin manos)";
        } else if (currentTarget === 'lienzo') {
            detectedGestureData = { type: 'open' };
        }
    }

    const dataChanged = JSON.stringify(detectedGestureData) !== JSON.stringify(lastGestureData);

    if (!isLocked && detectedGestureData && dataChanged) {
        let eventName = '';
        if (currentTarget === 'slides' && detectedGestureData.type === 'swipe') {
            eventName = 'gesture-data';
        } else if (currentTarget === 'lienzo' && (detectedGestureData.type === 'fist' || detectedGestureData.type === 'open')) {
            eventName = 'hand-state';
        }
        if (eventName) {
            console.log(`📡 Enviando [${eventName}] a ${currentTarget}:`, detectedGestureData);
            socket.emit(eventName, detectedGestureData);
            lastGestureData = { ...detectedGestureData };
        } else {
            if (dataChanged) lastGestureData = null;
        }
    } else if (!isLocked && !detectedGestureData && lastGestureData !== null && currentTarget === 'lienzo') {
        if (lastGestureData.type !== 'open') {
            console.log(`📡 Enviando [hand-state] a ${currentTarget}: { type: 'open' } (implícito)`);
            socket.emit('hand-state', { type: 'open' });
        }
        lastGestureData = { type: 'open' };
    } else if (!isLocked && !(results && results.landmarks && results.landmarks.length > 0) && currentTarget === 'lienzo' && lastGestureData?.type !== 'open') {
        console.log(`📡 Enviando [hand-state] a ${currentTarget}: { type: 'open' } (sin manos)`);
        socket.emit('hand-state', { type: 'open' });
        lastGestureData = { type: 'open' };
    } else if (isLocked && lastGestureData !== null) {
        lastGestureData = null;
    }

    if (gestureStatus && currentGestureText !== lastGestureType) {
        gestureStatus.innerText = currentGestureText;
        lastGestureType = currentGestureText;
    }
}

// --- FUNCIÓN DETECTAR SWIPE ---
function detectSwipe(landmarks, hand) {
    let state = (hand === 'Right') ? rightHandState : leftHandState;
    if (!state) return null;
    if (state.cooldown > 0) return null;
    const handX = landmarks[9]?.x;
    if (handX === undefined) return null;
    let gesture = null;
    if (state.lastX !== -1) {
        const deltaX = handX - state.lastX;
        if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
            gesture = { type: 'swipe', hand: hand, direction: deltaX > 0 ? 'right' : 'left' };
            state.cooldown = COOLDOWN_FRAMES;
            state.lastX = -1; state.lastY = -1;
        }
    }
    if (!gesture) { state.lastX = handX; }
    return gesture;
}

// --- FUNCIÓN DETECTAR PUÑO O MANO ABIERTA ---
function detectFistOrOpen(landmarks) {
    const tipIndex = landmarks[8]?.y;
    const knuckleIndex = landmarks[6]?.y;
    const tipMiddle = landmarks[12]?.y;
    const knuckleMiddle = landmarks[10]?.y;
    if ([tipIndex, knuckleIndex, tipMiddle, knuckleMiddle].some(val => val === undefined)) { return 'open'; }
    if (tipIndex > knuckleIndex && tipMiddle > knuckleMiddle) { return 'fist'; }
    return 'open';
}

// --- ❌ BORRAR FUNCIÓN ANTIGUA ---
// function detectSimpleGesture(landmarks) { ... }


// --- ✅ EJECUTAR TODO AL FINAL y SOLO UNA VEZ ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log("DOM Cargado. Ejecutando runDemo y setupTargetButtons.");
        runDemo();
        setupTargetButtons();
    });
} else {
    console.log("DOM ya estaba listo. Ejecutando runDemo y setupTargetButtons.");
    runDemo();
    setupTargetButtons();
}