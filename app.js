// =======================================================
// app.js: Lógica Compartida para Control Remoto GLB (Three.js, MediaPipe, Firestore)
// Este script es cargado por camera.html y lienzo.html.
// =======================================================

// Variables globales para Three.js, MediaPipe y Firestore
let videoElement;
let scene, camera, renderer, model;
let hands;
let cameraUtil;
let handLandmarks = [];
let handPoints = []; 
let controls; 

let db; // Instancia de Firebase Firestore (asignada en el HTML)
let userId; // ID de usuario de Firebase (asignada en el HTML)
let sessionRef = null; // Referencia al documento de sesión en Firestore

// ===================================
// UTILERÍAS DE APOYO
// ===================================

// Obtiene el ID de sesión de la URL (usado por camera.html y lienzo.html)
function getSessionIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || null;
}

// Genera un código de sesión de 6 dígitos
function generateSessionId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ===================================
// LÓGICA MEDIAPIPE (EMISOR)
// ===================================

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
    // Si la mano es detectada, se envían los datos
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        emitHandData(results.multiHandLandmarks[0]);
    } else {
        // Si no hay mano, se envía una señal de inactividad
        emitHandData(null);
    }
}


// ===================================
// EMISIÓN Y RECEPCIÓN DE DATOS
// ===================================

/**
 * [EMISOR] Envía los datos de la mano a Firestore.
 */
function emitHandData(landmarks) {
    if (!sessionRef) return;
    
    const setDoc = window.setDoc; 
    if (!setDoc) return; 

    let data;
    if (landmarks) {
        // Simplificar los landmarks para reducir el tamaño del documento de Firestore
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
 * [RECEPTOR] Configura un listener para recibir datos de la mano.
 */
function setupRemoteListener() {
    if (!sessionRef) return;
    
    const statusElement = document.getElementById('sessionStatus');
    const onSnapshot = window.onSnapshot;

    if (!onSnapshot) {
        statusElement.textContent = "ERROR: Firebase no cargado.";
        return;
    }

    onSnapshot(sessionRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();

            if (data.active && data.landmarks) {
                statusElement.textContent = `CONTROL REMOTO ACTIVO: ${sessionRef.id}`;
                updateModelAndHandVisualization(data.landmarks);
            } else {
                statusElement.textContent = `ESPERANDO GESTO REMOTO: ${sessionRef.id}`;
                // Ocultar la visualización de la mano cuando no hay datos
                handPoints.forEach(p => p.visible = false);
            }
        } else {
            statusElement.textContent = `SESIÓN ${sessionRef.id} NO ENCONTRADA.`;
            handPoints.forEach(p => p.visible = false);
        }
    }, (error) => {
        console.error("Error al leer datos remotos:", error);
        statusElement.textContent = `ERROR DE CONEXIÓN.`;
    });
}

// ===================================
// LÓGICA THREE.JS (RECEPTOR)
// ===================================

function initThreeJs() {
    const container = document.getElementById('container');
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (renderer) return; 
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    // En el modo lienzo, el fondo siempre es sólido (alpha: false)
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false 
    });
    renderer.setSize(width, height);
    renderer.domElement.id = 'threeCanvas'; 
    container.appendChild(renderer.domElement);
    renderer.setClearColor(0x333333, 1);

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
            model.scale.set(0.5, 0.5, 0.5); 
            model.position.set(0, 0, 0); 
            scene.add(model);
        },
        undefined, 
        function (error) {
            console.error('Error cargando el modelo GLB', error);
            document.getElementById('sessionStatus').textContent = "ERROR: No se pudo cargar el modelo 3D.";
        }
    );

    // Inicializa OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.enabled = true; // Control de ratón activo por defecto

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

    if (controls && controls.enabled) {
        controls.update();
    }
    renderer.render(scene, camera);
}


// ===================================
// MAPEO DE COORDENADAS (RECEPTOR)
// ===================================

/**
 * [RECEPTOR] Aplica la lógica de mapeo y muestra los puntos de la mano en 3D.
 */
function updateModelAndHandVisualization(landmarks) {
    if (!model || handPoints.length === 0 || !landmarks) return;

    // Desactivar OrbitControls mientras se recibe el gesto remoto
    if (controls) controls.enabled = false;

    // --- A. Mapeo de Posición para el Modelo ---
    const indexFingerTip = landmarks[8];
    
    // Mapeo sin inversión en X (cámara remota)
    const mappedX = indexFingerTip.x * 10 - 5; 
    const mappedY = (1 - indexFingerTip.y) * 10 - 5; 

    model.position.x = mappedX;
    model.position.y = mappedY;
    
    // --- B. Visualización de los Puntos de la Mano en 3D ---
    landmarks.forEach((landmark, index) => {
        const pointMesh = handPoints[index];
        
        // Mapeo sin inversión en X para los puntos
        const pointX = landmark.x * 10 - 5; 
        const pointY = (1 - landmark.y) * 10 - 5;
        // Z ajustada para aparecer delante del modelo
        const pointZ = (landmark.z * -5) + 2; 
        
        pointMesh.position.set(pointX, pointY, pointZ); 
        pointMesh.visible = true;
    });
}


// ===================================
// FUNCIONES DE INICIO EXPORTADAS
// ===================================

/**
 * Inicia la aplicación en modo EMISOR (Teléfono).
 * Llamada por camera.html.
 */
window.startCameraSender = function() {
    const sessionId = getSessionIdFromUrl();
    const statusElement = document.getElementById('sessionStatus');
    
    const docFn = window.doc;
    const collectionFn = window.collection;

    if (!db || !docFn || !collectionFn) {
        statusElement.textContent = "ERROR: Dependencias de Firebase no cargadas.";
        return;
    }
    
    const appId = 'dual-controller-ar'; 
    const sessionCollection = collectionFn(db, 'artifacts', appId, 'public', 'data', 'sessions');

    if (sessionId) {
        sessionRef = docFn(sessionCollection, sessionId);
        statusElement.textContent = `EMISOR ACTIVO. Sesión: ${sessionId}`;
        
        initMediaPipe(); 
        setupCamera(); // Activa la cámara y MediaPipe
    } else {
        statusElement.textContent = "ERROR: Falta el código de sesión en la URL.";
    }
};


/**
 * Inicia la aplicación en modo RECEPTOR (PC/Lienzo).
 * Llamada por lienzo.html.
 */
window.startCanvasReceiver = function() {
    const sessionId = getSessionIdFromUrl();
    const statusElement = document.getElementById('sessionStatus');

    const docFn = window.doc;
    const collectionFn = window.collection;

    if (!db || !docFn || !collectionFn) {
        statusElement.textContent = "ERROR: Dependencias de Firebase no cargadas.";
        return;
    }

    const appId = 'dual-controller-ar'; 
    const sessionCollection = collectionFn(db, 'artifacts', appId, 'public', 'data', 'sessions');

    if (sessionId) {
        sessionRef = docFn(sessionCollection, sessionId);
        statusElement.textContent = `RECEPTOR ACTIVO. Iniciando Lienzo...`;
        
        initThreeJs(); // Inicializa Three.js y OrbitControls
        setupRemoteListener(); // Inicia la escucha de gestos
    } else {
        statusElement.textContent = "ERROR: Falta el código de sesión en la URL.";
    }
};
