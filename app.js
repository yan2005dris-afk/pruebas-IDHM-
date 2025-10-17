// =======================================================
// app.js: Integración de Three.js, GLB, MediaPipe y Control Dual
// =======================================================

// Variables globales
let videoElement;
let scene, camera, renderer, model;
let hands;
let cameraUtil;
let handLandmarks = [];
let handPoints = []; // Mallas 3D para visualizar los 21 puntos de la mano
let currentMode = 'canvas'; 
let controls; // Control de ratón (OrbitControls)

// ===================================
// 1. CONFIGURACIÓN MEDIAPIPE
// ===================================

function onResults(results) {
    if (currentMode !== 'camera') return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handLandmarks = results.multiHandLandmarks;
        updateModelAndHandVisualization(handLandmarks[0]);
    } else {
        handLandmarks = [];
        handPoints.forEach(p => p.visible = false);
    }
}

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
// 2. ACCESO A LA CÁMARA (Modo 'camera')
// ===================================

function setupCamera() {
    videoElement = document.getElementById('videoElement');
    initMediaPipe(); 

    videoElement.style.display = 'block';

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Usa 'environment' para la cámara trasera (AR)
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(function(stream) {
                videoElement.srcObject = stream;
                videoElement.onloadedmetadata = function() {
                    videoElement.play();
                    
                    if(!renderer) initThreeJs(); 

                    renderer.setClearAlpha(0);
                    renderer.domElement.style.background = 'transparent';

                    // Inicia el envío de frames a MediaPipe
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

    if (renderer) return; 
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: currentMode === 'camera' 
    });
    renderer.setSize(width, height);
    renderer.domElement.id = 'threeCanvas'; 
    container.appendChild(renderer.domElement);
    
    renderer.domElement.style.display = 'block';

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);

    // Cargar el Modelo .glb
    const loader = new THREE.GLTFLoader();
    loader.load(
        'assets/modelo.glb', // <<-- RUTA CORREGIDA SEGÚN TU CAPTURA
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

    // Inicializa OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;

    setupHandVisualization();
    
    window.addEventListener('resize', onWindowResize, false);
    animate();
}

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
    if (camera) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    }
    if (renderer) {
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (currentMode === 'canvas' && controls) {
        controls.update();
        // Rotación automática solo si el ratón NO está siendo usado
        if(model && controls.enabled){ 
            model.rotation.y += 0.005; 
        }
    }
    renderer.render(scene, camera);
}


// ===================================
// 4. MAPEO DE COORDENADAS (Control de Mano)
// ===================================

function updateModelAndHandVisualization(landmarks) {
    if (!model || handPoints.length === 0) return;

    // --- A. Mapeo de Posición para el Modelo (Control) ---
    const indexFingerTip = landmarks[8];
    
    // Cámara trasera: NO se invierte X
    const mappedX = indexFingerTip.x * 10 - 5; 
    // Y se invierte (0 es arriba en el navegador)
    const mappedY = (1 - indexFingerTip.y) * 10 - 5; 

    model.position.x = mappedX;
    model.position.y = mappedY;
    
    // --- B. Visualización de los Puntos de la Mano en 3D ---
    landmarks.forEach((landmark, index) => {
        const pointMesh = handPoints[index];
        
        // Cámara trasera: NO se invierte X para los puntos
        const pointX = landmark.x * 10 - 5; 
        const pointY = (1 - landmark.y) * 10 - 5;
        const pointZ = landmark.z * -10; 
        
        pointMesh.position.set(pointX, pointY, pointZ - 1); 
        pointMesh.visible = true;
    });
}


// ===================================
// 5. FUNCIÓN DE INICIO POR SELECCIÓN
// ===================================

function startApp(mode) {
    currentMode = mode;
    
    document.getElementById('startScreen').style.display = 'none';

    // 1. Inicializa Three.js si es la primera vez
    if (!renderer) {
        initThreeJs();
    }
    
    if (mode === 'camera') {
        // MODO CÁMARA (Control de Manos)
        setupCamera(); 
        
        if(controls){
            controls.enabled = false;
        }

    } else if (mode === 'canvas') {
        // MODO SOLO LIENZO 3D (Control con Ratón)
        
        // Ocultar la cámara
        document.getElementById('videoElement').style.display = 'none';
        
        if(controls){
            controls.enabled = true;
        }

        // Configurar fondo sólido y ocultar las manos
        renderer.setClearColor(0x333333, 1);
        handPoints.forEach(p => p.visible = false);
    }
}
