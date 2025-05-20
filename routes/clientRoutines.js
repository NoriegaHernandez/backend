// server/routes/clientRoutines.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { connectDB, sql } = require('../config/db');

// Middleware para verificar que el usuario es un cliente
const verifyClient = async (req, res, next) => {
  try {
    const pool = await connectDB();
    const userResult = await pool.request()
      .input('userId', sql.Int, req.user.id)
      .query(`
        SELECT tipo_usuario 
        FROM Usuarios 
        WHERE id_usuario = @userId
      `);
    
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    if (userResult.recordset[0].tipo_usuario !== 'cliente') {
      return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de cliente' });
    }
    
    next();
  } catch (error) {
    console.error('Error en middleware verifyClient:', error);
    res.status(500).json({ message: 'Error en la verificación de rol' });
  }
};

// Obtener las rutinas asignadas al cliente
router.get('/routines', auth, verifyClient, async (req, res) => {
  try {
    const pool = await connectDB();
    
    const result = await pool.request()
      .input('userId', sql.Int, req.user.id)
      .query(`
        SELECT 
          ar.id_asignacion_rutina,
          r.id_rutina,
          r.nombre,
          r.objetivo,
          r.nivel_dificultad,
          r.duracion_estimada,
          ar.fecha_asignacion,
          ar.fecha_inicio,
          ar.estado,
          c.nombre AS nombre_coach,
          (
            SELECT COUNT(*) 
            FROM Detalles_Rutina 
            WHERE id_rutina = r.id_rutina
          ) AS num_ejercicios
        FROM 
          Asignaciones_Rutina ar
        JOIN 
          Rutinas r ON ar.id_rutina = r.id_rutina
        JOIN 
          Coaches co ON r.id_coach = co.id_coach
        JOIN 
          Usuarios c ON co.id_usuario = c.id_usuario
        WHERE 
          ar.id_usuario = @userId
        ORDER BY 
          CASE 
            WHEN ar.estado = 'activa' THEN 0
            WHEN ar.estado = 'completada' THEN 1
            ELSE 2
          END,
          ar.fecha_asignacion DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener rutinas del cliente:', error);
    res.status(500).json({ message: 'Error al obtener rutinas' });
  }
});

// Obtener detalles de una rutina específica
router.get('/routine/:routineId', auth, verifyClient, async (req, res) => {
  try {
    const { routineId } = req.params;
    const pool = await connectDB();
    
    // Verificar que la rutina está asignada a este cliente
    const assignmentResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .input('userId', sql.Int, req.user.id)
      .query(`
        SELECT id_asignacion_rutina
        FROM Asignaciones_Rutina
        WHERE id_rutina = @routineId AND id_usuario = @userId
      `);
    
    if (assignmentResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Rutina no encontrada o no tienes acceso a ella' });
    }
    
    // Obtener detalles de la rutina
    const routineResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .query(`
        SELECT 
          r.id_rutina,
          r.nombre,
          r.descripcion,
          r.objetivo,
          r.nivel_dificultad,
          r.duracion_estimada,
          c.nombre AS nombre_coach,
          ar.fecha_asignacion,
          ar.estado
        FROM 
          Rutinas r
        JOIN 
          Asignaciones_Rutina ar ON r.id_rutina = ar.id_rutina
        JOIN 
          Coaches co ON r.id_coach = co.id_coach
        JOIN 
          Usuarios c ON co.id_usuario = c.id_usuario
        WHERE 
          r.id_rutina = @routineId AND ar.id_usuario = @userId
      `);
    
    if (routineResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Rutina no encontrada' });
    }
    
    const routine = routineResult.recordset[0];
    
    // Obtener los ejercicios de la rutina
    const exercisesResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .query(`
        SELECT 
          dr.id_detalle,
          dr.orden,
          e.id_ejercicio,
          e.nombre,
          e.descripcion AS ejercicio_descripcion,
          e.grupos_musculares,
          e.equipo_necesario,
          e.imagen_url,
          e.video_url,
          dr.series,
          dr.repeticiones,
          dr.descanso_segundos,
          dr.notas
        FROM 
          Detalles_Rutina dr
        JOIN 
          Ejercicios e ON dr.id_ejercicio = e.id_ejercicio
        WHERE 
          dr.id_rutina = @routineId
        ORDER BY 
          dr.orden
      `);
    
    routine.ejercicios = exercisesResult.recordset;
    
    res.json(routine);
  } catch (error) {
    console.error('Error al obtener detalles de la rutina:', error);
    res.status(500).json({ message: 'Error al obtener detalles de la rutina' });
  }
});


// En clientRoutines.js
router.get('/active-routine', auth, async (req, res) => {
    try {
        const pool = await connectDB();
        const userId = req.user.id;
        const { day } = req.query; // Día específico que se quiere consultar
        
        console.log(`Cliente solicitando rutinas${day ? ' para el día: ' + day : ''}`);

        // Verificar si el usuario es un cliente
        const userCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT tipo_usuario 
                FROM Usuarios 
                WHERE id_usuario = @userId
            `);
            
        if (userCheck.recordset.length === 0 || userCheck.recordset[0].tipo_usuario !== 'cliente') {
            return res.status(403).json({ 
                success: false, 
                message: 'No autorizado. Solo los clientes pueden acceder a esta información' 
            });
        }
        
        // Si se especifica un día, obtener la rutina para ese día
        if (day) {
            const routineResult = await pool.request()
                .input('userId', sql.Int, userId)
                .input('day', sql.NVarChar, day)
                .query(`
                    SELECT 
                        ar.id_asignacion_rutina,
                        ar.id_rutina,
                        r.nombre AS nombre_rutina,
                        r.descripcion,
                        r.objetivo,
                        r.nivel_dificultad,
                        r.duracion_estimada,
                        ar.fecha_asignacion,
                        ar.fecha_inicio,
                        ar.fecha_fin,
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
                    JOIN 
                        Dias_Entrenamiento de ON ar.id_asignacion_rutina = de.id_asignacion_rutina
                    WHERE 
                        ar.id_usuario = @userId 
                        AND ar.estado = 'activa'
                        AND de.dia_semana = @day
                `);
                
            if (routineResult.recordset.length === 0) {
                return res.json({ 
                    success: true, 
                    message: 'No hay rutina asignada para este día',
                    data: null
                });
            }
            
            return res.json({
                success: true,
                data: routineResult.recordset[0]
            });
        } 
        // Si no se especifica un día, obtener TODAS las rutinas activas
        else {
            const allRoutinesResult = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT 
                        ar.id_asignacion_rutina,
                        ar.id_rutina,
                        r.nombre AS nombre_rutina,
                        r.descripcion,
                        r.objetivo,
                        r.nivel_dificultad,
                        r.duracion_estimada,
                        ar.fecha_asignacion,
                        ar.fecha_inicio,
                        ar.fecha_fin,
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
                        ar.id_usuario = @userId 
                        AND ar.estado = 'activa'
                `);
                
            if (allRoutinesResult.recordset.length === 0) {
                return res.json({ 
                    success: true, 
                    message: 'No hay rutinas activas asignadas',
                    data: null
                });
            }
            
            // Obtener los días para cada rutina
            const routinesWithDays = await Promise.all(
                allRoutinesResult.recordset.map(async (routine) => {
                    const daysResult = await pool.request()
                        .input('assignmentId', sql.Int, routine.id_asignacion_rutina)
                        .query(`
                            SELECT 
                                id_dia_entrenamiento,
                                dia_semana,
                                hora_inicio,
                                hora_fin,
                                notas
                            FROM 
                                Dias_Entrenamiento
                            WHERE 
                                id_asignacion_rutina = @assignmentId
                        `);
                    
                    return {
                        ...routine,
                        dias_entrenamiento: daysResult.recordset
                    };
                })
            );
            
            // Determinar la rutina del día actual
            const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
            const today = days[new Date().getDay()];
            
            const todayRoutine = routinesWithDays.find(routine => 
                routine.dias_entrenamiento.some(day => day.dia_semana.toLowerCase() === today)
            );
            
            return res.json({
                success: true,
                data: todayRoutine || routinesWithDays[0], // Rutina del día actual o la primera
                all_routines: routinesWithDays // Todas las rutinas con sus días
            });
        }
        
    } catch (error) {
        console.error('Error al obtener rutina activa:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error en el servidor al obtener la rutina activa', 
            error: error.message 
        });
    }
});

router.get('/routine-days/:assignmentId', auth, async (req, res) => {
    try {
        const pool = await connectDB();
        const userId = req.user.id;
        const { assignmentId } = req.params;
        
        // Verificar que el usuario es cliente
        const userCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT tipo_usuario 
                FROM Usuarios 
                WHERE id_usuario = @userId
            `);
            
        if (userCheck.recordset.length === 0 || userCheck.recordset[0].tipo_usuario !== 'cliente') {
            return res.status(403).json({ 
                success: false, 
                message: 'No autorizado. Solo los clientes pueden acceder a esta información' 
            });
        }
        
        // Verificar que la asignación pertenece al cliente
        const assignmentCheck = await pool.request()
            .input('assignmentId', sql.Int, assignmentId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT id_asignacion_rutina 
                FROM Asignaciones_Rutina 
                WHERE id_asignacion_rutina = @assignmentId AND id_usuario = @userId
            `);
            
        if (assignmentCheck.recordset.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'No autorizado. La asignación no pertenece a este cliente' 
            });
        }
        
        // Obtener los días de entrenamiento
        const result = await pool.request()
            .input('assignmentId', sql.Int, assignmentId)
            .query(`
                SELECT 
                    id_dia_entrenamiento,
                    dia_semana,
                    hora_inicio,
                    hora_fin,
                    notas
                FROM 
                    Dias_Entrenamiento
                WHERE 
                    id_asignacion_rutina = @assignmentId
                ORDER BY 
                    CASE dia_semana
                        WHEN 'lunes' THEN 1
                        WHEN 'martes' THEN 2
                        WHEN 'miércoles' THEN 3
                        WHEN 'jueves' THEN 4
                        WHEN 'viernes' THEN 5
                        WHEN 'sábado' THEN 6
                        WHEN 'domingo' THEN 7
                    END
            `);
            
        res.json({
            success: true,
            data: result.recordset
        });
        
    } catch (error) {
        console.error('Error al obtener días de entrenamiento:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error en el servidor al obtener los días de entrenamiento', 
            error: error.message 
        });
    }
});

router.get('/routine-exercises/:routineId', auth, async (req, res) => {
    try {
        const pool = await connectDB();
        const userId = req.user.id;
        const { routineId } = req.params;
        
        // Verificar que el usuario es cliente
        const userCheck = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT tipo_usuario 
                FROM Usuarios 
                WHERE id_usuario = @userId
            `);
            
        if (userCheck.recordset.length === 0 || userCheck.recordset[0].tipo_usuario !== 'cliente') {
            return res.status(403).json({ 
                success: false, 
                message: 'No autorizado. Solo los clientes pueden acceder a esta información' 
            });
        }
        
        // Verificar que la rutina está asignada al cliente
        const routineCheck = await pool.request()
            .input('routineId', sql.Int, routineId)
            .input('userId', sql.Int, userId)
            .query(`
                SELECT ar.id_asignacion_rutina 
                FROM Asignaciones_Rutina ar
                WHERE ar.id_rutina = @routineId AND ar.id_usuario = @userId AND ar.estado = 'activa'
            `);
            
        if (routineCheck.recordset.length === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'No autorizado. La rutina no está asignada a este cliente o no está activa' 
            });
        }
        
        // Obtener los ejercicios de la rutina
        const result = await pool.request()
            .input('routineId', sql.Int, routineId)
            .query(`
                SELECT 
                    e.id_ejercicio,
                    e.nombre,
                    e.descripcion,
                    e.instrucciones,
                    e.grupos_musculares,
                    e.equipo_necesario,
                    e.video_url,
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
                    dr.id_rutina = @routineId
                ORDER BY 
                    dr.orden
            `);
            
        res.json({
            success: true,
            data: result.recordset
        });
        
    } catch (error) {
        console.error('Error al obtener ejercicios de la rutina:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error en el servidor al obtener los ejercicios de la rutina', 
            error: error.message 
        });
    }
});
// Marcar rutina como completada
router.put('/routine/:routineId/complete', auth, verifyClient, async (req, res) => {
  try {
    const { routineId } = req.params;
    const pool = await connectDB();
    
    // Verificar que la rutina está asignada a este cliente
    const assignmentResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .input('userId', sql.Int, req.user.id)
      .query(`
        SELECT id_asignacion_rutina
        FROM Asignaciones_Rutina
        WHERE id_rutina = @routineId AND id_usuario = @userId AND estado = 'activa'
      `);
    
    if (assignmentResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Rutina no encontrada, ya completada o no tienes acceso a ella' });
    }
    
    // Actualizar estado de la rutina
    await pool.request()
      .input('routineId', sql.Int, routineId)
      .input('userId', sql.Int, req.user.id)
      .query(`
        UPDATE Asignaciones_Rutina
        SET 
          estado = 'completada',
          fecha_fin = GETDATE()
        WHERE 
          id_rutina = @routineId AND id_usuario = @userId AND estado = 'activa'
      `);
    
    res.json({ message: 'Rutina marcada como completada correctamente' });
  } catch (error) {
    console.error('Error al marcar rutina como completada:', error);
    res.status(500).json({ message: 'Error al marcar rutina como completada' });
  }
});

module.exports = router;