

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
router.get('/routines', authMiddleware, async (req, res) => {
  try {
    console.log('==== Obteniendo rutinas del coach ====');
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
    
    if (coachResult.recordset.length === 0) {
      console.log('⚠️ Coach no encontrado para el id_usuario:', req.user.id);
      return res.status(404).json({ message: 'Coach no encontrado' });
    }
    
    const coachId = coachResult.recordset[0].id_coach;
    console.log('ID del coach obtenido:', coachId);
    
    // Obtener las rutinas del coach
    const routinesResult = await pool.request()
      .input('id_coach', sql.Int, coachId)
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
          id_coach = @id_coach
        ORDER BY
          fecha_creacion DESC
      `);
    
    console.log('Total de rutinas encontradas:', routinesResult.recordset.length);
    
    res.json(routinesResult.recordset);
  } catch (error) {
    console.error('Error al obtener rutinas del coach:', error);
    res.status(500).json({ message: 'Error al obtener rutinas' });
  }
});
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

// Agregar esta nueva ruta a routes/coach.js

// Actualizar perfil de coach
router.post('/update-profile', authMiddleware, async (req, res) => {
  try {
    console.log('Recibida solicitud para actualizar perfil de coach:', req.body);
    
    // Extraer los datos del cuerpo de la solicitud
    const { 
      nombre, 
      email, 
      telefono, 
      especialidad, 
      certificaciones, 
      biografia, 
      horario_disponible, 
      experiencia 
    } = req.body;
    
    // Obtener el ID del usuario actual desde el token
    const userId = req.user.id;
    
    // Validaciones básicas
    if (!nombre || !email) {
      return res.status(400).json({ message: 'El nombre y email son obligatorios' });
    }
    
    const pool = await connectDB();
    
    // Iniciar una transacción para garantizar la integridad de ambas actualizaciones
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // 1. Actualizar datos básicos en la tabla Usuarios
      const updateUserRequest = new sql.Request(transaction);
      updateUserRequest.input('id_usuario', sql.Int, userId);
      updateUserRequest.input('nombre', sql.VarChar, nombre);
      updateUserRequest.input('email', sql.VarChar, email);
      updateUserRequest.input('telefono', sql.VarChar, telefono || null);
      
      const userUpdateResult = await updateUserRequest.query(`
        UPDATE Usuarios
        SET 
          nombre = @nombre,
          email = @email,
          telefono = @telefono
        WHERE 
          id_usuario = @id_usuario AND tipo_usuario = 'coach';
          
        SELECT @@ROWCOUNT AS UserUpdated;
      `);
      
      const userUpdated = userUpdateResult.recordset[0].UserUpdated;
      if (userUpdated === 0) {
        // Si no se actualizó ningún registro, el usuario no existe o no es un coach
        await transaction.rollback();
        return res.status(404).json({ message: 'Usuario no encontrado o no es un coach' });
      }
      
      // 2. Buscar si existe el registro en la tabla Coaches
      const coachCheckRequest = new sql.Request(transaction);
      coachCheckRequest.input('id_usuario', sql.Int, userId);
      
      const coachCheckResult = await coachCheckRequest.query(`
        SELECT id_coach 
        FROM Coaches 
        WHERE id_usuario = @id_usuario
      `);
      
      let coachId;
      
      if (coachCheckResult.recordset.length > 0) {
        // 3a. Si existe, actualizar los datos del coach
        coachId = coachCheckResult.recordset[0].id_coach;
        
        const updateCoachRequest = new sql.Request(transaction);
        updateCoachRequest.input('id_coach', sql.Int, coachId);
        updateCoachRequest.input('especialidad', sql.NVarChar, especialidad || null);
        updateCoachRequest.input('certificaciones', sql.NVarChar, certificaciones || null);
        updateCoachRequest.input('biografia', sql.NVarChar, biografia || null);
        updateCoachRequest.input('horario_disponible', sql.NVarChar, horario_disponible || null);
        updateCoachRequest.input('experiencia', sql.NVarChar, experiencia || null);
        
        await updateCoachRequest.query(`
          UPDATE Coaches
          SET 
            especialidad = @especialidad,
            certificaciones = @certificaciones,
            biografia = @biografia,
            horario_disponible = @horario_disponible,
            experiencia = @experiencia
          WHERE 
            id_coach = @id_coach;
        `);
        
        console.log('Información de coach actualizada, ID:', coachId);
      } else {
        // 3b. Si no existe, crear un nuevo registro en la tabla Coaches
        const insertCoachRequest = new sql.Request(transaction);
        insertCoachRequest.input('id_usuario', sql.Int, userId);
        insertCoachRequest.input('especialidad', sql.NVarChar, especialidad || 'General');
        insertCoachRequest.input('certificaciones', sql.NVarChar, certificaciones || null);
        insertCoachRequest.input('biografia', sql.NVarChar, biografia || null);
        insertCoachRequest.input('horario_disponible', sql.NVarChar, horario_disponible || null);
        insertCoachRequest.input('experiencia', sql.NVarChar, experiencia || null);
        
        const insertCoachResult = await insertCoachRequest.query(`
          INSERT INTO Coaches (
            id_usuario, 
            especialidad, 
            certificaciones, 
            biografia, 
            horario_disponible,
            experiencia
          )
          VALUES (
            @id_usuario,
            @especialidad,
            @certificaciones,
            @biografia,
            @horario_disponible,
            @experiencia
          );
          
          SELECT SCOPE_IDENTITY() AS id_coach;
        `);
        
        coachId = insertCoachResult.recordset[0].id_coach;
        console.log('Nuevo registro de coach creado, ID:', coachId);
      }
      
      // 4. Obtener los datos actualizados para devolverlos como respuesta
      const getUpdatedDataRequest = new sql.Request(transaction);
      getUpdatedDataRequest.input('id_usuario', sql.Int, userId);
      
      const updatedDataResult = await getUpdatedDataRequest.query(`
        SELECT 
          u.id_usuario,
          u.nombre,
          u.email,
          u.telefono,
          u.tipo_usuario,
          c.id_coach,
          c.especialidad,
          c.certificaciones,
          c.biografia,
          c.horario_disponible,
          c.experiencia
        FROM 
          Usuarios u
        JOIN 
          Coaches c ON u.id_usuario = c.id_usuario
        WHERE 
          u.id_usuario = @id_usuario;
      `);
      
      if (updatedDataResult.recordset.length === 0) {
        await transaction.rollback();
        return res.status(500).json({ message: 'Error al obtener los datos actualizados' });
      }
      
      // Confirmar la transacción
      await transaction.commit();
      
      // Formatear los datos de manera adecuada para el frontend
      const userData = updatedDataResult.recordset[0];
      const response = {
        id_usuario: userData.id_usuario,
        nombre: userData.nombre,
        email: userData.email,
        telefono: userData.telefono,
        tipo_usuario: userData.tipo_usuario,
        id_coach: userData.id_coach,
        especialidad: userData.especialidad,
        certificaciones: userData.certificaciones,
        biografia: userData.biografia,
        horario_disponible: userData.horario_disponible,
        experiencia: userData.experiencia
      };
      
      console.log('Datos actualizados correctamente:', response);
      res.json(response);
      
    } catch (transactionError) {
      // Si ocurre un error, hacer rollback
      await transaction.rollback();
      throw transactionError;
    }
    
  } catch (error) {
    console.error('Error al actualizar perfil de coach:', error);
    res.status(500).json({ 
      message: 'Error al actualizar perfil', 
      details: error.message 
    });
  }
});

// GET /coach/clients/:clientId
router.get('/clients/:clientId', authMiddleware, coachMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    const pool = await connectDB();
    
    // Verificar si el cliente está asignado a este coach
    const result = await pool.request()
      .input('id_coach', sql.Int, req.user.coach_id)
      .input('id_usuario', sql.Int, clientId)
      .query(`
        SELECT 
          u.id_usuario,
          u.nombre,
          u.email,
          u.telefono,
          a.fecha_asignacion,
          a.estado
        FROM 
          Asignaciones_Coach_Cliente a
        JOIN 
          Usuarios u ON a.id_usuario = u.id_usuario
        WHERE 
          a.id_coach = @id_coach AND 
          u.id_usuario = @id_usuario AND
          a.estado = 'activa'
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado o no asignado a este coach' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ message: 'Error al obtener cliente' });
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

// router.post('/assign-routine', authMiddleware, async (req, res) => {
//   try {
//     console.log('==== Asignando rutina a cliente ====');
//     const { userId, routineId } = req.body;
    
//     if (!userId || !routineId) {
//       return res.status(400).json({ message: 'Se requiere ID de usuario y rutina' });
//     }
    
//     console.log('ID de usuario cliente:', userId);
//     console.log('ID de rutina:', routineId);
    
//     const pool = await connectDB();
    
//     // Verificar que la rutina exista
//     const routineResult = await pool.request()
//       .input('id_rutina', sql.Int, routineId)
//       .query(`
//         SELECT * FROM Rutinas WHERE id_rutina = @id_rutina
//       `);
    
//     if (routineResult.recordset.length === 0) {
//       return res.status(404).json({ message: 'Rutina no encontrada' });
//     }
    
//     // Verificar que el usuario exista y está asignado a este coach
//     const coachResult = await pool.request()
//       .input('id_usuario', sql.Int, req.user.id)
//       .query(`
//         SELECT id_coach 
//         FROM Coaches 
//         WHERE id_usuario = @id_usuario
//       `);
    
//     if (coachResult.recordset.length === 0) {
//       return res.status(404).json({ message: 'Coach no encontrado' });
//     }
    
//     const coachId = coachResult.recordset[0].id_coach;
    
//     // Verificar que el cliente está asignado a este coach
//     const clientResult = await pool.request()
//       .input('id_coach', sql.Int, coachId)
//       .input('id_usuario', sql.Int, userId)
//       .query(`
//         SELECT * 
//         FROM Asignaciones_Coach_Cliente
//         WHERE id_coach = @id_coach AND id_usuario = @id_usuario AND estado = 'activa'
//       `);
    
//     if (clientResult.recordset.length === 0) {
//       return res.status(403).json({ message: 'Este cliente no está asignado a tu cuenta' });
//     }
    
//     // Crear una nueva asignación de rutina
//     // Primero, verificar si ya existe una asignación activa de esta rutina para este usuario
//     const existingAssignmentResult = await pool.request()
//       .input('id_rutina', sql.Int, routineId)
//       .input('id_usuario', sql.Int, userId)
//       .query(`
//         SELECT *
//         FROM Asignaciones_Rutina
//         WHERE id_rutina = @id_rutina 
//           AND id_usuario = @id_usuario 
//           AND estado = 'activa'
//       `);
    
//     if (existingAssignmentResult.recordset.length > 0) {
//       // Ya existe una asignación activa, no crear una nueva
//       return res.json({ 
//         message: 'Este usuario ya tiene esta rutina asignada',
//         assignmentId: existingAssignmentResult.recordset[0].id_asignacion_rutina
//       });
//     }
    
//     // Desactivar cualquier asignación de rutina activa anterior para este usuario
//     await pool.request()
//       .input('id_usuario', sql.Int, userId)
//       .query(`
//         UPDATE Asignaciones_Rutina
//         SET estado = 'completada'
//         WHERE id_usuario = @id_usuario AND estado = 'activa'
//       `);
    
//     // Crear nueva asignación
//     const assignmentResult = await pool.request()
//       .input('id_rutina', sql.Int, routineId)
//       .input('id_usuario', sql.Int, userId)
//       .input('fecha_asignacion', sql.Date, new Date())
//       .input('fecha_inicio', sql.Date, new Date())
//       .query(`
//         INSERT INTO Asignaciones_Rutina (
//           id_rutina,
//           id_usuario,
//           fecha_asignacion,
//           fecha_inicio,
//           estado,
//           notas_coach
//         )
//         VALUES (
//           @id_rutina,
//           @id_usuario,
//           @fecha_asignacion,
//           @fecha_inicio,
//           'activa',
//           'Asignada por entrenador'
//         );
        
//         SELECT SCOPE_IDENTITY() AS id_asignacion_rutina;
//       `);
    
//     // Obtener el ID de la asignación
//     const assignmentId = assignmentResult.recordset[0].id_asignacion_rutina;
//     console.log('Asignación de rutina creada, ID:', assignmentId);
    
//     // Crear notificación para el cliente
//     await pool.request()
//       .input('id_usuario', sql.Int, userId)
//       .input('id_origen', sql.Int, req.user.id)
//       .input('titulo', sql.NVarChar, 'Nueva rutina asignada')
//       .input('mensaje', sql.NVarChar, `Tu entrenador te ha asignado una nueva rutina: ${routineResult.recordset[0].nombre}`)
//       .query(`
//         INSERT INTO Notificaciones (
//           id_usuario,
//           tipo,
//           titulo,
//           mensaje,
//           fecha_creacion,
//           leida,
//           id_origen
//         )
//         VALUES (
//           @id_usuario,
//           'nueva_rutina',
//           @titulo,
//           @mensaje,
//           GETDATE(),
//           0,
//           @id_origen
//         )
//       `);
    
//     res.json({ 
//       message: 'Rutina asignada correctamente',
//       assignmentId: assignmentId
//     });
//   } catch (error) {
//     console.error('Error al asignar rutina:', error);
//     res.status(500).json({ message: 'Error al asignar rutina' });
//   }
// });

// // Rechazar solicitud
// router.post('/reject-request/:id', authMiddleware, async (req, res) => {
//   const { id } = req.params;
  
//   try {
//     console.log('==== Rechazando solicitud ====');
//     console.log('ID de asignación:', id);
    
//     const pool = await connectDB();
    
//     // Actualizar el estado de la asignación a 'rechazada'
//     await pool.request()
//       .input('id_asignacion', sql.Int, id)
//       .query(`
//         UPDATE Asignaciones_Coach_Cliente
//         SET estado = 'rechazada'
//         WHERE id_asignacion = @id_asignacion
//       `);
    
//     console.log('Asignación actualizada a estado "rechazada"');
    
//     // Obtener información para la notificación
//     const assignmentResult = await pool.request()
//       .input('id_asignacion', sql.Int, id)
//       .query(`
//         SELECT 
//           a.id_usuario AS id_cliente,
//           u.nombre AS nombre_coach
//         FROM 
//           Asignaciones_Coach_Cliente a
//         JOIN 
//           Coaches c ON a.id_coach = c.id_coach
//         JOIN 
//           Usuarios u ON c.id_usuario = u.id_usuario
//         WHERE 
//           a.id_asignacion = @id_asignacion
//       `);
    
//     if (assignmentResult.recordset.length > 0) {
//       const { id_cliente, nombre_coach } = assignmentResult.recordset[0];
//       console.log('Información para notificación - Cliente ID:', id_cliente, 'Nombre coach:', nombre_coach);
      
//       // Crear notificación para el cliente
//       await pool.request()
//         .input('id_usuario', sql.Int, id_cliente)
//         .input('id_origen', sql.Int, req.user.id)
//         .input('titulo', sql.NVarChar, 'Solicitud de entrenador rechazada')
//         .input('mensaje', sql.NVarChar, `El entrenador ${nombre_coach} ha rechazado tu solicitud. Por favor, intenta con otro entrenador.`)
//         .query(`
//           INSERT INTO Notificaciones (
//             id_usuario,
//             tipo,
//             titulo,
//             mensaje,
//             fecha_creacion,
//             leida,
//             id_origen
//           )
//           VALUES (
//             @id_usuario,
//             'asignacion_coach',
//             @titulo,
//             @mensaje,
//             GETDATE(),
//             0,
//             @id_origen
//           )
//         `);
      
//       console.log('Notificación creada para el cliente');
//     }
    
//     res.json({ message: 'Solicitud rechazada correctamente' });
//   } catch (error) {
//     console.error('Error al rechazar solicitud:', error);
//     res.status(500).json({ message: 'Error al rechazar solicitud' });
//   }
// });
// router.post('/custom-routine', authMiddleware, async (req, res) => {
//   try {
//     console.log('==== Creando rutina personalizada ====');
//     const { 
//       clientId, 
//       nombre, 
//       descripcion, 
//       objetivo, 
//       nivel_dificultad, 
//       duracion_estimada 
//     } = req.body;
    
//     if (!clientId || !nombre) {
//       return res.status(400).json({ message: 'El ID del cliente y nombre de la rutina son obligatorios' });
//     }
    
//     console.log('Datos recibidos:', {
//       clientId,
//       nombre,
//       objetivo: objetivo || 'No especificado',
//       nivel: nivel_dificultad || 'intermedio'
//     });
    
//     const pool = await connectDB();
    
//     // Obtener el id_coach del usuario actual
//     const coachResult = await pool.request()
//       .input('id_usuario', sql.Int, req.user.id)
//       .query(`
//         SELECT id_coach 
//         FROM Coaches 
//         WHERE id_usuario = @id_usuario
//       `);
    
//     if (coachResult.recordset.length === 0) {
//       return res.status(404).json({ message: 'Coach no encontrado' });
//     }
    
//     const coachId = coachResult.recordset[0].id_coach;
    
//     // Verificar que el cliente está asignado a este coach
//     const clientResult = await pool.request()
//       .input('id_coach', sql.Int, coachId)
//       .input('id_usuario', sql.Int, clientId)
//       .query(`
//         SELECT * 
//         FROM Asignaciones_Coach_Cliente
//         WHERE id_coach = @id_coach AND id_usuario = @id_usuario AND estado = 'activa'
//       `);
    
//     if (clientResult.recordset.length === 0) {
//       return res.status(403).json({ message: 'Este cliente no está asignado a tu cuenta' });
//     }
    
//     // Crear la rutina personalizada
//     const rutineResult = await pool.request()
//       .input('id_coach', sql.Int, coachId)
//       .input('nombre', sql.NVarChar, nombre)
//       .input('descripcion', sql.NVarChar, descripcion || null)
//       .input('objetivo', sql.NVarChar, objetivo || null)
//       .input('nivel_dificultad', sql.NVarChar, nivel_dificultad || 'intermedio')
//       .input('duracion_estimada', sql.Int, duracion_estimada || 60)
//       .input('es_personalizada', sql.Bit, 1)
//       .input('id_cliente_destino', sql.Int, clientId)
//       .query(`
//         INSERT INTO Rutinas (
//           id_coach,
//           nombre,
//           descripcion,
//           objetivo,
//           nivel_dificultad,
//           duracion_estimada,
//           fecha_creacion,
//           es_personalizada,
//           id_cliente_destino
//         )
//         VALUES (
//           @id_coach,
//           @nombre,
//           @descripcion,
//           @objetivo,
//           @nivel_dificultad,
//           @duracion_estimada,
//           GETDATE(),
//           @es_personalizada,
//           @id_cliente_destino
//         );
        
//         SELECT SCOPE_IDENTITY() AS id_rutina;
//       `);
    
//     const routineId = rutineResult.recordset[0].id_rutina;
//     console.log('Rutina personalizada creada, ID:', routineId);
    
//     // Opcionalmente, asignar automáticamente la rutina al cliente
//     const assignmentResult = await pool.request()
//       .input('id_rutina', sql.Int, routineId)
//       .input('id_usuario', sql.Int, clientId)
//       .input('fecha_asignacion', sql.Date, new Date())
//       .input('fecha_inicio', sql.Date, new Date())
//       .query(`
//         INSERT INTO Asignaciones_Rutina (
//           id_rutina,
//           id_usuario,
//           fecha_asignacion,
//           fecha_inicio,
//           estado,
//           notas_coach
//         )
//         VALUES (
//           @id_rutina,
//           @id_usuario,
//           @fecha_asignacion,
//           @fecha_inicio,
//           'activa',
//           'Rutina personalizada creada específicamente para ti'
//         );
        
//         SELECT SCOPE_IDENTITY() AS id_asignacion_rutina;
//       `);
    
//     const assignmentId = assignmentResult.recordset[0].id_asignacion_rutina;
    
//     // Crear notificación para el cliente
//     await pool.request()
//       .input('id_usuario', sql.Int, clientId)
//       .input('id_origen', sql.Int, req.user.id)
//       .input('titulo', sql.NVarChar, 'Nueva rutina personalizada')
//       .input('mensaje', sql.NVarChar, `Tu entrenador ha creado una rutina personalizada para ti: ${nombre}`)
//       .query(`
//         INSERT INTO Notificaciones (
//           id_usuario,
//           tipo,
//           titulo,
//           mensaje,
//           fecha_creacion,
//           leida,
//           id_origen
//         )
//         VALUES (
//           @id_usuario,
//           'nueva_rutina',
//           @titulo,
//           @mensaje,
//           GETDATE(),
//           0,
//           @id_origen
//         )
//       `);
    
//     res.status(201).json({
//       message: 'Rutina personalizada creada y asignada correctamente',
//       routineId,
//       assignmentId
//     });
    
//   } catch (error) {
//     console.error('Error al crear rutina personalizada:', error);
//     res.status(500).json({ message: 'Error al crear rutina personalizada' });
//   }
// });

// router.get('/custom-routines/:clientId', authMiddleware, async (req, res) => {
//   try {
//     const { clientId } = req.params;
    
//     console.log('==== Obteniendo rutinas personalizadas ====');
//     console.log('ID del cliente:', clientId);
    
//     const pool = await connectDB();
    
//     // Obtener el id_coach del usuario actual
//     const coachResult = await pool.request()
//       .input('id_usuario', sql.Int, req.user.id)
//       .query(`
//         SELECT id_coach 
//         FROM Coaches 
//         WHERE id_usuario = @id_usuario
//       `);
    
//     if (coachResult.recordset.length === 0) {
//       return res.status(404).json({ message: 'Coach no encontrado' });
//     }
    
//     const coachId = coachResult.recordset[0].id_coach;
    
//     // Verificar que el cliente está asignado a este coach
//     const clientResult = await pool.request()
//       .input('id_coach', sql.Int, coachId)
//       .input('id_usuario', sql.Int, clientId)
//       .query(`
//         SELECT * 
//         FROM Asignaciones_Coach_Cliente
//         WHERE id_coach = @id_coach AND id_usuario = @id_usuario AND estado = 'activa'
//       `);
    
//     if (clientResult.recordset.length === 0) {
//       return res.status(403).json({ message: 'Este cliente no está asignado a tu cuenta' });
//     }
    
//     // Obtener rutinas personalizadas para este cliente
//     const routinesResult = await pool.request()
//       .input('id_coach', sql.Int, coachId)
//       .input('id_cliente', sql.Int, clientId)
//       .query(`
//         SELECT 
//           r.id_rutina,
//           r.nombre,
//           r.descripcion,
//           r.objetivo,
//           r.nivel_dificultad,
//           r.duracion_estimada,
//           r.fecha_creacion,
//           (SELECT COUNT(*) FROM Detalles_Rutina WHERE id_rutina = r.id_rutina) AS total_ejercicios,
//           (
//             SELECT TOP 1 ar.estado
//             FROM Asignaciones_Rutina ar
//             WHERE ar.id_rutina = r.id_rutina AND ar.id_usuario = @id_cliente
//             ORDER BY ar.fecha_asignacion DESC
//           ) AS estado_asignacion
//         FROM 
//           Rutinas r
//         WHERE 
//           r.id_coach = @id_coach AND 
//           r.es_personalizada = 1 AND 
//           r.id_cliente_destino = @id_cliente
//         ORDER BY
//           r.fecha_creacion DESC
//       `);
    
//     console.log('Total de rutinas personalizadas encontradas:', routinesResult.recordset.length);
    
//     res.json(routinesResult.recordset);
//   } catch (error) {
//     console.error('Error al obtener rutinas personalizadas:', error);
//     res.status(500).json({ message: 'Error al obtener rutinas personalizadas' });
//   }
// });

// router.post('/routines/:routineId/exercises', authMiddleware, async (req, res) => {
//   try {
//     const { routineId } = req.params;
//     const { 
//       id_ejercicio, 
//       series, 
//       repeticiones, 
//       descanso_segundos, 
//       notas,
//       orden 
//     } = req.body;
    
//     if (!id_ejercicio || !series || !repeticiones) {
//       return res.status(400).json({ 
//         message: 'El ejercicio, series y repeticiones son obligatorios' 
//       });
//     }
    
//     console.log('==== Agregando ejercicio a rutina ====');
//     console.log('ID de rutina:', routineId);
//     console.log('ID de ejercicio:', id_ejercicio);
    
//     const pool = await connectDB();
    
//     // Obtener el id_coach del usuario actual
//     const coachResult = await pool.request()
//       .input('id_usuario', sql.Int, req.user.id)
//       .query(`
//         SELECT id_coach 
//         FROM Coaches 
//         WHERE id_usuario = @id_usuario
//       `);
    
//     if (coachResult.recordset.length === 0) {
//       return res.status(404).json({ message: 'Coach no encontrado' });
//     }
    
//     const coachId = coachResult.recordset[0].id_coach;
    
//     // Verificar que la rutina pertenece a este coach
//     const routineResult = await pool.request()
//       .input('id_rutina', sql.Int, routineId)
//       .input('id_coach', sql.Int, coachId)
//       .query(`
//         SELECT * 
//         FROM Rutinas
//         WHERE id_rutina = @id_rutina AND id_coach = @id_coach
//       `);
    
//     if (routineResult.recordset.length === 0) {
//       return res.status(403).json({ message: 'No tienes acceso a esta rutina' });
//     }
    
//     // Verificar que el ejercicio existe
//     const exerciseResult = await pool.request()
//       .input('id_ejercicio', sql.Int, id_ejercicio)
//       .query(`
//         SELECT * 
//         FROM Ejercicios
//         WHERE id_ejercicio = @id_ejercicio
//       `);
    
//     if (exerciseResult.recordset.length === 0) {
//       return res.status(404).json({ message: 'Ejercicio no encontrado' });
//     }
    
//     // Determinar el orden si no se especifica
//     let ordenFinal = orden;
//     if (!ordenFinal) {
//       const lastOrderResult = await pool.request()
//         .input('id_rutina', sql.Int, routineId)
//         .query(`
//           SELECT MAX(orden) AS max_orden
//           FROM Detalles_Rutina
//           WHERE id_rutina = @id_rutina
//         `);
      
//       ordenFinal = (lastOrderResult.recordset[0].max_orden || 0) + 1;
//     }
    
//     // Agregar ejercicio a la rutina
//     const result = await pool.request()
//       .input('id_rutina', sql.Int, routineId)
//       .input('id_ejercicio', sql.Int, id_ejercicio)
//       .input('orden', sql.Int, ordenFinal)
//       .input('series', sql.Int, series)
//       .input('repeticiones', sql.NVarChar, repeticiones)
//       .input('descanso_segundos', sql.Int, descanso_segundos || 60)
//       .input('notas', sql.NVarChar, notas || null)
//       .query(`
//         INSERT INTO Detalles_Rutina (
//           id_rutina,
//           id_ejercicio,
//           orden,
//           series,
//           repeticiones,
//           descanso_segundos,
//           notas
//         )
//         VALUES (
//           @id_rutina,
//           @id_ejercicio,
//           @orden,
//           @series,
//           @repeticiones,
//           @descanso_segundos,
//           @notas
//         );
        
//         SELECT SCOPE_IDENTITY() AS id_detalle;
//       `);
    
//     const detalleId = result.recordset[0].id_detalle;
//     console.log('Ejercicio agregado, ID:', detalleId);
    
//     // Obtener información completa del ejercicio para devolver
//     const detalleResult = await pool.request()
//       .input('id_detalle', sql.Int, detalleId)
//       .query(`
//         SELECT 
//           dr.*,
//           e.nombre AS nombre_ejercicio,
//           e.descripcion AS descripcion_ejercicio,
//           e.grupos_musculares,
//           e.imagen_url
//         FROM 
//           Detalles_Rutina dr
//         JOIN
//           Ejercicios e ON dr.id_ejercicio = e.id_ejercicio
//         WHERE 
//           dr.id_detalle = @id_detalle
//       `);
    
//     res.status(201).json({
//       message: 'Ejercicio agregado correctamente',
//       ejercicio: detalleResult.recordset[0]
//     });
    
//   } catch (error) {
//     console.error('Error al agregar ejercicio a rutina:', error);
//     res.status(500).json({ message: 'Error al agregar ejercicio' });
//   }
// });



// router.get('/available-exercises', authMiddleware, async (req, res) => {
//   try {
//     console.log('==== Obteniendo ejercicios disponibles ====');
    
//     const pool = await connectDB();
    
//     // Obtener todos los ejercicios
//     const exercisesResult = await pool.request()
//       .query(`
//         SELECT 
//           id_ejercicio,
//           nombre,
//           descripcion,
//           instrucciones,
//           grupos_musculares,
//           equipo_necesario,
//           video_url,
//           imagen_url
//         FROM 
//           Ejercicios
//         ORDER BY
//           nombre ASC
//       `);
    
//     console.log('Total de ejercicios disponibles:', exercisesResult.recordset.length);
    
//     res.json(exercisesResult.recordset);
//   } catch (error) {
//     console.error('Error al obtener ejercicios disponibles:', error);
//     res.status(500).json({ message: 'Error al obtener ejercicios' });
//   }
// });
// /**
//  * @route   GET /api/coach/routines/:routineId/exercises
//  * @desc    Obtener todos los ejercicios de una rutina
//  * @access  Private (Coach)
//  */
// router.get('/routines/:routineId/exercises', authMiddleware, async (req, res) => {
//   try {
//     const { routineId } = req.params;
    
//     console.log('==== Obteniendo ejercicios de rutina ====');
//     console.log('ID de rutina:', routineId);
    
//     const pool = await connectDB();
    
//     // Obtener el id_coach del usuario actual
//     const coachResult = await pool.request()
//       .input('id_usuario', sql.Int, req.user.id)
//       .query(`
//         SELECT id_coach 
//         FROM Coaches 
//         WHERE id_usuario = @id_usuario
//       `);
    
//     if (coachResult.recordset.length === 0) {
//       return res.status(404).json({ message: 'Coach no encontrado' });
//     }
    
//     const coachId = coachResult.recordset[0].id_coach;
    
//     // Verificar que la rutina pertenece a este coach
//     const routineResult = await pool.request()
//       .input('id_rutina', sql.Int, routineId)
//       .input('id_coach', sql.Int, coachId)
//       .query(`
//         SELECT * 
//         FROM Rutinas
//         WHERE id_rutina = @id_rutina AND id_coach = @id_coach
//       `);
    
//     if (routineResult.recordset.length === 0) {
//       return res.status(403).json({ message: 'No tienes acceso a esta rutina' });
//     }
    
//     // Obtener ejercicios de la rutina
//     const exercisesResult = await pool.request()
//       .input('id_rutina', sql.Int, routineId)
//       .query(`
//         SELECT 
//           dr.id_detalle,
//           dr.id_ejercicio,
//           dr.orden,
//           dr.series,
//           dr.repeticiones,
//           dr.descanso_segundos,
//           dr.notas,
//           e.nombre AS nombre_ejercicio,
//           e.descripcion AS descripcion_ejercicio,
//           e.grupos_musculares,
//           e.imagen_url
//         FROM 
//           Detalles_Rutina dr
//         JOIN
//           Ejercicios e ON dr.id_ejercicio = e.id_ejercicio
//         WHERE 
//           dr.id_rutina = @id_rutina
//         ORDER BY
//           dr.orden ASC
//       `);
    
//     console.log('Total de ejercicios en la rutina:', exercisesResult.recordset.length);
    
//     res.json(exercisesResult.recordset);
//   } catch (error) {
//     console.error('Error al obtener ejercicios de la rutina:', error);
//     res.status(500).json({ message: 'Error al obtener ejercicios' });
//   }
// });

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

// Obtener todos los ejercicios disponibles
router.get('/exercises', authMiddleware, verifyCoach, async (req, res) => {
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

// Obtener información de un cliente específico
router.get('/client/:clientId', authMiddleware, verifyCoach, async (req, res) => {
  try {
    const { clientId } = req.params;
    
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
// Obtener las rutinas creadas por el coach
router.get('/routines', authMiddleware, verifyCoach, async (req, res) => {
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
router.get('/routine/:routineId', authMiddleware, verifyCoach, async (req, res) => {
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

// // Crear una nueva rutina personalizada
// router.post('/routine', authMiddleware, verifyCoach, async (req, res) => {
//   try {
//     const {
//       nombre,
//       descripcion,
//       objetivo,
//       nivel_dificultad,
//       duracion_estimada,
//       id_cliente,
//       ejercicios
//     } = req.body;
    
//     // Validar que hay al menos un ejercicio
//     if (!ejercicios || !Array.isArray(ejercicios) || ejercicios.length === 0) {
//       return res.status(400).json({ message: 'Debes incluir al menos un ejercicio en la rutina' });
//     }
    
//     const pool = await connectDB();
    
//     // Obtener ID del coach
//     const coachId = await getCoachIdFromUserId(req.user.id);
    
//     // Verificar que el cliente está asignado a este coach
//     const assignmentResult = await pool.request()
//       .input('coachId', sql.Int, coachId)
//       .input('clientId', sql.Int, id_cliente)
//       .query(`
//         SELECT id_asignacion
//         FROM Asignaciones_Coach_Cliente
//         WHERE id_coach = @coachId AND id_usuario = @clientId AND estado = 'activa'
//       `);
    
//     if (assignmentResult.recordset.length === 0) {
//       return res.status(403).json({ 
//         message: 'Este cliente no está asignado a tu perfil de coach' 
//       });
//     }
    
//     // Iniciar transacción
//     const transaction = new sql.Transaction(pool);
//     await transaction.begin();
    
//     try {
//       // 1. Insertar la rutina
//       const routineResult = await new sql.Request(transaction)
//         .input('coachId', sql.Int, coachId)
//         .input('nombre', sql.VarChar(100), nombre)
//         .input('descripcion', sql.Text, descripcion || null)
//         .input('objetivo', sql.VarChar(100), objetivo || null)
//         .input('nivel_dificultad', sql.VarChar(20), nivel_dificultad || 'intermedio')
//         .input('duracion_estimada', sql.Int, duracion_estimada || 60)
//         .query(`
//           INSERT INTO Rutinas (
//             id_coach,
//             nombre,
//             descripcion,
//             objetivo,
//             nivel_dificultad,
//             duracion_estimada,
//             fecha_creacion
//           )
//           OUTPUT INSERTED.id_rutina
//           VALUES (
//             @coachId,
//             @nombre,
//             @descripcion,
//             @objetivo,
//             @nivel_dificultad,
//             @duracion_estimada,
//             GETDATE()
//           )
//         `);
      
//       const id_rutina = routineResult.recordset[0].id_rutina;
      
//       // 2. Insertar los detalles de la rutina (ejercicios)
//       for (const ejercicio of ejercicios) {
//         await new sql.Request(transaction)
//           .input('id_rutina', sql.Int, id_rutina)
//           .input('id_ejercicio', sql.Int, ejercicio.id_ejercicio)
//           .input('orden', sql.Int, ejercicio.orden)
//           .input('series', sql.Int, ejercicio.series)
//           .input('repeticiones', sql.VarChar(50), ejercicio.repeticiones)
//           .input('descanso_segundos', sql.Int, ejercicio.descanso_segundos || 60)
//           .input('notas', sql.Text, ejercicio.notas || null)
//           .query(`
//             INSERT INTO Detalles_Rutina (
//               id_rutina,
//               id_ejercicio,
//               orden,
//               series,
//               repeticiones,
//               descanso_segundos,
//               notas
//             )
//             VALUES (
//               @id_rutina,
//               @id_ejercicio,
//               @orden,
//               @series,
//               @repeticiones,
//               @descanso_segundos,
//               @notas
//             )
//           `);
//       }
      
//       // 3. Asignar la rutina al cliente
//       await new sql.Request(transaction)
//         .input('id_rutina', sql.Int, id_rutina)
//         .input('id_usuario', sql.Int, id_cliente)
//         .query(`
//           INSERT INTO Asignaciones_Rutina (
//             id_rutina,
//             id_usuario,
//             fecha_asignacion,
//             fecha_inicio,
//             fecha_fin,
//             estado,
//             notas_coach
//           )
//           VALUES (
//             @id_rutina,
//             @id_usuario,
//             GETDATE(),
//             GETDATE(),
//             NULL,
//             'activa',
//             'Rutina personalizada asignada'
//           )
//         `);
      
//       // 4. Commit de la transacción
//       await transaction.commit();
      
//       res.json({ 
//         message: 'Rutina creada y asignada correctamente',
//         id_rutina
//       });
      
//     } catch (error) {
//       // Si hay error, hacer rollback
//       await transaction.rollback();
//       throw error;
//     }
    
//   } catch (error) {
//     console.error('Error al crear rutina personalizada:', error);
//     res.status(500).json({ message: 'Error al crear rutina personalizada' });
//   }
// });


// Add this route to routes/coach.js
// Create a new custom routine
router.post('/routine', authMiddleware, verifyCoach, async (req, res) => {
  try {
    console.log('==== Creando rutina personalizada ====');
    const { 
      nombre, 
      descripcion, 
      objetivo, 
      nivel_dificultad, 
      duracion_estimada,
      id_cliente,
      ejercicios 
    } = req.body;
    
    // Validaciones básicas
    if (!nombre) {
      return res.status(400).json({ message: 'El nombre de la rutina es obligatorio' });
    }
    
    if (!ejercicios || !Array.isArray(ejercicios) || ejercicios.length === 0) {
      return res.status(400).json({ message: 'La rutina debe tener al menos un ejercicio' });
    }
    
    console.log('Datos recibidos:', {
      nombre,
      objetivo: objetivo || 'No especificado',
      nivel: nivel_dificultad || 'intermedio',
      duracion: duracion_estimada || 60,
      ejercicios: ejercicios.length
    });
    
    const pool = await connectDB();
    
    // Obtener el id_coach del usuario actual
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    // Crear transacción para asegurar que todo se guarde correctamente
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // 1. Crear la rutina principal
      const rutineRequest = new sql.Request(transaction);
      rutineRequest.input('id_coach', sql.Int, coachId);
      rutineRequest.input('nombre', sql.NVarChar, nombre);
      rutineRequest.input('descripcion', sql.NVarChar, descripcion || null);
      rutineRequest.input('objetivo', sql.NVarChar, objetivo || null);
      rutineRequest.input('nivel_dificultad', sql.NVarChar, nivel_dificultad || 'intermedio');
      rutineRequest.input('duracion_estimada', sql.Int, duracion_estimada || 60);
      rutineRequest.input('es_personalizada', sql.Bit, id_cliente ? 1 : 0);
      rutineRequest.input('id_cliente_destino', sql.Int, id_cliente || null);
      
      const rutineResult = await rutineRequest.query(`
        INSERT INTO Rutinas (
          id_coach,
          nombre,
          descripcion,
          objetivo,
          nivel_dificultad,
          duracion_estimada,
          fecha_creacion,
          es_personalizada,
          id_cliente_destino
        )
        VALUES (
          @id_coach,
          @nombre,
          @descripcion,
          @objetivo,
          @nivel_dificultad,
          @duracion_estimada,
          GETDATE(),
          @es_personalizada,
          @id_cliente_destino
        );
        
        SELECT SCOPE_IDENTITY() AS id_rutina;
      `);
      
      const routineId = rutineResult.recordset[0].id_rutina;
      console.log('Rutina creada, ID:', routineId);
      
      // 2. Insertar los ejercicios de la rutina
      for (const ejercicio of ejercicios) {
        const ejercicioRequest = new sql.Request(transaction);
        ejercicioRequest.input('id_rutina', sql.Int, routineId);
        ejercicioRequest.input('id_ejercicio', sql.Int, ejercicio.id_ejercicio);
        ejercicioRequest.input('orden', sql.Int, ejercicio.orden || 1);
        ejercicioRequest.input('series', sql.Int, ejercicio.series || 3);
        ejercicioRequest.input('repeticiones', sql.NVarChar, ejercicio.repeticiones || '12');
        ejercicioRequest.input('descanso_segundos', sql.Int, ejercicio.descanso_segundos || 60);
        ejercicioRequest.input('notas', sql.NVarChar, ejercicio.notas || null);
        
        await ejercicioRequest.query(`
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
          );
        `);
      }
      
      // 3. Si hay un cliente específico, asignar la rutina automáticamente
      if (id_cliente) {
        // Primero verificar que el cliente está asignado a este coach
        const clientCheckRequest = new sql.Request(transaction);
        clientCheckRequest.input('id_coach', sql.Int, coachId);
        clientCheckRequest.input('id_cliente', sql.Int, id_cliente);
        
        const clientCheckResult = await clientCheckRequest.query(`
          SELECT id_asignacion 
          FROM Asignaciones_Coach_Cliente
          WHERE id_coach = @id_coach AND id_usuario = @id_cliente AND estado = 'activa'
        `);
        
        if (clientCheckResult.recordset.length > 0) {
          // El cliente está asignado, desactivar rutinas anteriores
          const deactivateRequest = new sql.Request(transaction);
          deactivateRequest.input('id_cliente', sql.Int, id_cliente);
          
          await deactivateRequest.query(`
            UPDATE Asignaciones_Rutina
            SET estado = 'completada'
            WHERE id_usuario = @id_cliente AND estado = 'activa'
          `);
          
          // Asignar la nueva rutina
          const assignRequest = new sql.Request(transaction);
          assignRequest.input('id_rutina', sql.Int, routineId);
          assignRequest.input('id_cliente', sql.Int, id_cliente);
          
          await assignRequest.query(`
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
              @id_cliente,
              GETDATE(),
              GETDATE(),
              NULL,
              'activa',
              'Rutina personalizada asignada automáticamente'
            )
          `);
          
          console.log('Rutina asignada al cliente ID:', id_cliente);
          
          // Opcionalmente, crear una notificación para el cliente
          const notifyRequest = new sql.Request(transaction);
          notifyRequest.input('id_cliente', sql.Int, id_cliente);
          notifyRequest.input('id_origen', sql.Int, req.user.id);
          notifyRequest.input('titulo', sql.NVarChar, 'Nueva rutina personalizada');
          notifyRequest.input('mensaje', sql.NVarChar, `Tu entrenador ha creado una nueva rutina personalizada para ti: ${nombre}`);
          
          await notifyRequest.query(`
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
              @id_cliente,
              'nueva_rutina',
              @titulo,
              @mensaje,
              GETDATE(),
              0,
              @id_origen
            )
          `);
        }
      }
      
      // Confirmar transacción
      await transaction.commit();
      
      // Responder con éxito
      res.status(201).json({
        message: 'Rutina creada exitosamente',
        id_rutina: routineId,
        nombre: nombre,
        asignada: id_cliente ? true : false
      });
      
    } catch (error) {
      // Si hay error, hacer rollback
      await transaction.rollback();
      throw error;
    }
    
  } catch (error) {
    console.error('Error al crear rutina personalizada:', error);
    res.status(500).json({ 
      message: 'Error al crear rutina personalizada', 
      error: error.message 
    });
  }
});

// Get details of a specific routine
router.get('/routine/:routineId', authMiddleware, verifyCoach, async (req, res) => {
  try {
    const { routineId } = req.params;
    
    console.log('==== Obteniendo detalles de rutina ====');
    console.log('ID de rutina:', routineId);
    
    const pool = await connectDB();
    
    // Obtener el id_coach del usuario actual
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    // Verificar que la rutina pertenece a este coach
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
          r.fecha_creacion,
          r.es_personalizada,
          r.id_cliente_destino
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
          e.descripcion AS ejercicio_descripcion,
          e.grupos_musculares,
          e.imagen_url,
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

// Get clients who have this routine assigned
router.get('/routine/:routineId/assignments', authMiddleware, verifyCoach, async (req, res) => {
  try {
    const { routineId } = req.params;
    
    console.log('==== Obteniendo asignaciones de rutina ====');
    console.log('ID de rutina:', routineId);
    
    const pool = await connectDB();
    
    // Obtener el id_coach del usuario actual
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    // Verificar que la rutina pertenece a este coach
    const routineCheckResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .input('coachId', sql.Int, coachId)
      .query(`
        SELECT id_rutina
        FROM Rutinas
        WHERE id_rutina = @routineId AND id_coach = @coachId
      `);
    
    if (routineCheckResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Rutina no encontrada o no tienes acceso a ella' });
    }
    
    // Obtener los clientes asignados a esta rutina
    const assignmentsResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .query(`
        SELECT 
          ar.id_asignacion_rutina,
          u.id_usuario,
          u.nombre,
          u.email,
          ar.fecha_asignacion,
          ar.estado
        FROM 
          Asignaciones_Rutina ar
        JOIN 
          Usuarios u ON ar.id_usuario = u.id_usuario
        JOIN
          Asignaciones_Coach_Cliente acc ON u.id_usuario = acc.id_usuario
        WHERE 
          ar.id_rutina = @routineId AND
          acc.id_coach = @coachId AND
          acc.estado = 'activa'
        ORDER BY
          ar.fecha_asignacion DESC
      `);
    
    res.json(assignmentsResult.recordset);
  } catch (error) {
    console.error('Error al obtener asignaciones de la rutina:', error);
    res.status(500).json({ message: 'Error al obtener asignaciones de la rutina' });
  }
});

// Update a routine
router.put('/routine/:routineId', authMiddleware, verifyCoach, async (req, res) => {
  try {
    const { routineId } = req.params;
    const { 
      nombre, 
      descripcion, 
      objetivo, 
      nivel_dificultad, 
      duracion_estimada 
    } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ message: 'El nombre de la rutina es obligatorio' });
    }
    
    console.log('==== Actualizando rutina ====');
    console.log('ID de rutina:', routineId);
    
    const pool = await connectDB();
    
    // Obtener el id_coach del usuario actual
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    // Verificar que la rutina pertenece a este coach
    const routineCheckResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .input('coachId', sql.Int, coachId)
      .query(`
        SELECT id_rutina
        FROM Rutinas
        WHERE id_rutina = @routineId AND id_coach = @coachId
      `);
    
    if (routineCheckResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Rutina no encontrada o no tienes acceso a ella' });
    }
    
    // Actualizar la rutina
    await pool.request()
      .input('routineId', sql.Int, routineId)
      .input('nombre', sql.NVarChar, nombre)
      .input('descripcion', sql.NVarChar, descripcion || null)
      .input('objetivo', sql.NVarChar, objetivo || null)
      .input('nivel_dificultad', sql.NVarChar, nivel_dificultad || 'intermedio')
      .input('duracion_estimada', sql.Int, duracion_estimada || 45)
      .query(`
        UPDATE Rutinas
        SET 
          nombre = @nombre,
          descripcion = @descripcion,
          objetivo = @objetivo,
          nivel_dificultad = @nivel_dificultad,
          duracion_estimada = @duracion_estimada
        WHERE 
          id_rutina = @routineId
      `);
    
    res.json({ message: 'Rutina actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar la rutina:', error);
    res.status(500).json({ message: 'Error al actualizar la rutina' });
  }
});

// Delete a routine
router.delete('/routine/:routineId', authMiddleware, verifyCoach, async (req, res) => {
  try {
    const { routineId } = req.params;
    
    console.log('==== Eliminando rutina ====');
    console.log('ID de rutina:', routineId);
    
    const pool = await connectDB();
    
    // Obtener el id_coach del usuario actual
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    // Verificar que la rutina pertenece a este coach
    const routineCheckResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .input('coachId', sql.Int, coachId)
      .query(`
        SELECT id_rutina
        FROM Rutinas
        WHERE id_rutina = @routineId AND id_coach = @coachId
      `);
    
    if (routineCheckResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Rutina no encontrada o no tienes acceso a ella' });
    }
    
    // Iniciar una transacción para asegurarnos de que se eliminan todos los datos relacionados
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // 1. Desactivar las asignaciones activas de esta rutina
      await new sql.Request(transaction)
        .input('routineId', sql.Int, routineId)
        .query(`
          UPDATE Asignaciones_Rutina
          SET estado = 'cancelada'
          WHERE id_rutina = @routineId AND estado = 'activa'
        `);
      
      // 2. Eliminar los detalles de la rutina
      await new sql.Request(transaction)
        .input('routineId', sql.Int, routineId)
        .query(`
          DELETE FROM Detalles_Rutina
          WHERE id_rutina = @routineId
        `);
      
      // 3. Eliminar la rutina
      await new sql.Request(transaction)
        .input('routineId', sql.Int, routineId)
        .query(`
          DELETE FROM Rutinas
          WHERE id_rutina = @routineId
        `);
      
      // Confirmar transacción
      await transaction.commit();
      
      res.json({ message: 'Rutina eliminada correctamente' });
    } catch (error) {
      // Si hay error, hacer rollback
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error al eliminar la rutina:', error);
    res.status(500).json({ message: 'Error al eliminar la rutina' });
  }
});
// Update exercises in a routine
router.put('/routine/:routineId/exercises', authMiddleware, verifyCoach, async (req, res) => {
  try {
    const { routineId } = req.params;
    const { exercises } = req.body;
    
    if (!exercises || !Array.isArray(exercises) || exercises.length === 0) {
      return res.status(400).json({ message: 'Es necesario incluir al menos un ejercicio' });
    }
    
    console.log('==== Actualizando ejercicios de rutina ====');
    console.log('ID de rutina:', routineId);
    console.log('Número de ejercicios:', exercises.length);
    
    const pool = await connectDB();
    
    // Obtener el id_coach del usuario actual
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    // Verificar que la rutina pertenece a este coach
    const routineCheckResult = await pool.request()
      .input('routineId', sql.Int, routineId)
      .input('coachId', sql.Int, coachId)
      .query(`
        SELECT id_rutina
        FROM Rutinas
        WHERE id_rutina = @routineId AND id_coach = @coachId
      `);
    
    if (routineCheckResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Rutina no encontrada o no tienes acceso a ella' });
    }
    
    // Iniciar una transacción para asegurarnos de que todas las operaciones se completan correctamente
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // 1. Eliminar ejercicios existentes de la rutina
      await new sql.Request(transaction)
        .input('routineId', sql.Int, routineId)
        .query(`
          DELETE FROM Detalles_Rutina
          WHERE id_rutina = @routineId
        `);
      
      // 2. Insertar los nuevos ejercicios
      for (const exercise of exercises) {
        await new sql.Request(transaction)
          .input('routineId', sql.Int, routineId)
          .input('exerciseId', sql.Int, exercise.id_ejercicio)
          .input('orden', sql.Int, exercise.orden)
          .input('series', sql.Int, exercise.series)
          .input('repeticiones', sql.NVarChar, exercise.repeticiones)
          .input('descansoSegundos', sql.Int, exercise.descanso_segundos)
          .input('notas', sql.NVarChar, exercise.notas || null)
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
              @routineId,
              @exerciseId,
              @orden,
              @series,
              @repeticiones,
              @descansoSegundos,
              @notas
            )
          `);
      }
      
      // 3. Confirmar transacción
      await transaction.commit();
      
      res.json({ 
        message: 'Ejercicios actualizados correctamente',
        count: exercises.length
      });
    } catch (error) {
      // Si hay error, hacer rollback
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error al actualizar ejercicios de la rutina:', error);
    res.status(500).json({ message: 'Error al actualizar ejercicios de la rutina' });
  }
});
// In coach.js, replace or update the /assign-routine route
router.post('/assign-routine', authMiddleware, verifyCoach, async (req, res) => {
  try {
    console.log('==== Asignando rutina a cliente ====');
    console.log('Datos recibidos:', req.body);
    
    const { id_cliente, id_rutina } = req.body;
    
    if (!id_cliente || !id_rutina) {
      console.error('Datos incompletos:', { id_cliente, id_rutina });
      return res.status(400).json({ message: 'Se requiere ID de usuario y rutina' });
    }
    
    console.log('ID de usuario cliente:', id_cliente, typeof id_cliente);
    console.log('ID de rutina:', id_rutina, typeof id_rutina);
    
    // Intentar convertir a enteros si vienen como strings
    const clientId = typeof id_cliente === 'string' ? parseInt(id_cliente, 10) : id_cliente;
    const routineId = typeof id_rutina === 'string' ? parseInt(id_rutina, 10) : id_rutina;
    
    // Verificar que son números válidos después de conversión
    if (isNaN(clientId) || isNaN(routineId)) {
      console.error('IDs inválidos después de la conversión:', { clientId, routineId });
      return res.status(400).json({ message: 'IDs deben ser valores numéricos válidos' });
    }
    
    const pool = await connectDB();
    
    // Obtener ID del coach
    const coachId = await getCoachIdFromUserId(req.user.id);
    
    // Verificar que la rutina pertenece a este coach
    const routineResult = await pool.request()
      .input('routineId', sql.Int, routineId)
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
    
    // Verificar si ya tiene una rutina activa (opcional: podemos desactivar las rutinas previas)
    await pool.request()
      .input('clientId', sql.Int, clientId)
      .query(`
        UPDATE Asignaciones_Rutina
        SET estado = 'completada'
        WHERE id_usuario = @clientId AND estado = 'activa'
      `);
    
    // Asignar la rutina al cliente
    await pool.request()
      .input('id_rutina', sql.Int, routineId)
      .input('id_usuario', sql.Int, clientId)
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

// Agregar estos endpoints a tu archivo existente

// Obtener las rutinas asignadas al cliente
router.get('/routines', authMiddleware, async (req, res) => {
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
router.get('/routine/:routineId', authMiddleware, async (req, res) => {
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

// Marcar rutina como completada
router.put('/routine/:routineId/complete', authMiddleware, async (req, res) => {
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