# Instrucciones para Configurar Supabase como Base de Datos Persistente

## ¿Por qué Supabase?
- **Gratuito**: 500MB de almacenamiento
- **Persistente**: Los datos NO se reinician al hacer deploy
- **Compatible**: Funciona con tu código actual (PostgreSQL)
- **Dashboard**: Interfaz web para gestionar la base de datos

---

## Paso 1: Crear cuenta en Supabase
1. Ve a https://supabase.com
2. Crea una cuenta nueva (puedes usar tu cuenta de GitHub)
3. Verifica tu email

---

## Paso 2: Crear un nuevo proyecto
1. En el dashboard de Supabase, haz clic en **"New Project"**
2. Completa los campos:
   - **Name**: `proyecto-cmxg` (o el nombre que prefieras)
   - **Database Password**: Crea una contraseña segura (guárdala, la necesitarás)
   - **Region**: Elige la región más cercana a tus usuarios (ej: `Southeast Asia` si estás en México)
3. Haz clic en **"Create new project"**
4. Espera 2-3 minutos mientras se crea el proyecto

---

## Paso 3: Obtener la URL de conexión
1. En tu proyecto de Supabase, ve a **Settings** → **Database**
2. Busca la sección **Connection string**
3. Haz clic en **"URI"** y copia la cadena de conexión
4. La cadena tendrá este formato:
   ```
   postgresql://postgres:[TU-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

---

## Paso 4: Configurar variables de entorno en Render
1. Ve a tu dashboard de Render: https://dashboard.render.com
2. Selecciona tu servicio de backend
3. Ve a **Environment** (o Environment Variables)
4. Agrega una nueva variable:
   - **Key**: `DATABASE_URL`
   - **Value**: La cadena de conexión de Supabase que copiaste en el Paso 3
5. Haz clic en **Save Changes**

---

## Paso 5: Configurar variables de entorno en tu local (opcional)
Si quieres probar en local con Supabase:

1. Crea un archivo `.env` en la carpeta `backend`:
   ```bash
   DATABASE_URL=postgresql://postgres:[TU-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

2. Instala `python-dotenv` si no lo tienes:
   ```bash
   pip install python-dotenv
   ```

3. Modifica `models.py` para cargar variables desde `.env`:
   ```python
   from dotenv import load_dotenv
   load_dotenv()
   ```
   (Agrega esto al inicio del archivo, después de los imports)

---

## Paso 6: Deploy y verificación
1. Haz commit de los cambios en tu código:
   ```bash
   git add backend/models.py
   git commit -m "Configurar PostgreSQL con Supabase"
   git push
   ```

2. Render hará deploy automáticamente con la nueva variable de entorno

3. Verifica que la conexión funciona:
   - En el dashboard de Supabase, ve a **Table Editor**
   - Deberías ver las tablas `stations`, `employees`, `assignments` creadas automáticamente
   - Si subes datos desde tu app, aparecerán aquí

---

## Paso 7: Probar persistencia
1. Sube un archivo Excel con datos de estaciones
2. Verifica que los datos aparecen en Supabase (Table Editor)
3. Haz un nuevo deploy en Render (o espera el deploy automático)
4. Los datos DEBEN mantenerse (no se reinician)

---

## Solución de problemas

### Error: "connection refused"
- Verifica que la cadena de conexión sea correcta
- Asegúrate de que la contraseña sea la correcta
- Revisa que el proyecto de Supabase esté activo (no pausado)

### Error: "SSL required"
- La cadena de conexión debe incluir `?sslmode=require` al final
- Ejemplo: `postgresql://...?sslmode=require`

### Las tablas no se crean automáticamente
- SQLAlchemy las crea automáticamente al iniciar la app
- Si no aparecen, reinicia el servicio en Render

### Los datos no persisten
- Verifica que la variable `DATABASE_URL` esté configurada correctamente en Render
- Asegúrate de que NO estés usando SQLite localmente

---

## Beneficios de este cambio
✅ Los datos persisten entre deploys  
✅ Puedes ver los datos en el dashboard de Supabase  
✅ Puedes hacer backups desde Supabase  
✅ Escalable si necesitas más espacio  
✅ Gratis hasta 500MB (suficiente para tu aplicación)

---

## Notas importantes
- **NO subas el archivo `.env` a GitHub** (ya está en tu `.gitignore`)
- **Guarda tu contraseña de Supabase** en un lugar seguro
- **La base de datos de Supabase es accesible desde cualquier lugar** (no solo desde Render)
- **Puedes usar el mismo proyecto de Supabase** para múltiples aplicaciones si lo deseas
