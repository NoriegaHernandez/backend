
// server/routes/client.js
const express = require('express');
const router = express.Router();
const { connectDB, sql } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Middleware para verificar rol de cliente
const clientMiddleware = (req, res, next) => {
  if (req.user.type !== 'cliente') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de cliente' });
  }
  next();
};

// Ruta de prueba
router.get('/test', (req, res) => {
  res.json({ message: 'API de cliente funcionando correctamente' });
});

// Obtener estado de asignación de entrenador
router.get('/coach-status', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    
    const result = await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        SELECT 
          a.id_asignacion,
          a.id_coach,
          a.estado,
          a.fecha_asignacion,
          u.nombre AS nombre_coach,
          c.especialidad,
          c.horario_disponible
        FROM 
          Asignaciones_Coach_Cliente a
        JOIN 
          Coaches c ON a.id_coach = c.id_coach
        JOIN 
          Usuarios u ON c.id_usuario = u.id_usuario
        WHERE 
          a.id_usuario = @id_usuario AND (a.estado = 'activa' OR a.estado = 'pendiente')
        ORDER BY 
          a.fecha_asignacion DESC
      `);
    
    if (result.recordset.length === 0) {
      return res.json({ 
        hasCoach: false,
        pendingRequest: false
      });
    }
    
    const assignment = result.recordset[0];
    
    res.json({
      hasCoach: assignment.estado === 'activa',
      pendingRequest: assignment.estado === 'pendiente',
      coach: {
        id: assignment.id_coach,
        name: assignment.nombre_coach,
        specialization: assignment.especialidad,
        schedule: assignment.horario_disponible,
        assignmentDate: assignment.fecha_asignacion
      }
    });
  } catch (error) {
    console.error('Error al obtener estado del entrenador:', error);
    res.status(500).json({ message: 'Error al obtener estado del entrenador' });
  }
});

// Obtener todos los entrenadores disponibles
router.get('/coaches', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    
    // Obtener todos los entrenadores disponibles
    const result = await pool.request()
      .query(`
        SELECT 
          c.id_coach,
          u.nombre,
          c.especialidad,
          c.certificaciones,
          c.biografia,
          c.horario_disponible
        FROM 
          Coaches c
        JOIN 
          Usuarios u ON c.id_usuario = u.id_usuario
        WHERE 
          u.estado = 'activo'
        ORDER BY 
          u.nombre
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener entrenadores disponibles:', error);
    res.status(500).json({ message: 'Error al obtener entrenadores' });
  }
});

// Solicitar asignación de entrenador - MODIFICADO
router.post('/request-coach/:id', authMiddleware, async (req, res) => {
  const { id } = req.params; // ID del coach
  
  try {
    console.log('Procesando solicitud de entrenador. Coach ID:', id, 'Usuario ID:', req.user.id);
    const pool = await connectDB();
    
    // Verificar si el coach existe
    const coachCheck = await pool.request()
      .input('id_coach', sql.Int, id)
      .query(`
        SELECT 
          c.id_coach,
          u.nombre
        FROM 
          Coaches c
        JOIN 
          Usuarios u ON c.id_usuario = u.id_usuario
        WHERE 
          c.id_coach = @id_coach AND u.estado = 'activo'
      `);
    
    if (coachCheck.recordset.length === 0) {
      console.log('Coach no encontrado con ID:', id);
      return res.status(404).json({ message: 'Entrenador no encontrado' });
    }
    
    const coachName = coachCheck.recordset[0].nombre;
    console.log('Coach encontrado:', coachName);
    
    // Verificar si ya tiene una asignación o solicitud pendiente
    const assignmentCheck = await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        SELECT id_asignacion, estado 
        FROM Asignaciones_Coach_Cliente 
        WHERE id_usuario = @id_usuario AND (estado = 'activa' OR estado = 'pendiente')
      `);
    
    if (assignmentCheck.recordset.length > 0) {
      const status = assignmentCheck.recordset[0].estado;
      console.log('Usuario ya tiene asignación/solicitud. Estado:', status);
      return res.status(400).json({ 
        message: status === 'activa' 
          ? 'Ya tienes un entrenador asignado' 
          : 'Ya tienes una solicitud pendiente' 
      });
    }
    
    // Crear la asignación con estado 'pendiente' - CORREGIDO
    console.log('Creando asignación con estado pendiente');
    await pool.request()
      .input('id_coach', sql.Int, id)
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        INSERT INTO Asignaciones_Coach_Cliente (
          id_coach,
          id_usuario,
          fecha_asignacion,
          estado,
          notas
        )
        VALUES (
          @id_coach,
          @id_usuario,
          GETDATE(),
          'pendiente',
          'Solicitud pendiente de aprobación'
        )
      `);
    
    // Obtener el ID del usuario del coach
    const coachUserResult = await pool.request()
      .input('id_coach', sql.Int, id)
      .query(`
        SELECT id_usuario 
        FROM Coaches 
        WHERE id_coach = @id_coach
      `);
    
    if (coachUserResult.recordset.length > 0) {
      const coachUserId = coachUserResult.recordset[0].id_usuario;
      console.log('ID de usuario del coach:', coachUserId);
      
      // Crear notificación para el coach
      await pool.request()
        .input('id_usuario', sql.Int, coachUserId)
        .input('id_origen', sql.Int, req.user.id)
        .input('titulo', sql.NVarChar, 'Nueva solicitud de cliente')
        .input('mensaje', sql.NVarChar, 'Un nuevo cliente ha solicitado que seas su entrenador.')
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
            'solicitud_entrenamiento',
            @titulo,
            @mensaje,
            GETDATE(),
            0,
            @id_origen
          )
        `);
      
      console.log('Notificación creada para el coach');
    }
    
    console.log('Solicitud procesada correctamente');
    res.status(201).json({ 
      message: `Solicitud enviada correctamente al entrenador ${coachName}. Recibirás una notificación cuando sea aceptada.` 
    });
  } catch (error) {
    console.error('Error al solicitar entrenador:', error);
    res.status(500).json({ message: 'Error al solicitar entrenador' });
  }
});

module.exports = router;