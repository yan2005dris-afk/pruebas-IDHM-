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
let currentMode = 'canvas'; // Variable para rastrear el modo actual

let handPoints = []; 
let currentMode = 'canvas'; 
let controls; // Nueva variable para OrbitControls

// ===================================
// 1. CONFIGURACIÓN MEDIAPIPE
// ===================================

// Función que se ejecuta cada vez que MediaPipe detecta manos
function onResults(results) {
    // Solo procesamos si estamos en modo cámara
    if (currentMode !== 'camera') return;

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
        modelComplexity: 1,
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
    initMediaPipe(); // Inicializa MediaPipe

    // Muestra el elemento de video (estaba oculto por defecto en el CSS)
    videoElement.style.display = 'block';

    // Pide acceso a la cámara
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(function(stream) {
                videoElement.srcObject = stream;
                videoElement.onloadedmetadata = function() {
                    videoElement.play();
                    // Inicializamos Three.js, que ahora sí tendrá el video de fondo
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

    // Configurar Escena, Cámara y Renderer
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        // Alpha es true SOLO en modo cámara. En modo lienzo, podemos usar un color sólido.
        alpha: currentMode === 'camera' 
    });
    renderer.setSize(width, height);
    renderer.domElement.id = 'threeCanvas';
    container.appendChild(renderer.domElement);

    // Si no estamos en modo cámara, establecemos un fondo sólido
    if (currentMode === 'canvas') {
         renderer.setClearColor(0x333333, 1); // Gris oscuro
         renderer.domElement.style.display = 'block';
    }


    // Añadir Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);

    // Cargar el Modelo .glb
    const loader = new THREE.GLTFLoader();
    loader.load(
        'assets/modelo.glb', // ¡CAMBIA ESTA RUTA!
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
    
    // 🌟 NUEVO: Inicializar OrbitControls 🌟
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Efecto de inercia más suave
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;

    // Iniciar el bucle de renderizado
    window.addEventListener('resize', onWindowResize, false);
    animate();
}

// Inicializa las 21 esferas que dibujarán la mano
function setupHandVisualization() {
    const pointGeometry = new THREE.SphereGeometry(0.05, 10, 10);
    const pointMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

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
    // En modo lienzo, podemos añadir una rotación automática para que se vea bien
    if (currentMode === 'canvas' ) {
        controls.update();
        if(model && !controls.enabled){
            model.rotation.y +=0.005;        
        }
    }
    renderer.render(scene, camera);
}

// ===================================
// 4. MAPEO DE COORDENADAS (Control)
// ===================================

function updateModelAndHandVisualization(landmarks) {
    if (!model || handPoints.length === 0) return;

    // --- A. Mapeo de Posición para el Modelo (Control) ---
    const indexFingerTip = landmarks[8];
    const mappedX = indexFingerTip.x * 10 - 5;
    const mappedY = (1 - indexFingerTip.y) * 10 - 5;

    model.position.x = mappedX;
    model.position.y = mappedY;


    // --- B. Visualización de los Puntos de la Mano en 3D ---
    landmarks.forEach((landmark, index) => {
        const pointMesh = handPoints[index];

        const pointX = (1 - landmark.x) * 10 - 5;
        const pointY = (1 - landmark.y) * 10 - 5;
        const pointZ = landmark.z * -10;

        pointMesh.position.set(pointX, pointY, pointZ - 1);
        pointMesh.visible = true;
    });
}


// ===================================
// 5. FUNCIÓN DE INICIO POR SELECCIÓN
// ===================================

/**
 * Función llamada por los botones del HTML para iniciar la aplicación.
 * @param {string} mode - 'camera' para activar la cámara y MediaPipe, o 'canvas' para solo 3D.
 */
function startApp(mode) {
    // Establece el modo de aplicación actual
    currentMode = mode;
    
    // Oculta la pantalla de inicio
    document.getElementById('startScreen').style.display = 'none';

    if (mode === 'camera') {
        // MODO CÁMARA/CONTROL
        // setupCamera() se encargará de inicializar MediaPipe, la cámara y luego Three.js
        setupCamera();

    } else if (mode === 'canvas') {
        // MODO SOLO LIENZO 3D
        // Solo inicializa Three.js (sin el video de fondo ni MediaPipe activo)
        initThreeJs();
    }
}

// ===================================
// LÍNEA DE INICIO ANTIGUA ELIMINADA:
// setupCamera(); 
// ===================================

// La aplicación espera a que el usuario haga clic en un botón en el HTML.
// Ya no es necesario poner la función 'startApp' aquí, ya que el HTML la llama directamente.
