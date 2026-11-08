# Fuentes de sprites para Blue Rush

| Personaje | Hoja de sprites | Fuente |
|---|---|---|
| Sonic | SauceK · Sonic Escape | https://www.patreon.com/SauceK/posts/free-original-4-92998423 |
| Tails | SauceK · Sonic Escape | https://www.patreon.com/SauceK/posts/free-original-4-92998423 |
| Knuckles | SauceK · Sonic Escape (CC0) | https://github.com/Saucekye/SonicEscapeV |
| Amy Rose | Sonic Advance 3 · Ren Ramos | https://www.spriters-resource.com/game_boy_advance/sonicadv3/asset/7148/ |
| Shadow | Sonic Battle · QuadFactor | https://www.spriters-resource.com/game_boy_advance/sonicbattle/asset/10045/ |

SauceK publicó las hojas de Sonic y Tails como recursos gratuitos para su fan game Sonic Escape y permite reutilizarlas sin exigir crédito en la publicación original. Esa autorización cubre sus hojas, no los derechos sobre los personajes de Sonic ni una garantía de uso comercial.

## Mapa correcto de Tails

La hoja `assets/Tails/tailssheet.png` es el atlas de SauceK de **9 × 9 celdas**. El mapeo se contrastó con las animaciones del proyecto original [SauceK/SonicEscapeV](https://github.com/Saucekye/SonicEscapeV), en `Scenes/Characters/Tails/Tails.tscn`, que declara también `hframes=9` y `vframes=9`.

| Acción | Fotogramas |
|---|---|
| Reposo (`stance`) | 0, 1, 2, 3, 4, 0 |
| Carrera (`run`) | 11, 12, 13, 14, 15, 16 |
| Carrera rápida (`Dash`) | 21, 22, 23, 24, 26, 27, 28 |
| Máxima velocidad (`Dash max`) | 47, 48, 49 |
| Salto (`jump`) | 29, 30, 31, 32 |
| Caída (`falling`) | 80 (el fotograma 81 queda fuera de la cuadrícula 9 × 9) |
| Vuelo (`fly`) | 76, 77, 78 |
| Giro en bola (`ball`) | 7, 8, 9, 10 |
| Ataque de colas (`swipe`) | 70, 71, 72, 73, 19 |
| Carga Spin Dash | 35, 56, 57, 38, 39, 40, 53, 54, 55 |
| Giro aéreo (`airspin`) | 36, 37, 38, 39 |

El nado personalizado de Blue Rush reutiliza los fotogramas de propulsión de vuelo, ya que esta hoja no define una animación de nado independiente.

## Habilidades implementadas
- Vuelo limitado a 9 segundos; segundo toque de salto en el aire para despegar y mantener salto para ganar impulso.
- Ataque frontal con las dos colas (Z por defecto).
- Nado bajo los puentes (↓ para sumergirse y salto para impulsarse).
- Spin Dash con las poses de carga y bola correspondientes a la hoja original.

La hoja antigua `assets/knuckles/knucklesheet.png` se conserva como referencia, pero no se utiliza en el juego porque su distribución no coincide con los índices de animación de la escena de Knuckles.

## Habilidades de Knuckles en Blue Rush
- Segundo toque de salto en el aire o mantener Espacio después del despegue para planear; izquierda/derecha dirigen el desplazamiento.
- La carrera, el Dash, la máxima velocidad, el salto, la caída, el planeo, la bola y el puñetazo usan secuencias independientes.
- Z ejecuta un combo de tres puñetazos dirigido únicamente al jugador rival situado delante y cerca en la sala online. La animación solo se inicia después de validar un rival al alcance.
- No hay muros de roca ni escalada. Spin Dash sigue disponible con X.

## Hoja de sprites validada de Knuckles
El juego carga `assets/knuckles/knucklesheet-sauce.png`, copiada de la misma hoja que usa la escena original de Knuckles en [SauceK/SonicEscapeV](https://github.com/Saucekye/SonicEscapeV). La hoja mide **640 × 576 px** y la escena declara **10 columnas × 9 filas**, con celdas de 64 × 64 px. El juego ahora conserva esa cuadrícula original y utiliza los números de cuadro de cada animación directamente, sin eliminar ni desplazar columnas.

| Acción | Fotogramas de la escena original |
|---|---|
| Reposo (`stance`) | 0, 1, 2, 3, 4, 0 |
| Bola (`ball`) | 7, 8, 9, 10 |
| Carrera (`run`) | 11, 12, 13, 14, 15, 16 |
| Dash | 21, 22, 23, 24, 25, 26, 27, 28 |
| Máxima velocidad (`Dash max`) | 47, 48, 49 |
| Planeo (`fly`) | 58, 59 (cuadros declarados por la animación oficial `fly` de `Knuckles.tscn`) |
| Salto (`jump`) | 29, 30, 31, 32 |
| Caída (`falling`) | 81, 82 |
| Puñetazo (`swipe`) | 70, 71, 72, 73, 19 |

La hoja anterior `assets/knuckles/knucklesheet.png` se conserva en el repositorio como referencia, pero ya no se utiliza: su cuadrícula no coincidía con los índices de animación usados por el código. La hoja nueva procede del repositorio fuente, cuya licencia publicada es CC0; esto no cambia los derechos sobre los personajes de Sonic.

Amy y Shadow todavía usan los dibujos vectoriales provisionales. La selección de personaje se guarda por cuenta y se sincroniza online.


### Corrección visual del planeo de Knuckles
La metadata `fly` del proyecto fuente apunta a los cuadros 58–59, pero en la hoja de sprites distribuida esos cuadros no muestran la pose horizontal clara de planeo. Blue Rush utiliza los cuadros 83–84, que sí muestran a Knuckles extendido en el aire. Al iniciar el planeo también se cancela cualquier temporizador de puñetazo para que no pueda reaparecer una pose de ataque durante el vuelo.


### Nota de caché de la corrección de planeo
La corrección también cambia el parámetro de versión de `game.js` en `index.html`, para obligar al navegador y a GitHub Pages a solicitar el JavaScript actualizado en lugar de reutilizar la versión anterior almacenada en caché.


## Activación del planeo por doble toque
- Primer toque de salto en el suelo: Knuckles salta y habilita un segundo toque aéreo.
- Segundo toque separado (soltar y volver a pulsar) mientras está en el aire: activa el planeo.
- Mantener salto desde el primer toque no activa el planeo; al aterrizar se reinicia la secuencia.
- El mismo comportamiento se aplica al teclado y al botón táctil.
