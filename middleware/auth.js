// server/middleware/auth.js - Middleware para verificar tokens JWT
//hOLA MUNDO
const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = function(req, res, next) {
  // Obtener token del header
  const token = req.header('x-auth-token') || req.header('Authorization')?.replace('Bearer ', '');
  
  // Verificar si no hay token
  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado, token no proporcionado' });
  }
  
  try {
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Añadir usuario al objeto de solicitud
    req.user = decoded.user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
};