// /public/js/lienzo-main.js

// --- 1. IMPORTACIONES DE THREE.JS (desde CDN) ---
// Usamos un CDN para no tener que gestionar los archivos de Three.js
// Gracias a "type=module" en el HTML, podemos usar 'import'
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// --- 2. DEFINICIÓN DE VARIABLES GLOBALES ---
let scene, camera, renderer, controls;
let model; // Esta variable guardará nuestro objeto 3D
const canvas = document.getElementById('3d-canvas');
let isRotatingWithFist = false; // Nueva variable de estado


const ROTATION_SPEED_FACTOR = 5; // Ajusta qué tan rápido rota el modelo con el movimiento

// --- 3. CONEXIÓN AL SERVIDOR DE SOCKET.IO ---
const socket = io();
console.log("Conectando a Socket.io (Lienzo)...");

socket.on("connect", () => {
    console.log("¡Conectado al servidor con ID:", socket.id);
});

// --- 4. MÓDULO INDEPENDIENTE: CONFIGURACIÓN DE THREE.JS ---

function init() {
    // Escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Cámara
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5; // Aleja la cámara

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Luz suave global
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Luz tipo "sol"
    directionalLight.position.set(2, 5, 5); // Posición de la luz
    scene.add(directionalLight);

    // Controles de Mouse (Para probar independientemente)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Efecto de "desaceleración" suave
    controls.dampingFactor = 0.05;
    //controls.enabled = false;
    // Cargar el modelo 3D
    loadModel();

    // Iniciar el bucle de render
    animate();

    // Ajustar la ventana si cambia de tamaño
    window.addEventListener('resize', onWindowResize);
}

// Función para cargar el modelo .glb
function loadModel() {
    const loader = new GLTFLoader();
    
    // ¡¡IMPORTANTE!! 
    // Cambia esta ruta al nombre y ubicación de tu archivo .glb
    const modelPath = '/models/modelo.glb';

    loader.load(
        modelPath, 
        (gltf) => {
            // Se ejecuta cuando el modelo se carga correctamente
            model = gltf.scene;
            
            // Centrar y escalar el modelo automáticamente
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // Escala para que el lado más grande mida 3 unidades
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3.0 / maxDim;
            model.scale.set(scale, scale, scale);
            
            // Centra el modelo en el origen
            model.position.sub(center.multiplyScalar(scale)); 
            
            scene.add(model);
            console.log("Modelo 3D cargado y centrado.");
        },
        (xhr) => {
            // Se ejecuta mientras carga (opcional)
            console.log(`Cargando modelo: ${(xhr.loaded / xhr.total * 100).toFixed(0)}%`);
        },
        (error) => {
            // Se ejecuta si hay un error
            console.error("Error al cargar el modelo 3D:", error);
            alert(`No se pudo cargar el modelo de: ${modelPath}\nRevisa la ruta en 'lienzo-main.js' y la consola.`);
        }
    );
}

// Bucle de Render (se llama en cada frame)
function animate() {
    requestAnimationFrame(animate);

    // Actualiza los controles del mouse
    //controls.update();
    
    // Renderiza la escena
    renderer.render(scene, camera);
}

// Función para manejar el re-dimensionamiento de la ventana
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- 5. MÓDULO DE COMUNICACIÓN: ESCUCHAR EVENTOS DE SOCKET.IO ---

function setupSocketListeners() {
    // ÚNICO LISTENER para todos los gestos retransmitidos por el servidor
    socket.on('control-object', (data) => {
        if (!model) return; // Salir si el modelo 3D no ha cargado

        // console.log("Lienzo recibió control-object:", data); // Descomenta para depurar

        // Ahora clasificamos el gesto según el 'type'
        switch (data.type) {
            case 'fist_move':
                // Lógica para mover el objeto con el puño
                const MOVE_SPEED_FACTOR = 4;
                const MAX_OFFSET = 3;
                model.position.x += data.deltaX * MOVE_SPEED_FACTOR;
                model.position.x = Math.max(-MAX_OFFSET, Math.min(model.position.x, MAX_OFFSET));
                break;
            
            case 'open':
                // Lógica para centrar el objeto con la mano abierta
                // ¡Cuidado! Tu código usaba 'gsap' sin importarlo, lo que causa un error.
                // Usa la versión simple (sin GSAP) para asegurar que funcione:
                model.position.x = 0;
                
                // Si quieres la animación suave, DEBES importar GSAP al inicio de tu archivo.
                // import { gsap } from 'https://cdn.skypack.dev/gsap';
                // gsap.to(model.position, { x: 0, duration: 0.4, ease: 'power2.out' });
                break;
            
            case 'swipe':
                // Este evento es para 'slides', pero lo recibes igual.
                // No hacemos nada con él en el lienzo.
                // console.log("Swipe ignorado en lienzo");
                break;
        }
    });
}

// --- 6. FUNCIÓN UTILITARIA (Helper) ---

/**
 * Mapea un valor de un rango de entrada a un rango de salida.
 * También "pinza" (clamps) el valor para que no se salga de los rangos.
 */
function mapRange(value, inMin, inMax, outMin, outMax) {
  // Pinzar el valor al rango de entrada
  const clampedValue = Math.max(inMin, Math.min(value, inMax));
  // Mapear al rango de salida
  return ((clampedValue - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}


// --- 7. INICIAR TODO ---
init();
setupSocketListeners();
