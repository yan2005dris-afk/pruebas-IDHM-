
//se cambia la URL del servidor por la del servidor RENDER/HEROKU
//para desarollo local, se usa:
const SOCKET_SERVER_URL = 'http://localhost:3000';

//INICIALIZA LA CONEXION CON EL SERVIDOR DE GESTOS
const socket = io(SOCKET_SERVER_URL);

socket.on('connect', () => {
    console.log(`Conexión establecida con el servidor de gestos. ID: ${socket.id}`);
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor de gestos');
});

/**
 * Función para enviar datos de gestos (Llamada desde camera-logic.js)
 * @param {Object} data - Objeto con las coordenadas de la mano o el gesto detectado.
 */
function sendGestureData(data) {
    if (socket.connected) {
        socket.emit('gesture_data', data); // <-- Emite el evento al servidor
    } else {
        console.warn('Socket no conectado. No se puede enviar el gesto.');
    }
}

/**
 * Configuración del receptor de gestos (Usada en lienzo.html)
 * @param {function} callback - Función que se ejecuta al recibir datos de gestos.
 */
function setupGestureListener(callback) {
    socket.on('gesture_data', (data) => {
        callback(data); // <-- Llama a la función de manipulación visual en lienzo.html
    });
}
    window.sendGestureData = sendGestureData;
    window.setupGestureListener = setupGestureListener; 

