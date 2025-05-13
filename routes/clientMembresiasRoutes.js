// server/routes/clientMembresiasRoutes.js - Versión para SQL Server

const express = require('express');
const router = express.Router();
const sql = require('mssql'); // Asegúrate de importar mssql
const authenticateJWT = require('../middleware/auth');

// Configuración para manejar errores asíncronos
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Ruta de prueba para verificar conexión
router.get('/test', (req, res) => {
  res.json({ message: 'API funcionando correctamente' });
});

// Verificar autenticación
router.get('/test-auth', authenticateJWT, (req, res) => {
  res.json({ 
    message: 'Autenticación exitosa', 
    user_id: req.user.id 
  });
});

// Obtener membresía actual del usuario autenticado
router.get('/usuarios/current/membresia', authenticateJWT, asyncHandler(async (req, res) => {
  // Verificar que req.user exista y tenga una propiedad id
  if (!req.user || !req.user.id) {
    console.error('Error: req.user.id no está disponible en el token');
    return res.status(401).json({ message: 'Usuario no autenticado correctamente' });
  }
  
  const userId = req.user.id;
  console.log('Obteniendo membresía para el usuario ID:', userId);
  
  try {
    // Crear una nueva conexión desde el pool
    const pool = await sql.connect(); // Conectar usando la configuración predeterminada
    console.log('Conexión a SQL Server establecida');
    
    // IMPORTANTE: Adapta los nombres de las tablas y columnas a tu esquema de SQL Server
    // Consultar membresía activa del usuario con datos del plan
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT 
          s.id_suscripcion,
          s.id_usuario,
          s.id_plan,
          s.tipo_plan,
          s.fecha_inicio,
          s.fecha_fin,
          s.estado AS estado_membresia,
          s.precio_pagado,
          s.metodo_pago,
          p.nombre AS nombre_plan,
          p.descripcion AS descripcion_plan,
          p.precio
        FROM 
          Suscripciones s
        JOIN 
          Planes p ON s.id_plan = p.id_plan
        WHERE 
          s.id_usuario = @userId AND s.estado = 'activa'
        ORDER BY 
          s.fecha_inicio DESC
      `);
    
    console.log('Resultado de consulta de membresía:', result.recordset);
    
    if (result.recordset.length === 0) {
      // Si no tiene membresía activa, devolver estado básico
      console.log('No se encontró membresía activa para el usuario ID:', userId);
      return res.json({
        id_usuario: userId,
        estado_membresia: 'inactiva'
      });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error al obtener membresía:', error);
    // Devolver una respuesta por defecto en caso de error
    return res.json({
      id_usuario: userId,
      estado_membresia: 'inactiva'
    });
  }
}));

// Obtener todos los planes disponibles
router.get('/planes', asyncHandler(async (req, res) => {
  try {
    const pool = await sql.connect();
    console.log('Conexión a SQL Server establecida');
    
    // Consulta adaptada para SQL Server
    const result = await pool.request()
      .query(`
        SELECT * FROM Planes 
        WHERE estado = 1 OR estado IS NULL 
        ORDER BY precio ASC
      `);
    
    console.log('Planes disponibles encontrados:', result.recordset.length);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener planes:', error);
    // Devolver array vacío en caso de error
    res.json([]);
  }
}));

// Crear nueva membresía
router.post('/membresias', authenticateJWT, asyncHandler(async (req, res) => {
  let transaction;
  
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Usuario no autenticado correctamente' });
    }
    
    const userId = req.user.id;
    const { id_plan, tipo_plan, fecha_inicio, duracion_dias, precio_pagado, metodo_pago } = req.body;
    
    // Validar datos de entrada
    if (!id_plan || !tipo_plan || !fecha_inicio || !duracion_dias) {
      return res.status(400).json({ message: 'Faltan datos requeridos para crear la membresía' });
    }
    
    const pool = await sql.connect();
    console.log('Conexión a SQL Server establecida');
    
    // Iniciar una transacción
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    // Verificar que el usuario exista
    const userResult = await new sql.Request(transaction)
      .input('userId', sql.Int, userId)
      .query('SELECT id_usuario, estado FROM Usuarios WHERE id_usuario = @userId');
    
    if (userResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'El usuario no existe' });
    }
    
    // Verificar que el plan exista
    const planResult = await new sql.Request(transaction)
      .input('planId', sql.Int, id_plan)
      .query('SELECT * FROM Planes WHERE id_plan = @planId');
    
    if (planResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'El plan seleccionado no existe' });
    }
    
    // Calcular fecha de fin
    const fechaInicio = new Date(fecha_inicio);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + parseInt(duracion_dias));
    
    // Verificar si ya tiene membresía activa
    const activeResult = await new sql.Request(transaction)
      .input('userId', sql.Int, userId)
      .query('SELECT id_suscripcion FROM Suscripciones WHERE id_usuario = @userId AND estado = \'activa\'');
    
    // Si tiene membresía activa, cancelarla
    if (activeResult.recordset.length > 0) {
      await new sql.Request(transaction)
        .input('subsId', sql.Int, activeResult.recordset[0].id_suscripcion)
        .query(`
          UPDATE Suscripciones 
          SET estado = 'cancelada', 
              fecha_ultima_actualizacion = GETDATE() 
          WHERE id_suscripcion = @subsId
        `);
    }
    
    // Insertar nueva membresía - adaptado para SQL Server
    const insertResult = await new sql.Request(transaction)
      .input('userId', sql.Int, userId)
      .input('planId', sql.Int, id_plan)
      .input('tipoPlan', sql.VarChar(20), tipo_plan)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .input('precio', sql.Decimal(10, 2), precio_pagado)
      .input('metodo', sql.VarChar(50), metodo_pago)
      .query(`
        INSERT INTO Suscripciones (
          id_usuario, 
          id_plan, 
          tipo_plan,
          fecha_inicio, 
          fecha_fin, 
          estado,
          precio_pagado,
          metodo_pago,
          fecha_ultima_actualizacion
        ) 
        VALUES (
          @userId, 
          @planId, 
          @tipoPlan,
          @fechaInicio,
          @fechaFin,
          'activa',
          @precio,
          @metodo,
          GETDATE()
        );
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    await transaction.commit();
    
    res.status(201).json({
      id_suscripcion: insertResult.recordset[0].id,
      message: 'Membresía creada exitosamente'
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error al crear membresía:', error);
    res.status(500).json({ message: 'Error al crear membresía' });
  }
}));

// Renovar membresía
router.put('/membresias/:id/renovar', authenticateJWT, asyncHandler(async (req, res) => {
  let transaction;
  
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Usuario no autenticado correctamente' });
    }
    
    const userId = req.user.id;
    const idSuscripcion = req.params.id;
    const { id_plan, tipo_plan, fecha_inicio, duracion_dias, precio_pagado, metodo_pago } = req.body;
    
    const pool = await sql.connect();
    
    // Iniciar una transacción
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    // Verificar que la membresía exista y pertenezca al usuario
    const subResult = await new sql.Request(transaction)
      .input('subId', sql.Int, idSuscripcion)
      .input('userId', sql.Int, userId)
      .query('SELECT * FROM Suscripciones WHERE id_suscripcion = @subId AND id_usuario = @userId');
    
    if (subResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Membresía no encontrada o no autorizada' });
    }
    
    // Verificar que el plan exista
    const planResult = await new sql.Request(transaction)
      .input('planId', sql.Int, id_plan)
      .query('SELECT * FROM Planes WHERE id_plan = @planId');
    
    if (planResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'El plan seleccionado no existe' });
    }
    
    // Calcular fecha de fin
    const fechaInicio = new Date(fecha_inicio);
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + parseInt(duracion_dias));
    
    // Marcar la membresía actual como vencida
    await new sql.Request(transaction)
      .input('subId', sql.Int, idSuscripcion)
      .query(`
        UPDATE Suscripciones 
        SET estado = 'vencida', 
            fecha_ultima_actualizacion = GETDATE() 
        WHERE id_suscripcion = @subId
      `);
    
    // Crear nueva membresía (renovación)
    const insertResult = await new sql.Request(transaction)
      .input('userId', sql.Int, userId)
      .input('planId', sql.Int, id_plan)
      .input('tipoPlan', sql.VarChar(20), tipo_plan)
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .input('precio', sql.Decimal(10, 2), precio_pagado)
      .input('metodo', sql.VarChar(50), metodo_pago)
      .query(`
        INSERT INTO Suscripciones (
          id_usuario, 
          id_plan, 
          tipo_plan,
          fecha_inicio, 
          fecha_fin, 
          estado,
          precio_pagado,
          metodo_pago,
          fecha_ultima_actualizacion
        ) 
        VALUES (
          @userId, 
          @planId, 
          @tipoPlan,
          @fechaInicio,
          @fechaFin,
          'activa',
          @precio,
          @metodo,
          GETDATE()
        );
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    await transaction.commit();
    
    res.status(200).json({
      id_suscripcion: insertResult.recordset[0].id,
      message: 'Membresía renovada exitosamente'
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('Error al renovar membresía:', error);
    res.status(500).json({ message: 'Error al renovar membresía' });
  }
}));

// Cancelar membresía
router.put('/membresias/:id/cancelar', authenticateJWT, asyncHandler(async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Usuario no autenticado correctamente' });
    }
    
    const userId = req.user.id;
    const idSuscripcion = req.params.id;
    
    const pool = await sql.connect();
    
    // Verificar que la membresía exista y pertenezca al usuario
    const result = await pool.request()
      .input('subId', sql.Int, idSuscripcion)
      .input('userId', sql.Int, userId)
      .query('SELECT * FROM Suscripciones WHERE id_suscripcion = @subId AND id_usuario = @userId');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Membresía no encontrada o no autorizada' });
    }
    
    // Cancelar la membresía
    await pool.request()
      .input('subId', sql.Int, idSuscripcion)
      .query(`
        UPDATE Suscripciones 
        SET estado = 'cancelada', 
            fecha_ultima_actualizacion = GETDATE() 
        WHERE id_suscripcion = @subId
      `);
    
    res.status(200).json({
      message: 'Membresía cancelada exitosamente'
    });
  } catch (error) {
    console.error('Error al cancelar membresía:', error);
    res.status(500).json({ message: 'Error al cancelar membresía' });
  }
}));

// Middleware para manejar errores
router.use((err, req, res, next) => {
  console.error('Error en rutas de membresía:', err);
  res.status(500).json({ 
    message: 'Error al procesar la solicitud', 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor' 
  });
});

module.exports = router;