// /public/js/ar-main.js

// --- 1. IMPORTACIONES ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  HandLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

// --- 2. VARIABLES GLOBALES ---

// MediaPipe
let handLandmarker = undefined;
let webcamRunning = false;
let lastVideoTime = -1;

// Three.js
let scene, camera, renderer;
let model; // El .glb que se mostrará
const video = document.getElementById("webcam");
const canvas = document.getElementById("ar-canvas");

//nuevas variables para el cambio de camara
let videoDevices = []; //lista de camaras disponibles
let currentDeviceIndex = 0; //indice de la camara actual
let currentStream;


// --- 3. FUNCIÓN DE INICIO ---
async function main() {
    await setupMediaPipe();
    setupThreeJS();
    await loadModel();
    
    await getCameraDevices(); // Obtener lista de cámaras
    setupEventListeners(); // Configurar eventos de UI
    startCamera(); // Iniciar la cámara por primera vez

}
main();

// --- 4. MÓDULO DE MEDIAPIPE ---

async function setupMediaPipe() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1 // Solo nos importa una mano por dispositivo
    });
    console.log("HandLandmarker listo.");
}
async function getCameraDevices() {
    // Primero, pedir permiso (necesario para que enumerateDevices funcione bien)
    try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (e) {
        console.error("Permiso de cámara denegado:", e);
        alert("Necesitas dar permiso a la cámara para continuar.");
        return; 
    }

    // Ahora sí, obtener la lista
    const devices = await navigator.mediaDevices.enumerateDevices();
    videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    if (videoDevices.length === 0) {
        alert("No se encontraron cámaras.");
    } else {
        console.log("Cámaras encontradas:", videoDevices);
        // Ocultar el botón si solo hay 1 cámara
        if (videoDevices.length < 2) {
            document.getElementById('switch-cam-btn').style.display = 'none';
        }
    }
}

// --- ¡NUEVA FUNCIÓN PARA INICIAR/CAMBIAR CÁMARA! ---
// (Reemplaza la antigua 'enableCam')
function startCamera() {
    if (videoDevices.length === 0) {
        console.error("No hay cámaras para iniciar.");
        return;
    }
    
    // Parar el stream anterior (si existe)
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    // Obtener el deviceId de la cámara actual
    const deviceId = videoDevices[currentDeviceIndex].deviceId;
    
    const constraints = {
        video: {
            deviceId: { exact: deviceId },
            // Pedir resoluciones comunes de móvil
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    };
    
    // Pedir la nueva cámara
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        currentStream = stream; // Guardar el stream
        video.srcObject = stream;
        
        // 'play()' es importante para móviles
        video.play(); 
        
    }).catch((err) => console.error("Error al iniciar cámara:", err));
}

/*function enableCam() {
    const constraints = { video: { width: 640, height: 480 } };
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
            webcamRunning = true;
            console.log("Webcam iniciada.");
            // Ajustar el canvas de Three.js al tamaño del video
            resizeThreeJS(); 
            predictWebcam(); // Inicia el bucle
        });
    }).catch((err) => console.error("Error al acceder a la webcam:", err));
}*/

// --- ¡NUEVA FUNCIÓN PARA EL BOTÓN Y EL VIDEO! ---
function setupEventListeners() {
    // 1. Botón de cambiar cámara
    document.getElementById('switch-cam-btn').addEventListener('click', () => {
        if (videoDevices.length < 2) return; // No hacer nada si solo hay 1 cámara
        
        // Cambiar al siguiente índice de cámara
        currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
        console.log("Cambiando a cámara:", videoDevices[currentDeviceIndex].label);
        
        // Reiniciar la cámara
        startCamera();
    });

    // 2. Listener de video cargado
    // (Esto solo debe correr la PRIMERA vez que el video carga)
    video.addEventListener("loadeddata", () => {
        if (webcamRunning) return; // Si ya está corriendo, no hacer nada
        
        console.log("Webcam iniciada y datos cargados.");
        webcamRunning = true;
        resizeThreeJS(); // Ajustar Three.js al tamaño del video
        predictWebcam();  // Iniciar el bucle de detección/render
    });
}

// --- 5. MÓDULO DE THREE.JS ---

function setupThreeJS() {
    scene = new THREE.Scene();

    // Cámara: Es crucial que el FOV (campo de visión)
    // se parezca al de la webcam. 75 es un buen comienzo.
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5; // Posición inicial

    // ¡¡CLAVE!! El 'alpha: true' hace que el fondo sea transparente
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true 
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
}

function loadModel() {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        // Cambia esto por tu modelo
        loader.load('/models/modelo.glb', (gltf) => {
            model = gltf.scene;
            model.scale.set(0.1, 0.1, 0.1); // Escala inicial (ajusta esto)
            model.visible = false; // Empezar oculto
            scene.add(model);
            console.log("Modelo cargado.");
            resolve();
        }, undefined, reject);
    });
}

// Ajusta Three.js si la ventana (o el video) cambia de tamaño
function resizeThreeJS() {
    // Usamos el tamaño del video para la relación de aspecto
    const w = video.videoWidth;
    const h = video.videoHeight;
    renderer.setSize(w, h); // El canvas debe tener el mismo tamaño que el video
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    // Ajusta el tamaño del contenedor CSS
    const container = document.getElementById('ar-container');
    const windowAspect = window.innerWidth / window.innerHeight;
    const videoAspect = w / h;

    if (windowAspect > videoAspect) { // Ventana más ancha que video
        
        container.style.width = '100vw';
        container.style.height = `${window.innerWidth / videoAspect}px`;
        /*
        container.style.width = `${h * videoAspect}px`;
        container.style.height = `${h}px`;
        */
    } else { // Ventana más alta que video
       
        container.style.height = '100vh';
        container.style.width = `${window.innerHeight * videoAspect}px`;
        /*
        container.style.width = `${w}px`;
        container.style.height = `${w / videoAspect}px`;
        */
    }
}


// --- 6. LA MAGIA: BUCLE DE PREDICCIÓN Y RENDER ---

async function predictWebcam() {
    if (!webcamRunning || !model || !handLandmarker) {
        window.requestAnimationFrame(predictWebcam);
        return;
    }

    const startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        
        // Detectar manos
        const results = await handLandmarker.detectForVideo(video, startTimeMs);

        // Limpiar el canvas de Three.js (ya que es transparente)
        renderer.clear();

        // Si detectamos una mano...
        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0]; // landmarks de la primera mano

            // 1. Revisar si la mano está abierta
            if (isHandOpen(landmarks)) {
                // 2. Obtener la posición
                // Usamos el landmark 9 (base del dedo medio) como centro de la palma
                const palmPos = landmarks[9]; 

                // 3. Mapear coordenadas de MediaPipe (0-1) a Three.js (-1 a 1)
                // Invertimos Y porque MediaPipe (0 es arriba) es opuesto a Three.js (0 es centro)
                // Invertimos X por el efecto espejo del video
                const x = palmPos.x * 2 - 1;
                const y = -(palmPos.y * 2 - 1);

                // 4. Convertir posición 2D de la pantalla a 3D en el mundo
                const vector = new THREE.Vector3(x, y, 0.5); // 0.5 = a mitad de camino
                vector.unproject(camera); // Convierte de 2D (pantalla) a 3D (mundo)
                
                // 5. Posicionar el modelo
                model.position.set(vector.x, vector.y, 0); // Ajusta 'z' si es necesario
                
                // (Opcional) Rotar el modelo con la mano
                // model.rotation.z = ... 

                // Escalar el modelo basado en la "profundidad" (distancia entre pulgar y meñique)
                const thumbTip = landmarks[4];
                const pinkyTip = landmarks[20];
                const handWidth = Math.hypot(thumbTip.x - pinkyTip.x, thumbTip.y - pinkyTip.y);

                // Ajusta el '3.0' según el tamaño de tu modelo
                model.scale.setScalar(handWidth * 3.0);

                model.visible = true;
            } else {
                model.visible = false;
            }
        } else {
            model.visible = false;
        }
        
        // Renderizar la escena de Three.js
        renderer.render(scene, camera);
    }

    // Volver a llamar en el próximo frame
    window.requestAnimationFrame(predictWebcam);
}

// --- 7. FUNCIÓN DE GESTO ---

/**
 * Revisa si la mano está extendida (palma abierta).
 * Lo hacemos midiendo la distancia de las puntas de los dedos a la palma.
 */
function isHandOpen(landmarks) {
    // Landmark 9: Base del dedo medio (centro-palma)
    // Landmark 12: Punta del dedo medio
    // Landmark 20: Punta del dedo meñique
    
    const palm = landmarks[9];
    const middleTip = landmarks[12];
    const pinkyTip = landmarks[20];

    // Distancia vertical (Y)
    const distMiddle = Math.abs(palm.y - middleTip.y);
    const distPinky = Math.abs(palm.y - pinkyTip.y);
    
    // Umbral (ajusta esto probando)
    // Si la distancia 'y' es grande, los dedos están extendidos
    const openThreshold = 0.1; 
    
    return distMiddle > openThreshold && distPinky > openThreshold;
}