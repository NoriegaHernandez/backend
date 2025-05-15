// // server/routes/auth.js - Rutas de autenticación
// const express = require('express');
// const router = express.Router();
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const { connectDB, sql } = require('../config/db');
// const nodemailer = require('nodemailer');
// const crypto = require('crypto');

// // Middleware para verificar token
// const authMiddleware = require('../middleware/auth');

// router.post('/test-register', async (req, res) => {
//   console.log('Datos recibidos en test-register:', req.body);
  
//   try {
//     const { nombre, email, password } = req.body;
    
//     if (!nombre || !email || !password) {
//       return res.status(400).json({ message: 'Datos incompletos' });
//     }
    
//     res.status(200).json({ 
//       success: true, 
//       message: 'Solicitud de registro recibida correctamente',
//       userData: { nombre, email }
//     });
//   } catch (error) {
//     console.error('Error en test-register:', error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Error en la prueba',
//       error: error.message
//     });
//   }
// });

// // Modificación solo para la ruta de login (las demás rutas quedan igual)

// router.post('/login', async (req, res) => {
//   console.log('Intento de login recibido');
//   console.log('Headers completos:', req.headers);
//   console.log('Cuerpo completo de la solicitud:', req.body);
  
//   // Manejo defensivo para req.body indefinido
//   if (!req.body) {
//     return res.status(400).json({ 
//       message: 'Cuerpo de la solicitud vacío o mal formateado',
//       error: 'missing_body'
//     });
//   }
  
//   // Extraer email y password con manejo seguro
//   const email = req.body.email || '';
//   const password = req.body.password || '';
  
//   // Validaciones básicas
//   if (!email || !password) {
//     return res.status(400).json({ 
//       message: 'Se requieren email y contraseña',
//       error: 'missing_credentials',
//       received: { hasEmail: !!email, hasPassword: !!password }
//     });
//   }
  
//   try {
//     const pool = await connectDB();
    
//     // Buscar usuario por email
//     const result = await pool.request()
//       .input('email', sql.VarChar, email)
//       .query(`
//         SELECT u.id_usuario, u.nombre, u.email, u.contraseña, u.tipo_usuario, u.estado
//         FROM Usuarios u
//         WHERE u.email = @email
//       `);
    
//     const user = result.recordset[0];
    
//     // Verificar si el usuario existe
//     if (!user) {
//       console.log('Usuario no encontrado en la base de datos');
//       return res.status(401).json({ message: 'Credenciales incorrectas' });
//     }
    
//     // Verificar si la cuenta ha sido verificada
//     if (user.estado === 'inactivo') {
//       console.log('Usuario pendiente de verificación:', user.email);
//       return res.status(401).json({ 
//         message: 'Tu cuenta aún no ha sido verificada. Por favor, verifica tu correo electrónico para activar tu cuenta.',
//         requiresVerification: true,
//         email: user.email
//       });
//     }
    
//     // Verificar si la cuenta está activa
//     if (user.estado !== 'activo') {
//       console.log('Usuario encontrado pero estado es:', user.estado);
//       return res.status(401).json({ message: 'La cuenta está inactiva o suspendida' });
//     }
    
//     // Verificar si la contraseña comienza con '$2' (indicio de que está hasheada con bcrypt)
//     let isMatch = false;
//     if (user.contraseña.startsWith('$2')) {
//       // Contraseña hasheada con bcrypt
//       isMatch = await bcrypt.compare(password, user.contraseña);
//     } else {
//       // Contraseña sin hashear (método antiguo)
//       isMatch = (password === user.contraseña);
      
//       // Si coincide, actualizar a formato bcrypt para futuros inicios de sesión
//       if (isMatch) {
//         // Hashear la contraseña
//         const saltRounds = 10;
//         const hashedPassword = await bcrypt.hash(password, saltRounds);
        
//         // Actualizar en la base de datos
//         await pool.request()
//           .input('id_usuario', sql.Int, user.id_usuario)
//           .input('password', sql.VarChar, hashedPassword)
//           .query(`
//             UPDATE Usuarios
//             SET contraseña = @password
//             WHERE id_usuario = @id_usuario
//           `);
        
//         console.log('Contraseña migrada a formato bcrypt para usuario:', user.email);
//       }
//     }
    
//     if (!isMatch) {
//       console.log('Contraseña incorrecta');
//       return res.status(401).json({ message: 'Credenciales incorrectas' });
//     }
    
//     // Crear token JWT
//     const payload = {
//       user: {
//         id: user.id_usuario,
//         type: user.tipo_usuario
//       }
//     };
    
//     // Verificar que JWT_SECRET esté definido
//     if (!process.env.JWT_SECRET) {
//       console.error('Error crítico: JWT_SECRET no está definido en variables de entorno');
//       return res.status(500).json({ message: 'Error de configuración del servidor' });
//     }
    
//     jwt.sign(
//       payload,
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' },
//       (err, token) => {
//         if (err) {
//           console.error('Error al generar JWT:', err);
//           return res.status(500).json({ message: 'Error al generar token de autenticación' });
//         }
        
//         // Actualizar fecha del último login (opcional)
//         pool.request()
//           .input('id_usuario', sql.Int, user.id_usuario)
//           .query(`
//             UPDATE Usuarios 
//             SET fecha_registro = GETDATE() 
//             WHERE id_usuario = @id_usuario
//           `);
        
//         // Devolver token y datos básicos del usuario
//         res.json({
//           token,
//           user: {
//             id: user.id_usuario,
//             name: user.nombre,
//             email: user.email,
//             type: user.tipo_usuario
//           }
//         });
//       }
//     );
//   } catch (error) {
//     console.error('Error detallado en el login:', error);
//     console.error('Stack trace:', error.stack);
    
//     res.status(500).json({ 
//       message: 'Error en el servidor', 
//       details: error.message 
//     });
//   }
// });

// // Configuración de nodemailer
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASSWORD
//   },
//   tls: {
//     rejectUnauthorized: false
//   }
// });

// // Prueba la conexión al iniciar
// transporter.verify(function(error, success) {
//   if (error) {
//     console.error('Error en la configuración del correo:', error);
//   } else {
//     console.log('Servidor de correo listo para enviar mensajes');
//   }
// });

// router.post('/register', async (req, res) => {
//   console.log('Datos recibidos para registro:', JSON.stringify(req.body));
  
//   const { nombre, email, password, telefono, direccion, fecha_nacimiento } = req.body;
  
//   // Validaciones básicas
//   if (!nombre || !email || !password) {
//     return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios' });
//   }
  
//   try {
//     const pool = await connectDB();
    
//     // Verificar si el email ya existe
//     const emailCheck = await pool.request()
//       .input('email', sql.VarChar, email)
//       .query('SELECT email FROM Usuarios WHERE email = @email');
    
//     if (emailCheck.recordset.length > 0) {
//       return res.status(400).json({ message: 'El email ya está registrado' });
//     }
    
//     // Generar token de verificación - usar token más corto
//     const verificationToken = crypto.randomBytes(16).toString('hex');
//     const tokenExpires = new Date();
//     tokenExpires.setHours(tokenExpires.getHours() + 24); // El token expira en 24 horas
    
//     // Generar el hash de la contraseña
//     const saltRounds = 10;
//     const hashedPassword = await bcrypt.hash(password, saltRounds);
    
//     console.log('Preparando inserción de usuario...');
    
//     // Simplificar: Primero solo insertar el usuario sin usar transacción
//     const userInsert = await pool.request()
//       .input('nombre', sql.VarChar, nombre)
//       .input('email', sql.VarChar, email)
//       .input('password', sql.VarChar, hashedPassword) // Usar contraseña hasheada
//       .input('telefono', sql.VarChar, telefono || '')
//       .input('direccion', sql.VarChar, direccion || '')
//       .input('fecha_nacimiento', sql.Date, fecha_nacimiento ? new Date(fecha_nacimiento) : null)
//       .input('tipo_usuario', sql.VarChar, 'cliente')
//       .input('verification_token', sql.VarChar, verificationToken)
//       .input('token_expires', sql.DateTime, tokenExpires)
//       .query(`
//         INSERT INTO Usuarios (
//             nombre, 
//             email, 
//             contraseña, 
//             telefono, 
//             direccion, 
//             fecha_nacimiento, 
//             tipo_usuario, 
//             fecha_registro, 
//             estado,
//             verification_token,
//             token_expires
//         )
//         VALUES (
//             @nombre, 
//             @email, 
//             @password, 
//             @telefono,
//             @direccion,
//             @fecha_nacimiento,
//             @tipo_usuario,
//             GETDATE(),
//             'inactivo',
//             @verification_token,
//             @token_expires
//         );
        
//         SELECT SCOPE_IDENTITY() AS id_usuario;
//       `);
    
//     const userId = userInsert.recordset[0].id_usuario;
//     console.log('Usuario insertado correctamente, ID:', userId);
    
//     // Preparar URL de verificación
//     const verificationUrl = `${process.env.FRONTEND_URL}/verificar-email/${verificationToken}`;
    
//     console.log('Preparando envío de correo a:', email);
    
//     // Luego, si la inserción fue exitosa, enviar el correo
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'Verifica tu cuenta de Fitness Gym',
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #4a9ced; border-radius: 10px;">
//           <h2 style="color: #ff9966; text-align: center;">¡Gracias por registrarte en Fitness Gym!</h2>
//           <p>Hola ${nombre},</p>
//           <p>Estás a un paso de completar tu registro. Por favor, haz clic en el siguiente enlace para verificar tu dirección de correo electrónico:</p>
//           <div style="text-align: center; margin: 30px 0;">
//             <a href="${verificationUrl}" style="background: linear-gradient(to right, #ff9966, #ffde59); color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold;">Verificar mi cuenta</a>
//           </div>
//           <p>Este enlace es válido por 24 horas. Si no verificas tu cuenta en este tiempo, deberás registrarte nuevamente.</p>
//           <p>Si no solicitaste este registro, puedes ignorar este correo.</p>
//           <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #777;">
//             Este es un correo automático, por favor no respondas a este mensaje.
//           </p>
//         </div>
//       `
//     };
    
//     try {
//       console.log('Enviando correo electrónico...');
//       await transporter.sendMail(mailOptions);
//       console.log('Correo enviado correctamente');
      
//       // Responder al cliente
//       res.status(201).json({
//         message: 'Usuario registrado. Por favor, verifica tu correo electrónico para activar tu cuenta.',
//         requiresVerification: true,
//         email: email
//       });
//     } catch (emailError) {
//       console.error('Error al enviar correo:', emailError);
//       console.error('Stack trace:', emailError.stack);
      
//       // No revertimos la inserción, pero informamos del error
//       res.status(500).json({ 
//         message: 'Usuario registrado pero hubo un problema al enviar el correo de verificación. Detalles: ' + emailError.message,
//         requiresVerification: true,
//         email: email
//       });
//     }
//   } catch (error) {
//     console.error('Error completo en el registro:', error);
//     console.error('Stack trace del error:', error.stack);
    
//     // Determinar el tipo de error para dar una respuesta más específica
//     let errorMessage = 'Error en el servidor durante el registro';
//     if (error.code) {
//       console.log('Código de error SQL:', error.code);
//       if (error.code.includes('UNIQUE')) {
//         errorMessage = 'El email ya está registrado';
//       }
//     }
    
//     res.status(500).json({ 
//       message: errorMessage,
//       details: error.message
//     });
//   }
// });

// // 5. Ruta para verificar el email
// router.get('/verify-email/:token', async (req, res) => {
//   console.log('SERVIDOR: Recibida solicitud para verificar email con token:', req.params.token.substring(0, 10) + '...');
//   console.log('SERVIDOR: URL completa:', req.originalUrl);
//   const { token } = req.params;
  
//   try {
//     const pool = await connectDB();
    
//     // Buscar el usuario con el token proporcionado
//     const result = await pool.request()
//       .input('token', sql.VarChar, token)
//       .query(`
//         SELECT id_usuario, email, token_expires 
//         FROM Usuarios 
//         WHERE verification_token = @token AND estado = 'inactivo'
//       `);
    
//     if (result.recordset.length === 0) {
//       return res.status(400).json({ message: 'Token de verificación inválido' });
//     }
    
//     const user = result.recordset[0];
    
//     // Verificar si el token ha expirado
//     const now = new Date();
//     const tokenExpires = new Date(user.token_expires);
    
//     if (now > tokenExpires) {
//       return res.status(400).json({ message: 'El token de verificación ha expirado. Por favor, regístrate nuevamente.' });
//     }
    
//     // Actualizar el estado del usuario a 'activo'
//     await pool.request()
//       .input('id_usuario', sql.Int, user.id_usuario)
//       .query(`
//         UPDATE Usuarios 
//         SET 
//           estado = 'activo',
//           verification_token = NULL,
//           token_expires = NULL
//         WHERE id_usuario = @id_usuario
//       `);
    
//     // Crear token JWT para inicio de sesión automático
//     const payload = {
//       user: {
//         id: user.id_usuario,
//         type: 'cliente'
//       }
//     };
    
//     jwt.sign(
//       payload,
//       process.env.JWT_SECRET,
//       { expiresIn: '24h' },
//       (err, token) => {
//         if (err) throw err;
        
//         res.json({
//           message: 'Email verificado exitosamente. Tu cuenta ha sido activada.',
//           token,
//           user: {
//             id: user.id_usuario,
//             email: user.email,
//             type: 'cliente'
//           }
//         });
//       }
//     );
    
//   } catch (error) {
//     console.error('Error al verificar email:', error);
//     res.status(500).json({ message: 'Error en el servidor' });
//   }
// });

// // Añade esta ruta para probar el envío de correo
// router.get('/test-email', async (req, res) => {
//   try {
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: process.env.EMAIL_USER, // Enviar a mi mismo para probar
//       subject: 'Prueba de Correo - Fitness Gym',
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #4a9ced; border-radius: 10px;">
//           <h2 style="color: #ff9966; text-align: center;">Prueba de Correo</h2>
//           <p>Este es un correo de prueba para verificar la configuración de nodemailer.</p>
//           <p>Si estás viendo este mensaje, ¡la configuración funciona correctamente!</p>
//         </div>
//       `
//     };
    
//     await transporter.sendMail(mailOptions);
//     res.json({ success: true, message: 'Correo enviado con éxito' });
//   } catch (error) {
//     console.error('Error al enviar correo de prueba:', error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Error al enviar correo', 
//       details: error.message 
//     });
//   }
// });

// // 6. Ruta para reenviar el correo de verificación
// router.post('/resend-verification', async (req, res) => {
//   const { email } = req.body;
  
//   if (!email) {
//     return res.status(400).json({ message: 'Se requiere el correo electrónico' });
//   }
  
//   try {
//     const pool = await connectDB();
    
//     // Buscar al usuario por email
//     const userResult = await pool.request()
//       .input('email', sql.VarChar, email)
//       .query(`
//         SELECT id_usuario, nombre, estado 
//         FROM Usuarios 
//         WHERE email = @email
//       `);
    
//     if (userResult.recordset.length === 0) {
//       return res.status(404).json({ message: 'No se encontró ningún usuario con este correo electrónico' });
//     }
    
//     const user = userResult.recordset[0];
    
//     // Verificar si la cuenta ya está activa
//     if (user.estado === 'activo') {
//       return res.status(400).json({ message: 'Esta cuenta ya está verificada. Puedes iniciar sesión.' });
//     }
    
//     // Generar nuevo token
//     const verificationToken = crypto.randomBytes(16).toString('hex');
//     const tokenExpires = new Date();
//     tokenExpires.setHours(tokenExpires.getHours() + 24);
    
//     // Actualizar token en la base de datos
//     await pool.request()
//       .input('id_usuario', sql.Int, user.id_usuario)
//       .input('verification_token', sql.VarChar, verificationToken)
//       .input('token_expires', sql.DateTime, tokenExpires)
//       .query(`
//         UPDATE Usuarios 
//         SET 
//           verification_token = @verification_token,
//           token_expires = @token_expires
//         WHERE id_usuario = @id_usuario
//       `);
    
//     // Preparar URL de verificación
//     const verificationUrl = `${process.env.FRONTEND_URL}/verificar-email/${verificationToken}`;
    
//     // Enviar email de verificación
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'Verifica tu cuenta de Fitness Gym',
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #4a9ced; border-radius: 10px;">
//           <h2 style="color: #ff9966; text-align: center;">Verificación de cuenta en Fitness Gym</h2>
//           <p>Hola ${user.nombre},</p>
//           <p>Has solicitado un nuevo enlace de verificación. Por favor, haz clic en el siguiente enlace para verificar tu dirección de correo electrónico:</p>
//           <div style="text-align: center; margin: 30px 0;">
//             <a href="${verificationUrl}" style="background: linear-gradient(to right, #ff9966, #ffde59); color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold;">Verificar mi cuenta</a>
//           </div>
//           <p>Este enlace es válido por 24 horas. Si no verificas tu cuenta en este tiempo, deberás solicitar un nuevo enlace.</p>
//           <p>Si no solicitaste este enlace, puedes ignorar este correo.</p>
//           <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #777;">
//             Este es un correo automático, por favor no respondas a este mensaje.
//           </p>
//         </div>
//       `
//     };
    
//     // Enviar el correo
//     await transporter.sendMail(mailOptions);
    
//     res.json({ message: 'Se ha enviado un nuevo correo de verificación. Por favor, revisa tu bandeja de entrada.' });
    
//   } catch (error) {
//     console.error('Error al reenviar verificación:', error);
//     res.status(500).json({ message: 'Error en el servidor' });
//   }
// });

// // Ruta para solicitar restablecimiento de contraseña
// router.post('/forgot-password', async (req, res) => {
//   const { email } = req.body;
  
//   if (!email) {
//     return res.status(400).json({ message: 'Se requiere el correo electrónico' });
//   }
  
//   try {
//     const pool = await connectDB();
    
//     // Verificar si el email existe
//     const userResult = await pool.request()
//       .input('email', sql.VarChar, email)
//       .query(`
//         SELECT id_usuario, nombre, email 
//         FROM Usuarios 
//         WHERE email = @email
//       `);
    
//     if (userResult.recordset.length === 0) {
//       // Por seguridad, no informar si el email existe o no
//       return res.json({ message: 'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.' });
//     }
    
//     const user = userResult.recordset[0];
    
//     // Generar token de restablecimiento
//     const resetToken = crypto.randomBytes(16).toString('hex');
//     const tokenExpires = new Date();
//     tokenExpires.setHours(tokenExpires.getHours() + 1); // El token expira en 1 hora
    
//     // Guardar token en la base de datos
//     await pool.request()
//       .input('id_usuario', sql.Int, user.id_usuario)
//       .input('reset_token', sql.VarChar, resetToken)
//       .input('token_expires', sql.DateTime, tokenExpires)
//       .query(`
//         UPDATE Usuarios 
//         SET 
//           verification_token = @reset_token,
//           token_expires = @token_expires
//         WHERE id_usuario = @id_usuario
//       `);
    
//     // Preparar URL de restablecimiento
//     const resetUrl = `${process.env.FRONTEND_URL}/restablecer-password/${resetToken}`;
    
//     // Enviar email con instrucciones
//     const mailOptions = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: 'Restablece tu contraseña - Fitness Gym',
//       html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #4a9ced; border-radius: 10px;">
//           <h2 style="color: #ff9966; text-align: center;">Restablece tu contraseña</h2>
//           <p>Hola ${user.nombre},</p>
//           <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
//           <div style="text-align: center; margin: 30px 0;">
//             <a href="${resetUrl}" style="background: linear-gradient(to right, #ff9966, #ffde59); color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold;">Restablecer contraseña</a>
//           </div>
//           <p>Este enlace es válido por 1 hora. Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.</p>
//           <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #777;">
//             Este es un correo automático, por favor no respondas a este mensaje.
//           </p>
//         </div>
//       `
//     };
    
//     await transporter.sendMail(mailOptions);
    
//     // Por seguridad, siempre devolver el mismo mensaje
//     res.json({ message: 'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.' });
    
//   } catch (error) {
//     console.error('Error al solicitar restablecimiento de contraseña:', error);
//     res.status(500).json({ message: 'Error al procesar la solicitud' });
//   }
// });

// // Ruta para verificar token de restablecimiento
// router.get('/reset-password/:token', async (req, res) => {
//   const { token } = req.params;
  
//   try {
//     const pool = await connectDB();
    
//     // Buscar usuario con el token proporcionado
//     const result = await pool.request()
//       .input('token', sql.VarChar, token)
//       .query(`
//         SELECT id_usuario, token_expires 
//         FROM Usuarios 
//         WHERE verification_token = @token
//       `);
    
//     if (result.recordset.length === 0) {
//       return res.status(400).json({ message: 'El enlace de restablecimiento no es válido' });
//     }
    
//     const user = result.recordset[0];
    
//     // Verificar si el token ha expirado
//     const now = new Date();
//     const tokenExpires = new Date(user.token_expires);
    
//     if (now > tokenExpires) {
//       return res.status(400).json({ message: 'El enlace de restablecimiento ha expirado. Por favor, solicita uno nuevo.' });
//     }
    
//     res.json({ valid: true });
    
//   } catch (error) {
//     console.error('Error al verificar token de restablecimiento:', error);
//     res.status(500).json({ message: 'Error al verificar token' });
//   }
// });

// // Ruta para restablecer contraseña
// router.post('/reset-password/:token', async (req, res) => {
//   const { token } = req.params;
//   const { password } = req.body;
  
//   if (!password) {
//     return res.status(400).json({ message: 'Se requiere la nueva contraseña' });
//   }
  
//   try {
//     const pool = await connectDB();
    
//     // Buscar usuario con el token proporcionado
//     const result = await pool.request()
//       .input('token', sql.VarChar, token)
//       .query(`
//         SELECT id_usuario, email, token_expires 
//         FROM Usuarios 
//         WHERE verification_token = @token
//       `);
    
//     if (result.recordset.length === 0) {
//       return res.status(400).json({ message: 'El enlace de restablecimiento no es válido' });
//     }
    
//     const user = result.recordset[0];
    
//     // Verificar si el token ha expirado
//     const now = new Date();
//     const tokenExpires = new Date(user.token_expires);
    
//     if (now > tokenExpires) {
//       return res.status(400).json({ message: 'El enlace de restablecimiento ha expirado. Por favor, solicita uno nuevo.' });
//     }
    
//     // Hashear la nueva contraseña
//     const saltRounds = 10;
//     const hashedPassword = await bcrypt.hash(password, saltRounds);
    
//     // Actualizar contraseña y limpiar token
//     await pool.request()
//       .input('id_usuario', sql.Int, user.id_usuario)
//       .input('password', sql.VarChar, hashedPassword)
//       .query(`
//         UPDATE Usuarios 
//         SET 
//           contraseña = @password,
//           verification_token = NULL,
//           token_expires = NULL
//         WHERE id_usuario = @id_usuario
//       `);
    
//     res.json({ message: 'Contraseña actualizada correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.' });
    
//   } catch (error) {
//     console.error('Error al restablecer contraseña:', error);
//     res.status(500).json({ message: 'Error al restablecer contraseña' });
//   }
// });

// // Ruta para comproar si el token es válido
// router.post('/verify-token', authMiddleware, (req, res) => {
//   res.json({ valid: true, user: { id: req.user.id, type: req.user.type } });
// });

// // Ruta para obtener el usuario actual
// router.get('/me', authMiddleware, async (req, res) => {
//   try {
//     const pool = await connectDB();
    
//     // Consulta para obtener datos completos del usuario
//     const result = await pool.request()
//       .input('id_usuario', sql.Int, req.user.id)
//       .query(`
//         SELECT 
//           id_usuario, 
//           nombre, 
//           email, 
//           telefono, 
//           direccion, 
//           fecha_nacimiento, 
//           tipo_usuario, 
//           estado, 
//           fecha_registro
//         FROM 
//           Usuarios 
//         WHERE 
//           id_usuario = @id_usuario
//       `);
    
//     if (result.recordset.length === 0) {
//       return res.status(404).json({ message: 'Usuario no encontrado' });
//     }
    
//     // Usuario encontrado, enviar datos (sin la contraseña)
//     const userData = result.recordset[0];

//    // Si es cliente, obtener información de membresía si existe
// if (userData.tipo_usuario === 'cliente') {
//   try {
//     const membershipResult = await pool.request()
//       .input('id_usuario', sql.Int, req.user.id)
//       .query(`
//         SELECT 
//           m.id_suscripcion,
//           m.tipo_plan,
//           m.fecha_inicio,
//           m.fecha_fin,
//           m.estado,
//           m.precio_pagado,
//           m.metodo_pago
//         FROM 
//           Suscripciones m
//         WHERE 
//           m.id_usuario = @id_usuario AND
//           m.estado = 'activa'
//         ORDER BY 
//           m.fecha_fin DESC
//       `);
    
//     if (membershipResult.recordset.length > 0) {
//       // Mapeamos los nombres de las propiedades a los esperados en el frontend
//       userData.membresia = {
//         id_membresia: membershipResult.recordset[0].id_suscripcion,
//         tipo: membershipResult.recordset[0].tipo_plan,
//         fecha_inicio: membershipResult.recordset[0].fecha_inicio,
//         fecha_vencimiento: membershipResult.recordset[0].fecha_fin,
//         estado: membershipResult.recordset[0].estado,
//         precio_pagado: membershipResult.recordset[0].precio_pagado,
//         metodo_pago: membershipResult.recordset[0].metodo_pago
//       };
//     }
//   } catch (membershipError) {
//     console.error('Error al obtener membresía:', membershipError);
//     // No interrumpir la respuesta si falla esta parte
//   }
// }
    
//     // Si es entrenador, obtener información adicional
//     if (userData.tipo_usuario === 'coach') {
//       try {
//         const coachResult = await pool.request()
//           .input('id_usuario', sql.Int, req.user.id)
//           .query(`
//             SELECT 
//               c.id_coach,
//               c.especialidad,
//               c.certificaciones,
//               c.experiencia,
//               c.biografia,
//               c.horario_disponible
//             FROM 
//               Coaches c
//             WHERE 
//               c.id_usuario = @id_usuario
//           `);
        
//         if (coachResult.recordset.length > 0) {
//           userData.coach_info = coachResult.recordset[0];
//         }
//       } catch (coachError) {
//         console.error('Error al obtener información de coach:', coachError);
//         // No interrumpir la respuesta si falla esta parte
//       }
//     }
    
//     res.json(userData);
//   } catch (error) {
//     console.error('Error al obtener usuario actual:', error);
//     res.status(500).json({ message: 'Error del servidor al obtener datos del usuario' });
//   }
// });

// router.put('/profile', authMiddleware, async (req, res) => {
//   console.log('Solicitud de actualización de perfil recibida:', req.body);
  
//   try {
//     const { nombre, email, telefono, direccion, fecha_nacimiento } = req.body;
//     const userId = req.user.id;
    
//     // Validaciones básicas
//     if (!nombre || !email) {
//       return res.status(400).json({ message: 'El nombre y email son obligatorios' });
//     }
    
//     const pool = await connectDB();
    
//     // Verificar si el email ya existe para otro usuario
//     if (email) {
//       const emailCheck = await pool.request()
//         .input('email', sql.VarChar, email)
//         .input('id_usuario', sql.Int, userId)
//         .query('SELECT email FROM Usuarios WHERE email = @email AND id_usuario != @id_usuario');
      
//       if (emailCheck.recordset.length > 0) {
//         return res.status(400).json({ message: 'El email ya está siendo usado por otro usuario' });
//       }
//     }
    
//     // Preparar la fecha de nacimiento si existe
//     let fechaNacimiento = null;
//     if (fecha_nacimiento) {
//       fechaNacimiento = new Date(fecha_nacimiento);
//       // Verificar que la fecha sea válida
//       if (isNaN(fechaNacimiento.getTime())) {
//         fechaNacimiento = null;
//       }
//     }
    
//     console.log('Actualizando perfil para el usuario ID:', userId);
    
//     // Actualizar datos del usuario
//     const updateResult = await pool.request()
//       .input('id_usuario', sql.Int, userId)
//       .input('nombre', sql.VarChar, nombre)
//       .input('email', sql.VarChar, email)
//       .input('telefono', sql.VarChar, telefono || null)
//       .input('direccion', sql.VarChar, direccion || null)
//       .input('fecha_nacimiento', sql.Date, fechaNacimiento)
//       .query(`
//         UPDATE Usuarios
//         SET 
//           nombre = @nombre,
//           email = @email,
//           telefono = @telefono,
//           direccion = @direccion,
//           fecha_nacimiento = @fecha_nacimiento
//         WHERE 
//           id_usuario = @id_usuario;
          
//         -- Devolver los datos actualizados
//         SELECT 
//           id_usuario, 
//           nombre, 
//           email, 
//           telefono, 
//           direccion, 
//           fecha_nacimiento, 
//           tipo_usuario, 
//           estado, 
//           fecha_registro
//         FROM 
//           Usuarios 
//         WHERE 
//           id_usuario = @id_usuario;
//       `);
    
//     // Verificar si se actualizó el usuario
//     if (updateResult.recordset.length === 0) {
//       return res.status(404).json({ message: 'Usuario no encontrado' });
//     }
    
//     // Usuario actualizado, enviar datos actualizados
//     const updatedUserData = updateResult.recordset[0];
    
//     console.log('Perfil actualizado exitosamente');
//     res.json(updatedUserData);
    
//   } catch (error) {
//     console.error('Error al actualizar perfil:', error);
//     res.status(500).json({ message: 'Error del servidor al actualizar el perfil' });
//   }
// });



// // Ruta para cambiar contraseña del usuario actual
// router.put('/change-password', authMiddleware, async (req, res) => {
//   const { currentPassword, newPassword } = req.body;
  
//   // Validaciones básicas
//   if (!currentPassword || !newPassword) {
//     return res.status(400).json({ message: 'Se requieren la contraseña actual y la nueva contraseña' });
//   }
  
//   try {
//     const pool = await connectDB();
    
//     // Obtener la contraseña actual del usuario
//     const userResult = await pool.request()
//       .input('id_usuario', sql.Int, req.user.id)
//       .query(`
//         SELECT contraseña 
//         FROM Usuarios 
//         WHERE id_usuario = @id_usuario
//       `);
    
//     if (userResult.recordset.length === 0) {
//       return res.status(404).json({ message: 'Usuario no encontrado' });
//     }
    
//     const storedPassword = userResult.recordset[0].contraseña;
    
//     // Verificar si la contraseña actual es correcta
//     const isMatch = await bcrypt.compare(currentPassword, storedPassword);
    
//     if (!isMatch) {
//       return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
//     }
    
//     // Hashear la nueva contraseña
//     const saltRounds = 10;
//     const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
//     // Actualizar la contraseña
//     await pool.request()
//       .input('id_usuario', sql.Int, req.user.id)
//       .input('password', sql.VarChar, hashedPassword)
//       .query(`
//         UPDATE Usuarios 
//         SET contraseña = @password 
//         WHERE id_usuario = @id_usuario
//       `);
    
//     res.json({ message: 'Contraseña actualizada con éxito' });
    
//   } catch (error) {
//     console.error('Error al cambiar contraseña:', error);
//     res.status(500).json({ message: 'Error del servidor al cambiar la contraseña' });
//   }
// });

// module.exports = router;




// server/routes/auth.js - Rutas de autenticación
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { connectDB, sql } = require('../config/db');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Middleware para verificar token
const authMiddleware = require('../middleware/auth');

router.post('/test-register', async (req, res) => {
  console.log('Datos recibidos en test-register:', req.body);
  
  try {
    const { nombre, email, password } = req.body;
    
    if (!nombre || !email || !password) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Solicitud de registro recibida correctamente',
      userData: { nombre, email }
    });
  } catch (error) {
    console.error('Error en test-register:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error en la prueba',
      error: error.message
    });
  }
});

// Modificación solo para la ruta de login (las demás rutas quedan igual)

router.post('/login', async (req, res) => {
  console.log('Intento de login recibido');
  console.log('Headers completos:', req.headers);
  console.log('Cuerpo completo de la solicitud:', req.body);
  
  // Manejo defensivo para req.body indefinido
  if (!req.body) {
    return res.status(400).json({ 
      message: 'Cuerpo de la solicitud vacío o mal formateado',
      error: 'missing_body'
    });
  }
  
  // Extraer email y password con manejo seguro
  const email = req.body.email || '';
  const password = req.body.password || '';
  
  // Validaciones básicas
  if (!email || !password) {
    return res.status(400).json({ 
      message: 'Se requieren email y contraseña',
      error: 'missing_credentials',
      received: { hasEmail: !!email, hasPassword: !!password }
    });
  }
  
  try {
    const pool = await connectDB();
    
    // Buscar usuario por email
    const result = await pool.request()
      .input('email', sql.VarChar, email)
      .query(`
        SELECT u.id_usuario, u.nombre, u.email, u.contraseña, u.tipo_usuario, u.estado
        FROM Usuarios u
        WHERE u.email = @email
      `);
    
    const user = result.recordset[0];
    
    // Verificar si el usuario existe
    if (!user) {
      console.log('Usuario no encontrado en la base de datos');
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    
    // Verificar si la cuenta ha sido verificada
    if (user.estado === 'inactivo') {
      console.log('Usuario pendiente de verificación:', user.email);
      return res.status(401).json({ 
        message: 'Tu cuenta aún no ha sido verificada. Por favor, verifica tu correo electrónico para activar tu cuenta.',
        requiresVerification: true,
        email: user.email
      });
    }
    
    // Verificar si la cuenta está activa
    if (user.estado !== 'activo') {
      console.log('Usuario encontrado pero estado es:', user.estado);
      return res.status(401).json({ message: 'La cuenta está inactiva o suspendida' });
    }
    
    // Verificar si la contraseña comienza con '$2' (indicio de que está hasheada con bcrypt)
    let isMatch = false;
    if (user.contraseña.startsWith('$2')) {
      // Contraseña hasheada con bcrypt
      isMatch = await bcrypt.compare(password, user.contraseña);
    } else {
      // Contraseña sin hashear (método antiguo)
      isMatch = (password === user.contraseña);
      
      // Si coincide, actualizar a formato bcrypt para futuros inicios de sesión
      if (isMatch) {
        // Hashear la contraseña
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Actualizar en la base de datos
        await pool.request()
          .input('id_usuario', sql.Int, user.id_usuario)
          .input('password', sql.VarChar, hashedPassword)
          .query(`
            UPDATE Usuarios
            SET contraseña = @password
            WHERE id_usuario = @id_usuario
          `);
        
        console.log('Contraseña migrada a formato bcrypt para usuario:', user.email);
      }
    }
    
    if (!isMatch) {
      console.log('Contraseña incorrecta');
      return res.status(401).json({ message: 'Credenciales incorrectas' });
    }
    
    // Crear token JWT
    const payload = {
      user: {
        id: user.id_usuario,
        type: user.tipo_usuario
      }
    };
    
    // Verificar que JWT_SECRET esté definido
    if (!process.env.JWT_SECRET) {
      console.error('Error crítico: JWT_SECRET no está definido en variables de entorno');
      return res.status(500).json({ message: 'Error de configuración del servidor' });
    }
    
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) {
          console.error('Error al generar JWT:', err);
          return res.status(500).json({ message: 'Error al generar token de autenticación' });
        }
        
        // Actualizar fecha del último login (opcional)
        pool.request()
          .input('id_usuario', sql.Int, user.id_usuario)
          .query(`
            UPDATE Usuarios 
            SET fecha_registro = GETDATE() 
            WHERE id_usuario = @id_usuario
          `);
        
        // Devolver token y datos básicos del usuario
        res.json({
          token,
          user: {
            id: user.id_usuario,
            name: user.nombre,
            email: user.email,
            type: user.tipo_usuario
          }
        });
      }
    );
  } catch (error) {
    console.error('Error detallado en el login:', error);
    console.error('Stack trace:', error.stack);
    
    res.status(500).json({ 
      message: 'Error en el servidor', 
      details: error.message 
    });
  }
});

// Configuración de nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Prueba la conexión al iniciar
transporter.verify(function(error, success) {
  if (error) {
    console.error('Error en la configuración del correo:', error);
  } else {
    console.log('Servidor de correo listo para enviar mensajes');
  }
});

router.post('/register', async (req, res) => {
  console.log('Datos recibidos para registro:', JSON.stringify(req.body));
  
  const { nombre, email, password, telefono, direccion, fecha_nacimiento } = req.body;
  
  // Validaciones básicas
  if (!nombre || !email || !password) {
    return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios' });
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
    
    // Generar token de verificación - usar token más corto
    const verificationToken = crypto.randomBytes(16).toString('hex');
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24); // El token expira en 24 horas
    
    // Generar el hash de la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    console.log('Preparando inserción de usuario...');
    
    // Simplificar: Primero solo insertar el usuario sin usar transacción
    const userInsert = await pool.request()
      .input('nombre', sql.VarChar, nombre)
      .input('email', sql.VarChar, email)
      .input('password', sql.VarChar, hashedPassword) // Usar contraseña hasheada
      .input('telefono', sql.VarChar, telefono || '')
      .input('direccion', sql.VarChar, direccion || '')
      .input('fecha_nacimiento', sql.Date, fecha_nacimiento ? new Date(fecha_nacimiento) : null)
      .input('tipo_usuario', sql.VarChar, 'cliente')
      .input('verification_token', sql.VarChar, verificationToken)
      .input('token_expires', sql.DateTime, tokenExpires)
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
            estado,
            verification_token,
            token_expires
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
            'inactivo',
            @verification_token,
            @token_expires
        );
        
        SELECT SCOPE_IDENTITY() AS id_usuario;
      `);
    
    const userId = userInsert.recordset[0].id_usuario;
    console.log('Usuario insertado correctamente, ID:', userId);
    
    // Preparar URL de verificación - modificación para usar URL completa para verificación directa
   // const verificationUrl = `${process.env.FRONTEND_URL}/verificar-email/${verificationToken}`;
const backendUrl = process.env.API_URL || 'https://backend-h016.onrender.com';
const verificationUrl = `${backendUrl}/api/auth/verify-email-direct/${verificationToken}`;

    console.log('URL de verificación:', verificationUrl);
    console.log('Preparando envío de correo a:', email);
    
    // Luego, si la inserción fue exitosa, enviar el correo
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verifica tu cuenta de Fitness Gym',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #4a9ced; border-radius: 10px;">
          <h2 style="color: #ff9966; text-align: center;">¡Gracias por registrarte en Fitness Gym!</h2>
          <p>Hola ${nombre},</p>
          <p>Estás a un paso de completar tu registro. Por favor, haz clic en el siguiente enlace para verificar tu dirección de correo electrónico:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: linear-gradient(to right, #ff9966, #ffde59); color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold;">Verificar mi cuenta</a>
          </div>
          <p>Este enlace es válido por 24 horas. Si no verificas tu cuenta en este tiempo, deberás registrarte nuevamente.</p>
          <p>Si no solicitaste este registro, puedes ignorar este correo.</p>
          <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #777;">
            Este es un correo automático, por favor no respondas a este mensaje.
          </p>
        </div>
      `
    };
    
    try {
      console.log('Enviando correo electrónico...');
      await transporter.sendMail(mailOptions);
      console.log('Correo enviado correctamente');
      
      // Responder al cliente
      res.status(201).json({
        message: 'Usuario registrado. Por favor, verifica tu correo electrónico para activar tu cuenta.',
        requiresVerification: true,
        email: email
      });
    } catch (emailError) {
      console.error('Error al enviar correo:', emailError);
      console.error('Stack trace:', emailError.stack);
      
      // No revertimos la inserción, pero informamos del error
      res.status(500).json({ 
        message: 'Usuario registrado pero hubo un problema al enviar el correo de verificación. Detalles: ' + emailError.message,
        requiresVerification: true,
        email: email
      });
    }
  } catch (error) {
    console.error('Error completo en el registro:', error);
    console.error('Stack trace del error:', error.stack);
    
    // Determinar el tipo de error para dar una respuesta más específica
    let errorMessage = 'Error en el servidor durante el registro';
    if (error.code) {
      console.log('Código de error SQL:', error.code);
      if (error.code.includes('UNIQUE')) {
        errorMessage = 'El email ya está registrado';
      }
    }
    
    res.status(500).json({ 
      message: errorMessage,
      details: error.message
    });
  }
});

router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  
  console.log('SERVIDOR: Recibida solicitud para verificar email con token:', token.substring(0, 10) + '...');
  
  try {
    const pool = await connectDB();
    
    // Buscar el usuario con el token proporcionado
    const result = await pool.request()
      .input('token', sql.VarChar, token)
      .query(`
        SELECT id_usuario, email, token_expires, estado
        FROM Usuarios 
        WHERE verification_token = @token
      `);
    
    if (result.recordset.length === 0) {
      return res.status(400).json({ message: 'Token de verificación inválido o ya utilizado' });
    }
    
    const user = result.recordset[0];
    
    // Verificar si la cuenta ya está activa
    if (user.estado === 'activo') {
      return res.json({
        message: 'Tu cuenta ya ha sido verificada anteriormente. Puedes iniciar sesión.',
        alreadyVerified: true
      });
    }
    
    // Verificar si el token ha expirado
    const now = new Date();
    const tokenExpires = new Date(user.token_expires);
    
    if (now > tokenExpires) {
      return res.status(400).json({ message: 'El token de verificación ha expirado. Por favor, regístrate nuevamente.' });
    }
    
    // Actualizar el estado del usuario a 'activo'
    await pool.request()
      .input('id_usuario', sql.Int, user.id_usuario)
      .query(`
        UPDATE Usuarios 
        SET 
          estado = 'activo',
          verification_token = NULL,
          token_expires = NULL
        WHERE id_usuario = @id_usuario
      `);
    
    // Crear token JWT para inicio de sesión automático
    const payload = {
      user: {
        id: user.id_usuario,
        type: 'cliente'
      }
    };
    
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '24h' },
      (err, token) => {
        if (err) {
          console.error('Error al generar token JWT:', err);
          return res.status(500).json({ message: 'Error al generar token de autenticación' });
        }
        
        res.json({
          message: 'Email verificado exitosamente. Tu cuenta ha sido activada.',
          token,
          user: {
            id: user.id_usuario,
            email: user.email,
            type: 'cliente'
          }
        });
      }
    );
    
  } catch (error) {
    console.error('Error detallado al verificar email:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ message: 'Error en el servidor al verificar el email', details: error.message });
  }
});

// NUEVA RUTA: Verificación directa que redirecciona al frontend
router.get('/verify-email-direct/:token', async (req, res) => {
  const { token } = req.params;
  
  console.log('SERVIDOR: Recibida solicitud para verificación directa con token:', token.substring(0, 10) + '...');
  
  try {
    if (!token || token.length < 10) {
      console.error('Token inválido o muy corto en verificación directa:', token);
      return res.redirect(`${process.env.FRONTEND_URL}/login?verificationError=true&message=${encodeURIComponent('Token inválido')}`);
    }
    
    const pool = await connectDB();
    
    // Buscar el usuario con el token proporcionado
    const result = await pool.request()
      .input('token', sql.VarChar, token)
      .query(`
        SELECT id_usuario, email, token_expires, estado
        FROM Usuarios 
        WHERE verification_token = @token
      `);
    
    if (result.recordset.length === 0) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?verificationError=true&message=${encodeURIComponent('Token no encontrado o ya utilizado')}`);
    }
    
    const user = result.recordset[0];
    
    // Verificar si la cuenta ya está activa
    if (user.estado === 'activo') {
      console.log('La cuenta ya está activa para el usuario en verificación directa:', user.email);
      return res.redirect(`${process.env.FRONTEND_URL}/login?alreadyVerified=true`);
    }
    
    // Verificar si el token ha expirado
    const now = new Date();
    const tokenExpires = new Date(user.token_expires);
    
    if (now > tokenExpires) {
      console.log('Token expirado para el usuario en verificación directa:', user.email);
      return res.redirect(`${process.env.FRONTEND_URL}/login?verificationError=true&message=${encodeURIComponent('Token expirado')}`);
    }
    
    // Actualizar el estado del usuario a 'activo'
    await pool.request()
      .input('id_usuario', sql.Int, user.id_usuario)
      .query(`
        UPDATE Usuarios 
        SET 
          estado = 'activo',
          verification_token = NULL,
          token_expires = NULL
        WHERE id_usuario = @id_usuario
      `);
    
    console.log('Usuario activado correctamente en verificación directa:', user.email);
    
    // Redirigir al usuario al frontend con un mensaje de éxito
    return res.redirect(`${process.env.FRONTEND_URL}/login?verified=true`);
    
  } catch (error) {
    console.error('Error detallado en verificación directa:', error);
    console.error('Stack trace:', error.stack);
    return res.redirect(`${process.env.FRONTEND_URL}/login?verificationError=true&message=${encodeURIComponent('Error del servidor')}`);
  }
});

// Añade esta ruta para probar el envío de correo
router.get('/test-email', async (req, res) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Enviar a mi mismo para probar
      subject: 'Prueba de Correo - Fitness Gym',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #4a9ced; border-radius: 10px;">
          <h2 style="color: #ff9966; text-align: center;">Prueba de Correo</h2>
          <p>Este es un correo de prueba para verificar la configuración de nodemailer.</p>
          <p>Si estás viendo este mensaje, ¡la configuración funciona correctamente!</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Correo enviado con éxito' });
  } catch (error) {
    console.error('Error al enviar correo de prueba:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al enviar correo', 
      details: error.message 
    });
  }
});

// 6. Ruta para reenviar el correo de verificación
router.post('/resend-verification', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Se requiere el correo electrónico' });
  }
  
  try {
    const pool = await connectDB();
    
    // Buscar al usuario por email
    const userResult = await pool.request()
      .input('email', sql.VarChar, email)
      .query(`
        SELECT id_usuario, nombre, estado 
        FROM Usuarios 
        WHERE email = @email
      `);
    
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'No se encontró ningún usuario con este correo electrónico' });
    }
    
    const user = userResult.recordset[0];
    
    // Verificar si la cuenta ya está activa
    if (user.estado === 'activo') {
      return res.status(400).json({ message: 'Esta cuenta ya está verificada. Puedes iniciar sesión.' });
    }
    
    // Generar nuevo token
    const verificationToken = crypto.randomBytes(16).toString('hex');
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 24);
    
    // Actualizar token en la base de datos
    await pool.request()
      .input('id_usuario', sql.Int, user.id_usuario)
      .input('verification_token', sql.VarChar, verificationToken)
      .input('token_expires', sql.DateTime, tokenExpires)
      .query(`
        UPDATE Usuarios 
        SET 
          verification_token = @verification_token,
          token_expires = @token_expires
        WHERE id_usuario = @id_usuario
      `);
    
    // Preparar URL de verificación - actualizada para usar la verificación directa
    //const verificationUrl = `${process.env.FRONTEND_URL}/verificar-email/${verificationToken}`;
const backendUrl = process.env.API_URL || 'https://backend-h016.onrender.com';
const verificationUrl = `${backendUrl}/api/auth/verify-email-direct/${verificationToken}`;    // Enviar email de verificación
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verifica tu cuenta de Fitness Gym',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #4a9ced; border-radius: 10px;">
          <h2 style="color: #ff9966; text-align: center;">Verificación de cuenta en Fitness Gym</h2>
          <p>Hola ${user.nombre},</p>
          <p>Has solicitado un nuevo enlace de verificación. Por favor, haz clic en el siguiente enlace para verificar tu dirección de correo electrónico:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: linear-gradient(to right, #ff9966, #ffde59); color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold;">Verificar mi cuenta</a>
          </div>
          <p>Este enlace es válido por 24 horas. Si no verificas tu cuenta en este tiempo, deberás solicitar un nuevo enlace.</p>
          <p>Si no solicitaste este enlace, puedes ignorar este correo.</p>
          <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #777;">
            Este es un correo automático, por favor no respondas a este mensaje.
          </p>
        </div>
      `
    };
    
    // Enviar el correo
    await transporter.sendMail(mailOptions);
    
    res.json({ message: 'Se ha enviado un nuevo correo de verificación. Por favor, revisa tu bandeja de entrada.' });
    
  } catch (error) {
    console.error('Error al reenviar verificación:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Ruta para solicitar restablecimiento de contraseña
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ message: 'Se requiere el correo electrónico' });
  }
  
  try {
    const pool = await connectDB();
    
    // Verificar si el email existe
    const userResult = await pool.request()
      .input('email', sql.VarChar, email)
      .query(`
        SELECT id_usuario, nombre, email 
        FROM Usuarios 
        WHERE email = @email
      `);
    
    if (userResult.recordset.length === 0) {
      // Por seguridad, no informar si el email existe o no
      return res.json({ message: 'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.' });
    }
    
    const user = userResult.recordset[0];
    
    // Generar token de restablecimiento
    const resetToken = crypto.randomBytes(16).toString('hex');
    const tokenExpires = new Date();
    tokenExpires.setHours(tokenExpires.getHours() + 1); // El token expira en 1 hora
    
    // Guardar token en la base de datos
    await pool.request()
      .input('id_usuario', sql.Int, user.id_usuario)
      .input('reset_token', sql.VarChar, resetToken)
      .input('token_expires', sql.DateTime, tokenExpires)
      .query(`
        UPDATE Usuarios 
        SET 
          verification_token = @reset_token,
          token_expires = @token_expires
        WHERE id_usuario = @id_usuario
      `);
    
    // Preparar URL de restablecimiento
    const resetUrl = `${process.env.FRONTEND_URL}/restablecer-password/${resetToken}`;
    
    // Enviar email con instrucciones
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Restablece tu contraseña - Fitness Gym',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #4a9ced; border-radius: 10px;">
          <h2 style="color: #ff9966; text-align: center;">Restablece tu contraseña</h2>
          <p>Hola ${user.nombre},</p>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(to right, #ff9966, #ffde59); color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold;">Restablecer contraseña</a>
          </div>
          <p>Este enlace es válido por 1 hora. Si no solicitaste restablecer tu contraseña, puedes ignorar este correo.</p>
          <p style="text-align: center; margin-top: 30px; font-size: 12px; color: #777;">
            Este es un correo automático, por favor no respondas a este mensaje.
          </p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    
    // Por seguridad, siempre devolver el mismo mensaje
    res.json({ message: 'Si el correo existe en nuestro sistema, recibirás instrucciones para restablecer tu contraseña.' });
    
  } catch (error) {
    console.error('Error al solicitar restablecimiento de contraseña:', error);
    res.status(500).json({ message: 'Error al procesar la solicitud' });
  }
});

// Ruta para verificar token de restablecimiento
router.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  
  try {
    const pool = await connectDB();
    
    // Buscar usuario con el token proporcionado
    const result = await pool.request()
      .input('token', sql.VarChar, token)
      .query(`
        SELECT id_usuario, token_expires 
        FROM Usuarios 
        WHERE verification_token = @token
      `);
    
    if (result.recordset.length === 0) {
      return res.status(400).json({ message: 'El enlace de restablecimiento no es válido' });
    }
    
    const user = result.recordset[0];
    
    // Verificar si el token ha expirado
    const now = new Date();
    const tokenExpires = new Date(user.token_expires);
    
    if (now > tokenExpires) {
      return res.status(400).json({ message: 'El enlace de restablecimiento ha expirado. Por favor, solicita uno nuevo.' });
    }
    
    res.json({ valid: true });
    
  } catch (error) {
    console.error('Error al verificar token de restablecimiento:', error);
    res.status(500).json({ message: 'Error al verificar token' });
  }
});

// Ruta para restablecer contraseña
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ message: 'Se requiere la nueva contraseña' });
  }
  
  try {
    const pool = await connectDB();
    
    // Buscar usuario con el token proporcionado
    const result = await pool.request()
      .input('token', sql.VarChar, token)
      .query(`
        SELECT id_usuario, email, token_expires 
        FROM Usuarios 
        WHERE verification_token = @token
      `);
    
    if (result.recordset.length === 0) {
      return res.status(400).json({ message: 'El enlace de restablecimiento no es válido' });
    }
    
    const user = result.recordset[0];
    
    // Verificar si el token ha expirado
    const now = new Date();
    const tokenExpires = new Date(user.token_expires);
    
    if (now > tokenExpires) {
      return res.status(400).json({ message: 'El enlace de restablecimiento ha expirado. Por favor, solicita uno nuevo.' });
    }
    
    // Hashear la nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Actualizar contraseña y limpiar token
    await pool.request()
      .input('id_usuario', sql.Int, user.id_usuario)
      .input('password', sql.VarChar, hashedPassword)
      .query(`
        UPDATE Usuarios 
        SET 
          contraseña = @password,
          verification_token = NULL,
          token_expires = NULL
        WHERE id_usuario = @id_usuario
      `);
    
    res.json({ message: 'Contraseña actualizada correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.' });
    
  } catch (error) {
    console.error('Error al restablecer contraseña:', error);
    res.status(500).json({ message: 'Error al restablecer contraseña' });
  }
});

// Ruta para comprobar si el token es válido
router.post('/verify-token', authMiddleware, (req, res) => {
  res.json({ valid: true, user: { id: req.user.id, type: req.user.type } });
});

// Ruta para obtener el usuario actual
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pool = await connectDB();
    
    // Consulta para obtener datos completos del usuario
    const result = await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        SELECT 
          id_usuario, 
          nombre, 
          email, 
          telefono, 
          direccion, 
          fecha_nacimiento, 
          tipo_usuario, 
          estado, 
          fecha_registro
        FROM 
          Usuarios 
        WHERE 
          id_usuario = @id_usuario
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Usuario encontrado, enviar datos (sin la contraseña)
    const userData = result.recordset[0];

    // Si es cliente, obtener información de membresía si existe
    if (userData.tipo_usuario === 'cliente') {
      try {
        const membershipResult = await pool.request()
          .input('id_usuario', sql.Int, req.user.id)
          .query(`
            SELECT 
              m.id_suscripcion,
              m.tipo_plan,
              m.fecha_inicio,
              m.fecha_fin,
              m.estado,
              m.precio_pagado,
              m.metodo_pago
            FROM 
              Suscripciones m
            WHERE 
              m.id_usuario = @id_usuario AND
              m.estado = 'activa'
            ORDER BY 
              m.fecha_fin DESC
          `);
        
        if (membershipResult.recordset.length > 0) {
          // Mapeamos los nombres de las propiedades a los esperados en el frontend
          userData.membresia = {
            id_membresia: membershipResult.recordset[0].id_suscripcion,
            tipo: membershipResult.recordset[0].tipo_plan,
            fecha_inicio: membershipResult.recordset[0].fecha_inicio,
            fecha_vencimiento: membershipResult.recordset[0].fecha_fin,
            estado: membershipResult.recordset[0].estado,
            precio_pagado: membershipResult.recordset[0].precio_pagado,
            metodo_pago: membershipResult.recordset[0].metodo_pago
          };
        }
      } catch (membershipError) {
        console.error('Error al obtener membresía:', membershipError);
        // No interrumpir la respuesta si falla esta parte
      }
    }
    
    // Si es entrenador, obtener información adicional
    if (userData.tipo_usuario === 'coach') {
      try {
        const coachResult = await pool.request()
          .input('id_usuario', sql.Int, req.user.id)
          .query(`
            SELECT 
              c.id_coach,
              c.especialidad,
              c.certificaciones,
              c.experiencia,
              c.biografia,
              c.horario_disponible
            FROM 
              Coaches c
            WHERE 
              c.id_usuario = @id_usuario
          `);
        
        if (coachResult.recordset.length > 0) {
          userData.coach_info = coachResult.recordset[0];
        }
      } catch (coachError) {
        console.error('Error al obtener información de coach:', coachError);
        // No interrumpir la respuesta si falla esta parte
      }
    }
    
    res.json(userData);
  } catch (error) {
    console.error('Error al obtener usuario actual:', error);
    res.status(500).json({ message: 'Error del servidor al obtener datos del usuario' });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  console.log('Solicitud de actualización de perfil recibida:', req.body);
  
  try {
    const { nombre, email, telefono, direccion, fecha_nacimiento } = req.body;
    const userId = req.user.id;
    
    // Validaciones básicas
    if (!nombre || !email) {
      return res.status(400).json({ message: 'El nombre y email son obligatorios' });
    }
    
    const pool = await connectDB();
    
    // Verificar si el email ya existe para otro usuario
    if (email) {
      const emailCheck = await pool.request()
        .input('email', sql.VarChar, email)
        .input('id_usuario', sql.Int, userId)
        .query('SELECT email FROM Usuarios WHERE email = @email AND id_usuario != @id_usuario');
      
      if (emailCheck.recordset.length > 0) {
        return res.status(400).json({ message: 'El email ya está siendo usado por otro usuario' });
      }
    }
    
    // Preparar la fecha de nacimiento si existe
    let fechaNacimiento = null;
    if (fecha_nacimiento) {
      fechaNacimiento = new Date(fecha_nacimiento);
      // Verificar que la fecha sea válida
      if (isNaN(fechaNacimiento.getTime())) {
        fechaNacimiento = null;
      }
    }
    
    console.log('Actualizando perfil para el usuario ID:', userId);
    
    // Actualizar datos del usuario
    const updateResult = await pool.request()
      .input('id_usuario', sql.Int, userId)
      .input('nombre', sql.VarChar, nombre)
      .input('email', sql.VarChar, email)
      .input('telefono', sql.VarChar, telefono || null)
      .input('direccion', sql.VarChar, direccion || null)
      .input('fecha_nacimiento', sql.Date, fechaNacimiento)
      .query(`
        UPDATE Usuarios
        SET 
          nombre = @nombre,
          email = @email,
          telefono = @telefono,
          direccion = @direccion,
          fecha_nacimiento = @fecha_nacimiento
        WHERE 
          id_usuario = @id_usuario;
          
        -- Devolver los datos actualizados
        SELECT 
          id_usuario, 
          nombre, 
          email, 
          telefono, 
          direccion, 
          fecha_nacimiento, 
          tipo_usuario, 
          estado, 
          fecha_registro
        FROM 
          Usuarios 
        WHERE 
          id_usuario = @id_usuario;
      `);
    
    // Verificar si se actualizó el usuario
    if (updateResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Usuario actualizado, enviar datos actualizados
    const updatedUserData = updateResult.recordset[0];
    
    console.log('Perfil actualizado exitosamente');
    res.json(updatedUserData);
    
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ message: 'Error del servidor al actualizar el perfil' });
  }
});

// Ruta para cambiar contraseña del usuario actual
router.put('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  // Validaciones básicas
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Se requieren la contraseña actual y la nueva contraseña' });
  }
  
  try {
    const pool = await connectDB();
    
    // Obtener la contraseña actual del usuario
    const userResult = await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .query(`
        SELECT contraseña 
        FROM Usuarios 
        WHERE id_usuario = @id_usuario
      `);
    
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    const storedPassword = userResult.recordset[0].contraseña;
    
    // Verificar si la contraseña actual es correcta
    const isMatch = await bcrypt.compare(currentPassword, storedPassword);
    
    if (!isMatch) {
      return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
    }
    
    // Hashear la nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Actualizar la contraseña
    await pool.request()
      .input('id_usuario', sql.Int, req.user.id)
      .input('password', sql.VarChar, hashedPassword)
      .query(`
        UPDATE Usuarios 
        SET contraseña = @password 
        WHERE id_usuario = @id_usuario
      `);
    
    res.json({ message: 'Contraseña actualizada con éxito' });
    
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ message: 'Error del servidor al cambiar la contraseña' });
  }
});

module.exports = router;