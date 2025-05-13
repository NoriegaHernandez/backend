
// server/routes/admin.js
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

// Obtener todos los usuarios
router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    
    const result = await pool.request()
      .query(`
        SELECT 
          id_usuario,
          nombre,
          email,
          telefono,
          direccion,
          fecha_nacimiento,
          tipo_usuario,
          fecha_registro,
          estado
        FROM 
          Usuarios
        ORDER BY 
          fecha_registro DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// Crear un nuevo usuario
router.post('/users', authMiddleware, adminMiddleware, async (req, res) => {
  const { 
    nombre, 
    email, 
    password, 
    telefono, 
    direccion, 
    fecha_nacimiento, 
    tipo_usuario, 
    estado 
  } = req.body;
  
  // Validaciones básicas
  if (!nombre || !email || !password || !tipo_usuario) {
    return res.status(400).json({ 
      message: 'Nombre, email, contraseña y tipo de usuario son campos obligatorios' 
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
        .input('direccion', sql.VarChar, direccion || null)
        .input('fecha_nacimiento', sql.Date, fecha_nacimiento ? new Date(fecha_nacimiento) : null)
        .input('tipo_usuario', sql.VarChar, tipo_usuario)
        .input('estado', sql.VarChar, estado || 'activo')
        .query(`
          INSERT INTO Usuarios (
              nombre, 
              email, 
              contraseña, 
              telefono, 
              direccion, 
              fecha_nacimiento, 
              tipo_usuario, 
              fecha_registro, 
              estado
          )
          VALUES (
              @nombre, 
              @email, 
              @password, 
              @telefono,
              @direccion,
              @fecha_nacimiento,
              @tipo_usuario,
              GETDATE(),
              @estado
          );
          
          SELECT SCOPE_IDENTITY() AS id_usuario;
        `);
      
      const userId = userInsert.recordset[0].id_usuario;
      
      if (tipo_usuario === 'coach') {
        await new sql.Request(transaction)
          .input('id_usuario', sql.Int, userId)
          .input('especialidad', sql.VarChar, 'General')
          .query(`
            INSERT INTO Coaches (
                id_usuario,
                especialidad
            )
            VALUES (
                @id_usuario,
                @especialidad
            );
          `);
      }
      
      await transaction.commit();
      
      res.status(201).json({
        message: 'Usuario creado exitosamente',
        userId
      });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ 
      message: 'Error al crear usuario', 
      details: error.message 
    });
  }
});

// Actualizar usuario existente
router.put('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  const { 
    nombre, 
    email, 
    password, 
    telefono, 
    direccion, 
    fecha_nacimiento, 
    tipo_usuario, 
    estado 
  } = req.body;
  
  try {
    const pool = await connectDB();
    
    // Verificar si el usuario existe
    const userCheck = await pool.request()
      .input('id_usuario', sql.Int, id)
      .query('SELECT id_usuario, tipo_usuario FROM Usuarios WHERE id_usuario = @id_usuario');
    
    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const currentUserType = userCheck.recordset[0].tipo_usuario;
    
    // Si está cambiando el email, verificar que no esté en uso
    if (email) {
      const emailCheck = await pool.request()
        .input('email', sql.VarChar, email)
        .input('id_usuario', sql.Int, id)
        .query('SELECT email FROM Usuarios WHERE email = @email AND id_usuario != @id_usuario');
      
      if (emailCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'El email ya está registrado por otro usuario' });
      }
    }
    
    // Iniciar transacción
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      
      // Construir la consulta de actualización
      let updateQuery = `
        UPDATE Usuarios 
        SET 
      `;
      
      const updateRequest = new sql.Request(transaction);
      let updateParts = [];
      
      if (nombre) {
        updateParts.push('nombre = @nombre');
        updateRequest.input('nombre', sql.VarChar, nombre);
      }
      
      if (email) {
        updateParts.push('email = @email');
        updateRequest.input('email', sql.VarChar, email);
      }
      
      if (password) {
        updateParts.push('contraseña = @password');
        updateRequest.input('password', sql.VarChar, password);
      }
      
      if (telefono !== undefined) {
        updateParts.push('telefono = @telefono');
        updateRequest.input('telefono', sql.VarChar, telefono || null);
      }
      
      if (direccion !== undefined) {
        updateParts.push('direccion = @direccion');
        updateRequest.input('direccion', sql.VarChar, direccion || null);
      }
      
      if (fecha_nacimiento !== undefined) {
        updateParts.push('fecha_nacimiento = @fecha_nacimiento');
        updateRequest.input('fecha_nacimiento', sql.Date, fecha_nacimiento ? new Date(fecha_nacimiento) : null);
      }
      
      if (tipo_usuario) {
        updateParts.push('tipo_usuario = @tipo_usuario');
        updateRequest.input('tipo_usuario', sql.VarChar, tipo_usuario);
      }
      
      if (estado) {
        updateParts.push('estado = @estado');
        updateRequest.input('estado', sql.VarChar, estado);
      }
      
      if (updateParts.length === 0) {
        return res.status(400).json({ message: 'No se proporcionaron datos para actualizar' });
      }
      
      updateQuery += updateParts.join(', ');
      updateQuery += ' WHERE id_usuario = @id_usuario';
      
      updateRequest.input('id_usuario', sql.Int, id);
      
      await updateRequest.query(updateQuery);
      
      // Si está cambiando el tipo de usuario de o a 'coach', gestionar la tabla Coaches
      if (tipo_usuario && tipo_usuario !== currentUserType) {
        if (tipo_usuario === 'coach') {
          // Verificar si ya existe un registro en la tabla Coaches
          const coachCheck = await new sql.Request(transaction)
            .input('id_usuario', sql.Int, id)
            .query('SELECT id_coach FROM Coaches WHERE id_usuario = @id_usuario');
          
          if (coachCheck.recordset.length === 0) {
            // Crear registro en la tabla Coaches
            await new sql.Request(transaction)
              .input('id_usuario', sql.Int, id)
              .input('especialidad', sql.VarChar, 'General')
              .query(`
                INSERT INTO Coaches (
                    id_usuario,
                    especialidad
                )
                VALUES (
                    @id_usuario,
                    @especialidad
                );
              `);
          }
        } else if (currentUserType === 'coach') {
          // Si estaba como coach y ahora no, no eliminamos el registro pero podríamos marcarlo
        }
      }
      
      await transaction.commit();
      
      res.json({
        message: 'Usuario actualizado exitosamente',
        userId: id
      });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ 
      message: 'Error al actualizar usuario', 
      details: error.message 
    });
  }
});

// Eliminar usuario
router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { id } = req.params;
  
  try {
    const pool = await connectDB();
    
    // Verificar si el usuario existe
    const userCheck = await pool.request()
      .input('id_usuario', sql.Int, id)
      .query('SELECT id_usuario, tipo_usuario FROM Usuarios WHERE id_usuario = @id_usuario');
    
    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const userType = userCheck.recordset[0].tipo_usuario;
    
    // No permitir eliminar al propio usuario administrador que está haciendo la solicitud
    if (id == req.user.id) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
    }
    
    // Iniciar transacción
    const transaction = new sql.Transaction(pool);
    
    try {
      await transaction.begin();
      
      // Desactivar las asignaciones si es un coach
      if (userType === 'coach') {
        // Obtener el id del coach
        const coachResult = await new sql.Request(transaction)
          .input('id_usuario', sql.Int, id)
          .query('SELECT id_coach FROM Coaches WHERE id_usuario = @id_usuario');
        
        if (coachResult.recordset.length > 0) {
          const coachId = coachResult.recordset[0].id_coach;
          
          // Marcar asignaciones como inactivas
          await new sql.Request(transaction)
            .input('id_coach', sql.Int, coachId)
            .query(`
              UPDATE Asignaciones_Coach_Cliente
              SET estado = 'inactiva'
              WHERE id_coach = @id_coach
            `);
        }
      }
      
      // Marcar el usuario como inactivo en lugar de eliminarlo físicamente
      await new sql.Request(transaction)
        .input('id_usuario', sql.Int, id)
        .query(`
          UPDATE Usuarios
          SET estado = 'inactivo'
          WHERE id_usuario = @id_usuario
        `);
      
      await transaction.commit();
      
      res.json({
        message: 'Usuario eliminado exitosamente'
      });
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ 
      message: 'Error al eliminar usuario', 
      details: error.message 
    });
  }
});


// Ruta para obtener estadísticas del dashboard
// GET /api/admin/dashboard/stats
router.get('/dashboard/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { timeframe = 'month' } = req.query;
    const pool = await connectDB();
    
    // Obtener fecha límite según el timeframe
    let dateLimit = new Date();
    if (timeframe === 'week') {
      dateLimit.setDate(dateLimit.getDate() - 7);
    } else if (timeframe === 'month') {
      dateLimit.setMonth(dateLimit.getMonth() - 1);
    } else if (timeframe === 'year') {
      dateLimit.setFullYear(dateLimit.getFullYear() - 1);
    }
    
    // Contar usuarios totales
    const totalUsersResult = await pool.request()
      .query('SELECT COUNT(*) AS total FROM Usuarios');
    
    const totalUsers = totalUsersResult.recordset[0].total;
    
    // Contar usuarios activos
    const activeUsersResult = await pool.request()
      .query("SELECT COUNT(*) AS total FROM Usuarios WHERE estado = 'activo'");
    
    const activeUsers = activeUsersResult.recordset[0].total;
    
    // Contar entrenadores
    const totalCoachesResult = await pool.request()
      .query("SELECT COUNT(*) AS total FROM Usuarios WHERE tipo_usuario = 'coach'");
    
    const totalCoaches = totalCoachesResult.recordset[0].total;
    
    // Contar suscripciones activas
    const activeSubscriptionsResult = await pool.request()
      .query("SELECT COUNT(*) AS total FROM Membresias WHERE estado = 'activa' AND fecha_fin >= GETDATE()");
    
    const activeSubscriptions = activeSubscriptionsResult.recordset[0]?.total || 0;
    
    // Contar verificaciones pendientes
    const pendingVerificationsResult = await pool.request()
      .query("SELECT COUNT(*) AS total FROM Usuarios WHERE estado = 'pendiente' AND email_verificado = 0");
    
    const pendingVerifications = pendingVerificationsResult.recordset[0]?.total || 0;
    
    res.json({
      totalUsers,
      activeUsers,
      totalCoaches,
      activeSubscriptions,
      pendingVerifications
    });
  } catch (error) {
    console.error('Error al obtener estadísticas del dashboard:', error);
    res.status(500).json({ message: 'Error del servidor al obtener estadísticas' });
  }
});

// Ruta para obtener datos comparativos para estadísticas
// GET /api/admin/dashboard/stats/comparison
router.get('/dashboard/stats/comparison', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { timeframe = 'month' } = req.query;
    const pool = await connectDB();
    
    // Calcular fechas de inicio y fin para el período actual y el anterior
    let currentStart, currentEnd, previousStart, previousEnd;
    currentEnd = new Date(); // Fecha actual
    
    if (timeframe === 'week') {
      currentStart = new Date();
      currentStart.setDate(currentEnd.getDate() - 7);
      
      previousEnd = new Date(currentStart);
      previousStart = new Date(previousEnd);
      previousStart.setDate(previousEnd.getDate() - 7);
    } else if (timeframe === 'month') {
      currentStart = new Date();
      currentStart.setMonth(currentEnd.getMonth() - 1);
      
      previousEnd = new Date(currentStart);
      previousStart = new Date(previousEnd);
      previousStart.setMonth(previousEnd.getMonth() - 1);
    } else if (timeframe === 'year') {
      currentStart = new Date();
      currentStart.setFullYear(currentEnd.getFullYear() - 1);
      
      previousEnd = new Date(currentStart);
      previousStart = new Date(previousEnd);
      previousStart.setFullYear(previousEnd.getFullYear() - 1);
    }
    
    // Formatear fechas para SQL Server
    const formatDate = (date) => {
      return date.toISOString().slice(0, 19).replace('T', ' ');
    };
    
    // Período actual - Usuarios totales
    const currentTotalUsersResult = await pool.request()
      .input('startDate', sql.DateTime, formatDate(currentStart))
      .input('endDate', sql.DateTime, formatDate(currentEnd))
      .query(`
        SELECT COUNT(*) AS total 
        FROM Usuarios 
        WHERE fecha_registro BETWEEN @startDate AND @endDate
      `);
    
    const currentTotalUsers = currentTotalUsersResult.recordset[0].total;
    
    // Período anterior - Usuarios totales
    const previousTotalUsersResult = await pool.request()
      .input('startDate', sql.DateTime, formatDate(previousStart))
      .input('endDate', sql.DateTime, formatDate(previousEnd))
      .query(`
        SELECT COUNT(*) AS total 
        FROM Usuarios 
        WHERE fecha_registro BETWEEN @startDate AND @endDate
      `);
    
    const previousTotalUsers = previousTotalUsersResult.recordset[0].total;
    
    // Período actual - Usuarios activos
    const currentActiveUsersResult = await pool.request()
      .input('startDate', sql.DateTime, formatDate(currentStart))
      .input('endDate', sql.DateTime, formatDate(currentEnd))
      .query(`
        SELECT COUNT(*) AS total 
        FROM Usuarios 
        WHERE fecha_registro BETWEEN @startDate AND @endDate 
        AND estado = 'activo'
      `);
    
    const currentActiveUsers = currentActiveUsersResult.recordset[0].total;
    
    // Período anterior - Usuarios activos
    const previousActiveUsersResult = await pool.request()
      .input('startDate', sql.DateTime, formatDate(previousStart))
      .input('endDate', sql.DateTime, formatDate(previousEnd))
      .query(`
        SELECT COUNT(*) AS total 
        FROM Usuarios 
        WHERE fecha_registro BETWEEN @startDate AND @endDate 
        AND estado = 'activo'
      `);
    
    const previousActiveUsers = previousActiveUsersResult.recordset[0].total;
    
    // Período actual - Coaches
    const currentCoachesResult = await pool.request()
      .input('startDate', sql.DateTime, formatDate(currentStart))
      .input('endDate', sql.DateTime, formatDate(currentEnd))
      .query(`
        SELECT COUNT(*) AS total 
        FROM Usuarios 
        WHERE fecha_registro BETWEEN @startDate AND @endDate 
        AND tipo_usuario = 'coach'
      `);
    
    const currentTotalCoaches = currentCoachesResult.recordset[0].total;
    
    // Período anterior - Coaches
    const previousCoachesResult = await pool.request()
      .input('startDate', sql.DateTime, formatDate(previousStart))
      .input('endDate', sql.DateTime, formatDate(previousEnd))
      .query(`
        SELECT COUNT(*) AS total 
        FROM Usuarios 
        WHERE fecha_registro BETWEEN @startDate AND @endDate 
        AND tipo_usuario = 'coach'
      `);
    
    const previousTotalCoaches = previousCoachesResult.recordset[0].total;
    
    // Período actual - Membresías activas
    const currentMembershipsResult = await pool.request()
      .input('startDate', sql.DateTime, formatDate(currentStart))
      .input('endDate', sql.DateTime, formatDate(currentEnd))
      .query(`
        SELECT COUNT(*) AS total 
        FROM Membresias 
        WHERE fecha_inicio BETWEEN @startDate AND @endDate 
        AND estado = 'activa'
      `);
    
    const currentActiveSubscriptions = currentMembershipsResult.recordset[0]?.total || 0;
    
    // Período anterior - Membresías activas
    const previousMembershipsResult = await pool.request()
      .input('startDate', sql.DateTime, formatDate(previousStart))
      .input('endDate', sql.DateTime, formatDate(previousEnd))
      .query(`
        SELECT COUNT(*) AS total 
        FROM Membresias 
        WHERE fecha_inicio BETWEEN @startDate AND @endDate 
        AND estado = 'activa'
      `);
    
    const previousActiveSubscriptions = previousMembershipsResult.recordset[0]?.total || 0;
    
    res.json({
      totalUsers: {
        current: currentTotalUsers,
        previous: previousTotalUsers
      },
      activeUsers: {
        current: currentActiveUsers,
        previous: previousActiveUsers
      },
      totalCoaches: {
        current: currentTotalCoaches,
        previous: previousTotalCoaches
      },
      activeSubscriptions: {
        current: currentActiveSubscriptions,
        previous: previousActiveSubscriptions
      }
    });
  } catch (error) {
    console.error('Error al obtener datos comparativos:', error);
    res.status(500).json({ message: 'Error del servidor al obtener datos comparativos' });
  }
});

// Ruta para obtener actividad reciente
// GET /api/admin/dashboard/activity
router.get('/dashboard/activity', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { type, timeFilter, limit = 10 } = req.query;
    const pool = await connectDB();
    
    // Construir condiciones de filtrado
    let filterConditions = '';
    const filterParams = {};
    
    // Filtrar por tipo de actividad
    if (type && type !== 'all') {
      filterConditions += " AND tipo = @tipo";
      filterParams.tipo = type;
    }
    
    // Filtrar por tiempo
    if (timeFilter && timeFilter !== 'all') {
      let dateLimit = new Date();
      
      if (timeFilter === 'today') {
        dateLimit.setHours(0, 0, 0, 0); // Inicio del día actual
      } else if (timeFilter === 'week') {
        dateLimit.setDate(dateLimit.getDate() - 7);
      } else if (timeFilter === 'month') {
        dateLimit.setMonth(dateLimit.getMonth() - 1);
      }
      
      filterConditions += " AND fecha >= @dateLimit";
      filterParams.dateLimit = dateLimit;
    }
    
    // Construir la consulta
    const query = `
      SELECT TOP ${parseInt(limit)} 
        id_actividad, 
        tipo, 
        descripcion, 
        fecha
      FROM 
        Actividades
      WHERE 
        1 = 1 ${filterConditions}
      ORDER BY 
        fecha DESC
    `;
    
    // Crear la solicitud con parámetros
    const request = pool.request();
    
    // Agregar parámetros al request
    Object.keys(filterParams).forEach(key => {
      if (key === 'dateLimit') {
        request.input(key, sql.DateTime, filterParams[key]);
      } else {
        request.input(key, sql.VarChar, filterParams[key]);
      }
    });
    
    const checkTableResult = await pool.request().query(`
      SELECT OBJECT_ID('Actividades') AS TableExists
    `);
    
    if (!checkTableResult.recordset[0].TableExists) {
      console.log('Tabla Actividades no existe, devolviendo datos de ejemplo');
      
      // Crear datos de ejemplo basados en información de usuarios
      const usersResult = await pool.request()
        .query(`
          SELECT TOP 10
            id_usuario,
            nombre,
            fecha_registro,
            tipo_usuario
          FROM 
            Usuarios
          ORDER BY 
            fecha_registro DESC
        `);
      
      // Formatear usuarios como actividades
      const activities = usersResult.recordset.map((user, index) => {
        let activityType = 'new_user';
        let description = `${user.nombre} se ha registrado en el sistema`;
        
        // Alternar tipos de actividad para los ejemplos
        if (index % 3 === 1) {
          activityType = 'subscription_renewal';
          description = `${user.nombre} ha renovado su suscripción`;
        } else if (index % 3 === 2) {
          activityType = 'coach_assignment';
          description = `${user.nombre} ha sido asignado a un entrenador`;
        }
        
        return {
          id_actividad: index + 1,
          tipo: activityType,
          descripcion: description,
          fecha: user.fecha_registro
        };
      });
      
      return res.json(activities);
    }
    
    // Ejecutar la consulta
    const result = await request.query(query);
    
    // Formatear actividades para el frontend
    const activities = result.recordset.map(activity => {
      return {
        id: activity.id_actividad,
        type: activity.tipo,
        description: activity.descripcion,
        date: activity.fecha.toLocaleString('es-ES', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      };
    });
    
    res.json(activities);
  } catch (error) {
    console.error('Error al obtener actividad reciente:', error);
    res.status(500).json({ message: 'Error del servidor al obtener actividad reciente' });
  }
});

// Ruta para obtener verificaciones pendientes
// GET /api/admin/verification/pending
router.get('/verification/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    
    // Contar verificaciones pendientes
    const pendingVerificationsResult = await pool.request()
      .query("SELECT COUNT(*) AS total FROM Usuarios WHERE estado = 'pendiente' AND email_verificado = 0");
    
    const count = pendingVerificationsResult.recordset[0]?.total || 0;
    
    res.json({ count });
  } catch (error) {
    console.error('Error al obtener verificaciones pendientes:', error);
    res.status(500).json({ message: 'Error del servidor al obtener verificaciones pendientes' });
  }
});

router.get('/users-with-memberships', authMiddleware, async (req, res) => {
  // Verificar que el usuario sea administrador
  if (req.user.type !== 'administrador') {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  
  try {
    const pool = await connectDB();
    
    const result = await pool.request()
      .query(`
        SELECT * FROM vw_usuarios_membresias
        ORDER BY nombre
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener usuarios con membresías:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Ruta para obtener todos los planes disponibles
router.get('/plans', authMiddleware, async (req, res) => {
  // Verificar que el usuario sea administrador
  if (req.user.type !== 'administrador') {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  
  try {
    const pool = await connectDB();
    
    const result = await pool.request()
      .query(`
        SELECT 
          id_plan, 
          nombre, 
          descripcion, 
          precio, 
          duracion_dias
        FROM Planes
        ORDER BY precio ASC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener planes:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Ruta para crear una nueva membresía
router.post('/memberships', authMiddleware, async (req, res) => {
  // Verificar que el usuario sea administrador
  if (req.user.type !== 'administrador') {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  
  const { 
    id_usuario,
    id_plan, 
    tipo_plan,
    fecha_inicio,
    duracion_dias,
    precio_pagado,
    metodo_pago
  } = req.body;
  
  if (!id_usuario || !id_plan || !tipo_plan) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }
  
  try {
    const pool = await connectDB();
    
    const result = await pool.request()
      .input('accion', sql.VarChar, 'crear')
      .input('id_usuario', sql.Int, id_usuario)
      .input('id_plan', sql.Int, id_plan)
      .input('tipo_plan', sql.VarChar, tipo_plan)
      .input('fecha_inicio', sql.Date, fecha_inicio ? new Date(fecha_inicio) : null)
      .input('duracion_dias', sql.Int, duracion_dias)
      .input('precio_pagado', sql.Decimal(10, 2), precio_pagado)
      .input('metodo_pago', sql.VarChar, metodo_pago || null)
      .input('id_admin', sql.Int, req.user.id)
      .execute('sp_GestionarMembresia');
    
    // Obtener información completa de la membresía creada
    const membershipId = result.recordset[0].id_suscripcion;
    
    const membershipResult = await pool.request()
      .input('id_suscripcion', sql.Int, membershipId)
      .query(`
        SELECT 
          s.*,
          p.nombre AS nombre_plan,
          u.nombre AS nombre_usuario,
          u.email AS email_usuario
        FROM Suscripciones s
        JOIN Planes p ON s.id_plan = p.id_plan
        JOIN Usuarios u ON s.id_usuario = u.id_usuario
        WHERE s.id_suscripcion = @id_suscripcion
      `);
    
    res.status(201).json(membershipResult.recordset[0]);
  } catch (error) {
    console.error('Error al crear membresía:', error);
    res.status(500).json({ 
      message: 'Error al crear membresía', 
      error: error.message 
    });
  }
});

// Ruta para actualizar una membresía existente
router.put('/memberships/:id', authMiddleware, async (req, res) => {
  // Verificar que el usuario sea administrador
  if (req.user.type !== 'administrador') {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  
  const { id } = req.params;
  const { 
    id_plan, 
    tipo_plan,
    fecha_inicio,
    duracion_dias,
    precio_pagado,
    metodo_pago
  } = req.body;
  
  try {
    const pool = await connectDB();
    
    // Verificar que la membresía exista
    const checkResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT id_usuario FROM Suscripciones WHERE id_suscripcion = @id');
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Membresía no encontrada' });
    }
    
    const userId = checkResult.recordset[0].id_usuario;
    
    const result = await pool.request()
      .input('accion', sql.VarChar, 'actualizar')
      .input('id_usuario', sql.Int, userId)
      .input('id_suscripcion', sql.Int, id)
      .input('id_plan', sql.Int, id_plan)
      .input('tipo_plan', sql.VarChar, tipo_plan)
      .input('fecha_inicio', sql.Date, fecha_inicio ? new Date(fecha_inicio) : null)
      .input('duracion_dias', sql.Int, duracion_dias)
      .input('precio_pagado', sql.Decimal(10, 2), precio_pagado)
      .input('metodo_pago', sql.VarChar, metodo_pago)
      .input('id_admin', sql.Int, req.user.id)
      .execute('sp_GestionarMembresia');
    
    // Obtener información actualizada
    const membershipResult = await pool.request()
      .input('id_suscripcion', sql.Int, id)
      .query(`
        SELECT 
          s.*,
          p.nombre AS nombre_plan,
          u.nombre AS nombre_usuario,
          u.email AS email_usuario
        FROM Suscripciones s
        JOIN Planes p ON s.id_plan = p.id_plan
        JOIN Usuarios u ON s.id_usuario = u.id_usuario
        WHERE s.id_suscripcion = @id_suscripcion
      `);
    
    res.json(membershipResult.recordset[0]);
  } catch (error) {
    console.error('Error al actualizar membresía:', error);
    res.status(500).json({ 
      message: 'Error al actualizar membresía', 
      error: error.message 
    });
  }
});

// Ruta para cancelar una membresía
router.post('/memberships/:id/cancel', authMiddleware, async (req, res) => {
  // Verificar que el usuario sea administrador
  if (req.user.type !== 'administrador') {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  
  const { id } = req.params;
  
  try {
    const pool = await connectDB();
    
    // Verificar que la membresía exista
    const checkResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT id_usuario FROM Suscripciones WHERE id_suscripcion = @id');
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Membresía no encontrada' });
    }
    
    const userId = checkResult.recordset[0].id_usuario;
    
    await pool.request()
      .input('accion', sql.VarChar, 'cancelar')
      .input('id_usuario', sql.Int, userId)
      .input('id_suscripcion', sql.Int, id)
      .input('id_admin', sql.Int, req.user.id)
      .execute('sp_GestionarMembresia');
    
    res.json({ message: 'Membresía cancelada correctamente' });
  } catch (error) {
    console.error('Error al cancelar membresía:', error);
    res.status(500).json({ 
      message: 'Error al cancelar membresía', 
      error: error.message 
    });
  }
});

// Ruta para renovar una membresía
router.post('/memberships/:id/renew', authMiddleware, async (req, res) => {
  // Verificar que el usuario sea administrador
  if (req.user.type !== 'administrador') {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  
  const { id } = req.params;
  const { 
    id_plan, 
    tipo_plan,
    fecha_inicio,
    duracion_dias,
    precio_pagado,
    metodo_pago
  } = req.body;
  
  if (!id_plan || !tipo_plan || !duracion_dias) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }
  
  try {
    const pool = await connectDB();
    
    // Verificar que la membresía exista
    const checkResult = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT id_usuario FROM Suscripciones WHERE id_suscripcion = @id');
    
    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Membresía no encontrada' });
    }
    
    const userId = checkResult.recordset[0].id_usuario;
    
    const result = await pool.request()
      .input('accion', sql.VarChar, 'renovar')
      .input('id_usuario', sql.Int, userId)
      .input('id_suscripcion', sql.Int, id)
      .input('id_plan', sql.Int, id_plan)
      .input('tipo_plan', sql.VarChar, tipo_plan)
      .input('fecha_inicio', sql.Date, fecha_inicio ? new Date(fecha_inicio) : null)
      .input('duracion_dias', sql.Int, duracion_dias)
      .input('precio_pagado', sql.Decimal(10, 2), precio_pagado)
      .input('metodo_pago', sql.VarChar, metodo_pago || null)
      .input('id_admin', sql.Int, req.user.id)
      .execute('sp_GestionarMembresia');
    
    // Obtener información de la nueva membresía
    const membershipId = result.recordset[0].id_suscripcion;
    
    const membershipResult = await pool.request()
      .input('id_suscripcion', sql.Int, membershipId)
      .query(`
        SELECT 
          s.*,
          p.nombre AS nombre_plan,
          u.nombre AS nombre_usuario,
          u.email AS email_usuario
        FROM Suscripciones s
        JOIN Planes p ON s.id_plan = p.id_plan
        JOIN Usuarios u ON s.id_usuario = u.id_usuario
        WHERE s.id_suscripcion = @id_suscripcion
      `);
    
    res.status(201).json(membershipResult.recordset[0]);
  } catch (error) {
    console.error('Error al renovar membresía:', error);
    res.status(500).json({ 
      message: 'Error al renovar membresía', 
      error: error.message 
    });
  }
});

// Ruta para obtener el historial de membresías de un usuario
router.get('/users/:userId/membership-history', authMiddleware, async (req, res) => {
  // Verificar que el usuario sea administrador
  if (req.user.type !== 'administrador') {
    return res.status(403).json({ message: 'Acceso denegado' });
  }
  
  const { userId } = req.params;
  
  try {
    const pool = await connectDB();
    
    // Verificar que el usuario exista
    const userCheck = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT id_usuario FROM Usuarios WHERE id_usuario = @userId');
    
    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          s.id_suscripcion,
          s.id_plan,
          p.nombre AS nombre_plan,
          s.tipo_plan,
          s.fecha_inicio,
          s.fecha_fin,
          s.estado,
          s.precio_pagado,
          s.metodo_pago,
          s.fecha_ultima_actualizacion,
          admin.nombre AS nombre_admin
        FROM 
          Suscripciones s
        JOIN 
          Planes p ON s.id_plan = p.id_plan
        LEFT JOIN 
          Usuarios admin ON s.id_admin_ultima_actualizacion = admin.id_usuario
        WHERE 
          s.id_usuario = @userId
        ORDER BY 
          s.fecha_inicio DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener historial de membresías:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

module.exports = router;