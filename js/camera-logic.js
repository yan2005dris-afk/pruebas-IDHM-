// pruebas-IDHM-/js/camera-logic.js

const videoElement = document.getElementById('videoElement'); 
const canvasElement = document.getElementById('canvasElement');
const canvasCtx = canvasElement.getContext('2d');

console.log("DEBUG INICIO: El script camera-logic.js se cargó correctamente.");


// -----------------------------------------------------------------
// FUNCIÓN AUXILIAR: isPinching (MOVIDA AL ALCANCE GLOBAL)
// -----------------------------------------------------------------

/**
 * Función auxiliar simple para detectar si el pulgar y el índice están cerca
 * @param {Array<Object>} landmarks - Puntos de referencia de la mano de MediaPipe.
 */
function isPinching(landmarks){
    const thumbTip = landmarks[4]; 
    const indexTip = landmarks[8]; 
    
    // Calcula la distancia euclidiana entre la punta del pulgar y el índice.
    const distance = Math.sqrt(
        Math.pow(thumbTip.x - indexTip.x, 2) +
        Math.pow(thumbTip.y - indexTip.y, 2)
    );
    // Retorna true si la distancia es menor que el umbral (0.05 es un buen punto de partida).
    return distance < 0.05; 
}


// -----------------------------------------------------------------
// FUNCIÓN PRINCIPAL DE MEDIA PIPE: PROCESAMIENTO DE FRAME
// -----------------------------------------------------------------

/**
 * Función llamada cuando MediaPipe procesa un nuevo frame.
 */
function onResults (results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks) {
        // Solo trabajamos con la primera mano detectada
        const handLandmarks = results.multiHandLandmarks[0];

        if (handLandmarks) {
            // Dibuja las conexiones y los puntos de referencia
            drawConnectors(canvasCtx, handLandmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 5});
            drawLandmarks(canvasCtx, handLandmarks, {color: '#FF0000', lineWidth: 2});
        
            // Envía la posición normalizada del punto de la punta del dedo índice
            const indexTip = handLandmarks[8];

            const gestureData = {
                // Coordenadas normalizadas (0 a 1)
                x: indexTip.x,
                y: indexTip.y,
                // Llama a la función isPinching (ahora accesible globalmente)
                is_pinching: isPinching(handLandmarks) 
            };
            
            // Envía los datos al servidor Socket.IO (definido en app.js)
            window.sendGestureData(gestureData);
        }
    }
    canvasCtx.restore();
}


// -----------------------------------------------------------------
// 3. INICIO DE STREAMING Y CONFIGURACIÓN (MEDIAPIPE)
// -----------------------------------------------------------------

// Configuración del objeto hands de mediapipe
const hands = new Hands({locateFile: (file)=>{
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
}});

hands.setOptions({
    maxNumHands: 1, 
    modelComplexity: 1, 
    minDetectionConfidence: 0.5, 
    minTrackingConfidence: 0.5 
});

// Asigna la función de resultados
hands.onResults(onResults);


// -----------------------------------------------------------------
// INICIO DE LA CÁMARA (WebRTC)
// -----------------------------------------------------------------

if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    console.log("DEBUG: intentando acceder a la cámara...");
    
    // Solicitud de permisos
    navigator.mediaDevices.getUserMedia({video: true})
        .then(function(stream){ 
            console.log("DEBUG: ¡Éxito! Stream de video obtenido.");
            videoElement.srcObject = stream;
            
            videoElement.onloadedmetadata = () => {
                videoElement.play();

                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;

                // Loop principal para enviar frames a MediaPipe
                function processFrame(){
                    hands.send({image: videoElement});
                    requestAnimationFrame(processFrame);
                }
                videoElement.addEventListener('play', processFrame);
            };

        }).catch(function(err){
            // Captura de errores de permiso o dispositivo no encontrado
            console.error("CÁMARA CRÍTICO: Fallo al solicitar la cámara. Nombre del error:", err.name);
            console.error("Detalles:", err);
            
            // Alerta amigable para el usuario
            alert(`Error de Cámara: ${err.name}. Verifica que la cámara esté libre y que has concedido permisos.`);
        }); 
} else {
    // Bloque ELSE CORREGIDO para navegadores muy antiguos (no usa 'err')
    console.error("CÁMARA CRÍTICO: El navegador no soporta la API getUserMedia.");
    alert("Tu navegador no soporta la API de la cámara");
}