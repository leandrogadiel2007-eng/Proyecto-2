# Configurar el multijugador de Blue Rush con Supabase

Blue Rush usa **Supabase Realtime Broadcast y Presence** para mostrar a otros jugadores en la misma sala. Esta versión no necesita crear tablas SQL.

## 1. Obtener la clave pública

1. Abre el panel de tu proyecto de Supabase: https://supabase.com/dashboard/project/kakmmynajggihmmsfsfo
2. Entra en **Project Settings → API Keys** (en algunas versiones aparece como **Settings → API**).
3. Copia la **Publishable key** (suele empezar por `sb_publishable_`). Si tu panel solo muestra las claves antiguas, puedes usar la clave pública **anon**.
4. No copies una `secret` key ni `service_role`: nunca deben estar en el navegador ni en GitHub.

## 2. Poner la clave en el juego

1. Abre `supabase-config.js` en el repositorio.
2. Reemplaza el valor vacío de `publishableKey` por tu clave pública, conservando las comillas:

```js
window.BLUE_RUSH_SUPABASE = {
  url: "https://kakmmynajggihmmsfsfo.supabase.co",
  publishableKey: "PEGA_AQUI_TU_PUBLISHABLE_KEY"
};
```

3. Guarda el archivo y espera a que Vercel termine el despliegue.

> La clave publishable/anon está diseñada para usarse en el cliente. Aun así, no pongas una clave secret ni service_role en este archivo.

## 3. Entrar a la misma sala

1. Abre https://proyecto-2-ma5w.vercel.app en dos dispositivos o dos navegadores.
2. En cada uno, escribe un nombre.
3. En ambos, escribe exactamente el mismo código de sala, por ejemplo `GREEN-ISLAND`.
4. Pulsa **JUGAR ONLINE** en ambos.

Los jugadores de una misma sala deberían verse en el nivel. Para jugar en salas distintas, usa códigos distintos. No hace falta ejecutar SQL para el sistema de salas actual, porque usa canales públicos de Supabase Realtime en vez de tablas de base de datos.

## Si no conecta

- Confirma que URL y clave pertenecen al mismo proyecto.
- En Supabase, revisa que Realtime esté disponible para el proyecto y que no hayas deshabilitado los canales públicos.
- Recarga el juego después del despliegue. En el navegador, prueba una recarga forzada si sigue usando archivos antiguos.
- Mira la consola del navegador para el mensaje detallado del error.
