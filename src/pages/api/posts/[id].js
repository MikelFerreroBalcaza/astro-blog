// src/pages/api/posts/[id].js
// Maneja GET para un post específico, PUT para actualizar y DELETE para eliminar.
import { query } from '../../../lib/db';

export async function GET({ params, request }) {
  const { id } = params;
  try {
    const { rows, rowCount } = await query('SELECT id, title, slug, content, pubDate, description, author, image_url, image_alt, tags, status, created_at, updated_at FROM posts WHERE id = $1', [id]);
    if (rowCount === 0) {
      return new Response(JSON.stringify({ error: 'Post no encontrado.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ post: rows[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`Error al obtener post con id ${id}:`, error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor al obtener el post.', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function PUT({ params, request }) {
  const { id } = params;
  try {
    const body = await request.json();
    // Extraer solo los campos que se pueden actualizar para evitar actualizar id, created_at, etc.
    const { title, slug, content, pubDate, description, author, image_url, image_alt, tags, status } = body;

    // Validación básica
    if (!title || !slug || !content || !pubDate) {
      return new Response(JSON.stringify({ error: 'Faltan campos requeridos: title, slug, content, pubDate son obligatorios.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Construir la query dinámicamente basado en los campos presentes (opcional, pero más flexible)
    // Por simplicidad, aquí actualizamos todos los campos permitidos.
    // El campo `updated_at` se actualizará automáticamente por el trigger en la DB.
    const updateQuery = `
      UPDATE posts
      SET title = $1, slug = $2, content = $3, pubDate = $4, description = $5, author = $6, image_url = $7, image_alt = $8, tags = $9, status = $10
      WHERE id = $11
      RETURNING id, title, slug, content, pubDate, description, author, image_url, image_alt, tags, status, created_at, updated_at;
    `;
    const values = [title, slug, content, new Date(pubDate), description, author, image_url, image_alt, tags, status, id];

    const { rows, rowCount } = await query(updateQuery, values);

    if (rowCount === 0) {
      return new Response(JSON.stringify({ error: 'Post no encontrado para actualizar.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'Post actualizado exitosamente', post: rows[0] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`Error al actualizar post con id ${id}:`, error);
    if (error.code === '23505' && error.constraint === 'posts_slug_key') {
       return new Response(JSON.stringify({ error: `El slug '${error.detail.match(/\(([^)]+)\)/)[1]}' ya existe para otro post.`, field: 'slug' }), {
        status: 409, // Conflict
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: 'Error interno del servidor al actualizar el post.', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function DELETE({ params, request }) {
  const { id } = params;
  try {
    const deleteQuery = 'DELETE FROM posts WHERE id = $1 RETURNING id;';
    const { rowCount } = await query(deleteQuery, [id]);

    if (rowCount === 0) {
      return new Response(JSON.stringify({ error: 'Post no encontrado para eliminar.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: `Post con id ${id} eliminado exitosamente.` }), {
      status: 200, // O 204 No Content si no devuelves cuerpo
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(`Error al eliminar post con id ${id}:`, error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor al eliminar el post.', details: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Astro maneja automáticamente los métodos GET, POST, PUT, DELETE, etc. a las funciones exportadas con esos nombres.
// Si un método no tiene una función exportada correspondiente, Astro devolverá un 405 Method Not Allowed.
// No es necesario un handler ALL aquí a menos que haya una lógica muy específica para métodos no cubiertos.
