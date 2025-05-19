// server/routes/client/physicalMeasurements.js

const express = require('express');
const router = express.Router();
// const { connectDB, sql } = require('../../config/db');
// const authMiddleware = require('../../middleware/auth');
const { connectDB, sql } = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Ruta para guardar medidas físicas
router.post('/physical-measurements', authMiddleware, async (req, res) => {
  try {
    const {
      peso, altura, porcentaje_grasa, masa_muscular,
      medida_pecho, medida_brazo_izq, medida_brazo_der,
      medida_pierna_izq, medida_pierna_der, medida_cintura,
      medida_cadera, notas
    } = req.body;
    
    // Obtener el ID del usuario del token
    const userId = req.user.id;
    
    const pool = await connectDB();
    
    // Insertar las medidas físicas
    const result = await pool.request()
      .input('id_usuario', sql.Int, userId)
      .input('peso', sql.Decimal(5, 2), peso || null)
      .input('altura', sql.Decimal(5, 2), altura || null)
      .input('porcentaje_grasa', sql.Decimal(5, 2), porcentaje_grasa || null)
      .input('masa_muscular', sql.Decimal(5, 2), masa_muscular || null)
      .input('medida_pecho', sql.Decimal(5, 2), medida_pecho || null)
      .input('medida_brazo_izq', sql.Decimal(5, 2), medida_brazo_izq || null)
      .input('medida_brazo_der', sql.Decimal(5, 2), medida_brazo_der || null)
      .input('medida_pierna_izq', sql.Decimal(5, 2), medida_pierna_izq || null)
      .input('medida_pierna_der', sql.Decimal(5, 2), medida_pierna_der || null)
      .input('medida_cintura', sql.Decimal(5, 2), medida_cintura || null)
      .input('medida_cadera', sql.Decimal(5, 2), medida_cadera || null)
      .input('notas', sql.NVarChar(500), notas || null)
      .query(`
        INSERT INTO Medidas (
          id_usuario, fecha_registro, peso, altura, porcentaje_grasa, 
          masa_muscular, medida_pecho, medida_brazo_izq, medida_brazo_der, 
          medida_pierna_izq, medida_pierna_der, medida_cintura, medida_cadera, 
          notas
        )
        VALUES (
          @id_usuario, GETDATE(), @peso, @altura, @porcentaje_grasa,
          @masa_muscular, @medida_pecho, @medida_brazo_izq, @medida_brazo_der,
          @medida_pierna_izq, @medida_pierna_der, @medida_cintura, @medida_cadera,
          @notas
        );
        
        SELECT SCOPE_IDENTITY() AS id_medida;
      `);
    
    const id_medida = result.recordset[0].id_medida;
    
    res.status(201).json({
      message: 'Medidas físicas guardadas correctamente',
      id_medida
    });
  } catch (error) {
    console.error('Error al guardar medidas físicas:', error);
    res.status(500).json({ message: 'Error al guardar medidas físicas' });
  }
});

// Ruta para obtener medidas físicas del usuario
router.get('/physical-measurements', authMiddleware, async (req, res) => {
  try {
    // Obtener el ID del usuario del token
    const userId = req.user.id;
    
    const pool = await connectDB();
    
    // Obtener las últimas medidas físicas
    const result = await pool.request()
      .input('id_usuario', sql.Int, userId)
      .query(`
        SELECT * FROM Medidas
        WHERE id_usuario = @id_usuario
        ORDER BY fecha_registro DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error al obtener medidas físicas:', error);
    res.status(500).json({ message: 'Error al obtener medidas físicas' });
  }
});

module.exports = router;