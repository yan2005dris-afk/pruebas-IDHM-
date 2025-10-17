// =======================================================
// app.js: LÓGICA COMPARTIDA DE 3D, MEDIAPIPE Y FIREBASE
// =======================================================

// Variables globales
let scene, camera, renderer, model;
let hands;
let cameraUtil;
let handPoints = []; 
let controls; 

let db; 
let userId; 
let sessionRef = null; 
let currentMode = 'init'; // 'sender' o 'receiver'

// ===================================
// UTILERÍAS DE INICIALIZACIÓN
// ===================================

function getSessionIdFromUrl() {
    // Obtiene el ID de sesión de la URL (ej: camera.html?session=ABCD12)
    const params = new URLSearchParams(window.location.search);
    return params.get('session');
}

// ===================================
// LÓGICA DE MEDIAPIPE/CÁMARA (SENDER)
// ===================================

function initMediaPipe(onResultsHandler) {
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
    hands.onResults(onResultsHandler);
}

function setupCamera(videoElement, onFrameHandler) {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Usa 'environment' para la cámara trasera (AR)
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            .then(function(stream) {
                videoElement.srcObject = stream;
                videoElement.onloadedmetadata = function() {
                    videoElement.play();
                    
                    cameraUtil = new Camera(videoElement, {
                        onFrame: onFrameHandler,
                        width: videoElement.videoWidth,
                        height: videoElement.videoHeight
                    });
                    cameraUtil.start();
                };
            })
            .catch(function(error) {
                console.error("Error al acceder a la cámara: ", error);
                document.getElementById('sessionStatus').textContent = "ERROR: Necesita permisos de cámara.";
            });
    } else {
        document.getElementById('sessionStatus').textContent = "ERROR: Navegador no soporta cámara.";
    }
}


// ===================================
// 3D & MANIPULACIÓN (RECEIVER)
// ===================================

function initThreeJs() {
    const container = document.getElementById('container');
    const width = window.innerWidth;
    const height = window.innerHeight;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false 
    });
    renderer.setSize(width, height);
    renderer.domElement.id = 'threeCanvas'; 
    container.appendChild(renderer.domElement);
    renderer.setClearColor(0x333333, 1); // Fondo sólido para el lienzo

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
        }
    );

    // Inicializa OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.enabled = true; // Activo por defecto en el lienzo

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

    if (currentMode === 'receiver' && controls && controls.enabled) {
        // Si el control remoto está inactivo, permite OrbitControls
        controls.update();
    } else if (currentMode === 'receiver' && model && !controls.enabled) {
        // En modo remoto, si el modelo está quieto, podemos añadir una rotación si no hay gestos
        // model.rotation.y += 0.005; // Opcional: rotación automática cuando el control remoto no está activo.
    }
    renderer.render(scene, camera);
}


// ===================================
// FIREBASE - EMISIÓN Y RECEPCIÓN
// ===================================

// Función de callback de MediaPipe para enviar datos
function onSenderResults(results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        emitHandData(results.multiHandLandmarks[0]);
    } else {
        emitHandData(null);
    }
}

function emitHandData(landmarks) {
    if (!sessionRef) return;
    
    const setDoc = window.setDoc; 
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

function setupRemoteListener() {
    if (!sessionRef) return;
    
    const statusElement = document.getElementById('sessionStatus');
    const onSnapshot = window.onSnapshot; 

    if (!onSnapshot) return;

    onSnapshot(sessionRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();

            if (data.active && data.landmarks) {
                statusElement.textContent = `SESIÓN ${sessionRef.id}: CONTROL ACTIVO`;
                updateModelAndHandVisualization(data.landmarks);
                controls.enabled = false; // Desactiva OrbitControls mientras haya gestos
            } else {
                statusElement.textContent = `SESIÓN ${sessionRef.id}: ESPERANDO MANO`;
                handPoints.forEach(p => p.visible = false);
                controls.enabled = true; // Activa OrbitControls si no hay gestos
            }
        } else {
            statusElement.textContent = `SESIÓN ${sessionRef.id} NO ENCONTRADA o FINALIZADA.`;
            handPoints.forEach(p => p.visible = false);
            controls.enabled = true;
        }
    });
}

/**
 * Aplica la lógica de mapeo (solo se usa en modo RECEIVER).
 */
function updateModelAndHandVisualization(landmarks) {
    if (!model || handPoints.length === 0 || !landmarks) return;

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
// 5. FUNCIONES DE INICIO POR PÁGINA
// ===================================

window.startCameraSender = function() {
    currentMode = 'sender';
    db = window.db; 
    
    const sessionId = getSessionIdFromUrl();
    const statusElement = document.getElementById('sessionStatus');

    if (!sessionId) {
        statusElement.textContent = "ERROR: Falta el ID de Sesión. Vuelve al inicio.";
        return;
    }
    
    const docFn = window.doc;
    const collectionFn = window.collection;
    const appId = 'dual-controller-ar'; 
    const sessionCollection = collectionFn(db, 'artifacts', appId, 'public', 'data', 'sessions');
    sessionRef = docFn(sessionCollection, sessionId);

    statusElement.textContent = `SENDER: SESIÓN ACTIVA (${sessionId}). Detectando mano...`;
    
    const videoElement = document.getElementById('videoElement');
    videoElement.style.display = 'block';
    
    // Inicia MediaPipe con la función de emisión
    initMediaPipe(onSenderResults);
    setupCamera(videoElement, async () => { await hands.send({ image: videoElement }); });
};


window.startCanvasReceiver = function() {
    currentMode = 'receiver';
    db = window.db;
    
    const sessionId = getSessionIdFromUrl();
    const statusElement = document.getElementById('sessionStatus');

    if (!sessionId) {
        statusElement.textContent = "ERROR: Falta el ID de Sesión. Vuelve al inicio.";
        return;
    }

    initThreeJs();

    const docFn = window.doc;
    const collectionFn = window.collection;
    const appId = 'dual-controller-ar'; 
    const sessionCollection = collectionFn(db, 'artifacts', appId, 'public', 'data', 'sessions');
    sessionRef = docFn(sessionCollection, sessionId);

    statusElement.textContent = `RECEIVER: Conectando a sesión ${sessionId}...`;
    setupRemoteListener();
};
