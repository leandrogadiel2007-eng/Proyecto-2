# Fuentes de sprites para Blue Rush

| Personaje | Hoja de sprites | Fuente |
|---|---|---|
| Sonic | SauceK · Sonic Escape | https://www.patreon.com/SauceK/posts/free-original-4-92998423 |
| Tails | SauceK · Sonic Escape | https://www.patreon.com/SauceK/posts/free-original-4-92998423 |
| Knuckles | Sonic Advance 3 · Ren Ramos | https://www.spriters-resource.com/game_boy_advance/sonicadv3/asset/7147/ |
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

Blue Rush utiliza la hoja de sprites que ya estaba en el repositorio: `assets/knuckles/knucklesheet.png` (576 × 576 px). Su distribución compacta es de 9 columnas × 9 filas, con celdas de 64 × 64 px. El juego ahora recorta exactamente una celda por fotograma y refleja horizontalmente la imagen para que Knuckles mire hacia la dirección de movimiento. Los sprites de reposo, carrera y bola proceden de esta hoja local; las poses especiales de planeo, escalada y puñetazo se muestran con el mismo personaje y sus estados de animación.

Fuente declarada: *Sonic Advance 3*, Sega/Sonic Team; sprites de Knuckles rippeados por Ren “Foxx” Ramos, [The Spriters Resource](https://www.spriters-resource.com/game_boy_advance/sonicadv3/asset/7147/).

## Habilidades de Knuckles en Blue Rush
- Segundo toque de salto en el aire o mantener Espacio después del despegue para planear; izquierda/derecha dirigen el desplazamiento.
- La escena fuente de Knuckles declara 10 columnas × 9 filas (celdas de 64 px). El PNG local de Blue Rush mide 576 × 576: conserva las primeras 9 columnas de cada fila y omite solo la columna fuente 9 (la décima). Conversión: `local = fila × 9 + columna` cuando `columna < 9`.
- Mapeo convertido desde `Knuckles.tscn`: reposo [0–4], bola [7, 8, 10], carrera [11–16], Dash [21–28], Dash max [47–48], planeo [58], salto [30–32], caída [81–82] y swipe [70–73]. Los fotogramas de la décima columna se omiten.
- El recorte de transparencia conserva el pivote central de cada celda, igual que el `Sprite2D` original, para mantener estable la posición entre fotogramas.
- La bolita aparece solo durante Spin Dash activo en el suelo. El planeo se mantiene hasta aterrizar.
- Z ejecuta un combo de tres puñetazos dirigido únicamente al jugador rival situado delante y cerca en la sala online. La animación solo se inicia desde una entrada de teclado o botón táctil y después de validar un rival al alcance.
- No hay muros de roca ni escalada. Spin Dash sigue disponible con X.

Amy y Shadow todavía usan los dibujos vectoriales provisionales. La selección de personaje se guarda por cuenta y se sincroniza online.
