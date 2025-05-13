

// server/routes/coach.js
const express = require('express');
const router = express.Router();
const { connectDB, sql } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Middleware para verificar rol de administrador
const adminMiddleware = (req, res, next) => {
  if (req.user.type !== 'administrador') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador' });
  }
  next();
};

// Middleware para verificar rol de coach
const coachMiddleware = (req, res, next) => {
  if (req.user.type !== 'coach') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de coach' });
  }
  next();
};

// Ruta de prueba
router.get('/test', (req, res) => {
  res.json({ message: 'API de coach funcionando correctamente' });
});

// Obtener todos los coaches (Admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    
    const result = await pool.request()
      .query(`
        SELECT 
          c.id_coach,
          u.id_usuario,
          u.nombre,
          u.email,
          u.telefono,
          c.especialidad,
          c.certificaciones,
          c.biografia,
          c.horario_disponible,
          u.estado
        FROM 
          Coaches c
        JOIN 
          Usuarios u ON c.id_usuario = u.id_usuario
        ORDER BY 
          u.nombre
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener coaches:', error);
    res.status(500).json({ message: 'Error al obtener coaches' });
  }
});

// Crear un nuevo coach (Admin)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { 
    nombre, 
    email, 
    password, 
    telefono, 
    especialidad, 
    certificaciones, 
    biografia,
    horario 
  } = req.body;
  
  // Validaciones básicas
  if (!nombre || !email || !password || !especialidad) {
    return res.status(400).json({ 
      message: 'Nombre, email, contraseña y especialidad son campos obligatorios' 
    });
  }
  
  try {
    const pool = await connectDB();
    
    // Verificar si el email ya existe
    const emailCheck = await pool.request()
      .input('email', sql.VarChar, email)
      .query('SELECT email FROM Usuarios WHERE email = @email');
    
    if (emailCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }
    
    // Iniciar transacción
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      
      // 1. Insertar usuario
      const userInsert = await new sql.Request(transaction)
        .input('nombre', sql.VarChar, nombre)
        .input('email', sql.VarChar, email)
        .input('password', sql.VarChar, password)
        .input('telefono', sql.VarChar, telefono || null)
        .input('tipo_usuario', sql.VarChar, 'coach')
        .query(`
          INSERT INTO Usuarios (
              nombre, 
              email, 
              contraseña, 
              telefono, 
              tipo_usuario, 
              fecha_registro, 
              estado
          )
          VALUES (
              @nombre, 
              @email, 
              @password, 
              @telefono,
              @tipo_usuario,
              GETDATE(),
              'activo'
          );
          
          SELECT SCOPE_IDENTITY() AS id_usuario;
        `);
      
      const userId = userInsert.recordset[0].id_usuario;
      
      // 2. Insertar coach
      const coachInsert = await new sql.Request(transaction)
        .input('id_usuario', sql.Int, userId)
        .input('especialidad', sql.VarChar, especialidad)
        .input('certificaciones', sql.VarChar, certificaciones || null)
        .input('biografia', sql.VarChar, biografia || null)
        .input('horario_disponible', sql.VarChar, horario || null)
        .query(`
          INSERT INTO Coaches (
              id_usuario,
              especialidad,
              certificaciones,
              biografia,
              horario_disponible
          )
          VALUES (
              @id_usuario,
              @especialidad,
              @certificaciones,
              @biografia,
              @horario_disponible
          );
          
          SELECT SCOPE_IDENTITY() AS id_coach;
        `);
      
      const coachId = coachInsert.recordset[0].id_coach;
      
      await transaction.commit();
      
      res.status(201).json({
        message: 'Coach registrado exitosamente',
        coachId,
        userId
      });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error al crear coach:', error);
    res.status(500).json({ 
      message: 'Error al crear coach', 
      details: error.message 
    });
  }
});

// Obtener clientes asignados - MODIFICADO con logs
router.get('/clients', authMiddleware, async (req, res) => {
  try {
    console.log('==== Obteniendo clientes para coach ====');
    console.log('ID de usuario del coach:', req.user.id);
    
    const pool = await connectDB();
    
    // Primero obtener el id_coach del usuario actual
    const coachResult = await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        SELECT id_coach 
        FROM Coaches 
        WHERE id_usuario = @id_usuario
      `);
    
    console.log('Resultado de la búsqueda de coach:', coachResult.recordset);
    
    if (coachResult.recordset.length === 0) {
      console.log('⚠️ Coach no encontrado para el id_usuario:', req.user.id);
      return res.status(404).json({ message: 'Coach no encontrado' });
    }
    
    const coachId = coachResult.recordset[0].id_coach;
    console.log('ID del coach obtenido:', coachId);
    
    // Consulta modificada para depuración - muestra todas las asignaciones
    const clientsResult = await pool.request()
      .input('id_coach', sql.Int, coachId)
      .query(`
        SELECT 
          u.id_usuario,
          u.nombre,
          u.email,
          u.telefono,
          a.fecha_asignacion,
          a.estado,
          a.id_asignacion
        FROM 
          Asignaciones_Coach_Cliente a
        JOIN 
          Usuarios u ON a.id_usuario = u.id_usuario
        WHERE 
          a.id_coach = @id_coach
        ORDER BY
          u.nombre
      `);
    
    console.log('Total de asignaciones encontradas:', clientsResult.recordset.length);
    console.log('Asignaciones:', JSON.stringify(clientsResult.recordset, null, 2));
    
    // Filtrar solo las activas para la respuesta final
    const activeClients = clientsResult.recordset.filter(client => client.estado === 'activa');
    console.log('Clientes activos filtrados:', activeClients.length);
    
    res.json(activeClients);
  } catch (error) {
    console.error('Error al obtener clientes del coach:', error);
    res.status(500).json({ message: 'Error al obtener clientes' });
  }
});

// Obtener solicitudes pendientes - MODIFICADO con logs
router.get('/pending-requests', authMiddleware, async (req, res) => {
  try {
    console.log('==== Obteniendo solicitudes pendientes ====');
    console.log('ID de usuario del coach:', req.user.id);
    
    const pool = await connectDB();
    
    // Obtener el id_coach del usuario actual
    const coachResult = await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        SELECT id_coach 
        FROM Coaches 
        WHERE id_usuario = @id_usuario
      `);
    
    console.log('Resultado de la búsqueda de coach:', coachResult.recordset);
    
    if (coachResult.recordset.length === 0) {
      console.log('⚠️ Coach no encontrado para el id_usuario:', req.user.id);
      return res.status(404).json({ message: 'Coach no encontrado' });
    }
    
    const coachId = coachResult.recordset[0].id_coach;
    console.log('ID del coach obtenido:', coachId);
    
    // Obtener las solicitudes pendientes
    const requestsResult = await pool.request()
      .input('id_coach', sql.Int, coachId)
      .query(`
        SELECT 
          a.id_asignacion,
          u.id_usuario,
          u.nombre,
          u.email,
          a.fecha_asignacion
        FROM 
          Asignaciones_Coach_Cliente a
        JOIN 
          Usuarios u ON a.id_usuario = u.id_usuario
        WHERE 
          a.id_coach = @id_coach AND a.estado = 'pendiente'
        ORDER BY
          a.fecha_asignacion DESC
      `);
    
    console.log('Total de solicitudes pendientes encontradas:', requestsResult.recordset.length);
    console.log('Solicitudes pendientes:', JSON.stringify(requestsResult.recordset, null, 2));
    
    res.json(requestsResult.recordset);
  } catch (error) {
    console.error('Error al obtener solicitudes pendientes:', error);
    res.status(500).json({ message: 'Error al obtener solicitudes' });
  }
});

// Aceptar solicitud
router.post('/accept-request/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  
  try {
    console.log('==== Aceptando solicitud ====');
    console.log('ID de asignación:', id);
    
    const pool = await connectDB();
    
    // Actualizar el estado de la asignación a 'activa'
    await pool.request()
      .input('id_asignacion', sql.Int, id)
      .query(`
        UPDATE Asignaciones_Coach_Cliente
        SET estado = 'activa'
        WHERE id_asignacion = @id_asignacion
      `);
    
    console.log('Asignación actualizada a estado "activa"');
    
    // Obtener información para la notificación
    const assignmentResult = await pool.request()
      .input('id_asignacion', sql.Int, id)
      .query(`
        SELECT 
          a.id_usuario AS id_cliente,
          u.nombre AS nombre_coach
        FROM 
          Asignaciones_Coach_Cliente a
        JOIN 
          Coaches c ON a.id_coach = c.id_coach
        JOIN 
          Usuarios u ON c.id_usuario = u.id_usuario
        WHERE 
          a.id_asignacion = @id_asignacion
      `);
    
    if (assignmentResult.recordset.length > 0) {
      const { id_cliente, nombre_coach } = assignmentResult.recordset[0];
      console.log('Información para notificación - Cliente ID:', id_cliente, 'Nombre coach:', nombre_coach);
      
      // Crear notificación para el cliente
      await pool.request()
        .input('id_usuario', sql.Int, id_cliente)
        .input('id_origen', sql.Int, req.user.id)
        .input('titulo', sql.NVarChar, 'Solicitud de entrenador aceptada')
        .input('mensaje', sql.NVarChar, `El entrenador ${nombre_coach} ha aceptado tu solicitud. ¡Comienza a entrenar ahora!`)
        .query(`
          INSERT INTO Notificaciones (
            id_usuario,
            tipo,
            titulo,
            mensaje,
            fecha_creacion,
            leida,
            id_origen
          )
          VALUES (
            @id_usuario,
            'asignacion_coach',
            @titulo,
            @mensaje,
            GETDATE(),
            0,
            @id_origen
          )
        `);
      
      console.log('Notificación creada para el cliente');
    }
    
    res.json({ message: 'Solicitud aceptada correctamente' });
  } catch (error) {
    console.error('Error al aceptar solicitud:', error);
    res.status(500).json({ message: 'Error al aceptar solicitud' });
  }
});

// Rechazar solicitud
router.post('/reject-request/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  
  try {
    console.log('==== Rechazando solicitud ====');
    console.log('ID de asignación:', id);
    
    const pool = await connectDB();
    
    // Actualizar el estado de la asignación a 'rechazada'
    await pool.request()
      .input('id_asignacion', sql.Int, id)
      .query(`
        UPDATE Asignaciones_Coach_Cliente
        SET estado = 'rechazada'
        WHERE id_asignacion = @id_asignacion
      `);
    
    console.log('Asignación actualizada a estado "rechazada"');
    
    // Obtener información para la notificación
    const assignmentResult = await pool.request()
      .input('id_asignacion', sql.Int, id)
      .query(`
        SELECT 
          a.id_usuario AS id_cliente,
          u.nombre AS nombre_coach
        FROM 
          Asignaciones_Coach_Cliente a
        JOIN 
          Coaches c ON a.id_coach = c.id_coach
        JOIN 
          Usuarios u ON c.id_usuario = u.id_usuario
        WHERE 
          a.id_asignacion = @id_asignacion
      `);
    
    if (assignmentResult.recordset.length > 0) {
      const { id_cliente, nombre_coach } = assignmentResult.recordset[0];
      console.log('Información para notificación - Cliente ID:', id_cliente, 'Nombre coach:', nombre_coach);
      
      // Crear notificación para el cliente
      await pool.request()
        .input('id_usuario', sql.Int, id_cliente)
        .input('id_origen', sql.Int, req.user.id)
        .input('titulo', sql.NVarChar, 'Solicitud de entrenador rechazada')
        .input('mensaje', sql.NVarChar, `El entrenador ${nombre_coach} ha rechazado tu solicitud. Por favor, intenta con otro entrenador.`)
        .query(`
          INSERT INTO Notificaciones (
            id_usuario,
            tipo,
            titulo,
            mensaje,
            fecha_creacion,
            leida,
            id_origen
          )
          VALUES (
            @id_usuario,
            'asignacion_coach',
            @titulo,
            @mensaje,
            GETDATE(),
            0,
            @id_origen
          )
        `);
      
      console.log('Notificación creada para el cliente');
    }
    
    res.json({ message: 'Solicitud rechazada correctamente' });
  } catch (error) {
    console.error('Error al rechazar solicitud:', error);
    res.status(500).json({ message: 'Error al rechazar solicitud' });
  }
});

module.exports = router;

