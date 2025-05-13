const sql = require('mssql');
require('dotenv').config();

// Añadir logs para depuración
console.log('Variables de entorno para conexión DB:');
console.log(`DB_SERVER: ${process.env.DB_SERVER || 'NO DISPONIBLE'}`);
console.log(`DB_DATABASE: ${process.env.DB_DATABASE || 'NO DISPONIBLE'}`);
console.log(`DB_USER: ${process.env.DB_USER || 'NO DISPONIBLE'}`);
console.log(`DB_INSTANCE: ${process.env.DB_INSTANCE || 'NO DEFINIDA'}`);

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: parseInt(process.env.DB_PORT) || 1433, // Añadir puerto explícitamente
  options: {
    encrypt: true, // Azure SQL siempre necesita encriptación
    trustServerCertificate: false,
    // Condicional para instanceName - solo incluirlo si está definido
    ...(process.env.DB_INSTANCE ? { instanceName: process.env.DB_INSTANCE } : {})
  }
};

async function connectDB() {
  try {
    console.log('Intentando conectar con la siguiente configuración:');
    console.log('DB_SERVER:', process.env.DB_SERVER);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '****' : 'Not set');
console.log('DB_DATABASE:', process.env.DB_DATABASE);
console.log('DB_PORT:', process.env.DB_PORT);

    // Mostrar config sin exponer la contraseña
    const safeConfig = {...config, password: '******'};
    console.log(JSON.stringify(safeConfig, null, 2));
    
    const pool = await sql.connect(config);
    console.log('Conexión a SQL Server establecida');
    return pool;
    
  } catch (error) {
    console.error('Error al conectar a SQL Server:', error);
    throw error;
  }
}

module.exports = { connectDB, sql };