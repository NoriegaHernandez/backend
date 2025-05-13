
// server/server.js - Archivo principal del servidor
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require('./config/db');

// Importar rutas
const authRoutes = require('./routes/auth');
const coachRoutes = require('./routes/coach');
const clientRoutes = require('./routes/client');
const adminRoutes = require('./routes/admin'); // Añadir esta línea
// Importar las rutas de membresía para clientes
const clientMembresiasRoutes = require('./routes/clientMembresiasRoutes');

// Inicializar app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Adaptar a tu URL de Vite
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization']
}));
app.use(express.json());

// Probar conexión a la base de datos
connectDB()
  .then(() => console.log('Conexión a la base de datos establecida'))
  .catch(err => console.error('Error de conexión a la base de datos:', err));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes); // Añadir esta línea
app.use('/api', clientMembresiasRoutes);

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ message: 'API del sistema de gimnasio funcionando correctamente' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
});