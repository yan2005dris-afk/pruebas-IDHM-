const videoElement = document.getElementById('videoElement'); 
const canvasElement = document.getElementById('canvasElement');
const canvasCtx = canvasElement.getContext('2d');


/** 
 * Inicializacion de mediapipe y video
 * 
 */
//funcion axuiliar simple para detectar si el pulgar y el indice estan cerca
    function isPinching(landmarks){
        //tumbTip es la punta del dedo pulgar
        const thumbTip = landmarks[4];
        //indexTip es la punta del dedo indice
        const indexTip = landmarks[8];
        //usamos una disntancia euclidiana simple en 2D para determinar si los dedos estan cerca
        const distance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2)
        );
        return distance < 0.05; //umbral para considerar que estan haciendo pinza
    }

/**
 * Funcion llamada cuadno mediapipe procesa un nuevo frame
 */

function onResults (results) {
    //canvasCtx sirve para dibujar sobre el canvas HTML5
    //el .save() guarda el estado actual del canvas
    canvasCtx.save();
    //el .clearRect() limpia el canvas y pasamos por parametro las dimensiones del canvas
    canvasCtx.clearRect(0,0, canvasElement.width, canvasElement.height);
    // el .drawImage() dibuja la imagen procesada por mediapipe en el canvas
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    // verificamos si se detectaron manos en el frame actual 
    if(results.multiHandLandmarks){
        //solo trabajamos con la primera mano detectada
        const handLandmarks = results.multiHandLandmarks[0];

        if(handLandmarks){
            //drawConnectors dibuja las conexiones entre los puntos de referencia de la mano
            //el canvasCtx es el contexto del canvas donde se dibuja
            // handLandmarks son los puntos de referencia de la mano detectada
            //hand_connections son las conexiones entre los puntos de referencia
            //{color: '#FF0000', lineWidth: 5} son los parametros de estilo 
            drawConnectors(canvasCtx, handLandmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 5});
            
            //dranwLandmarks dibuja los puntos de referencia de la mano
            drawLandmarks(canvasCtx, handLandmarks, {color: '#FF0000', lineWidth: 2});
        
            //como prueba o ejemplo se envia la posicion normalizada del punto de la punta del dedo indice
            const indexTip = handLandmarks[8];

            const gestureData = {
                 //x e y son las coordenadas normalizadas del punto de la punta del dedo indice  
                x: indexTip.x,
                y: indexTip.y,
                //is_pinching es un booleano que indica si el usuario esta haciendo el gesto de pinza

                is_pinching: isPinching(handLandmarks)
            };
            //windows es el objeto global del navegador
            //sendGestureData es una funcion definida en 
            // otro archivo JS que recibe los datos del gesto
            // gestureData es el objeto con los datos del gesto
            window.sendGestureData(gestureData);
        
        
        }
    }
    //el .restore() restaura el estado del canvas guardado con .save()
    canvasCtx.restore();

/**
 * 3.- INICIO DE STREAMING Y CONFIGURACION
 */

//configuracion del objeto hands de mediapipe
//se instancia el objeto Hands de mediapipe 
// con los parametros necesarios para el procesamiento de manos
// locateFile es una funcion que indica donde se encuentran los archivos necesarios de mediapipe
const hands = new Hands({locateFile: (file)=>{
    //retorna la URL donde se encuentran los archivos de mediapipe
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`;
}});

hands.setOptions({
    /**
     * modelcomplexity: define la complejidad del modelo de deteccion de manos
     * 0: modelo ligero, 1: modelo medio, 2: modelo pesado
     * mas complejo es el modelo, mayor precision pero mayor uso de recursos
     * minDetectionConfidence: confianza minima para considerar que se ha detectado una mano
     * minTrackingConfidence: confianza minima para considerar que se esta siguiendo una mano
     */

    maxNumHands: 1, //numero maximo de manos a detectar
    modelComplexity: 1, //complejidad del modelo (0, 1, 2)
    minDetectionConfidence: 0.5, //confianza minima para la deteccion
    minTrackingConfidence: 0.5 //confianza minima para el seguimiento
});

//se crea un objeto Camera de mediapipe para manejar el video
hands.onResults(onResults);

//se accede a la camara del usuario usando la API de getUserMedia
//y se inicia el streaming de video
//nueva instancia de la camara de mediapipe recibe el elemento de video y las configuraciones
/*const camera = new Camera(videoElement, {
    //onFrame es una funcion que se llama en cada frame del video
    //async porque hands.send es una funcion asincrona, y esto significa que 
    // puede tomar tiempo procesar el frame y no bloquear el hilo principal
    //await es para esperar a que hands.send termine de procesar el frame antes de continuar
    // .send() envia el frame de video al objeto hands para su procesamiento
    // image: videoElement es el frame actual del video
    onFrame: async () => {

        await hands.send({image: videoElement});
    },
    //definimos las dimensiones del video
    width:640,
    height:480
});
*/

if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
    console.log("DEBUG: intentando acceder a la cámara...");
    navigator.mediaDevices.getUserMedia({video: true})
        .then(function(stream){ 
            console.log("DEBUG: ¡Éxito! Stream de video obtenido.");
            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = () => {
                videoElement.play();

                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;

                function processFrame(){
                    hands.send({image: videoElement});
                    requestAnimationFrame(processFrame);
                }
                videoElement.addEventListener('play', processFrame);
            };

        }).catch(function(err){
            console.error("CÁMARA CRÍTICO: Fallo al solicitar la cámara. Nombre del error:", err.name);
            console.error("Detalles:", err);
            alert("No se pudo acceder a la cámara. Por favor, verifica los permisos y que la cámara esté conectada.");
            alert(`Error de Cámara: ${err.name}. Tu navegador no solicitará permisos.`);
        });   
}else{
    console.error("CÁMARA CRÍTICO: El navegador no soporta la API getUserMedia.");
    alert("tu navegador no soporta la API de la cámara");
}


}