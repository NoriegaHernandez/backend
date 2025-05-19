

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

router.post('/assign-routine', authMiddleware, async (req, res) => {
  try {
    console.log('==== Asignando rutina a cliente ====');
    const { userId, routineId } = req.body;
    
    if (!userId || !routineId) {
      return res.status(400).json({ message: 'Se requiere ID de usuario y rutina' });
    }
    
    console.log('ID de usuario cliente:', userId);
    console.log('ID de rutina:', routineId);
    
    const pool = await connectDB();
    
    // Verificar que la rutina exista
    const routineResult = await pool.request()
      .input('id_rutina', sql.Int, routineId)
      .query(`
        SELECT * FROM Rutinas WHERE id_rutina = @id_rutina
      `);
    
    if (routineResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Rutina no encontrada' });
    }
    
    // Verificar que el usuario exista y está asignado a este coach
    const coachResult = await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        SELECT id_coach 
        FROM Coaches 
        WHERE id_usuario = @id_usuario
      `);
    
    if (coachResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Coach no encontrado' });
    }
    
    const coachId = coachResult.recordset[0].id_coach;
    
    // Verificar que el cliente está asignado a este coach
    const clientResult = await pool.request()
      .input('id_coach', sql.Int, coachId)
      .input('id_usuario', sql.Int, userId)
      .query(`
        SELECT * 
        FROM Asignaciones_Coach_Cliente
        WHERE id_coach = @id_coach AND id_usuario = @id_usuario AND estado = 'activa'
      `);
    
    if (clientResult.recordset.length === 0) {
      return res.status(403).json({ message: 'Este cliente no está asignado a tu cuenta' });
    }
    
    // Crear una nueva asignación de rutina
    // Primero, verificar si ya existe una asignación activa de esta rutina para este usuario
    const existingAssignmentResult = await pool.request()
      .input('id_rutina', sql.Int, routineId)
      .input('id_usuario', sql.Int, userId)
      .query(`
        SELECT *
        FROM Asignaciones_Rutina
        WHERE id_rutina = @id_rutina 
          AND id_usuario = @id_usuario 
          AND estado = 'activa'
      `);
    
    if (existingAssignmentResult.recordset.length > 0) {
      // Ya existe una asignación activa, no crear una nueva
      return res.json({ 
        message: 'Este usuario ya tiene esta rutina asignada',
        assignmentId: existingAssignmentResult.recordset[0].id_asignacion_rutina
      });
    }
    
    // Desactivar cualquier asignación de rutina activa anterior para este usuario
    await pool.request()
      .input('id_usuario', sql.Int, userId)
      .query(`
        UPDATE Asignaciones_Rutina
        SET estado = 'completada'
        WHERE id_usuario = @id_usuario AND estado = 'activa'
      `);
    
    // Crear nueva asignación
    const assignmentResult = await pool.request()
      .input('id_rutina', sql.Int, routineId)
      .input('id_usuario', sql.Int, userId)
      .input('fecha_asignacion', sql.Date, new Date())
      .input('fecha_inicio', sql.Date, new Date())
      .query(`
        INSERT INTO Asignaciones_Rutina (
          id_rutina,
          id_usuario,
          fecha_asignacion,
          fecha_inicio,
          estado,
          notas_coach
        )
        VALUES (
          @id_rutina,
          @id_usuario,
          @fecha_asignacion,
          @fecha_inicio,
          'activa',
          'Asignada por entrenador'
        );
        
        SELECT SCOPE_IDENTITY() AS id_asignacion_rutina;
      `);
    
    // Obtener el ID de la asignación
    const assignmentId = assignmentResult.recordset[0].id_asignacion_rutina;
    console.log('Asignación de rutina creada, ID:', assignmentId);
    
    // Crear notificación para el cliente
    await pool.request()
      .input('id_usuario', sql.Int, userId)
      .input('id_origen', sql.Int, req.user.id)
      .input('titulo', sql.NVarChar, 'Nueva rutina asignada')
      .input('mensaje', sql.NVarChar, `Tu entrenador te ha asignado una nueva rutina: ${routineResult.recordset[0].nombre}`)
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
          'nueva_rutina',
          @titulo,
          @mensaje,
          GETDATE(),
          0,
          @id_origen
        )
      `);
    
    res.json({ 
      message: 'Rutina asignada correctamente',
      assignmentId: assignmentId
    });
  } catch (error) {
    console.error('Error al asignar rutina:', error);
    res.status(500).json({ message: 'Error al asignar rutina' });
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