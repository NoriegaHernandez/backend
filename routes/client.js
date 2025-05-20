
// server/routes/client.js
const express = require('express');
const router = express.Router();
const { connectDB, sql } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Middleware para verificar rol de cliente
// Middleware para verificar rol de cliente
const clientMiddleware = (req, res, next) => {
  if (req.user.type !== 'cliente') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de cliente' });
  }
  next();
};

// Obtener rutinas asignadas al cliente
router.get('/routines', authMiddleware, clientMiddleware, async (req, res) => {
  try {
    console.log('==== Obteniendo rutinas del cliente ====');
    console.log('ID de usuario del cliente:', req.user.id);
    
    const pool = await connectDB();
    
    // Obtener rutinas asignadas activas
    const result = await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        SELECT 
          ar.id_asignacion_rutina,
          r.id_rutina,
          r.nombre,
          r.descripcion,
          r.objetivo,
          r.nivel_dificultad,
          r.duracion_estimada,
          ar.fecha_asignacion,
          ar.fecha_inicio,
          ar.estado,
          c.id_coach,
          u.nombre AS nombre_coach
        FROM 
          Asignaciones_Rutina ar
        JOIN 
          Rutinas r ON ar.id_rutina = r.id_rutina
        JOIN 
          Coaches c ON r.id_coach = c.id_coach
        JOIN
          Usuarios u ON c.id_usuario = u.id_usuario
        WHERE 
          ar.id_usuario = @id_usuario AND 
          ar.estado = 'activa'
        ORDER BY 
          ar.fecha_asignacion DESC
      `);
      
    console.log('Rutinas encontradas:', result.recordset.length);
    
    // Si hay rutinas, obtener los detalles (ejercicios) de cada rutina
    if (result.recordset.length > 0) {
      for (let rutina of result.recordset) {
        const ejerciciosResult = await pool.request()
          .input('id_rutina', sql.Int, rutina.id_rutina)
          .query(`
            SELECT 
              dr.id_detalle,
              e.id_ejercicio,
              e.nombre,
              e.descripcion,
              e.instrucciones,
              e.grupos_musculares,
              e.imagen_url,
              dr.series,
              dr.repeticiones,
              dr.descanso_segundos,
              dr.notas,
              dr.orden
            FROM 
              Detalles_Rutina dr
            JOIN 
              Ejercicios e ON dr.id_ejercicio = e.id_ejercicio
            WHERE 
              dr.id_rutina = @id_rutina
            ORDER BY 
              dr.orden
          `);
          
        rutina.ejercicios = ejerciciosResult.recordset;
      }
    }
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener rutinas del cliente:', error);
    res.status(500).json({ message: 'Error al obtener rutinas' });
  }
});
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

// Guardar medidas físicas del cliente
router.post('/physical-measurements', authMiddleware, clientMiddleware, async (req, res) => {
  try {
    console.log('Guardando medidas físicas para usuario ID:', req.user.id);
    console.log('Datos recibidos:', req.body);
    
    const pool = await connectDB();
    
    // Insertar los datos en la tabla Medidas_Corporales
    await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .input('peso', sql.Decimal(5, 2), req.body.peso || null)
      .input('altura', sql.Decimal(5, 2), req.body.altura || null)
      .input('porcentaje_grasa', sql.Decimal(5, 2), req.body.porcentaje_grasa || null)
      .input('masa_muscular', sql.Decimal(5, 2), req.body.masa_muscular || null)
      .input('medida_pecho', sql.Decimal(5, 2), req.body.medida_pecho || null)
      .input('medida_brazo_izq', sql.Decimal(5, 2), req.body.medida_brazo_izq || null)
      .input('medida_brazo_der', sql.Decimal(5, 2), req.body.medida_brazo_der || null)
      .input('medida_pierna_izq', sql.Decimal(5, 2), req.body.medida_pierna_izq || null)
      .input('medida_pierna_der', sql.Decimal(5, 2), req.body.medida_pierna_der || null)
      .input('medida_cintura', sql.Decimal(5, 2), req.body.medida_cintura || null)
      .input('medida_cadera', sql.Decimal(5, 2), req.body.medida_cadera || null)
      .input('notas', sql.Text, req.body.notas || null)
      .query(`
        INSERT INTO Medidas_Corporales (
          id_usuario,
          fecha_registro,
          peso,
          altura,
          porcentaje_grasa,
          masa_muscular,
          medida_pecho,
          medida_brazo_izq,
          medida_brazo_der,
          medida_pierna_izq,
          medida_pierna_der,
          medida_cintura,
          medida_cadera,
          notas
        )
        VALUES (
          @id_usuario,
          GETDATE(),
          @peso,
          @altura,
          @porcentaje_grasa,
          @masa_muscular,
          @medida_pecho,
          @medida_brazo_izq,
          @medida_brazo_der,
          @medida_pierna_izq,
          @medida_pierna_der,
          @medida_cintura,
          @medida_cadera,
          @notas
        )
      `);
    
    // Notificar al entrenador asignado (si existe)
    // Primero, obtener si el cliente tiene un entrenador asignado
    const coachResult = await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        SELECT 
          c.id_coach, 
          c.id_usuario AS id_usuario_coach
        FROM 
          Asignaciones_Coach_Cliente a
        JOIN 
          Coaches c ON a.id_coach = c.id_coach
        WHERE 
          a.id_usuario = @id_usuario AND a.estado = 'activa'
      `);
    
    // Si tiene entrenador, crear notificación
    if (coachResult.recordset.length > 0) {
      const coachUserId = coachResult.recordset[0].id_usuario_coach;
      
      await pool.request()
        .input('id_usuario', sql.Int, coachUserId)
        .input('id_origen', sql.Int, req.user.id)
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
            'nuevas_medidas',
            'Nuevas medidas físicas registradas',
            'Tu cliente ha registrado nuevas medidas corporales. Revisa su progreso.',
            GETDATE(),
            0,
            @id_origen
          )
        `);
    }
    
    res.status(201).json({ message: 'Medidas físicas guardadas correctamente' });
  } catch (error) {
    console.error('Error al guardar medidas físicas:', error);
    res.status(500).json({ message: 'Error al guardar medidas físicas' });
  }
});

// Obtener medidas físicas del cliente
router.get('/physical-measurements', authMiddleware, clientMiddleware, async (req, res) => {
  try {
    console.log('Obteniendo medidas físicas para usuario ID:', req.user.id);
    
    const pool = await connectDB();
    
    // Obtener medidas físicas ordenadas por fecha (más recientes primero)
    const result = await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        SELECT 
          id_medida,
          fecha_registro,
          peso,
          altura,
          porcentaje_grasa,
          masa_muscular,
          medida_pecho,
          medida_brazo_izq,
          medida_brazo_der,
          medida_pierna_izq,
          medida_pierna_der,
          medida_cintura,
          medida_cadera,
          notas
        FROM 
          Medidas_Corporales
        WHERE 
          id_usuario = @id_usuario
        ORDER BY 
          fecha_registro DESC
      `);
    
    console.log('Medidas encontradas:', result.recordset.length);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener medidas físicas:', error);
    res.status(500).json({ message: 'Error al obtener medidas físicas' });
  }
});
module.exports = router;