
// // // server/server.js - Archivo principal del servidor
// // const express = require('express');
// // const cors = require('cors');
// // require('dotenv').config();
// // const { connectDB } = require('./config/db');

// // // Importar rutas
// // const authRoutes = require('./routes/auth');
// // const coachRoutes = require('./routes/coach');
// // const clientRoutes = require('./routes/client');
// // const adminRoutes = require('./routes/admin'); // Añadir esta línea
// // // Importar las rutas de membresía para clientes
// // const clientMembresiasRoutes = require('./routes/clientMembresiasRoutes');

// // // Inicializar app
// // const app = express();
// // const PORT = process.env.PORT || 5000;

// // // Middleware
// // // Middleware para CORS
// // app.use(express.json());
// // app.use(express.urlencoded({ extended: true })); // Añade esto también

// // app.use(cors({
// //   origin: [
// //     'http://localhost:5173',  // Para desarrollo local
// //     'https://frontend-e7n0.onrender.com'  // Tu frontend en Render
// //   ],
// //   methods: ['GET', 'POST', 'PUT', 'DELETE'],
// //   allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization']
// // }));
// // // Probar conexión a la base de datos
// // connectDB()
// //   .then(() => console.log('Conexión a la base de datos establecida'))
// //   .catch(err => console.error('Error de conexión a la base de datos:', err));


// // // Rutas
// // app.use('/api/auth', authRoutes);
// // app.use('/api/coach', coachRoutes);
// // app.use('/api/client', clientRoutes);
// // app.use('/api/admin', adminRoutes); // Añadir esta línea
// // app.use('/api', clientMembresiasRoutes);

// // // Ruta de prueba
// // app.get('/api/test', (req, res) => {
// //   res.json({ message: 'API del sistema de gimnasio funcionando correctamente' });
// // });

// // // Iniciar servidor
// // app.listen(PORT, () => {
// //   console.log(`Servidor ejecutándose en el puerto ${PORT}`);
// // });


// // server/server.js - Archivo principal del servidor
// const express = require('express');
// const cors = require('cors');
// require('dotenv').config();
// const { connectDB } = require('./config/db');

// // Importar rutas
// const authRoutes = require('./routes/auth');
// const coachRoutes = require('./routes/coach');
// const clientRoutes = require('./routes/client');
// const adminRoutes = require('./routes/admin');
// const clientMembresiasRoutes = require('./routes/clientMembresiasRoutes');

// // Inicializar app
// const app = express();
// const PORT = process.env.PORT || 5000;

// // Configuración de CORS más permisiva para depuración
// app.use(cors({
//   origin: ['http://localhost:5173', 'https://frontend-e7n0.onrender.com'],
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'],
//   credentials: true // Importante si usas cookies
// }));

// // Middleware para parsear JSON y URL-encoded (ANTES de las rutas)
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Ruta de prueba para debugging
// app.post('/api/test-body', (req, res) => {
//   console.log('Test body - Headers:', req.headers);
//   console.log('Test body - Body completo:', req.body);
//   res.json({ 
//     receivedBody: req.body,
//     hasBody: !!req.body,
//     contentType: req.headers['content-type']
//   });
// });

// // Probar conexión a la base de datos
// connectDB()
//   .then(() => console.log('Conexión a la base de datos establecida'))
//   .catch(err => console.error('Error de conexión a la base de datos:', err));

// // Rutas
// app.use('/api/auth', authRoutes);
// app.use('/api/coach', coachRoutes);
// app.use('/api/client', clientRoutes);
// app.use('/api/admin', adminRoutes);
// app.use('/api', clientMembresiasRoutes);

// // Ruta de prueba
// app.get('/api/test', (req, res) => {
//   res.json({ message: 'API del sistema de gimnasio funcionando correctamente' });
// });

// // Iniciar servidor
// app.listen(PORT, () => {
//   console.log(`Servidor ejecutándose en el puerto ${PORT}`);
// });

// server/server.js - Archivo principal del servidor
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { connectDB } = require('./config/db');

// Importar rutas
const authRoutes = require('./routes/auth');
const coachRoutes = require('./routes/coach');
const clientRoutes = require('./routes/client');
const adminRoutes = require('./routes/admin');
const clientMembresiasRoutes = require('./routes/clientMembresiasRoutes');

// Inicializar app
const app = express();
const PORT = process.env.PORT || 5000;

// Logging middleware para depuración
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  // Log del origen para depurar problemas CORS
  if (req.headers.origin) {
    console.log(`Origen de la solicitud: ${req.headers.origin}`);
  }
  next();
});

// Configuración simple de CORS - permitir todas las solicitudes
app.use(cors());

// Middleware para parsear JSON y URL-encoded (ANTES de las rutas)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de verificación directa con redirección al frontend
// IMPORTANTE: Esta ruta debe estar ANTES de las demás rutas de API
app.get('/api/auth/verify-email-direct/:token', async (req, res) => {
  const { token } = req.params;
  
  console.log('Verificación directa para token:', token.substring(0, 10) + '...');
  
  try {
    // Importar sql desde la configuración de la base de datos
    const { connectDB, sql } = require('./config/db');
    const pool = await connectDB();
    
    // Buscar el usuario con el token proporcionado
    const result = await pool.request()
      .input('token', sql.VarChar, token)
      .query(`
        SELECT id_usuario, email, token_expires, estado
        FROM Usuarios 
        WHERE verification_token = @token
      `);
    
    if (result.recordset.length === 0) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?verificationError=true&message=${encodeURIComponent('Token no encontrado o ya utilizado')}`);
    }
    
    const user = result.recordset[0];
    
    // Verificar si la cuenta ya está activa
    if (user.estado === 'activo') {
      console.log('La cuenta ya está activa para el usuario en verificación directa:', user.email);
      return res.redirect(`${process.env.FRONTEND_URL}/login?alreadyVerified=true`);
    }
    
    // Verificar si el token ha expirado
    const now = new Date();
    const tokenExpires = new Date(user.token_expires);
    
    if (now > tokenExpires) {
      console.log('Token expirado en verificación directa:', user.email);
      return res.redirect(`${process.env.FRONTEND_URL}/login?verificationError=true&message=${encodeURIComponent('Token expirado')}`);
    }
    
    // Actualizar el estado del usuario a 'activo'
    await pool.request()
      .input('id_usuario', sql.Int, user.id_usuario)
      .query(`
        UPDATE Usuarios 
        SET 
          estado = 'activo',
          verification_token = NULL,
          token_expires = NULL
        WHERE id_usuario = @id_usuario
      `);
    
    console.log('Usuario activado correctamente en verificación directa:', user.email);
    
    // Redirigir al usuario al frontend con un mensaje de éxito
    return res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
    
  } catch (error) {
    console.error('Error en verificación directa:', error);
    console.error(error.stack);
    return res.redirect(`${process.env.FRONTEND_URL}/login?verificationError=true&message=${encodeURIComponent('Error del servidor')}`);
  }
});

// Ruta de prueba para debugging
app.post('/api/test-body', (req, res) => {
  console.log('Test body - Headers:', req.headers);
  console.log('Test body - Body completo:', req.body);
  res.json({ 
    receivedBody: req.body,
    hasBody: !!req.body,
    contentType: req.headers['content-type']
  });
});

// Probar conexión a la base de datos
connectDB()
  .then(() => console.log('Conexión a la base de datos establecida'))
  .catch(err => console.error('Error de conexión a la base de datos:', err));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/client', clientRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', clientMembresiasRoutes);

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API del sistema de gimnasio funcionando correctamente',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'No configurado'
  });
});

// Manejador para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ 
    message: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Middleware para manejo de errores generales
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({
    message: 'Error en el servidor',
    error: process.env.NODE_ENV === 'production' ? 'Error interno' : err.message
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`URL del frontend: ${process.env.FRONTEND_URL || 'No configurado'}`);
});