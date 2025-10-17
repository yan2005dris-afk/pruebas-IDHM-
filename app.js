// =======================================================
// app.js: Integración de Three.js, GLB, MediaPipe y CONTROL REMOTO (Firestore)
// =======================================================

// Variables globales para Three.js, MediaPipe y Firestore
let videoElement;
let scene, camera, renderer, model;
let hands;
let cameraUtil;
let handLandmarks = [];
let handPoints = []; // Mallas 3D para visualizar los 21 puntos de la mano
let currentMode = 'canvas'; 
let controls; 

let db; // Instancia de Firebase Firestore (inicializada en el HTML)
let userId; // ID de usuario de Firebase
let sessionRef = null; // Referencia al documento de sesión en Firestore

// ===================================
// UTILERÍAS FIREBASE (Se ejecutan al cargar)
// ===================================

// Función que se ejecuta cuando Firebase está listo (llamada desde el script del HTML)
window.onFirebaseReady = () => {
    // Estas variables son inicializadas en el script type="module" del HTML
    db = window.db;
    userId = window.userId;
    console.log("App ready. DB and User ID loaded.");
};

// Genera un código de sesión de 6 dígitos
function generateSessionId() {
    // Genera una cadena aleatoria y la convierte a 6 caracteres en mayúsculas
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}


// ===================================
// 1. CONFIGURACIÓN MEDIAPIPE
// ===================================

function onResults(results) {
    // En modo 'camera', el onResults solo EMITE datos
    if (currentMode !== 'camera') return;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handLandmarks = results.multiHandLandmarks;
        // La función de actualización ahora EMITE los datos
        emitHandData(handLandmarks[0]);
    } else {
        handLandmarks = [];
        handPoints.forEach(p => p.visible = false);
        // Enviar un estado 'no-hand' para que el receptor sepa que oculte los puntos
        emitHandData(null);
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

                    // Configuración visual para modo cámara
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
// 4. EMISIÓN Y RECEPCIÓN DE DATOS (Firestore)
// ===================================

/**
 * [EMISOR] Envía los datos de la mano a Firestore (Modo 'camera').
 * @param {Array} landmarks - 21 puntos clave de la mano o null si no se detecta.
 */
function emitHandData(landmarks) {
    if (!sessionRef) {
        // Esto solo debería pasar si el usuario sale del modo sin apagar la cámara
        console.warn("Session reference not set, cannot emit data.");
        return;
    }

    let data;
    if (landmarks) {
        // Reducimos la información solo a las coordenadas X, Y, Z (para ahorrar ancho de banda)
        const simplifiedLandmarks = landmarks.map(l => ({ x: l.x, y: l.y, z: l.z }));
        data = {
            landmarks: simplifiedLandmarks,
            timestamp: Date.now(),
            active: true
        };
    } else {
        data = { active: false, timestamp: Date.now() };
    }

    // setDoc está disponible gracias a la importación en el HTML
    setDoc(sessionRef, data, { merge: true }).catch(error => {
        console.error("Error al escribir en Firestore:", error);
    });
}

/**
 * [RECEPTOR] Configura un listener para recibir datos de la mano (Modo 'canvas').
 */
function setupRemoteListener() {
    if (!sessionRef) {
        console.error("Session reference not set.");
        return;
    }
    
    const statusElement = document.getElementById('sessionStatus');
    statusElement.textContent = `ESCUCHANDO SESIÓN: ${sessionRef.id}`;

    // onSnapshot está disponible gracias a la importación en el HTML
    onSnapshot(sessionRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const data = docSnapshot.data();

            if (data.active && data.landmarks) {
                // Hay datos de mano activos, los usamos para actualizar la visualización.
                statusElement.textContent = `CONTROL ACTIVO desde ${sessionRef.id}`;
                updateModelAndHandVisualization(data.landmarks);
            } else {
                // No hay mano activa. Ocultamos los puntos.
                statusElement.textContent = `ESPERANDO MANO en ${sessionRef.id}`;
                handPoints.forEach(p => p.visible = false);
            }
        } else {
            // El documento no existe o se eliminó.
            statusElement.textContent = `SESIÓN ${sessionRef.id} NO ENCONTRADA o FINALIZADA.`;
            handPoints.forEach(p => p.visible = false);
        }
    }, (error) => {
        console.error("Error al leer datos remotos:", error);
        statusElement.textContent = `ERROR DE CONEXIÓN.`;
    });
}

/**
 * [RECEPTOR / EMISOR] Aplica la lógica de mapeo (solo se usa para recibir datos remotos).
 */
function updateModelAndHandVisualization(landmarks) {
    if (!model || handPoints.length === 0 || !landmarks) return;

    // En el modo receptor (PC), desactivamos OrbitControls si se activa el control remoto
    if (controls) controls.enabled = false;

    // --- A. Mapeo de Posición para el Modelo (Control) ---
    const indexFingerTip = landmarks[8];
    
    // Mapeo (X sin invertir, Y invertida)
    const mappedX = indexFingerTip.x * 10 - 5; 
    const mappedY = (1 - indexFingerTip.y) * 10 - 5; 

    model.position.x = mappedX;
    model.position.y = mappedY;
    
    // --- B. Visualización de los Puntos de la Mano en 3D ---
    landmarks.forEach((landmark, index) => {
        const pointMesh = handPoints[index];
        
        // Mapeo de posición X e Y 
        const pointX = landmark.x * 10 - 5; 
        const pointY = (1 - landmark.y) * 10 - 5;
        
        // Ajuste de profundidad (Z)
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

    // Inicializa Three.js si es la primera vez
    if (!renderer) {
        initThreeJs();
    }
    
    // 1. Configuración del documento de sesión
    const appId = 'dual-controller-ar'; 
    // Usamos 'public/data' para que cualquier usuario pueda leer/escribir si tiene el ID de sesión
    const sessionCollection = collection(db, 'artifacts', appId, 'public', 'data', 'sessions');

    // 2. Lógica de inicio
    if (mode === 'camera') {
        // MODO EMISOR (TELÉFONO)
        
        // Si no hay código ingresado, crea uno nuevo. Si lo hay, úsalo.
        if (sessionId.length !== 6) {
             sessionId = generateSessionId(); 
            // setDoc creará el documento con el ID generado
            sessionRef = doc(sessionCollection, sessionId);
            statusElement.textContent = `CREANDO SESIÓN: ${sessionId}. CÁRGALA EN TU PC.`;
            
            // Mostrar el código al usuario
            setTimeout(() => { alert(`Tu código de sesión es: ${sessionId}. Cárgalo en tu PC.`); }, 500);
        } else {
             // Usa la sesión ingresada
            sessionRef = doc(sessionCollection, sessionId);
            statusElement.textContent = `USANDO SESIÓN: ${sessionId}.`;
        }
        
        document.getElementById('startScreen').style.display = 'none';
        setupCamera(); // Activa la cámara y MediaPipe (emisión)
        
        if(controls) controls.enabled = false;

    } else if (mode === 'canvas') {
        // MODO RECEPTOR (PC)
        
        if (sessionId.length !== 6) {
            alert("Debes ingresar un código de sesión de 6 dígitos para conectar la PC.");
            return;
        }

        sessionRef = doc(sessionCollection, sessionId);
        
        document.getElementById('startScreen').style.display = 'none';
        
        // Configura la visualización
        document.getElementById('videoElement').style.display = 'none';
        renderer.setClearColor(0x333333, 1);
        handPoints.forEach(p => p.visible = false);
        
        // Habilita OrbitControls (se usará si el control remoto está inactivo)
        if(controls) controls.enabled = true;

        // Inicia el listener remoto (recepción)
        setupRemoteListener();
    }
}
