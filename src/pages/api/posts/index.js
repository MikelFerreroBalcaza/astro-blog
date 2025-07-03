// src/pages/api/posts/index.js
// Maneja GET para listar todos los posts y POST para crear un nuevo post.
import { query, createPostsTable } from '../../../lib/db';

export async function GET({ request }) {
  try {
    // Opcional: Asegurarse de que la tabla existe. En un entorno de producción,
    // esto se manejaría con migraciones separadas, no en cada request.
    // await createPostsTable(); // Considerar mover esto a un script de inicialización.

    const { rows } = await query('SELECT id, title, slug, pubDate, description, author, image_url, image_alt, tags, status, created_at, updated_at FROM posts ORDER BY pubDate DESC');
    return new Response(JSON.stringify({ posts: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error al obtener posts:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor al obtener posts.', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { title, slug, content, pubDate, description, author, image_url, image_alt, tags, status = 'draft' } = body;

    // Validación básica (se puede expandir significativamente)
    if (!title || !slug || !content || !pubDate) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos: title, slug, content, pubDate son obligatorios.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // TODO: Generar slug automáticamente si no se provee o sanitizar el que llega.
    // TODO: Validar formato de pubDate.

    const insertQuery = `
      INSERT INTO posts (title, slug, content, pubDate, description, author, image_url, image_alt, tags, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, title, slug, pubDate, description, author, image_url, image_alt, tags, status, created_at, updated_at;
    `;
    const values = [title, slug, content, new Date(pubDate), description, author, image_url, image_alt, tags, status];

    const { rows } = await query(insertQuery, values);

    if (rows.length > 0) {
      return new Response(JSON.stringify({ message: 'Post creado exitosamente', post: rows[0] }), {
        status: 201, // 201 Created
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      throw new Error('La inserción del post no devolvió ninguna fila.');
    }
  } catch (error) {
    console.error('Error al crear post:', error);
    // Comprobar si el error es por violación de unicidad del slug
    if (error.code === '23505' && error.constraint === 'posts_slug_key') {
      return new Response(JSON.stringify({ error: `El slug '${error.detail.match(/\(([^)]+)\)/)[1]}' ya existe.`, field: 'slug' }), {
        status: 409, // Conflict
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Error interno del servidor al crear el post.', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Endpoint para inicializar la tabla de posts (solo para desarrollo/setup inicial)
// GET /api/posts?init_db=true
export async function ALL({ request }) { // Usamos ALL para capturar GET con query param específico
    const url = new URL(request.url);
    if (request.method === 'GET' && url.searchParams.get('init_db') === 'true') {
        try {
            await createPostsTable();
            return new Response(JSON.stringify({ message: 'Tabla "posts" inicializada (creada si no existía y trigger configurado).' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('Error al inicializar la tabla de posts:', error);
            return new Response(JSON.stringify({ error: 'Error al inicializar la tabla de posts.', details: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }
    // Si no es el GET especial para init_db, devolvemos un 405 Method Not Allowed para otros métodos no implementados en esta ruta base.
    // O podrías tener una lógica más específica si esperas otros métodos aquí.
    if (request.method !== 'GET' && request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Método no permitido en esta ruta. Use GET para listar o POST para crear.' }), {
            status: 405, // Method Not Allowed
            headers: { 'Allow': 'GET, POST', 'Content-Type': 'application/json' },
        });
    }
    // Si es GET pero sin init_db, se maneja por la función GET exportada arriba.
    // Si es POST, se maneja por la función POST exportada arriba.
    // Esta función ALL solo se activa si no hay un handler GET o POST específico, o para otros métodos.
    // Dado que tenemos GET y POST, este ALL solo se llamaría para PUT, DELETE, etc. en /api/posts
    // O si el GET tiene el parámetro init_db.
}
