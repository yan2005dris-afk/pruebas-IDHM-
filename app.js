// =======================================================
// app.js: Integración de Three.js, GLB, MediaPipe y Cámara
// =======================================================

// Variables globales para Three.js y MediaPipe
let videoElement;
let scene, camera, renderer, model;
let hands;
let cameraUtil;
let handLandmarks = []; 
let handPoints = []; // Mallas 3D para visualizar los 21 puntos de la mano

// ===================================
// 1. CONFIGURACIÓN MEDIAPIPE
// ===================================

// Función que se ejecuta cada vez que MediaPipe detecta manos
function onResults(results) {
    // Si hay manos detectadas, actualiza las landmarks
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handLandmarks = results.multiHandLandmarks;
        // Solo usamos la primera mano detectada para el control
        updateModelAndHandVisualization(handLandmarks[0]); 
    } else {
        // Si no hay manos, ocultamos los puntos de la mano
        handLandmarks = [];
        handPoints.forEach(p => p.visible = false);
    }
}

// Inicialización de MediaPipe Hands
function initMediaPipe() {
    hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1, // 0 para rápido, 1 para mejor precisión
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    hands.onResults(onResults);
}


// ===================================
// 2. ACCESO A LA CÁMARA
// ===================================

function setupCamera() {
    videoElement = document.getElementById('videoElement');
    initMediaPipe(); // Inicializa MediaPipe primero

    // Pide acceso a la cámara
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // facingMode: 'user' usa la cámara frontal (modo espejo)
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
            .then(function(stream) {
                videoElement.srcObject = stream;
                videoElement.onloadedmetadata = function() {
                    videoElement.play();
                    initThreeJs();

                    // Inicializar CameraUtil para enviar fotogramas a MediaPipe
                    cameraUtil = new Camera(videoElement, {
                        onFrame: async () => {
                            await hands.send({ image: videoElement });
                        },
                        width: videoElement.videoWidth,
                        height: videoElement.videoHeight
                    });
                    cameraUtil.start();
                };
            })
            .catch(function(error) {
                console.error("Error al acceder a la cámara: ", error);
                alert("No se pudo acceder a la cámara. Asegúrate de dar permisos.");
            });
    } else {
        alert("Tu navegador no soporta la API de getUserMedia.");
    }
}

// ===================================
// 3. CONFIGURAR ESCENA THREE.JS
// ===================================

function initThreeJs() {
    const container = document.getElementById('container');
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Configurar Escena, Cámara y Renderer (con alpha: true)
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5; // Posición de la cámara en Z
    
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true // Fondo transparente para ver el video
    });
    renderer.setSize(width, height);
    renderer.domElement.id = 'threeCanvas'; 
    container.appendChild(renderer.domElement);
    
    // Añadir Luces 
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);
    
    // Cargar el Modelo .glb
    const loader = new THREE.GLTFLoader();
    loader.load(
        'assets/models/mi_modelo.glb', // ¡CAMBIA ESTA RUTA!
        function (gltf) {
            model = gltf.scene;
            model.scale.set(1, 1, 1); 
            model.position.set(0, 0, 0); 
            scene.add(model);
        },
        undefined, 
        function (error) {
            console.error('Error cargando el modelo GLB', error);
        }
    );

    // Inicializar los puntos 3D para la visualización de la mano
    setupHandVisualization();
    
    // Iniciar el bucle de renderizado
    window.addEventListener('resize', onWindowResize, false);
    animate();
}

// Inicializa las 21 esferas que dibujarán la mano
function setupHandVisualization() {
    const pointGeometry = new THREE.SphereGeometry(0.05, 10, 10); // Tamaño del punto
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Color verde
    
    for (let i = 0; i < 21; i++) {
        const point = new THREE.Mesh(pointGeometry, pointMaterial);
        point.visible = false; 
        scene.add(point);
        handPoints.push(point);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    // Renderiza la escena
    renderer.render(scene, camera);
}

// ===================================
// 4. MAPEO DE COORDENADAS (Control)
// ===================================

function updateModelAndHandVisualization(landmarks) {
    if (!model || handPoints.length === 0) return;

    // A. Mapeo de Posición para el Modelo (Control)
    // Usamos el landmark 8 (punta del dedo índice) para mover el modelo.
    const indexFingerTip = landmarks[8];
    
    // Mapear coordenadas normalizadas (0 a 1) a coordenadas 3D (-5 a 5)
    // X e Y están invertidos para simular el modo espejo de la cámara y el sistema de coordenadas 3D.
    const mappedX = (1 - indexFingerTip.x) * 10 - 5; 
    const mappedY = (1 - indexFingerTip.y) * 10 - 5; 
    
    // Aplicar la nueva posición (Z es fija para el plano de la pantalla)
    // El modelo se mueve con el dedo en el plano X-Y.
    model.position.x = mappedX;
    model.position.y = mappedY;
    
    // B. Visualización de los Puntos de la Mano en 3D
    landmarks.forEach((landmark, index) => {
        const pointMesh = handPoints[index];
        
        // Mapear cada punto individualmente (con inversión de X e Y)
        const pointX = (1 - landmark.x) * 10 - 5;
        const pointY = (1 - landmark.y) * 10 - 5;
        
        // Z (Profundidad): Los valores Z de MediaPipe son relativos (más grande = más cerca).
        // Lo multiplicamos por un factor y lo ajustamos para que la mano aparezca cerca del modelo.
        // Un valor más pequeño de Z en MediaPipe significa que la mano está más lejos de la cámara.
        // En Three.js, un valor positivo de Z es "hacia la cámara". 
        // Usamos -1 para que el modelo aparezca en el espacio 3D (puedes ajustar -10 para acercar/alejar la visualización de la mano)
        const pointZ = landmark.z * -10; 
        
        pointMesh.position.set(pointX, pointY, pointZ - 1); // -1 lo coloca cerca del modelo
        pointMesh.visible = true;
    });
}


// ===================================
// INICIO DE LA APLICACIÓN
// ===================================

setupCamera(); // Comienza pidiendo acceso a la cámara
