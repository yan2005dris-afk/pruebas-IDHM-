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
        video: { width: 640, height: 480 }
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

    const startTimeMs = performance.now();

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
            
            // --- MÓDULO 1: DIBUJAR LAS MANOS (Visualización local) ---
            for (const landmarks of results.landmarks) {
                drawHand(landmarks); // Llama a nuestra función de dibujo
            }

            // --- MÓDULO 2: PROCESAR GESTO Y COMUNICAR (Socket.io) ---
            // Solo procesamos la primera mano detectada por simplicidad
            const gestureData = processGesture(results.landmarks[0]);
            
            if (gestureData) {
                // Si detectamos un gesto, lo enviamos al servidor
                socket.emit('gesture-data', gestureData);
                // Actualizamos la UI local
                gestureStatus.innerText = `Gesto detectado: ${gestureData.type} (Distancia: ${gestureData.distance.toFixed(2)})`;
            } else {
                gestureStatus.innerText = "Gesto detectado: Ninguno";
            }
        }
        
        canvasCtx.restore();
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
    // Landmark 4: Punta del pulgar
    // Landmark 8: Punta del dedo índice
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    
    // Calcula la distancia 2D (podríamos usar 3D con 'z', pero 2D es más simple)
    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Define un umbral para el "pellizco"
    // Este valor (0.05) tendrás que ajustarlo probando
    const pinchThreshold = 0.05; 

    if (distance < pinchThreshold) {
        // Gesto de "pellizco" detectado
        return {
            type: 'pinch',
            distance: distance,
            // Podrías enviar el punto medio para saber DÓNDE se hace el pellizco
            midpoint: {
                x: (thumbTip.x + indexTip.x) / 2,
                y: (thumbTip.y + indexTip.y) / 2
            }
        };
    }

    // No se detectó ningún gesto
    return null;
}
