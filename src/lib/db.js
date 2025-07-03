import pg from 'pg';

const { Pool } = pg;

// Es importante que estas variables de entorno estén definidas en tu archivo .env
// Astro las carga automáticamente. Asegúrate de que NO incluyes PUBLIC_ al principio
// ya que estas son variables del lado del servidor.

const pool = new Pool({
  host: import.meta.env.POSTGRES_HOST,
  port: import.meta.env.POSTGRES_PORT ? parseInt(import.meta.env.POSTGRES_PORT, 10) : 5432,
  user: import.meta.env.POSTGRES_USER,
  password: import.meta.env.POSTGRES_PASSWORD,
  database: import.meta.env.POSTGRES_DATABASE,
  ssl: import.meta.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false, // Opcional, para conexiones SSL
});

pool.on('connect', () => {
  console.log('Conectado a PostgreSQL!');
});

pool.on('error', (err) => {
  console.error('Error inesperado en el cliente de la base de datos PostgreSQL', err);
  process.exit(-1);
});

export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('Error ejecutando la consulta PostgreSQL', { text, params, error: err.stack });
    throw err;
  }
}

export async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query;
  const originalRelease = client.release;

  // Settear un timeout para las queries
  const timeoutId = setTimeout(() => {
    console.error('Un cliente de base de datos ha estado activo por mucho tiempo');
    console.error('Query:', (client).lastQuery); // Necesitaríamos añadir lastQuery al cliente
  }, 5000);

  client.query = (...args) => {
    (client).lastQuery = args;
    return originalQuery.apply(client, args);
  };

  client.release = () => {
    clearTimeout(timeoutId);
    client.query = originalQuery; // Restaurar original
    client.release = originalRelease; // Restaurar original
    return originalRelease.apply(client);
  };
  return client;
}

// Ejemplo de cómo crear la tabla de posts (esto debería ejecutarse una sola vez, quizás en un script de migración)
export async function createPostsTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      content TEXT,
      pubDate TIMESTAMP NOT NULL,
      description TEXT,
      author VARCHAR(255),
      image_url VARCHAR(255),
      image_alt VARCHAR(255),
      tags TEXT[],
      status VARCHAR(50) DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  // Trigger para actualizar updated_at
  const createFunctionQuery = `
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
       NEW.updated_at = NOW();
       RETURN NEW;
    END;
    $$ language 'plpgsql';
  `;
  const createTriggerQuery = `
    DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
    CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  `;

  try {
    await query(createTableQuery);
    console.log('Tabla "posts" creada o ya existente.');
    await query(createFunctionQuery);
    console.log('Función "update_updated_at_column" creada o ya existente.');
    await query(createTriggerQuery);
    console.log('Trigger "update_posts_updated_at" creado en tabla "posts".');
  } catch (err) {
    console.error('Error al crear la tabla posts o el trigger:', err);
    throw err;
  }
}

// (Opcional) Podrías llamar a createPostsTable() aquí una vez si estás seguro
// de que solo se ejecutará en un contexto de servidor al inicio,
// pero es mejor manejar las migraciones de esquema de forma más explícita.
// Ejemplo: createPostsTable().catch(err => console.error("Error inicializando DB:", err));

export default pool; // Exportar el pool por si se necesita acceso directo

// Para probar la conexión, puedes añadir una pequeña función de prueba
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Conexión de prueba a PostgreSQL exitosa!');
    const time = await client.query('SELECT NOW()');
    console.log('Hora actual de la DB:', time.rows[0].now);
    client.release();
  } catch (error) {
    console.error('Error al conectar con PostgreSQL para prueba:', error);
  }
}

// Descomenta la siguiente línea si quieres probar la conexión cuando este módulo se carga.
// Ten cuidado si este módulo se importa en muchos sitios, podría generar múltiples intentos de conexión.
// testConnection();
