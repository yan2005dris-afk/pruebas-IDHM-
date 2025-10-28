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
const LOCK_COOLDOWN_FRAMES = 40;

let fistHoldCounter = 0; // Contador de frames que llevamos con 2 puños
const LOCK_HOLD_FRAMES_REQUIRED = 15; // 3 segundos (60 frames @ 20fps)

let currentTarget = 'lienzo';

let targetLienzoButton;
let targetSlidesButton;

let rightHandState = { lastX: -1, lastY: -1, cooldown: 0, fistLastX: -1, lastState: 'open' };
let leftHandState = { lastX: -1, lastY: -1, cooldown: 0, fistLastX: -1, lastState: 'open' };
const SWIPE_THRESHOLD = 0.07;
const COOLDOWN_FRAMES = 5;
const FIST_MOVE_THRESHOLD = 0.01; // Sensibilidad mínima para detectar movimiento del puño


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
            minHandDetectionConfidence: 0.7,
            minHandPresenceConfidence: 0.7,
            minTrackingConfidence: 0.7,
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
    if (!socket) return;

    let detectedGestureData = null;
    let currentGestureText = "🙌 No se detectan manos...";
    let fistCount = 0;

    // --- 1. REDUCIR COOLDOWNS ---
    rightHandState.cooldown = Math.max(0, rightHandState.cooldown - 1);
    leftHandState.cooldown = Math.max(0, leftHandState.cooldown - 1);
    lockCooldown = Math.max(0, lockCooldown - 1);

    const handsDetected = results?.landmarks?.length > 0;

    // --- 2. PROCESAR SI HAY MANOS ---
    if (handsDetected) {
        currentGestureText = "🖐️ Mano detectada";

        // --- 3. CONTAR PUÑOS ---
        // (Tu lógica de FIST_CONFIDENCE_THRESHOLD es buena, pero no estaba en este código)
        for (const landmarks of results.landmarks) {
            if (detectFistOrOpen(landmarks) === 'fist') fistCount++;
        }

        // --- 4. GESTO DE BLOQUEO (DOBLE PUÑO) ---
        if (fistCount === 2 && lockCooldown === 0) {
            // Si tenemos 2 puños, empezamos a contar
            fistHoldCounter++;

            // Calcular el progreso para mostrarlo en pantalla
            let chargePercent = Math.round((fistHoldCounter / LOCK_HOLD_FRAMES_REQUIRED) * 100);
            currentGestureText = `⏳ Bloqueando (${chargePercent}%)`;

            // ¿Llegamos al tiempo requerido?
            if (fistHoldCounter >= LOCK_HOLD_FRAMES_REQUIRED) {
                isLocked = !isLocked;
                lockCooldown = LOCK_COOLDOWN_FRAMES; // Activar el cooldown de 2 seg
                currentGestureText = isLocked ? "🔒 Bloqueado" : "🔓 Desbloqueado";
                console.log(`Sistema ${currentGestureText} (¡3 seg. completados!)`);

                // Resetear todo para el próximo gesto
                fistHoldCounter = 0;
                resetHandStates(); 
                lastGestureData = null;
                if (gestureStatus) gestureStatus.innerText = currentGestureText;
                lastGestureType = currentGestureText;
                return; // Salir del procesamiento de este frame
            }

        } else {
            // Si el gesto se rompe (menos de 2 puños), reiniciamos el contador
            fistHoldCounter = 0;
        }
        // --- 5. SI ESTÁ BLOQUEADO ---
        if (isLocked) {
            currentGestureText = "🔒 Bloqueado";
            resetHandStates();
        } 

        // --- 6. PROCESAR GESTOS SI NO ESTÁ BLOQUEADO ---
        else {
            for (let i = 0; i < results.landmarks.length; i++) {
                const landmarks = results.landmarks[i];
                const handInfo = results.handedness[i]?.[0];
                if (!handInfo) continue;

                const hand = handInfo.categoryName;
                const handStateRef = (hand === 'Right') ? rightHandState : leftHandState;
                
                // --- CAMBIO: Obtener estado actual y anterior ---
                const currentState = detectFistOrOpen(landmarks);
                const lastState = handStateRef.lastState;

                if (currentState === 'fist') {
                    // --- LÓGICA LIENZO (INTACTA) ---
                    if (currentTarget === 'lienzo') {
                        const currentFistX = landmarks[9].x; 
                        const lastX = handStateRef.fistLastX;
                        if (lastX !== -1) {
                            const deltaX = currentFistX - lastX;
                            if (Math.abs(deltaX) > FIST_MOVE_THRESHOLD) {
                                console.log(`✊ ${hand} DeltaX: ${deltaX.toFixed(4)}`);
                                detectedGestureData = { type: 'fist_move', hand, deltaX };
                                currentGestureText = `✊ Moviendo ${hand} (${deltaX > 0 ? '→' : '←'})`;
                            }
                        }
                        handStateRef.fistLastX = currentFistX;
                    } else {
                        handStateRef.fistLastX = -1; // Reset si no es lienzo
                    }
                } 
                else { 
                    // --- Mano abierta (currentState === 'open') ---
                    if (handStateRef.fistLastX !== -1) handStateRef.fistLastX = -1;

                    // --- CAMBIO: LÓGICA 'FIST-TO-OPEN' (para slides) ---
                    if (currentTarget === 'slides' && !detectedGestureData) {
                        // Si el estado anterior era 'fist' y el actual es 'open'
                        if (lastState === 'fist') {
                            detectedGestureData = { type: 'fist_to_open', hand: hand };
                            currentGestureText = `✋ ¡${hand} Abierta! (Slides)`;
                            
                            // --- ¡LA SOLUCIÓN! ---
                            // Actualiza el estado ANTES de salir del bucle
                            handStateRef.lastState = currentState; 
                            break; 
                        }
                    }
                    // --- FIN DEL CAMBIO ---
                }

                // --- CAMBIO: Actualizar el estado de la mano para el próximo frame ---
                handStateRef.lastState = currentState;

                // (Se eliminó la lógica de 'detectSwipe' de aquí)
            }

            // --- Si no hay gesto, enviar 'open' (para lienzo) ---
            if (!detectedGestureData && currentTarget === 'lienzo') {
                detectedGestureData = { type: 'open' };
                resetFistPositions();
            }
        }

    } 
    // --- 7. SIN MANOS DETECTADAS ---
    else {
        if (isLocked) {
            currentGestureText = "🔒 Bloqueado (sin manos)";
        }
        resetHandStates();
    }

    // --- 8. ENVÍO DE DATOS (MODIFICADO) --- 
    const dataChanged = JSON.stringify(detectedGestureData) !== JSON.stringify(lastGestureData);

    if (!isLocked && detectedGestureData ) {
        // --- CAMBIO: Actualizado para 'fist_to_open' ---
        const isSlideGesture = currentTarget === 'slides' && detectedGestureData.type === 'fist_to_open';
        const isLienzoGesture = currentTarget === 'lienzo' && ['fist_move', 'open'].includes(detectedGestureData.type);
        // --- FIN DEL CAMBIO ---

        if (isSlideGesture || isLienzoGesture) {
            console.log(`📡 Enviando [gesture-data] a ${currentTarget}:`, detectedGestureData);
            socket.emit('gesture-data', detectedGestureData);
            lastGestureData = { ...detectedGestureData };
        }
    }
    // Enviar 'open' implícito si antes había otro gesto
    else if (!isLocked && !detectedGestureData && lastGestureData?.type !== 'open' && currentTarget === 'lienzo') {
        const openData = { type: 'open' };
        console.log(`📡 Enviando [gesture-data] a ${currentTarget}: { type: 'open' }`);
        socket.emit('gesture-data', openData);
        lastGestureData = openData;
    }
    // Reset si bloqueado
    else if (isLocked && lastGestureData) {
        lastGestureData = null;
    }

    // --- 9. ACTUALIZAR UI ---
    if (gestureStatus && currentGestureText !== lastGestureType) {
        gestureStatus.innerText = currentGestureText;
        lastGestureType = currentGestureText;
    }

    // --- Funciones internas auxiliares (sin cambios) ---
    function resetFistPositions() {
        rightHandState.fistLastX = -1;
        leftHandState.fistLastX = -1;
    }

    function resetHandStates() {
        resetFistPositions();
        rightHandState.lastX = -1;
        leftHandState.lastX = -1;
        // --- CAMBIO: Resetear también lastState ---
        rightHandState.lastState = 'open';
        leftHandState.lastState = 'open';
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