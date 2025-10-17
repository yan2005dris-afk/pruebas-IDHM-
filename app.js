// =======================================================
// app.js: Integración de Three.js, GLB, MediaPipe y CONTROL REMOTO (Firestore)
// =======================================================

// Variables globales
let videoElement;
let scene, camera, renderer, model;
let hands;
let cameraUtil;
let handLandmarks = [];
let handPoints = []; // Mallas 3D para visualizar los 21 puntos de la mano
let currentMode = 'canvas'; 
let controls; 

let db; // Instancia de Firebase Firestore
let userId; // ID de usuario de Firebase
let sessionRef = null; // Referencia al documento de sesión en Firestore

// ===================================
// UTILERÍAS FIREBASE Y MEDIAPIPE
// ===================================

// Función que se ejecuta cuando Firebase está listo
window.onFirebaseReady = () => {
    // Asigna las variables globales exportadas por el script module de Firebase en el HTML
    db = window.db;
    userId = window.userId;
    console.log("App ready. DB and User ID loaded.");
};

// Genera un código de sesión de 6 dígitos
function generateSessionId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
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

function onResults(results) {
    if (currentMode !== 'camera') return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        emitHandData(results.multiHandLandmarks[0]);
    } else {
        emitHandData(null);
    }
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
                    
                    // Asegurar que el canvas 3D esté oculto en modo EMISOR
                    const threeCanvas = document.getElementById('threeCanvas');
                    if (threeCanvas) threeCanvas.style.display = 'none';

                    // Inicializa Three.js SÓLO si es necesario
                    if(!renderer) initThreeJs(); 

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

    // Alpha se define en base al currentMode, aunque se ajusta en startApp
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: currentMode === 'camera' 
    });
    renderer.setSize(width, height);
    renderer.domElement.id = 'threeCanvas'; 
    container.appendChild(renderer.domElement);
    
    renderer.domElement.style.display = 'none'; // Oculto hasta que se elige el modo

    // Luces
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);

    // Cargar el Modelo .glb
    const loader = new THREE.GLTFLoader();
    loader.load(
        'assets/modelo.glb', 
        function (gltf) {
            model = gltf.scene;
            model.scale.set(0.5, 0.5, 0.5); // Escala corregida
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
        if(model && controls.enabled){ 
            model.rotation.y += 0.005; 
        }
    }
    renderer.render(scene, camera);
}


// ===================================
// 4. EMISIÓN Y RECEPCIÓN DE DATOS
// ===================================

/**
 * [EMISOR] Envía los datos de la mano a Firestore (Modo 'camera').
 */
function emitHandData(landmarks) {
    if (!sessionRef) return;
    
    const setDoc = window.setDoc; // Accede a la función exportada desde el HTML
    if (!setDoc) return; 

    let data;
    if (landmarks) {
        const simplifiedLandmarks = landmarks.map(l => ({ x: l.x, y: l.y, z: l.z }));
        data = {
            landmarks: simplifiedLandmarks,
            timestamp: Date.now(),
            active: true
        };
    } else {
        data = { active: false, timestamp: Date.now() };
    }

    setDoc(sessionRef, data, { merge: true }).catch(error => {
        console.error("Error al escribir en Firestore:", error);
    });
}

/**
 * [RECEPTOR] Configura un listener para recibir datos de la mano (Modo 'canvas').
 */
function setupRemoteListener() {
    if (!sessionRef) return;
    
    const statusElement = document.getElementById('sessionStatus');
    statusElement.textContent = `ESCUCHANDO SESIÓN: ${sessionRef.id}`;
    
    const onSnapshot = window.onSnapshot; // Accede a la función exportada desde el HTML

    if (!onSnapshot) {
        statusElement.textContent = "ERROR: Firebase no conectado.";
        return;
    }

    onSnapshot(sessionRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();

            if (data.active && data.landmarks) {
                statusElement.textContent = `CONTROL ACTIVO desde ${sessionRef.id}`;
                updateModelAndHandVisualization(data.landmarks);
            } else {
                statusElement.textContent = `ESPERANDO MANO en ${sessionRef.id}`;
                handPoints.forEach(p => p.visible = false);
            }
        } else {
            statusElement.textContent = `SESIÓN ${sessionRef.id} NO ENCONTRADA o FINALIZADA.`;
            handPoints.forEach(p => p.visible = false);
        }
    }, (error) => {
        console.error("Error al leer datos remotos:", error);
        statusElement.textContent = `ERROR DE CONEXIÓN.`;
    });
}

/**
 * [RECEPTOR] Aplica la lógica de mapeo.
 */
function updateModelAndHandVisualization(landmarks) {
    if (!model || handPoints.length === 0 || !landmarks) return;

    if (controls) controls.enabled = false;

    // --- A. Mapeo de Posición para el Modelo (Control) ---
    const indexFingerTip = landmarks[8];
    
    const mappedX = indexFingerTip.x * 10 - 5; 
    const mappedY = (1 - indexFingerTip.y) * 10 - 5; 

    model.position.x = mappedX;
    model.position.y = mappedY;
    
    // --- B. Visualización de los Puntos de la Mano en 3D ---
    landmarks.forEach((landmark, index) => {
        const pointMesh = handPoints[index];
        
        const pointX = landmark.x * 10 - 5; 
        const pointY = (1 - landmark.y) * 10 - 5;
        const pointZ = (landmark.z * -5) + 2; 
        
        pointMesh.position.set(pointX, pointY, pointZ); 
        pointMesh.visible = true;
    });
}


// ===================================
// 5. FUNCIÓN DE INICIO POR SELECCIÓN
// ===================================

function startApp(mode) {
    currentMode = mode;
    const sessionIdInput = document.getElementById('sessionIdInput');
    let sessionId = sessionIdInput.value.trim().toUpperCase();
    const statusElement = document.getElementById('sessionStatus');
    
    const docFn = window.doc;
    const collectionFn = window.collection;

    if (!docFn || !collectionFn) {
        statusElement.textContent = "ERROR: Firebase no está cargado. Recarga la página y verifica tu conexión.";
        return;
    }
    
    // 1. Inicializa Three.js si es la primera vez
    if (!renderer) {
        initThreeJs();
    }
    
    // 2. Configuración del documento de sesión
    const appId = 'dual-controller-ar'; 
    const sessionCollection = collectionFn(db, 'artifacts', appId, 'public', 'data', 'sessions');

    // 3. Lógica de inicio
    if (mode === 'camera') {
        // MODO EMISOR (TELÉFONO)
        
        if (sessionId.length !== 6) {
             sessionId = generateSessionId(); 
            sessionRef = docFn(sessionCollection, sessionId);
            statusElement.textContent = `CREANDO SESIÓN: ${sessionId}. CÁRGALA EN TU PC.`;
            
            setTimeout(() => { alert(`Tu código de sesión es: ${sessionId}. Cárgalo en tu PC.`); }, 500);
        } else {
             sessionRef = docFn(sessionCollection, sessionId);
             statusElement.textContent = `USANDO SESIÓN: ${sessionId}.`;
        }
        
        document.getElementById('startScreen').style.display = 'none';
        setupCamera(); // Activa la cámara y MediaPipe
        
        // Ocultar el lienzo 3D en el modo EMISOR
        const threeCanvas = document.getElementById('threeCanvas');
        if (threeCanvas) threeCanvas.style.display = 'none'; 
        
        if(controls) controls.enabled = false;

    } else if (mode === 'canvas') {
        // MODO RECEPTOR (PC)
        
        if (sessionId.length !== 6) {
            alert("Debes ingresar un código de sesión de 6 dígitos para conectar la PC.");
            return;
        }

        sessionRef = docFn(sessionCollection, sessionId);
        
        document.getElementById('startScreen').style.display = 'none';
        
        // Mostrar el lienzo y ocultar la cámara (si existía)
        document.getElementById('threeCanvas').style.display = 'block';
        document.getElementById('videoElement').style.display = 'none';
        
        // Configura el renderizador para fondo sólido
        renderer.setClearColor(0x333333, 1);
        
        if(controls) controls.enabled = true; // El control del ratón inicia activo

        setupRemoteListener(); // Inicia el listener remoto
    }
}
