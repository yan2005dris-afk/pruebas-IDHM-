let videoElement;

function setupCamera() {
    videoElement = document.getElementById('videoElement');
    
    // Pide acceso a la cámara de video
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }) // Intenta usar la cámara trasera en móvil
            .then(function(stream) {
                videoElement.srcObject = stream;
                // Una vez cargado el video, inicializa la escena 3D
                videoElement.onloadedmetadata = function() {
                    videoElement.play();
                    initThreeJs();
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


//segunda parte 

let scene, camera, renderer, model;

function initThreeJs() {
    const container = document.getElementById('container');
    
    // 1. Configurar la Escena y la Cámara
    scene = new THREE.Scene();
    
    // Usamos la misma relación de aspecto que el video/ventana
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Cámara de Perspectiva (similar a cómo ve el ojo humano)
    camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5; // Posición inicial para ver el modelo
    
    // 2. Configurar el Renderizador (Renderer)
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true // ESENCIAL: El fondo debe ser transparente para ver el video
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.id = 'threeCanvas'; // Asignar el ID del CSS
    container.appendChild(renderer.domElement);
    
    // 3. Añadir Luces (Necesarias para que el GLB sea visible)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Luz suave
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);
    
    // 4. Cargar el Modelo .glb
    const loader = new THREE.GLTFLoader();
    // Reemplaza 'path/to/your/model.glb' con la ruta real de tu archivo
    loader.load(
        'path/to/your/model.glb', 
        function (gltf) {
            model = gltf.scene;
            model.scale.set(1, 1, 1); // Ajusta la escala si es necesario
            model.position.set(0, 0, 0); // Posiciona el modelo
            scene.add(model);
            console.log("Modelo GLB cargado y añadido a la escena.");
        },
        // Opcional: Función para progreso (muestra un porcentaje de carga)
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% cargando');
        },
        // Opcional: Función para errores
        function (error) {
            console.error('An error happened loading the GLB model', error);
        }
    );
    
    // Manejar el redimensionamiento de la ventana
    window.addEventListener('resize', onWindowResize, false);
    
    // Iniciar el bucle de renderizado
    animate();
}

// Función de Redimensionamiento
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Bucle de Renderizado Principal
function animate() {
    requestAnimationFrame(animate);

    // Opcional: Rotación de ejemplo para ver el modelo
    if (model) {
        model.rotation.y += 0.005; 
    }

    renderer.render(scene, camera);
}

// Iniciar la aplicación
setupCamera();
