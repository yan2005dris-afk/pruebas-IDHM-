// /public/js/ar-main.js
/**
 * Aplicación de Realidad Aumentada de Manos con MediaPipe y Three.js
 * Refactorizado a una estructura de Clase (basado en el ejemplo CalaveraApp)
 */

// --- 1. IMPORTACIONES ---
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
//MULTIMANOS
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import {
  HandLandmarker, 
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js";

class HandArApp {

    /**
     * Inicializa la aplicación de AR
     */
    constructor() {
       // 
       this.MAX_HANDS = 2;
       
        // MediaPipe
        this.handLandmarker = undefined;
        this.webcamRunning = false;
        this.lastVideoTime = -1;

        // Three.js
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.model = null;
        this.mixer = null;
        this.clock = new THREE.Clock();

        this.modelPool = []; // Pool de calaveras
        this.mixerPool = []; // Pool de mixers de animación
        
        // Lógica de Cámara
        this.videoDevices = [];
        this.currentDeviceIndex = 0;
        this.currentStream = null;
        this.isFrontCamera = true;

        // Elementos DOM
        this.video = document.getElementById("webcam");
        this.canvas = document.getElementById("ar-canvas");
        
        // Stats (del ejemplo de CalaveraApp)
        this.stats = {
            fps: 0,
            frameCount: 0,
            lastTime: performance.now()
        };
        this.fpsCounterEl = document.getElementById('fps-counter');
        this.trianglesCounterEl = document.getElementById('triangles-counter');

        // Iniciar la aplicación
        this.init();
    }

    /**
     * Gestor principal de inicialización asíncrona
     */
    async init() {
        try {
            console.log("Iniciando HandArApp...");
            await this.setupMediaPipe();
            this.setupThreeJS();
            await this.loadModel();
            await this.getCameraDevices();
            this.setupEventListeners();
            
            // Iniciar la cámara (esto disparará el evento 'loadeddata' que inicia el bucle)
            this.startCamera();
            console.log("Aplicación inicializada.");

        } catch (error) {
            console.error('Error fatal en inicialización:', error);
            alert('Error al cargar la aplicación. Revisa la consola.');
        }
    }

    // --- 4. MÓDULOS DE CONFIGURACIÓN ---

    async setupMediaPipe() {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: this.MAX_HANDS
        });
        console.log(`HandLandmarker listo (detectando ${this.MAX_HANDS} manos).`);
    }

    async getCameraDevices() {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (e) {
            console.error("Permiso de cámara denegado:", e);
            alert("Necesitas dar permiso a la cámara para continuar.");
            return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        this.videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (this.videoDevices.length === 0) {
            alert("No se encontraron cámaras.");
        } else {
            console.log("Cámaras encontradas:", this.videoDevices);

            const rearCamIndex = this.videoDevices.findIndex(device =>
                device.label.toLowerCase().includes('back') ||
                device.label.toLowerCase().includes('trasera')
            );

            if (rearCamIndex !== -1) {
                console.log("Cámara trasera encontrada, usándola primero.");
                this.currentDeviceIndex = rearCamIndex;
                this.isFrontCamera = false;
            } else {
                console.log("No se encontró cámara trasera, usando la frontal/default.");
                this.currentDeviceIndex = 0;
                this.isFrontCamera = true;
            }

            if (this.videoDevices.length < 2) {
                document.getElementById('switch-cam-btn').style.display = 'none';
            }
        }
    }

    setupThreeJS() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.0001, 100);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);
        console.log("Three.js listo.");
    }

async loadModel() {
    return new Promise((resolve, reject) =>     {
        const loader = new GLTFLoader();
        loader.load('/models/modelo.glb', (gltf) => {
            
            console.log("Modelo base cargado. Creando pool...");
            
            // Preparamos las animaciones si existen
            const animations = gltf.animations;

            for (let i = 0; i < this.MAX_HANDS; i++) {
                // Clonamos el modelo usando SkeletonUtils
                const newModel = SkeletonUtils.clone(gltf.scene);
                
                const initialScale = 0.05; // El valor que te funcionó
                newModel.scale.set(initialScale, initialScale, initialScale);
                newModel.visible = false; // Oculto por defecto
                
                this.scene.add(newModel);
                this.modelPool.push(newModel); // Añadir al pool de modelos
                
                // Clonar animaciones para este modelo
                if (animations && animations.length) {
                    const newMixer = new THREE.AnimationMixer(newModel);
                    const action = newMixer.clipAction(animations[0]);
                    action.play();
                    this.mixerPool.push(newMixer); // Añadir al pool de mixers
                }
            }
            
            console.log(`Pool de ${this.MAX_HANDS} modelos creado.`);
            
            // Actualizar stats (ahora suma los triángulos de todos los clones)
            this.updateTriangleStats();
            
            resolve();
        }, undefined, reject);
    });
}

    setupEventListeners() {
        // Botón de cambiar cámara
        document.getElementById('switch-cam-btn').addEventListener('click', () => {
            if (this.videoDevices.length < 2) return;
            this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.videoDevices.length;
            console.log("Cambiando a cámara:", this.videoDevices[this.currentDeviceIndex].label);
            this.startCamera(); // Reiniciar la cámara
        });

        // Listener de video cargado
        this.video.addEventListener("playing", () => {
            this.updateMirrorEffect();
            
            if (this.webcamRunning) {
                this.onWindowResize(); // Solo reajustar si ya corría
                return;
            }
            
            console.log("Webcam iniciada y datos cargados.");
            this.webcamRunning = true;
            this.onWindowResize(); // Ajustar tamaño
            
            // ¡INICIAR EL BUCLE DE RENDER!
            this.predictWebcam();
        });
        
        // Listener de redimensionamiento de ventana
        window.addEventListener('resize', () => this.onWindowResize());
        
        console.log("Event Listeners listos.");
    }

    // --- 5. MÉTODOS DE CÁMARA Y LÓGICA ---

    startCamera() {
        if (this.videoDevices.length === 0) {
            console.error("No hay cámaras para iniciar.");
            return;
        }
        
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
        }

        const deviceId = this.videoDevices[this.currentDeviceIndex].deviceId;
        const currentDevice = this.videoDevices[this.currentDeviceIndex];
        
        this.isFrontCamera = !currentDevice.label.toLowerCase().includes('back') && !currentDevice.label.toLowerCase().includes('trasera');
        console.log(`Cambiando a cámara: ${currentDevice.label}. ¿Es frontal? ${this.isFrontCamera}`);

        const constraints = {
            video: {
                deviceId: { exact: deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
            this.currentStream = stream;
            this.video.srcObject = stream;
            this.video.play();
            this.updateMirrorEffect();
        }).catch((err) => console.error("Error al iniciar cámara:", err));
    }

    updateMirrorEffect() {
        if (this.isFrontCamera) {
            this.video.classList.add('mirrored');
            //this.canvas.classList.add('mirrored');
        } else {
            this.video.classList.remove('mirrored');
            this.canvas.classList.remove('mirrored');
        }
    }

    onWindowResize() {
        const w = this.video.videoWidth;
        const h = this.video.videoHeight;
        
        // Si el video no tiene dimensiones, no hagas nada
        if (w === 0 || h === 0) return; 

        // 1. Ajusta la resolución interna del canvas
        // (Esto es lo que estabas haciendo, está perfecto)
        this.renderer.setSize(w, h);
        
        // 2. Ajusta el aspect ratio de la cámara 3D
        // para que coincida EXACTAMENTE con la proporción del video
        this.camera.aspect = w / h;
        
        // 3. Aplica los cambios a la cámara
        this.camera.updateProjectionMatrix();

        // 4. ¡ELIMINAMOS TODO EL CÓDIGO QUE MANEJABA EL 'container' CSS!
        // Dejamos que el CSS (object-fit: cover) haga su trabajo.
    }

    // --- 6. BUCLE PRINCIPAL (ANIMATE) ---

    async predictWebcam() {
        // Bucle continuo
        requestAnimationFrame(() => this.predictWebcam());

        // ¡CORRECCIÓN 1! Comprobar el POOL, no this.model
        if (!this.webcamRunning || this.modelPool.length === 0 || !this.handLandmarker) {
            return;
        }

        const startTimeMs = performance.now();
        
        // Actualizar FPS (bonus)
        this.updateFpsStats(startTimeMs);
        
        if (this.lastVideoTime !== this.video.currentTime && this.video.videoWidth > 0) {
            this.lastVideoTime = this.video.currentTime;
            
            const results = await this.handLandmarker.detectForVideo(this.video, startTimeMs);
            this.renderer.clear();

            // --- ¡CORRECCIÓN 2! Lógica de Bucle Multi-Mano ---

            // 1. Ocultar todos los modelos del pool
            for (const model of this.modelPool) {
                model.visible = false;
            }

            // 2. Recorrer las manos detectadas
            if (results.landmarks && results.landmarks.length > 0) {
                
                // Iteramos sobre CADA mano detectada (i = 0, i = 1, ...)
                for (let i = 0; i < results.landmarks.length; i++) {
                    const landmarks = results.landmarks[i];
                    
                    const handedness = results.handednesses[i][0].categoryName;
                    // Obtenemos el modelo correspondiente (mano 0 -> modelo 0, mano 1 -> modelo 1)
                    const model = this.modelPool[i]; 

                    // Aplicamos la lógica A ESE MODELO
                    if (this.isHandPalmUp(landmarks)) {
                        model.visible = true; // <-- Usamos model (minúscula)

                        const palmPos = landmarks[9];
                        const wristPos = landmarks[0];
                    
                        let x = palmPos.x;
                        let y = palmPos.y;
                        //let z = palmPos.z;

                        // Si es cámara frontal, reflejar X
                        if (this.isFrontCamera) x = 1 - x;

                        // Convertir a espacio de Three.js
                        x = (x - 0.5) * 2;
                        y = -(y - 0.5) * 2;

                        // Calcular posición 3D "flotante" cerca de la cámara
                        const zNdc = -0.1;
                        const vector = new THREE.Vector3(x, y, zNdc);
                        vector.unproject(this.camera);
                        model.position.copy(vector);

                      // --- 2. ESCALA (¡NUEVA LÓGICA!) ---
                        // Medimos el tamaño de la mano en la pantalla (distancia 2D muñeca-palma)
                        const dx = palmPos.x - wristPos.x;
                        const dy = palmPos.y - wristPos.y;
                        // Distancia euclidiana (qué tan grande se ve la mano)
                        const handSize = Math.sqrt(dx * dx + dy * dy); 
                        
                        // ¡ESTE ES EL NÚMERO CLAVE PARA AJUSTAR!
                        // Convierte el "tamaño de mano" (ej: 0.15) a la "escala del modelo"
                        const scaleMultiplier = 0.015 // <-- ¡AJUSTA ESTE NÚMERO! (Prueba 0.3, 0.5, 1.0)

                        const scale = handSize * scaleMultiplier;
                        model.scale.set(scale, scale, scale);


                        // --- 3. ROTACIÓN (¡NUEVA LÓGICA!) ---
                        // No usar lookAt(). Causa "roll" (giro inestable).
                        // Ponemos una rotación fija para que mire a la cámara.
                        
                        model.rotation.set(0, 0, 0); // Resetea la rotación
                        
                        // Ajusta esto basado en cómo fue exportado tu modelo GLB.
                        // La meta es que la "cara" apunte al eje +Z (hacia ti).
                        // Viendo tu foto del teléfono (de lado), la cara debe estar en el eje X del modelo.
                        
                        // PRUEBA 1 (Girar -90 grados en Y):
                        model.rotation.y = -Math.PI / 2;
                        /*

                        // --- Rotación ---
                        // 1. Rotación base: "Levantar" la calavera
                        model.rotation.x = Math.PI / 2; // 90 grados en X
                        
                        // 2. Rotación Y: (Tu rotación personalizada para que mire al frente)
                        if (handedness === "Left") {
                            model.rotation.y = (3 * Math.PI) / 2; // 270 grados
                        } else { // handedness === "Right"
                            model.rotation.y = ( Math.PI) / 2; // 90 grados
                        }

                        
                        // 3. Rotación Z: Alinear con los dedos
                        const wrist = landmarks[0];
                        const deltaX_world = this.isFrontCamera ? (palmPos.x - wrist.x) * -1 : (palmPos.x - wrist.x);
                        const deltaY_world = palmPos.y - wrist.y;
                        const angle = Math.atan2(deltaY_world, deltaX_world) + (Math.PI / 2);
                        
                        model.rotation.z = angle; // <-- Usamos model
                        */
                    }
                    // Si isHandPalmUp es falso, el 'model' [i] se queda invisible.
                }
            }
            
            // --- FIN LÓGICA MULTI-MANO ---
            
            // ¡CORRECCIÓN 3! Actualizar TODAS las animaciones en el POOL
            const delta = this.clock.getDelta();
            for (const mixer of this.mixerPool) {
                mixer.update(delta);
            }
            
            // 4. Renderizar la escena (solo se hace 1 vez)
            this.renderer.render(this.scene, this.camera);
        }
    }

    // --- 7. FUNCIONES DE GESTOS (Helpers) ---

    isHandPalmUp(landmarks) {
        const palmBase = landmarks[9];
        const middleTip = landmarks[12];
        const pinkyTip = landmarks[20];
        const middleDiff = palmBase.y - middleTip.y;
        const pinkyDiff = palmBase.y - pinkyTip.y;
        const palmUpThreshold = 0.05;
        return middleDiff > palmUpThreshold && pinkyDiff > palmUpThreshold;
    }
    
    // --- 8. FUNCIONES DE STATS (Bonus del ejemplo) ---

    updateFpsStats(now) {
        this.stats.frameCount++;
        if (now - this.stats.lastTime >= 1000) {
            this.stats.fps = Math.round((this.stats.frameCount * 1000) / (now - this.stats.lastTime));
            if (this.fpsCounterEl) {
                this.fpsCounterEl.textContent = this.stats.fps;
            }
            this.stats.frameCount = 0;
            this.stats.lastTime = now;
        }
    }

   updateTriangleStats() {
        if (this.modelPool.length > 0 && this.trianglesCounterEl) {
            let totalTriangles = 0;
            
            // Recorremos el pool y sumamos los triángulos de cada modelo
            for (const model of this.modelPool) {
                model.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        const geometry = child.geometry;
                        if (geometry.index) {
                            totalTriangles += geometry.index.count / 3;
                        } else {
                            totalTriangles += geometry.attributes.position.count / 3;
                        }
                    }
                });
            }
            // El total será (triángulos de 1 modelo) * MAX_HANDS
            this.trianglesCounterEl.textContent = Math.floor(totalTriangles);
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.handArApp = new HandArApp();
});
