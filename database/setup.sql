-- Crear la base de datos
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'GymSystem')
BEGIN
    CREATE DATABASE GymSystem;
END
GO

USE GymSystem;
GO

GRANT EXECUTE ON dbo.sp_RegistrarUsuario TO [gym_app_user];

-- Tabla Usuarios
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Usuarios')
BEGIN
    CREATE TABLE Usuarios (
        id_usuario INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        contraseña VARCHAR(255) NOT NULL,
        telefono VARCHAR(20),
        direccion VARCHAR(200),
        fecha_nacimiento DATE,
        tipo_usuario VARCHAR(20) CHECK(tipo_usuario IN ('cliente', 'coach', 'administrador')),
        fecha_registro DATETIME DEFAULT GETDATE(),
        estado VARCHAR(20) CHECK(estado IN ('activo', 'inactivo', 'suspendido'))
    );
END;


-- Tabla Planes
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Planes')
BEGIN
    CREATE TABLE Planes (
        id_plan INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        precio DECIMAL(10,2) NOT NULL,
        duracion_dias INT NOT NULL
    );
END;

-- Tabla Suscripciones
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Suscripciones')
BEGIN
    CREATE TABLE Suscripciones (
        id_suscripcion INT IDENTITY(1,1) PRIMARY KEY,
        id_usuario INT FOREIGN KEY REFERENCES Usuarios(id_usuario),
        id_plan INT FOREIGN KEY REFERENCES Planes(id_plan),
        tipo_plan VARCHAR(20) CHECK(tipo_plan IN ('mensual', 'trimestral', 'anual')),
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE NOT NULL,
        estado VARCHAR(20) CHECK(estado IN ('activa', 'pendiente', 'cancelada', 'vencida')),
        id_admin_ultima_actualizacion INT FOREIGN KEY REFERENCES Usuarios(id_usuario),
        fecha_ultima_actualizacion DATETIME,
        notas_administrativas TEXT
    );
END;

-- Tabla Coaches
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Coaches')
BEGIN
    CREATE TABLE Coaches (
        id_coach INT IDENTITY(1,1) PRIMARY KEY,
        id_usuario INT UNIQUE FOREIGN KEY REFERENCES Usuarios(id_usuario),
        especialidad VARCHAR(100),
        certificaciones TEXT,
        biografia TEXT,
        horario_disponible TEXT
    );
END;

-- Tabla Asignaciones_Coach_Cliente
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Asignaciones_Coach_Cliente')
BEGIN
    CREATE TABLE Asignaciones_Coach_Cliente (
        id_asignacion INT IDENTITY(1,1) PRIMARY KEY,
        id_coach INT FOREIGN KEY REFERENCES Coaches(id_coach),
        id_usuario INT FOREIGN KEY REFERENCES Usuarios(id_usuario),
        fecha_asignacion DATE NOT NULL,
        estado VARCHAR(10) CHECK(estado IN ('activa', 'inactiva')),
        notas TEXT
    );
END;

-- Tabla Rutinas
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Rutinas')
BEGIN
    CREATE TABLE Rutinas (
        id_rutina INT IDENTITY(1,1) PRIMARY KEY,
        id_coach INT FOREIGN KEY REFERENCES Coaches(id_coach),
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        objetivo VARCHAR(100),
        nivel_dificultad VARCHAR(20) CHECK(nivel_dificultad IN ('principiante', 'intermedio', 'avanzado')),
        duracion_estimada INT, -- en minutos
        fecha_creacion DATE DEFAULT GETDATE()
    );
END;

-- Tabla Asignaciones_Rutina
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Asignaciones_Rutina')
BEGIN
    CREATE TABLE Asignaciones_Rutina (
        id_asignacion_rutina INT IDENTITY(1,1) PRIMARY KEY,
        id_rutina INT FOREIGN KEY REFERENCES Rutinas(id_rutina),
        id_usuario INT FOREIGN KEY REFERENCES Usuarios(id_usuario),
        fecha_asignacion DATE NOT NULL,
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE,
        estado VARCHAR(20) CHECK(estado IN ('activa', 'completada', 'cancelada')),
        notas_coach TEXT
    );
END;

-- Tabla Ejercicios
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Ejercicios')
BEGIN
    CREATE TABLE Ejercicios (
        id_ejercicio INT IDENTITY(1,1) PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        instrucciones TEXT,
        grupos_musculares VARCHAR(200),
        equipo_necesario VARCHAR(200),
        video_url VARCHAR(255),
        imagen_url VARCHAR(255)
    );
END;

-- Tabla Detalles_Rutina
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Detalles_Rutina')
BEGIN
    CREATE TABLE Detalles_Rutina (
        id_detalle INT IDENTITY(1,1) PRIMARY KEY,
        id_rutina INT FOREIGN KEY REFERENCES Rutinas(id_rutina),
        id_ejercicio INT FOREIGN KEY REFERENCES Ejercicios(id_ejercicio),
        orden INT NOT NULL,
        series INT NOT NULL,
        repeticiones VARCHAR(50) NOT NULL,
        descanso_segundos INT,
        notas TEXT
    );
END;

-- Tabla Medidas_Corporales
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Medidas_Corporales')
BEGIN
    CREATE TABLE Medidas_Corporales (
        id_medida INT IDENTITY(1,1) PRIMARY KEY,
        id_usuario INT FOREIGN KEY REFERENCES Usuarios(id_usuario),
        fecha_registro DATE NOT NULL DEFAULT GETDATE(),
        peso DECIMAL(5,2),
        altura DECIMAL(5,2),
        porcentaje_grasa DECIMAL(5,2),
        masa_muscular DECIMAL(5,2),
        medida_pecho DECIMAL(5,2),
        medida_brazo_izq DECIMAL(5,2),
        medida_brazo_der DECIMAL(5,2),
        medida_pierna_izq DECIMAL(5,2),
        medida_pierna_der DECIMAL(5,2),
        medida_cintura DECIMAL(5,2),
        medida_cadera DECIMAL(5,2),
        notas TEXT
    );
END;

-- Tabla Notificaciones
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notificaciones')
BEGIN
    CREATE TABLE Notificaciones (
        id_notificacion INT IDENTITY(1,1) PRIMARY KEY,
        id_usuario INT FOREIGN KEY REFERENCES Usuarios(id_usuario),
        tipo VARCHAR(30) CHECK(tipo IN ('asignacion_coach', 'nueva_rutina', 'solicitud_entrenamiento', 'verificacion_datos')),
        titulo VARCHAR(100) NOT NULL,
        mensaje TEXT NOT NULL,
        fecha_creacion DATETIME DEFAULT GETDATE(),
        leida BIT DEFAULT 0,
        fecha_lectura DATETIME,
        id_origen INT, -- ID del usuario o entidad que generó la notificación
        accion_url VARCHAR(255)
    );
END;

-- Tabla Verificaciones_Admin
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Verificaciones_Admin')
BEGIN
    CREATE TABLE Verificaciones_Admin (
        id_verificacion INT IDENTITY(1,1) PRIMARY KEY,
        id_usuario INT FOREIGN KEY REFERENCES Usuarios(id_usuario),
        id_admin INT FOREIGN KEY REFERENCES Usuarios(id_usuario),
        tipo_verificacion VARCHAR(50),
        fecha_verificacion DATETIME DEFAULT GETDATE(),
        estado VARCHAR(20) CHECK(estado IN ('aprobado', 'rechazado', 'pendiente')),
        comentarios TEXT,
        documentos_url NVARCHAR(MAX)
    );
END;

-- Crear índices para optimizar consultas
-- 1. Índice en "email" para búsquedas rápidas durante login
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_usuarios_email')
BEGIN
    CREATE INDEX idx_usuarios_email ON Usuarios(email);
END;

-- 2. Índice en "id_usuario" y "estado" para consultas de suscripciones activas
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_suscripciones_usuario_estado')
BEGIN
    CREATE INDEX idx_suscripciones_usuario_estado ON Suscripciones(id_usuario, estado);
END;

-- 3. Índice en "fecha_fin" para búsquedas de suscripciones próximas a vencer
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_suscripciones_fecha_fin')
BEGIN
    CREATE INDEX idx_suscripciones_fecha_fin ON Suscripciones(fecha_fin);
END;

-- 4. Índices para búsquedas de relaciones coach-cliente
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_asignaciones_coach')
BEGIN
    CREATE INDEX idx_asignaciones_coach ON Asignaciones_Coach_Cliente(id_coach);
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_asignaciones_cliente')
BEGIN
    CREATE INDEX idx_asignaciones_cliente ON Asignaciones_Coach_Cliente(id_usuario);
END;

-- 5. Índice en la tabla Notificaciones para consultas de notificaciones no leídas
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_notificaciones_usuario_leida')
BEGIN
    CREATE INDEX idx_notificaciones_usuario_leida ON Notificaciones(id_usuario, leida);
END;

-- 6. Índice para la búsqueda de medidas corporales por usuario
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_medidas_usuario')
BEGIN
    CREATE INDEX idx_medidas_usuario ON Medidas_Corporales(id_usuario);
END;

-- Crear vistas para consultas comunes

-- Vista para datos de usuarios con tipo (incluye coach o cliente)
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_usuarios_completos')
BEGIN
    EXEC('
    CREATE VIEW vw_usuarios_completos AS
    SELECT 
        u.id_usuario,
        u.nombre,
        u.email,
        u.telefono,
        u.direccion,
        u.fecha_nacimiento,
        u.tipo_usuario,
        u.fecha_registro,
        u.estado,
        c.especialidad,
        c.certificaciones,
        c.biografia
    FROM 
        Usuarios u
    LEFT JOIN 
        Coaches c ON u.id_usuario = c.id_usuario;
    ');
END;

-- Vista para suscripciones activas con datos de usuario y plan
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_suscripciones_activas')
BEGIN
    EXEC('
    CREATE VIEW vw_suscripciones_activas AS
    SELECT 
        s.id_suscripcion,
        s.id_usuario,
        u.nombre AS nombre_usuario,
        u.email AS email_usuario,
        s.id_plan,
        p.nombre AS nombre_plan,
        p.precio,
        s.fecha_inicio,
        s.fecha_fin,
        s.estado,
        s.id_admin_ultima_actualizacion,
        s.fecha_ultima_actualizacion,
        admin.nombre AS nombre_admin_actualizacion
    FROM 
        Suscripciones s
    JOIN 
        Usuarios u ON s.id_usuario = u.id_usuario
    JOIN 
        Planes p ON s.id_plan = p.id_plan
    LEFT JOIN 
        Usuarios admin ON s.id_admin_ultima_actualizacion = admin.id_usuario
    WHERE 
        s.estado = ''activa'';
    ');
END;

-- Vista para relaciones coach-cliente activas
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_relaciones_coach_cliente')
BEGIN
    EXEC('
    CREATE VIEW vw_relaciones_coach_cliente AS
    SELECT 
        a.id_asignacion,
        a.id_coach,
        coach.nombre AS nombre_coach,
        coach.email AS email_coach,
        a.id_usuario AS id_cliente,
        cliente.nombre AS nombre_cliente,
        cliente.email AS email_cliente,
        a.fecha_asignacion,
        a.estado
    FROM 
        Asignaciones_Coach_Cliente a
    JOIN 
        Coaches c ON a.id_coach = c.id_coach
    JOIN 
        Usuarios coach ON c.id_usuario = coach.id_usuario
    JOIN 
        Usuarios cliente ON a.id_usuario = cliente.id_usuario
    WHERE 
        a.estado = ''activa'';
    ');
END;

-- Vista para últimas medidas por cliente
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_ultimas_medidas_cliente')
BEGIN
    EXEC('
    CREATE VIEW vw_ultimas_medidas_cliente AS
    WITH UltimasMedidas AS (
        SELECT 
            id_usuario,
            MAX(fecha_registro) AS ultima_fecha
        FROM 
            Medidas_Corporales
        GROUP BY 
            id_usuario
    )
    SELECT 
        m.*,
        u.nombre AS nombre_usuario
    FROM 
        Medidas_Corporales m
    JOIN 
        UltimasMedidas um ON m.id_usuario = um.id_usuario AND m.fecha_registro = um.ultima_fecha
    JOIN 
        Usuarios u ON m.id_usuario = u.id_usuario;
    ');
END;

-- Crear procedimientos almacenados para operaciones comunes

-- Procedimiento para registrar un nuevo usuario
IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_RegistrarUsuario')
BEGIN
    EXEC('
    CREATE PROCEDURE sp_RegistrarUsuario
        @nombre VARCHAR(100),
        @email VARCHAR(100),
        @contrasena VARCHAR(255),
        @telefono VARCHAR(20) = NULL,
        @direccion VARCHAR(200) = NULL,
        @fecha_nacimiento DATE = NULL,
        @tipo_usuario VARCHAR(20) = ''cliente''
    AS
    BEGIN
        BEGIN TRY
            BEGIN TRANSACTION;
            
            -- Verificar que el email no exista
            IF EXISTS (SELECT 1 FROM Usuarios WHERE email = @email)
            BEGIN
                RAISERROR(''El email ya está registrado'', 16, 1);
                RETURN;
            END
            
            -- Insertar el usuario
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
                @contrasena, -- Nota: debería estar hasheada antes de llegar aquí
                @telefono,
                @direccion,
                @fecha_nacimiento,
                @tipo_usuario,
                GETDATE(),
                ''activo''
            );
            
            -- Obtener el ID del usuario insertado
            DECLARE @id_usuario INT = SCOPE_IDENTITY();
            
            -- Si es de tipo coach, insertar en la tabla de coaches
            IF @tipo_usuario = ''coach''
            BEGIN
                INSERT INTO Coaches (id_usuario, especialidad)
                VALUES (@id_usuario, ''General''); -- Datos por defecto, se actualizarán después
            END
            
            COMMIT TRANSACTION;
            
            -- Retornar el ID del usuario
            SELECT @id_usuario AS id_usuario;
        END TRY
        BEGIN CATCH
            ROLLBACK TRANSACTION;
            THROW;
        END CATCH
    END;
    ');
END;

-- Procedimiento para crear una nueva asignación coach-cliente
IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_AsignarCoachCliente')
BEGIN
    EXEC('
    CREATE PROCEDURE sp_AsignarCoachCliente
        @id_coach INT,
        @id_cliente INT
    AS
    BEGIN
        BEGIN TRY
            BEGIN TRANSACTION;
            
            -- Verificar que el coach exista y sea de tipo coach
            IF NOT EXISTS (
                SELECT 1 
                FROM Coaches c
                JOIN Usuarios u ON c.id_usuario = u.id_usuario
                WHERE c.id_coach = @id_coach AND u.tipo_usuario = ''coach''
            )
            BEGIN
                RAISERROR(''El coach no existe o no es un coach válido'', 16, 1);
                RETURN;
            END
            
            -- Verificar que el cliente exista y sea de tipo cliente
            IF NOT EXISTS (
                SELECT 1 
                FROM Usuarios
                WHERE id_usuario = @id_cliente AND tipo_usuario = ''cliente''
            )
            BEGIN
                RAISERROR(''El cliente no existe o no es un cliente válido'', 16, 1);
                RETURN;
            END
            
            -- Verificar si ya existe una asignación activa
            IF EXISTS (
                SELECT 1 
                FROM Asignaciones_Coach_Cliente
                WHERE id_coach = @id_coach AND id_usuario = @id_cliente AND estado = ''activa''
            )
            BEGIN
                RAISERROR(''Ya existe una asignación activa entre este coach y cliente'', 16, 1);
                RETURN;
            END
            
            -- Desactivar asignaciones previas para este cliente
            UPDATE Asignaciones_Coach_Cliente
            SET estado = ''inactiva''
            WHERE id_usuario = @id_cliente AND estado = ''activa'';
            
            -- Crear nueva asignación
            INSERT INTO Asignaciones_Coach_Cliente (
                id_coach,
                id_usuario,
                fecha_asignacion,
                estado
            )
            VALUES (
                @id_coach,
                @id_cliente,
                GETDATE(),
                ''activa''
            );
            
            -- Obtener el ID del usuario del coach
            DECLARE @id_usuario_coach INT;
            SELECT @id_usuario_coach = id_usuario FROM Coaches WHERE id_coach = @id_coach;
            
            -- Crear notificación para el cliente
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
                ''asignacion_coach'',
                ''Coach asignado'',
                ''¡Felicidades! Ahora tienes un coach asignado para ayudarte con tus entrenamientos.'',
                GETDATE(),
                0,
                @id_usuario_coach
            );
            
            COMMIT TRANSACTION;
            
            -- Retornar el ID de la asignación
            SELECT SCOPE_IDENTITY() AS id_asignacion;
        END TRY
        BEGIN CATCH
            ROLLBACK TRANSACTION;
            THROW;
        END CATCH
    END;
    ');
END;

-- Procedimiento para actualizar una suscripción
IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_ActualizarSuscripcion')
BEGIN
    EXEC('
    CREATE PROCEDURE sp_ActualizarSuscripcion
        @id_suscripcion INT,
        @id_admin INT,
        @nueva_fecha_fin DATE,
        @notas_administrativas VARCHAR(MAX) = NULL
    AS
    BEGIN
        BEGIN TRY
            BEGIN TRANSACTION;
            
            -- Verificar que la suscripción exista
            IF NOT EXISTS (SELECT 1 FROM Suscripciones WHERE id_suscripcion = @id_suscripcion)
            BEGIN
                RAISERROR(''La suscripción no existe'', 16, 1);
                RETURN;
            END
            
            -- Verificar que el administrador exista
            IF NOT EXISTS (
                SELECT 1 
                FROM Usuarios
                WHERE id_usuario = @id_admin AND tipo_usuario = ''administrador''
            )
            BEGIN
                RAISERROR(''El administrador no existe o no tiene permisos suficientes'', 16, 1);
                RETURN;
            END
            
            -- Obtener información del usuario para la notificación
            DECLARE @id_usuario INT;
            SELECT @id_usuario = id_usuario FROM Suscripciones WHERE id_suscripcion = @id_suscripcion;
            
            -- Actualizar la suscripción
            UPDATE Suscripciones
            SET 
                fecha_fin = @nueva_fecha_fin,
                id_admin_ultima_actualizacion = @id_admin,
                fecha_ultima_actualizacion = GETDATE(),
                notas_administrativas = CASE 
                    WHEN @notas_administrativas IS NOT NULL THEN @notas_administrativas
                    ELSE notas_administrativas
                END,
                -- Si la fecha de fin es mayor a hoy, cambiar el estado a ''activa''
                estado = CASE 
                    WHEN @nueva_fecha_fin > GETDATE() THEN ''activa''
                    ELSE ''vencida''
                END
            WHERE 
                id_suscripcion = @id_suscripcion;
            
            -- Crear notificación para el usuario
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
                ''actualizacion_suscripcion'',
                ''Suscripción actualizada'',
                ''Tu suscripción ha sido actualizada. La nueva fecha de vencimiento es: '' + 
                CONVERT(VARCHAR, @nueva_fecha_fin, 103),
                GETDATE(),
                0,
                @id_admin
            );
            
            COMMIT TRANSACTION;
        END TRY
        BEGIN CATCH
            ROLLBACK TRANSACTION;
            THROW;
        END CATCH
    END;
    ');
END;

-- Crear triggers para automatizar procesos

-- Trigger para generar notificaciones cuando una suscripción está por vencer
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_NotificarSuscripcionPorVencer')
BEGIN
    DROP TRIGGER trg_NotificarSuscripcionPorVencer;
END
GO

CREATE TRIGGER trg_NotificarSuscripcionPorVencer
ON Suscripciones
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Verificar suscripciones que están a 7 días o menos de vencer
    DECLARE @FechaLimite DATE = DATEADD(DAY, 7, GETDATE());
    
    -- Suscripciones insertadas o actualizadas que están por vencer
    SELECT 
        i.id_suscripcion, 
        i.id_usuario,
        i.fecha_fin
    INTO #SuscripcionesPorVencer
    FROM 
        inserted i
    WHERE 
        i.estado = 'activa' 
        AND i.fecha_fin <= @FechaLimite
        AND i.fecha_fin > GETDATE();
    
    -- Generar notificaciones para cada suscripción por vencer
    INSERT INTO Notificaciones (
        id_usuario,
        tipo,
        titulo,
        mensaje,
        fecha_creacion,
        leida,
        id_origen
    )
    SELECT
        spv.id_usuario,
        'vencimiento_suscripcion',
        'Tu suscripción está por vencer',
        'Tu suscripción vencerá el ' + CONVERT(VARCHAR, spv.fecha_fin, 103) + 
        '. Por favor visita nuestro gimnasio para renovarla.',
        GETDATE(),
        0,
        NULL -- No hay un origen específico
    FROM
        #SuscripcionesPorVencer spv;
    
    -- Limpiar tabla temporal
    DROP TABLE #SuscripcionesPorVencer;
END;
GO

-- Trigger para actualizar el estado de las suscripciones vencidas
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_ActualizarSuscripcionesVencidas')
BEGIN
    DROP TRIGGER trg_ActualizarSuscripcionesVencidas;
END
GO

CREATE TRIGGER trg_ActualizarSuscripcionesVencidas
ON Suscripciones
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Actualizar suscripciones que han vencido
    UPDATE s
    SET s.estado = 'vencida'
    FROM Suscripciones s
    JOIN inserted i ON s.id_suscripcion = i.id_suscripcion
    WHERE s.fecha_fin < GETDATE() AND s.estado = 'activa';
END;
GO

-- Trigger para generar notificaciones cuando se registran nuevas medidas corporales
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_NotificarNuevasMedidas')
BEGIN
    DROP TRIGGER trg_NotificarNuevasMedidas;
END
GO

CREATE TRIGGER trg_NotificarNuevasMedidas
ON Medidas_Corporales
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Encontrar el coach asignado a cada cliente que registró medidas
    WITH ClientesConCoach AS (
        SELECT 
            i.id_usuario AS id_cliente,
            acc.id_coach,
            c.id_usuario AS id_usuario_coach
        FROM 
            inserted i
        JOIN 
            Asignaciones_Coach_Cliente acc ON i.id_usuario = acc.id_usuario
        JOIN
            Coaches c ON acc.id_coach = c.id_coach
        WHERE 
            acc.estado = 'activa'
    )
    
    -- Generar notificaciones para cada coach
    INSERT INTO Notificaciones (
        id_usuario, -- ID del coach (usuario)
        tipo,
        titulo,
        mensaje,
        fecha_creacion,
        leida,
        id_origen -- ID del cliente
    )
    SELECT
        ccc.id_usuario_coach,
        'nuevas_medidas',
        'Nuevas medidas registradas',
        'Tu cliente ha registrado nuevas medidas corporales. Revisa su progreso.',
        GETDATE(),
        0,
        ccc.id_cliente
    FROM
        ClientesConCoach ccc;
END;
GO

-- Trigger para notificar cuando se asigna una nueva rutina
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_NotificarAsignacionRutina')
BEGIN
    DROP TRIGGER trg_NotificarAsignacionRutina;
END
GO

CREATE TRIGGER trg_NotificarAsignacionRutina
ON Asignaciones_Rutina
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Obtener información para las notificaciones
    WITH DatosRutina AS (
        SELECT 
            i.id_usuario,
            r.nombre AS nombre_rutina,
            c.id_usuario AS id_usuario_coach
        FROM 
            inserted i
        JOIN 
            Rutinas r ON i.id_rutina = r.id_rutina
        JOIN 
            Coaches c ON r.id_coach = c.id_coach
    )
    
    -- Generar notificaciones para los clientes
    INSERT INTO Notificaciones (
        id_usuario,
        tipo,
        titulo,
        mensaje,
        fecha_creacion,
        leida,
        id_origen
    )
    SELECT
        dr.id_usuario,
        'nueva_rutina',
        'Nueva rutina asignada',
        'Se te ha asignado una nueva rutina: ' + dr.nombre_rutina + '. Revisa tu plan de entrenamiento.',
        GETDATE(),
        0,
        dr.id_usuario_coach
    FROM
        DatosRutina dr;
END;
GO

-- Insertar datos iniciales (datos de muestra)

-- Insertar plan básico
IF NOT EXISTS (SELECT 1 FROM Planes WHERE nombre = 'Plan Básico')
BEGIN
    INSERT INTO Planes (nombre, descripcion, precio, duracion_dias)
    VALUES ('Plan Básico', 'Acceso a instalaciones básicas y clases grupales', 500, 30);
END

-- Insertar plan premium
IF NOT EXISTS (SELECT 1 FROM Planes WHERE nombre = 'Plan Premium')
BEGIN
    INSERT INTO Planes (nombre, descripcion, precio, duracion_dias)
    VALUES ('Plan Premium', 'Acceso completo a todas las instalaciones y servicios', 900, 30);
END

-- Insertar plan anual
IF NOT EXISTS (SELECT 1 FROM Planes WHERE nombre = 'Plan Anual')
BEGIN
    INSERT INTO Planes (nombre, descripcion, precio, duracion_dias)
    VALUES ('Plan Anual', 'Acceso completo por un año con descuento', 8000, 365);
END

-- Insertar administrador por defecto
IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE email = 'admin@gym.com')
BEGIN
    -- La contraseña 'admin123' debe estar hasheada en producción
    -- Esta es solo una contraseña de ejemplo para desarrollo
    INSERT INTO Usuarios (nombre, email, contraseña, tipo_usuario, estado)
    VALUES ('Administrador', 'admin@gym.com', 'admin123', 'administrador', 'activo');
END

UPDATE Usuarios
SET contraseña = 'mbopcqxzblxwmnjr'
WHERE contraseña = 'zywbUm-jovbuj-3cedxu';



-- Insertar algunos ejercicios básicos
IF NOT EXISTS (SELECT 1 FROM Ejercicios WHERE nombre = 'Sentadillas')
BEGIN
    INSERT INTO Ejercicios (nombre, descripcion, instrucciones, grupos_musculares, equipo_necesario)
    VALUES ('Sentadillas', 'Ejercicio básico para piernas', 'Mantén la espalda recta y baja como si fueras a sentarte', 'Cuádriceps, glúteos, pantorrillas', 'Ninguno o barra con pesas');
END

IF NOT EXISTS (SELECT 1 FROM Ejercicios WHERE nombre = 'Press de Banca')
BEGIN
    INSERT INTO Ejercicios (nombre, descripcion, instrucciones, grupos_musculares, equipo_necesario)
    VALUES ('Press de Banca', 'Ejercicio para pecho', 'Acuéstate en el banco y empuja la barra hacia arriba', 'Pectorales, tríceps, hombros', 'Banco, barra con pesas');
END



-- Actualizaciones a la tabla Usuarios para incluir campos de verificación

-- Validar si las columnas ya existen antes de añadirlas
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Usuarios') AND name = 'verification_token')
BEGIN
    ALTER TABLE Usuarios
    ADD verification_token VARCHAR(255) NULL;
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Usuarios') AND name = 'token_expires')
BEGIN
    ALTER TABLE Usuarios
    ADD token_expires DATETIME NULL;
END

-- Índice para búsqueda rápida por token
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_usuarios_verification_token')
BEGIN
    CREATE INDEX idx_usuarios_verification_token ON Usuarios(verification_token);
END

use GymSystem

SELECT * FROM Usuarios
SELECT * FROM Asignaciones_Coach_Cliente

SELECT * FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('Usuarios');


SELECT definition 
FROM sys.check_constraints 
WHERE name = 'CK__Asignacio__estad__6B24EA82';


ALTER TABLE Asignaciones_Coach_Cliente 
DROP CONSTRAINT CK__Asignacio__estad__6B24EA82;

ALTER TABLE Asignaciones_Coach_Cliente 
ADD CONSTRAINT CK_Asignaciones_Estado 
CHECK (estado IN ('activa', 'pendiente', 'rechazada'));



-- Verificar si hay registros en Asignaciones_Coach_Cliente
SELECT * FROM Asignaciones_Coach_Cliente;

-- Verificar si hay entrenadores configurados correctamente
SELECT c.id_coach, u.id_usuario, u.nombre, u.email, u.tipo_usuario 
FROM Coaches c
JOIN Usuarios u ON c.id_usuario = u.id_usuario;

-- Verificar si hay asignaciones activas para algún entrenador
SELECT a.*, uc.nombre AS nombre_coach, uc.email AS email_coach, 
       us.nombre AS nombre_cliente, us.email AS email_cliente
FROM Asignaciones_Coach_Cliente a
JOIN Coaches c ON a.id_coach = c.id_coach
JOIN Usuarios uc ON c.id_usuario = uc.id_usuario
JOIN Usuarios us ON a.id_usuario = us.id_usuario
WHERE a.estado = 'activa';


UPDATE Asignaciones_Coach_Cliente
SET estado = 'pendiente'
WHERE id_asignacion = 3;

use GymSystem
SELECT * FROM Usuarios


-- Ver la restricción actual
SELECT definition 
FROM sys.check_constraints 
WHERE name = 'CK__Usuarios__estado__4CA06362';

-- Modificar la restricción para incluir 'pendiente'
ALTER TABLE Usuarios 
DROP CONSTRAINT CK__Usuarios__estado__4CA06362;

ALTER TABLE Usuarios 
ADD CONSTRAINT CK_Usuarios_Estado 
CHECK (estado IN ('activo', 'inactivo', 'suspendido', 'pendiente'));

DELETE FROM Usuarios
WHERE email = 'jesusrlc15@gmail.com';

DELETE FROM Usuarios
WHERE email = 'ivanjorge0310@gmail.com';

select * from Usuarios
select * from ejercicios

use GymSystem

-- 1. Vista para que cada usuario vea solo su propia información
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_usuario_actual')
BEGIN
    DROP VIEW vw_usuario_actual;
END
GO

CREATE VIEW vw_usuario_actual
AS
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
    id_usuario = CONVERT(INT, CONTEXT_INFO())
GO

-- Verificar los permisos actuales del usuario de la aplicación
SELECT 
    DP1.name AS [Usuario], 
    DP2.name AS [Tabla], 
    O.permission_name AS [Permiso]
FROM sys.database_permissions O
INNER JOIN sys.database_principals DP1 
    ON O.grantee_principal_id = DP1.principal_id
INNER JOIN sys.objects DP2 
    ON O.major_id = DP2.object_id
WHERE DP1.name = 'gym_app_user' -- Nombre del usuario de la aplicación
ORDER BY [Usuario], [Tabla], [Permiso];
GO

GRANT SELECT ON vw_usuarios_completos TO [gym_app_user];


SELECT * FROM Asignaciones_Coach_Cliente

GRANT UPDATE ON dbo.Usuarios TO [gym_app_user];

select * from Usuarios


-- Procedimiento almacenado para actualizar perfil de usuario
IF NOT EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_ActualizarPerfilUsuario')
BEGIN
    EXEC('
    CREATE PROCEDURE sp_ActualizarPerfilUsuario
        @id_usuario INT,
        @nombre VARCHAR(100),
        @email VARCHAR(100),
        @telefono VARCHAR(20) = NULL,
        @direccion VARCHAR(200) = NULL,
        @fecha_nacimiento DATE = NULL
    AS
    BEGIN
        BEGIN TRY
            BEGIN TRANSACTION;
            
            -- Verificar que el usuario exista
            IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE id_usuario = @id_usuario)
            BEGIN
                RAISERROR(''El usuario no existe'', 16, 1);
                RETURN;
            END
            
            -- Verificar que el email no esté ya en uso por otro usuario
            IF EXISTS (SELECT 1 FROM Usuarios WHERE email = @email AND id_usuario != @id_usuario)
            BEGIN
                RAISERROR(''El email ya está en uso por otro usuario'', 16, 1);
                RETURN;
            END
            
            -- Actualizar el usuario
            UPDATE Usuarios
            SET 
                nombre = @nombre,
                email = @email,
                telefono = @telefono,
                direccion = @direccion,
                fecha_nacimiento = @fecha_nacimiento
            WHERE 
                id_usuario = @id_usuario;
            
            COMMIT TRANSACTION;
            
            -- Retornar los datos actualizados
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
            WHERE
                id_usuario = @id_usuario;
        END TRY
        BEGIN CATCH
            ROLLBACK TRANSACTION;
            THROW;
        END CATCH
    END;
    ');
END;

-- Otorgar permiso de ejecución al usuario de la aplicación
GRANT EXECUTE ON dbo.sp_ActualizarPerfilUsuario TO [gym_app_user];

select * from Usuarios

use GymSystem


-- Primero, aseguremos que la tabla de Suscripciones esté configurada correctamente
USE GymSystem;
GO

-- Verificar si la tabla tiene el campo tipo_plan
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Suscripciones') AND name = 'tipo_plan'
)
BEGIN
    ALTER TABLE Suscripciones
    ADD tipo_plan VARCHAR(20) CHECK(tipo_plan IN ('mensual', 'trimestral', 'anual'));
END;

-- Agregar campos adicionales si son necesarios
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Suscripciones') AND name = 'precio_pagado'
)
BEGIN
    ALTER TABLE Suscripciones
    ADD precio_pagado DECIMAL(10,2) DEFAULT 0.00;
END;

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('Suscripciones') AND name = 'metodo_pago'
)
BEGIN
    ALTER TABLE Suscripciones
    ADD metodo_pago VARCHAR(50);
END;

-- Asegurar que los índices existan para mejorar el rendimiento
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'idx_suscripciones_id_usuario' AND object_id = OBJECT_ID('Suscripciones')
)
BEGIN
    CREATE INDEX idx_suscripciones_id_usuario ON Suscripciones(id_usuario);
END;

IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'idx_suscripciones_estado_fecha' AND object_id = OBJECT_ID('Suscripciones')
)
BEGIN
    CREATE INDEX idx_suscripciones_estado_fecha ON Suscripciones(estado, fecha_fin);
END;

-- Crear vista para facilitar consultas combinadas de usuarios y membresías
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_usuarios_membresias')
BEGIN
    DROP VIEW vw_usuarios_membresias;
END
GO

CREATE VIEW vw_usuarios_membresias AS
SELECT 
    u.id_usuario,
    u.nombre,
    u.email,
    u.telefono,
    u.tipo_usuario,
    u.estado AS estado_usuario,
    s.id_suscripcion,
    s.tipo_plan,
    s.fecha_inicio,
    s.fecha_fin,
    s.estado AS estado_membresia,
    p.nombre AS nombre_plan,
    p.precio,
    s.precio_pagado,
    s.metodo_pago
FROM 
    Usuarios u
LEFT JOIN 
    Suscripciones s ON u.id_usuario = s.id_usuario AND s.estado = 'activa'
LEFT JOIN 
    Planes p ON s.id_plan = p.id_plan
GO

-- Crear procedimiento almacenado para gestionar membresías
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_GestionarMembresia')
BEGIN
    DROP PROCEDURE sp_GestionarMembresia;
END
GO

CREATE PROCEDURE sp_GestionarMembresia
    @accion VARCHAR(20), -- 'crear', 'actualizar', 'cancelar', 'renovar'
    @id_usuario INT,
    @id_plan INT = NULL,
    @tipo_plan VARCHAR(20) = NULL,
    @fecha_inicio DATE = NULL,
    @duracion_dias INT = NULL,
    @precio_pagado DECIMAL(10,2) = NULL,
    @metodo_pago VARCHAR(50) = NULL,
    @id_admin INT = NULL,
    @id_suscripcion INT = NULL -- Solo para actualizar o cancelar
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        
        DECLARE @estado VARCHAR(20) = 'activa';
        DECLARE @fecha_fin DATE;
        
        -- Validaciones básicas
        IF @accion NOT IN ('crear', 'actualizar', 'cancelar', 'renovar')
        BEGIN
            RAISERROR('Acción no válida. Use: crear, actualizar, cancelar o renovar', 16, 1);
            RETURN;
        END
        
        -- Verificar que el usuario exista
        IF NOT EXISTS (SELECT 1 FROM Usuarios WHERE id_usuario = @id_usuario)
        BEGIN
            RAISERROR('El usuario no existe', 16, 1);
            RETURN;
        END
        
        -- Si es crear o renovar, calcular fecha_fin
        IF @accion IN ('crear', 'renovar')
        BEGIN
            IF @fecha_inicio IS NULL
                SET @fecha_inicio = GETDATE();
                
            IF @id_plan IS NULL OR @tipo_plan IS NULL OR @duracion_dias IS NULL
            BEGIN
                RAISERROR('Para crear o renovar se requiere: id_plan, tipo_plan y duracion_dias', 16, 1);
                RETURN;
            END
            
            -- Verificar que el plan exista
            IF NOT EXISTS (SELECT 1 FROM Planes WHERE id_plan = @id_plan)
            BEGIN
                RAISERROR('El plan no existe', 16, 1);
                RETURN;
            END
            
            -- Calcular fecha de fin
            SET @fecha_fin = DATEADD(DAY, @duracion_dias, @fecha_inicio);
            
            -- Si es renovación, desactivar membresía anterior
            IF @accion = 'renovar' AND @id_suscripcion IS NOT NULL
            BEGIN
                UPDATE Suscripciones
                SET estado = 'vencida',
                    id_admin_ultima_actualizacion = @id_admin,
                    fecha_ultima_actualizacion = GETDATE(),
                    notas_administrativas = CONCAT(ISNULL(notas_administrativas, ''), CHAR(13), CHAR(10), 'Renovada el ', CONVERT(VARCHAR, GETDATE(), 103))
                WHERE id_suscripcion = @id_suscripcion;
            END
            
            -- Crear nueva membresía
            INSERT INTO Suscripciones (
                id_usuario, 
                id_plan, 
                tipo_plan,
                fecha_inicio, 
                fecha_fin, 
                estado,
                precio_pagado,
                metodo_pago,
                id_admin_ultima_actualizacion,
                fecha_ultima_actualizacion
            )
            VALUES (
                @id_usuario,
                @id_plan,
                @tipo_plan,
                @fecha_inicio,
                @fecha_fin,
                @estado,
                @precio_pagado,
                @metodo_pago,
                @id_admin,
                GETDATE()
            );
            
            SELECT SCOPE_IDENTITY() AS id_suscripcion;
        END
        -- Si es actualizar
        ELSE IF @accion = 'actualizar'
        BEGIN
            IF @id_suscripcion IS NULL
            BEGIN
                RAISERROR('Para actualizar se requiere el id_suscripcion', 16, 1);
                RETURN;
            END
            
            -- Verificar que la suscripción exista
            IF NOT EXISTS (SELECT 1 FROM Suscripciones WHERE id_suscripcion = @id_suscripcion)
            BEGIN
                RAISERROR('La suscripción no existe', 16, 1);
                RETURN;
            END
            
            -- Actualizar suscripción
            UPDATE Suscripciones
            SET 
                id_plan = ISNULL(@id_plan, id_plan),
                tipo_plan = ISNULL(@tipo_plan, tipo_plan),
                fecha_inicio = ISNULL(@fecha_inicio, fecha_inicio),
                fecha_fin = CASE WHEN @duracion_dias IS NOT NULL AND @fecha_inicio IS NOT NULL 
                                THEN DATEADD(DAY, @duracion_dias, @fecha_inicio)
                                WHEN @duracion_dias IS NOT NULL 
                                THEN DATEADD(DAY, @duracion_dias, fecha_inicio)
                                ELSE fecha_fin END,
                precio_pagado = ISNULL(@precio_pagado, precio_pagado),
                metodo_pago = ISNULL(@metodo_pago, metodo_pago),
                id_admin_ultima_actualizacion = @id_admin,
                fecha_ultima_actualizacion = GETDATE()
            WHERE id_suscripcion = @id_suscripcion;
            
            SELECT @id_suscripcion AS id_suscripcion;
        END
        -- Si es cancelar
        ELSE IF @accion = 'cancelar'
        BEGIN
            IF @id_suscripcion IS NULL
            BEGIN
                RAISERROR('Para cancelar se requiere el id_suscripcion', 16, 1);
                RETURN;
            END
            
            -- Verificar que la suscripción exista
            IF NOT EXISTS (SELECT 1 FROM Suscripciones WHERE id_suscripcion = @id_suscripcion)
            BEGIN
                RAISERROR('La suscripción no existe', 16, 1);
                RETURN;
            END
            
            -- Cancelar suscripción
            UPDATE Suscripciones
            SET 
                estado = 'cancelada',
                id_admin_ultima_actualizacion = @id_admin,
                fecha_ultima_actualizacion = GETDATE(),
                notas_administrativas = CONCAT(ISNULL(notas_administrativas, ''), CHAR(13), CHAR(10), 'Cancelada el ', CONVERT(VARCHAR, GETDATE(), 103))
            WHERE id_suscripcion = @id_suscripcion;
            
            SELECT @id_suscripcion AS id_suscripcion;
        END
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- Otorgar permisos al usuario de la aplicación
GRANT SELECT ON vw_usuarios_membresias TO [gym_app_user];
GRANT EXECUTE ON sp_GestionarMembresia TO [gym_app_user];

-- Verify the Planes table has an 'estado' field for active/inactive plans
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Planes' AND COLUMN_NAME = 'estado'
)
BEGIN
    ALTER TABLE Planes ADD estado TINYINT DEFAULT 1;
END

-- Agregar tipo_plan si no existe
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Suscripciones' AND COLUMN_NAME = 'tipo_plan'
)
BEGIN
    ALTER TABLE Suscripciones
    ADD tipo_plan VARCHAR(20)
    CONSTRAINT CHK_tipo_plan CHECK (tipo_plan IN ('mensual', 'trimestral', 'anual'));
END

-- Agregar precio_pagado si no existe
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Suscripciones' AND COLUMN_NAME = 'precio_pagado'
)
BEGIN
    ALTER TABLE Suscripciones
    ADD precio_pagado DECIMAL(10,2) NULL;
END

-- Agregar metodo_pago si no existe
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Suscripciones' AND COLUMN_NAME = 'metodo_pago'
)
BEGIN
    ALTER TABLE Suscripciones
    ADD metodo_pago VARCHAR(50) NULL;
END



----

-- Script para corregir el esquema de la base de datos en SQL Server

USE GymSystem;
GO

-- Verificar si las columnas mencionadas en el error existen, si no, crearlas
-- Para la tabla Suscripciones
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Suscripciones') AND name = 'tipo_plan')
BEGIN
    ALTER TABLE Suscripciones
    ADD tipo_plan VARCHAR(20);
    
    PRINT 'Columna tipo_plan agregada a la tabla Suscripciones';
END

-- Verificar si existe la columna fecha_fin (que estaría reemplazando a fecha_vencimiento)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Suscripciones') AND name = 'fecha_fin')
BEGIN
    ALTER TABLE Suscripciones
    ADD fecha_fin DATE;
    
    PRINT 'Columna fecha_fin agregada a la tabla Suscripciones';
END

-- Verificar si existe precio_pagado
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Suscripciones') AND name = 'precio_pagado')
BEGIN
    ALTER TABLE Suscripciones
    ADD precio_pagado DECIMAL(10, 2);
    
    PRINT 'Columna precio_pagado agregada a la tabla Suscripciones';
END

-- Verificar si existe metodo_pago
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Suscripciones') AND name = 'metodo_pago')
BEGIN
    ALTER TABLE Suscripciones
    ADD metodo_pago VARCHAR(50);
    
    PRINT 'Columna metodo_pago agregada a la tabla Suscripciones';
END

-- Verificar si existe estado para Planes
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Planes') AND name = 'estado')
BEGIN
    ALTER TABLE Planes
    ADD estado TINYINT DEFAULT 1;
    
    PRINT 'Columna estado agregada a la tabla Planes';
END

-- Verificar que existen planes en la tabla
IF NOT EXISTS (SELECT TOP 1 1 FROM Planes)
BEGIN
    -- Insertar planes básicos
    INSERT INTO Planes (nombre, descripcion, precio, duracion_dias, estado)
    VALUES 
        ('Plan Básico', 'Acceso a instalaciones básicas y clases grupales', 500, 30, 1),
        ('Plan Premium', 'Acceso completo a todas las instalaciones y servicios', 900, 30, 1),
        ('Plan Anual', 'Acceso completo por un año con descuento', 8000, 365, 1);
    
    PRINT 'Planes básicos insertados';
END

-- Ahora vamos a verificar si hay datos en la columna tipo_plan
-- Si no hay datos, actualicemos todas las suscripciones existentes con un valor predeterminado
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Suscripciones') AND name = 'tipo_plan')
BEGIN
    -- Contar cuántos registros no tienen valor en tipo_plan
    DECLARE @CountNullTipoPlan INT;
    
    SELECT @CountNullTipoPlan = COUNT(*) 
    FROM Suscripciones 
    WHERE tipo_plan IS NULL;
    
    IF @CountNullTipoPlan > 0
    BEGIN
        -- Actualizar registros donde tipo_plan es nulo
        UPDATE Suscripciones
        SET tipo_plan = 'mensual'
        WHERE tipo_plan IS NULL;
        
        PRINT 'Actualizado ' + CAST(@CountNullTipoPlan AS VARCHAR) + ' registros donde tipo_plan era NULL';
    END
END

-- Verificar si hay datos sin fecha_fin
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Suscripciones') AND name = 'fecha_inicio')
AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Suscripciones') AND name = 'fecha_fin')
BEGIN
    -- Contar cuántos registros no tienen valor en fecha_fin
    DECLARE @CountNullFechaFin INT;
    
    SELECT @CountNullFechaFin = COUNT(*) 
    FROM Suscripciones 
    WHERE fecha_fin IS NULL AND fecha_inicio IS NOT NULL;
    
    IF @CountNullFechaFin > 0
    BEGIN
        -- Actualizar registros donde fecha_fin es nulo pero fecha_inicio no lo es
        -- Asumiendo suscripciones mensuales (30 días)
        UPDATE Suscripciones
        SET fecha_fin = DATEADD(DAY, 30, fecha_inicio)
        WHERE fecha_fin IS NULL AND fecha_inicio IS NOT NULL;
        
        PRINT 'Actualizado ' + CAST(@CountNullFechaFin AS VARCHAR) + ' registros donde fecha_fin era NULL';
    END
END

-- Imprimir mensaje de confirmación
PRINT 'Corrección de esquema completada.';