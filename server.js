const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir archivos estáticos desde la carpeta 'public'
//app.use('/mediapipe', express.static(path.join(__dirname, '/node_modules/@mediapipe/tasks-vision')));

app.use(express.static('public'));

app.use(express.static(path.join(__dirname, 'public')));

// Rutas principales
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/camera', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'camera.html'));
});

app.get('/slides', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'slides.html'));
});

// Lógica de Socket.io
io.on('connection', (socket) => {
    console.log('✅ Cliente conectado:', socket.id);
    
    // Notificar a otros clientes sobre la nueva conexión
    socket.broadcast.emit('user-connected', socket.id);

    // Escuchar eventos de gestos desde 'camera.html'
    socket.on('gesture-data', (data) => {
        console.log('🤖 Gesto recibido:', data);
        // Retransmitir esos datos a todos los clientes excepto el emisor
        socket.broadcast.emit('control-object', data);
    });

    // Escuchar eventos de control manual desde el cliente
    socket.on('manual-control', (data) => {
        console.log('🎮 Control manual:', data);
        socket.broadcast.emit('control-object', data);
    });

    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
        socket.broadcast.emit('user-disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    console.log(`📷 Página de cámara: http://localhost:${PORT}/camera`);
    console.log(`🎬 Página de diapositivas: http://localhost:${PORT}/slides`);
});




/*
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Lógica de Socket.io
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado:', socket.id);

  // Escuchar eventos de gestos desde 'camera.html'
  socket.on('gesture-data', (data) => {
    // Retransmitir esos datos a 'lienzo.html'
    // 'socket.broadcast.emit' envía a todos MENOS al que lo envió
    socket.broadcast.emit('control-object', data);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
*/