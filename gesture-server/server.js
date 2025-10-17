// gesture-server/server.js

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
// Configuración de CORS para permitir la conexión desde tu GitHub Pages
const io = socketIo(server, {
    cors: {
        // En producción, aquí debería ir la URL específica de tu GitHub Pages.
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Manejo de conexiones Socket.IO
io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    // 1. EL CLIENTE 'CAMERA' EMITE 'gesture_data'
    socket.on('gesture_data', (data) => {
        // 2. EL SERVIDOR RETRANSMITE A TODOS (excepto al emisor)
        // Esto envía los datos al 'lienzo.html'
        socket.broadcast.emit('gesture_data', data);
    });

    socket.on('disconnect', () => {
        console.log(`Cliente desconectado: ${socket.id}`);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor de gestos escuchando en http://localhost:${PORT}`);
});