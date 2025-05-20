// server/routes/routines.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { connectDB, sql } = require('../config/db');

// Middleware para verificar que el usuario es un coach
const verifyCoach = async (req, res, next) => {
  try {
    // Asumiendo que el middleware auth ya verificó el token y guardó el id_usuario en req.user.id
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
    
    if (userResult.recordset[0].tipo_usuario !== 'coach') {
      return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de coach' });
    }
    
    next();
  } catch (error) {
    console.error('Error en middleware verifyCoach:', error);
    res.status(500).json({ message: 'Error en la verificación de rol' });
  }
};

// Obtener información de un cliente específico
router.get('/client/:clientId', auth, verifyCoach, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId || clientId === 'undefined' || clientId === 'new') {
      return res.status(400).json({ message: 'ID de cliente no válido' });
    }
    
    const pool = await connectDB();
    
    // Primero verificar que el cliente está asignado a este coach
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    const assignmentResult = await pool.request()
      .input('coachId', sql.Int, coachId)
      .input('clientId', sql.Int, clientId)
      .query(`
        SELECT id_asignacion
        FROM Asignaciones_Coach_Cliente
        WHERE id_coach = @coachId AND id_usuario = @clientId AND estado = 'activa'
      `);
    
    if (assignmentResult.recordset.length === 0) {
      return res.status(403).json({ 
        message: 'Este cliente no está asignado a tu perfil de coach' 
      });
    }
    
    // Obtener datos del cliente
    const clientResult = await pool.request()
      .input('clientId', sql.Int, clientId)
      .query(`
        SELECT 
          id_usuario,
          nombre,
          email,
          telefono,
          fecha_nacimiento
        FROM 
          Usuarios
        WHERE 
          id_usuario = @clientId
      `);
    
    if (clientResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    res.json(clientResult.recordset[0]);
  } catch (error) {
    console.error('Error al obtener información del cliente:', error);
    res.status(500).json({ message: 'Error al obtener información del cliente' });
  }
});

// Obtener todos los ejercicios disponibles
router.get('/exercises', auth, verifyCoach, async (req, res) => {
  try {
    const pool = await connectDB();
    const result = await pool.request().query(`
      SELECT 
        id_ejercicio, 
        nombre, 
        descripcion, 
        grupos_musculares,
        equipo_necesario
      FROM 
        Ejercicios
      ORDER BY 
        nombre
    `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener ejercicios:', error);
    res.status(500).json({ message: 'Error al obtener ejercicios' });
  }
});

// Obtener las rutinas creadas por el coach
router.get('/routines', auth, verifyCoach, async (req, res) => {
  try {
    const pool = await connectDB();
    
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    const result = await pool.request()
      .input('coachId', sql.Int, coachId)
      .query(`
        SELECT 
          id_rutina,
          nombre,
          descripcion,
          objetivo,
          nivel_dificultad,
          duracion_estimada,
          fecha_creacion
        FROM 
          Rutinas
        WHERE 
          id_coach = @coachId
        ORDER BY 
          fecha_creacion DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener rutinas:', error);
    res.status(500).json({ message: 'Error al obtener rutinas' });
  }
});

// Obtener detalles de una rutina específica
router.get('/routine/:routineId', auth, verifyCoach, async (req, res) => {
  try {
    const { routineId } = req.params;
    const pool = await connectDB();
    
    // Verificar que la rutina pertenece a este coach
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    const routineResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .input('coachId', sql.Int, coachId)
      .query(`
        SELECT 
          r.id_rutina,
          r.nombre,
          r.descripcion,
          r.objetivo,
          r.nivel_dificultad,
          r.duracion_estimada,
          r.fecha_creacion
        FROM 
          Rutinas r
        WHERE 
          r.id_rutina = @routineId AND r.id_coach = @coachId
      `);
    
    if (routineResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Rutina no encontrada o no tienes acceso a ella' });
    }
    
    const routine = routineResult.recordset[0];
    
    // Obtener los ejercicios de la rutina
    const exercisesResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .query(`
        SELECT 
          dr.id_detalle,
          dr.id_ejercicio,
          e.nombre,
          dr.series,
          dr.repeticiones,
          dr.descanso_segundos,
          dr.orden,
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

// Crear una nueva rutina personalizada
router.post('/routine', auth, verifyCoach, async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      objetivo,
      nivel_dificultad,
      duracion_estimada,
      id_cliente,
      ejercicios
    } = req.body;
    
    // Validar que hay al menos un ejercicio
    if (!ejercicios || !Array.isArray(ejercicios) || ejercicios.length === 0) {
      return res.status(400).json({ message: 'Debes incluir al menos un ejercicio en la rutina' });
    }
    
    const pool = await connectDB();
    
    // Obtener ID del coach
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    // Verificar que el cliente está asignado a este coach
    const assignmentResult = await pool.request()
      .input('coachId', sql.Int, coachId)
      .input('clientId', sql.Int, id_cliente)
      .query(`
        SELECT id_asignacion
        FROM Asignaciones_Coach_Cliente
        WHERE id_coach = @coachId AND id_usuario = @clientId AND estado = 'activa'
      `);
    
    if (assignmentResult.recordset.length === 0) {
      return res.status(403).json({ 
        message: 'Este cliente no está asignado a tu perfil de coach' 
      });
    }
    
    // Iniciar transacción
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // 1. Insertar la rutina
      const routineResult = await new sql.Request(transaction)
        .input('coachId', sql.Int, coachId)
        .input('nombre', sql.VarChar(100), nombre)
        .input('descripcion', sql.Text, descripcion || null)
        .input('objetivo', sql.VarChar(100), objetivo || null)
        .input('nivel_dificultad', sql.VarChar(20), nivel_dificultad || 'intermedio')
        .input('duracion_estimada', sql.Int, duracion_estimada || 60)
        .query(`
          INSERT INTO Rutinas (
            id_coach,
            nombre,
            descripcion,
            objetivo,
            nivel_dificultad,
            duracion_estimada,
            fecha_creacion
          )
          OUTPUT INSERTED.id_rutina
          VALUES (
            @coachId,
            @nombre,
            @descripcion,
            @objetivo,
            @nivel_dificultad,
            @duracion_estimada,
            GETDATE()
          )
        `);
      
      const id_rutina = routineResult.recordset[0].id_rutina;
      
      // 2. Insertar los detalles de la rutina (ejercicios)
      for (const ejercicio of ejercicios) {
        await new sql.Request(transaction)
          .input('id_rutina', sql.Int, id_rutina)
          .input('id_ejercicio', sql.Int, ejercicio.id_ejercicio)
          .input('orden', sql.Int, ejercicio.orden)
          .input('series', sql.Int, ejercicio.series)
          .input('repeticiones', sql.VarChar(50), ejercicio.repeticiones)
          .input('descanso_segundos', sql.Int, ejercicio.descanso_segundos || 60)
          .input('notas', sql.Text, ejercicio.notas || null)
          .query(`
            INSERT INTO Detalles_Rutina (
              id_rutina,
              id_ejercicio,
              orden,
              series,
              repeticiones,
              descanso_segundos,
              notas
            )
            VALUES (
              @id_rutina,
              @id_ejercicio,
              @orden,
              @series,
              @repeticiones,
              @descanso_segundos,
              @notas
            )
          `);
      }
      
      // 3. Asignar la rutina al cliente
      await new sql.Request(transaction)
        .input('id_rutina', sql.Int, id_rutina)
        .input('id_usuario', sql.Int, id_cliente)
        .query(`
          INSERT INTO Asignaciones_Rutina (
            id_rutina,
            id_usuario,
            fecha_asignacion,
            fecha_inicio,
            fecha_fin,
            estado,
            notas_coach
          )
          VALUES (
            @id_rutina,
            @id_usuario,
            GETDATE(),
            GETDATE(),
            NULL,
            'activa',
            'Rutina personalizada asignada'
          )
        `);
      
      // 4. Commit de la transacción
      await transaction.commit();
      
      res.json({ 
        message: 'Rutina creada y asignada correctamente',
        id_rutina
      });
      
    } catch (error) {
      // Si hay error, hacer rollback
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error al crear rutina personalizada:', error);
    res.status(500).json({ message: 'Error al crear rutina personalizada' });
  }
});

// Asignar una rutina existente a un cliente
// router.post('/assign-routine', auth, verifyCoach, async (req, res) => {
//   try {
//     const { id_rutina, id_cliente } = req.body;
    
//     if (!id_rutina || !id_cliente) {
//       return res.status(400).json({ message: 'ID de rutina y cliente son requeridos' });
//     }
// // En server/routes/routines.js o donde tengas el endpoint
// router.post('/assign-routine-with-days', auth, async (req, res) => {
//   const { clientId, routineId, trainingDays, startDate, endDate } = req.body;

//   // Validar datos de entrada
//   if (!clientId || !routineId || !trainingDays || !Array.isArray(trainingDays) || trainingDays.length === 0) {
//     return res.status(400).json({ 
//       success: false, 
//       message: 'Datos incompletos. Se requiere ID de cliente, ID de rutina y al menos un día de entrenamiento' 
//     });
//   }

//   try {
//     // Validar que el usuario logueado sea un coach
//     const userId = req.user.id;
//     const coachCheck = await pool.request()
//       .input('userId', sql.Int, userId)
//       .query(`
//         SELECT c.id_coach 
//         FROM Coaches c 
//         JOIN Usuarios u ON c.id_usuario = u.id_usuario 
//         WHERE u.id_usuario = @userId AND u.tipo_usuario = 'coach'
//       `);
      
//     if (coachCheck.recordset.length === 0) {
//       return res.status(403).json({ 
//         success: false, 
//         message: 'No autorizado. Solo los coaches pueden asignar rutinas' 
//       });
//     }
    
//     const coachId = coachCheck.recordset[0].id_coach;
    
//     // Validar que la rutina pertenezca al coach
//     const routineCheck = await pool.request()
//       .input('routineId', sql.Int, routineId)
//       .input('coachId', sql.Int, coachId)
//       .query(`
//         SELECT id_rutina 
//         FROM Rutinas 
//         WHERE id_rutina = @routineId AND id_coach = @coachId
//       `);
      
//     if (routineCheck.recordset.length === 0) {
//       return res.status(403).json({ 
//         success: false, 
//         message: 'No autorizado. La rutina no pertenece a este coach' 
//       });
//     }
    
//     // Validar que el cliente esté asignado al coach
//     const clientCheck = await pool.request()
//       .input('clientId', sql.Int, clientId)
//       .input('coachId', sql.Int, coachId)
//       .query(`
//         SELECT * 
//         FROM Asignaciones_Coach_Cliente 
//         WHERE id_usuario = @clientId AND id_coach = @coachId AND estado = 'activa'
//       `);
      
//     if (clientCheck.recordset.length === 0) {
//       return res.status(403).json({ 
//         success: false, 
//         message: 'El cliente no está asignado a este coach o la asignación no está activa' 
//       });
//     }

//     // Verificar que los días de la semana sean válidos
//     const validDays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
//     const invalidDays = trainingDays.filter(day => !validDays.includes(day.toLowerCase()));
    
//     if (invalidDays.length > 0) {
//       return res.status(400).json({ 
//         success: false, 
//         message: `Días de entrenamiento inválidos: ${invalidDays.join(', ')}. Los días válidos son: ${validDays.join(', ')}` 
//       });
//     }
    
//     // Preparar las fechas (si están proporcionadas)
//     let startDateParam = startDate ? new Date(startDate) : null;
//     let endDateParam = endDate ? new Date(endDate) : null;
    
//     // Convertir los días de entrenamiento a formato JSON para el procedimiento almacenado
//     const trainingDaysJson = JSON.stringify(trainingDays.map(day => day.toLowerCase()));
    
//     // Llamar al procedimiento almacenado
//     const result = await pool.request()
//       .input('id_usuario', sql.Int, clientId)
//       .input('id_rutina', sql.Int, routineId)
//       .input('fecha_inicio', sql.Date, startDateParam)
//       .input('fecha_fin', sql.Date, endDateParam)
//       .input('dias_semana', sql.NVarChar(sql.MAX), trainingDaysJson)
//       .execute('sp_AsignarRutinaConDias');
    
//     res.json({
//       success: true,
//       message: 'Rutina asignada correctamente con días específicos',
//       data: result.recordset[0]
//     });
    
//   } catch (error) {
//     console.error('Error al asignar rutina con días:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Error en el servidor al asignar rutina con días', 
//       error: error.message 
//     });
//   }
// });
router.post('/assign-routine-with-days', auth, async (req, res) => {
  const { clientId, routineId, trainingDays, startDate, endDate } = req.body;

  // Validar datos de entrada
  if (!clientId || !routineId || !trainingDays || !Array.isArray(trainingDays) || trainingDays.length === 0) {
    return res.status(400).json({ 
      success: false, 
      message: 'Datos incompletos. Se requiere ID de cliente, ID de rutina y al menos un día de entrenamiento' 
    });
  }

  try {
    // Obtener conexión a la base de datos - Agregamos esta línea
    const pool = await connectDB();
    
    // Validar que el usuario logueado sea un coach
    const userId = req.user.id;
    const coachCheck = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT c.id_coach 
        FROM Coaches c 
        JOIN Usuarios u ON c.id_usuario = u.id_usuario 
        WHERE u.id_usuario = @userId AND u.tipo_usuario = 'coach'
      `);
      
    if (coachCheck.recordset.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'No autorizado. Solo los coaches pueden asignar rutinas' 
      });
    }
    
    const coachId = coachCheck.recordset[0].id_coach;
    
    // Validar que la rutina pertenezca al coach
    const routineCheck = await pool.request()
      .input('routineId', sql.Int, routineId)
      .input('coachId', sql.Int, coachId)
      .query(`
        SELECT id_rutina 
        FROM Rutinas 
        WHERE id_rutina = @routineId AND id_coach = @coachId
      `);
      
    if (routineCheck.recordset.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'No autorizado. La rutina no pertenece a este coach' 
      });
    }
    
    // Validar que el cliente esté asignado al coach
    const clientCheck = await pool.request()
      .input('clientId', sql.Int, clientId)
      .input('coachId', sql.Int, coachId)
      .query(`
        SELECT * 
        FROM Asignaciones_Coach_Cliente 
        WHERE id_usuario = @clientId AND id_coach = @coachId AND estado = 'activa'
      `);
      
    if (clientCheck.recordset.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'El cliente no está asignado a este coach o la asignación no está activa' 
      });
    }

    // Verificar que los días de la semana sean válidos
    const validDays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    const invalidDays = trainingDays.filter(day => !validDays.includes(day.toLowerCase()));
    
    if (invalidDays.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Días de entrenamiento inválidos: ${invalidDays.join(', ')}. Los días válidos son: ${validDays.join(', ')}` 
      });
    }
    
    // Preparar las fechas (si están proporcionadas)
    let startDateParam = startDate ? new Date(startDate) : null;
    let endDateParam = endDate ? new Date(endDate) : null;
    
    // Convertir los días de entrenamiento a formato JSON para el procedimiento almacenado
    const trainingDaysJson = JSON.stringify(trainingDays.map(day => day.toLowerCase()));
    
    console.log('Llamando a procedimiento almacenado con parámetros:', {
      userId: clientId,
      routineId: routineId,
      startDate: startDateParam,
      endDate: endDateParam,
      trainingDaysJson: trainingDaysJson
    });
    
    // Llamar al procedimiento almacenado
    const result = await pool.request()
      .input('id_usuario', sql.Int, clientId)
      .input('id_rutina', sql.Int, routineId)
      .input('fecha_inicio', sql.Date, startDateParam)
      .input('fecha_fin', sql.Date, endDateParam)
      .input('dias_semana', sql.NVarChar(sql.MAX), trainingDaysJson)
      .execute('sp_AsignarRutinaConDias');
    
    console.log('Resultado del procedimiento almacenado:', result.recordset);
    
    res.json({
      success: true,
      message: 'Rutina asignada correctamente con días específicos',
      data: result.recordset[0]
    });
    
  } catch (error) {
    console.error('Error al asignar rutina con días:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error en el servidor al asignar rutina con días', 
      error: error.message 
    });
  }
});
router.post('/assign-routine', auth, verifyCoach, async (req, res) => {
  try {
    // Log para depuración
    console.log('Cuerpo de la solicitud recibida:', req.body);
    
    // Extraer los datos del cuerpo de la solicitud
    const { userId, routineId } = req.body;
    
    // Verificar que se proporcionaron los datos necesarios
    if (!userId || !routineId) {
      return res.status(400).json({ message: 'Se requiere ID de usuario y rutina' });
    }
    
    // Resto del código para asignar la rutina...
    const pool = await connectDB();
    
    // Obtener ID del coach
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    // Verificar que la rutina pertenece a este coach
    const routineResult = await pool.request()
      .input('routineId', sql.Int, id_rutina)
      .input('coachId', sql.Int, coachId)
      .query(`
        SELECT id_rutina
        FROM Rutinas
        WHERE id_rutina = @routineId AND id_coach = @coachId
      `);
    
    if (routineResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Rutina no encontrada o no tienes acceso a ella' });
    }
    
    // Verificar que el cliente está asignado a este coach
    const assignmentResult = await pool.request()
      .input('coachId', sql.Int, coachId)
      .input('clientId', sql.Int, id_cliente)
      .query(`
        SELECT id_asignacion
        FROM Asignaciones_Coach_Cliente
        WHERE id_coach = @coachId AND id_usuario = @clientId AND estado = 'activa'
      `);
    
    if (assignmentResult.recordset.length === 0) {
      return res.status(403).json({ 
        message: 'Este cliente no está asignado a tu perfil de coach' 
      });
    }
    
    // Verificar si ya tiene una rutina activa (opcional: podemos desactivar las rutinas previas)
    await pool.request()
      .input('clientId', sql.Int, id_cliente)
      .query(`
        UPDATE Asignaciones_Rutina
        SET estado = 'completada'
        WHERE id_usuario = @clientId AND estado = 'activa'
      `);
    
    // Asignar la rutina al cliente
    await pool.request()
      .input('id_rutina', sql.Int, id_rutina)
      .input('id_usuario', sql.Int, id_cliente)
      .query(`
        INSERT INTO Asignaciones_Rutina (
          id_rutina,
          id_usuario,
          fecha_asignacion,
          fecha_inicio,
          fecha_fin,
          estado,
          notas_coach
        )
        VALUES (
          @id_rutina,
          @id_usuario,
          GETDATE(),
          GETDATE(),
          NULL,
          'activa',
          'Rutina asignada desde el panel de coach'
        )
      `);
    
    res.json({ message: 'Rutina asignada correctamente' });
    
  } catch (error) {
    console.error('Error al asignar rutina:', error);
    res.status(500).json({ message: 'Error al asignar rutina' });
  }
});

// Función helper para obtener el id_coach a partir del id_usuario
async function getCoachIdFromUserId(userId) {
  const pool = await connectDB();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`
      SELECT id_coach
      FROM Coaches
      WHERE id_usuario = @userId
    `);
  
  if (result.recordset.length === 0) {
    throw new Error('No se encontró el perfil de coach para este usuario');
  }
  
  return result.recordset[0].id_coach;
}

module.exports = router;