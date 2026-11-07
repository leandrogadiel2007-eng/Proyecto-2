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

La hoja local `assets/knuckles/knucklesheet.png` de 576 × 576 px no corresponde a una cuadrícula de fotogramas fiable: recortarla por celdas provoca que una misma imagen contenga varias poses. La hoja de referencia de *Sonic Advance 3* atribuida a Ren Ramos en The Spriters Resource mide 1048 × 1667 px y está organizada de forma irregular; además, la ficha indica que faltan sprites de Spin Dash y rodar. Por eso Blue Rush evita mezclar recortes y representa a Knuckles como una sola figura vectorial animada por estado (reposo, carrera, salto, planeo, escalada y puñetazo) hasta disponer de un atlas correctamente separado.

## Habilidades de Knuckles en Blue Rush
- Salto más bajo que Sonic.
- Segundo toque de salto en el aire y mantenerlo para planear; izquierda/derecha dirigen el desplazamiento.
- Al planear contra un muro de roca se aferra a él. ↑/W sube, ↓/S baja y Espacio salta para soltarse.
- Z ejecuta un combo de tres puñetazos; el último es un uppercut. Los golpes eliminan enemigos y rompen los muros de roca del recorrido.
- Spin Dash sigue disponible con X.
- Los muros rotos se sincronizan entre jugadores de una misma sala online.

La cuadrícula del atlas de Knuckles se interpreta de izquierda a derecha y de arriba abajo; los fotogramas 0–4 se reservan para reposo, 5–9 para bola y 10–15 para carrera.

Amy y Shadow todavía usan los dibujos vectoriales provisionales. La selección de personaje se guarda por cuenta y se sincroniza online.
