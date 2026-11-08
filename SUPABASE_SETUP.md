# Configurar Supabase para Blue Rush

Blue Rush usa **Supabase Realtime** para las salas online y ahora también usa **tres tablas SQL** para guardar perfiles, estadísticas y el historial de partidas.

## 1. Crear las tablas SQL (obligatorio para la persistencia)

1. Abre el [SQL Editor de tu proyecto Supabase](https://supabase.com/dashboard/project/kakmmynajggihmmsfsfo/sql/new).
2. Abre el archivo [supabase/schema.sql](https://github.com/leandrogadiel2007-eng/Proyecto-2/blob/main/supabase/schema.sql) del repositorio.
3. Copia todo su contenido, pégalo en el SQL Editor y pulsa **Run**.
4. El script crea las tablas, índices, políticas RLS y los tres perfiles ficticios iniciales. Se puede ejecutar más de una vez.

### Tablas creadas

| Tabla | Qué guarda |
|---|---|
| `br_profiles` | Los tres perfiles de demostración y el personaje seleccionado. |
| `br_player_stats` | Récord, puntos acumulados, partidas, victorias y mejor tiempo por cuenta. |
| `br_match_history` | Cada partida finalizada, su puntuación, duración, resultado, personaje y sala. |

El juego carga el perfil y las estadísticas al iniciar sesión, guarda el personaje seleccionado y registra el resultado al terminar cada partida. El ranking se obtiene de `br_player_stats`, por lo que se comparte entre navegadores que usen el mismo proyecto Supabase.

## 2. Configuración de la clave pública

El archivo `supabase-config.js` contiene la URL del proyecto y la clave pública `publishableKey`. Usa únicamente una **Publishable key** (o la antigua clave pública `anon`). Nunca pongas una `secret` key ni `service_role` en el navegador ni en GitHub.

## 3. Entrar a la misma sala online

1. Abre Blue Rush en dos dispositivos o navegadores.
2. Inicia sesión con una de las cuentas de demostración.
3. Escribe exactamente el mismo código de sala en ambos, por ejemplo `GREEN-ISLAND`.
4. Pulsa **JUGAR ONLINE** en ambos.

El canal de Supabase Realtime comparte posiciones, animaciones, golpes, destrucción de enemigos y llegada a la meta. Presence mantiene el estado temporal de los jugadores conectados.

## 4. Cuentas de demostración y seguridad

Las cuentas actuales (`sonic`, `tails`, `amy`) son **identificadores ficticios validados por el código del navegador**, no usuarios de Supabase Auth. Por eso las políticas SQL permiten leer y escribir exclusivamente los tres identificadores de demostración, pero cualquier persona con acceso al juego puede suplantarlos o alterar sus puntuaciones.

Estas tablas son apropiadas para una práctica o demostración con datos ficticios. **No guardes contraseñas ni datos privados en ellas.** Para publicar el juego con cuentas reales habría que migrar el inicio de sesión a Supabase Auth y restringir cada fila usando `auth.uid()`.

## 5. Si no aparecen las puntuaciones

- Comprueba que ejecutaste `supabase/schema.sql` sin errores.
- Comprueba que `supabase-config.js` contiene la URL correcta y una clave pública válida.
- Recarga el juego. Los récords antiguos que existían solo en LocalStorage se copian a las tablas cuando esa cuenta vuelve a iniciar sesión.
- Si las tablas no existen, el juego continúa en modo local y muestra un aviso en la pantalla de acceso.
