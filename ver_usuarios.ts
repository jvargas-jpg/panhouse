import { pool } from './server/db/client.js';

async function main() {
  try {
    // Transformamos a editor2 en líder creativo
    await pool.query("UPDATE usuarios SET rol = 'lider_creativo' WHERE email = 'editor2.demo@panhouse.test'");
    
    console.log("✅ ¡Magia hecha! El usuario ha sido actualizado.");
    console.log("✉️  Correo a usar: editor2.demo@panhouse.test");
    console.log("🔑 Contraseña: (La misma que usas para el resto de los usuarios demo)");
  } catch (error) {
    console.error("Error actualizando:", error);
  } finally {
    process.exit(0);
  }
}

main();