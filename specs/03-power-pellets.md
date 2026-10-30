# SPEC 03 — Power pellets y modo asustado

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-30
> **Objetivo:** Que Pac-Man pueda comerse a los fantasmas durante 6 s al coger cada uno de los 4 power pellets del tablero, con fantasmas azules huyendo a media velocidad y cadena de puntuación 200/400/800/1600.

---

## Scope

**In:**

- `src/js/maze.js`: nuevo char `'o'` → valor 4 (power pellet) en `parseTile`, colocado en las 4 esquinas clásicas: (1,3), (26,3), (1,23), (26,23).
- Comer un pellet vale 50 puntos y cuenta en `dotsRemaining` (hay que comerse todo el tablero, pellets incluidos, para ganar).
- Modo global "asustado" de 6 s (360 frames), en `game.frightenedFrames`; se restaura a 360 cada vez que se come un pellet.
- Cadena de perlas: por cada pellet, el fantasma comido nº 1/2/3/4 vale 200/400/800/1600 (`game.eatChain`); la cadena se reinicia con cada pellet y al expirar el modo.
- Durante el modo, los fantasmas `out`:
  - Se vuelven asustados/comestibles (comportamiento derivado del timer global; sin flag por fantasma).
  - Huyen: al coger el pellet dan la media vuelta inmediata y, en cada cruce, eligen la dirección que MAXIMIZA la distancia Manhattan a Pac-Man. Las personalidades de `decideGhost` quedan en pausa hasta que el modo expire.
  - Van a media velocidad: `FRIGHTENED_SPEED = 0.06` celdas/frame.
- Comer un fantasma asustado: se suma la puntuación de la cadena, se muestra el número flotante en su casilla y el fantasma vuelve a la pen (teleport a su casilla de `GHOST_STARTS`, `state = 'pen'`) con salida diferida: `releaseDelayFrames = game.lifeFrames + 60` (1 s de espera; reaparece por el teleport de SPEC 02).
- Fantasmas que estaban en la pen al coger el pellet: no se comen ahí (no hay colisión en pen) y, si el modo sigue activo cuando teleporta a `PEN_EXIT`, salen ya asustados (deriva del flag dinámico).
- Aviso de fin: en los últimos 2 s los fantasmas parpadean entre azul y blanco (solo visual).
- Empate en el frame límite: si `frightenedFrames > 0` en el frame de la colisión, el fantasma es comestible; la regla es determinista por el orden de evaluación en `update`.

**Out of scope (para futuras specs):**

- Ojos que caminan de vuelta al pen (modo 'eyes'); la reaparición es por teleport diferido.
- Duración del modo escalada por nivel (el clásico la acorta).
- Ciclos scatter/chase, balance de dificultad, velocidades de fantasmas fuera del modo.
- Sin puntos por pellet > 50, ni combos adicionales, ni fruta.
- Score flotante para dots o pellets (solo para fantasmas comidos).
- Normalización por delta time / monitores > 60 Hz (limitación ya documentada en SPEC 01).

---

## Data model

```js
// maze.js — nuevo char en parseTile
//   '#' pared(1) · '.' dot(2) · ' ' vacio(0) · '-' puerta pen(3) · 'o' power pellet(4)
// Filas 3 y 23 cambian col 1 y col 26 de '.' a 'o'.

// game.js — estado nuevo de partida
game.frightenedFrames = 0; // >0: modo activo; +360 al comer pellet; 0 = desactivado
game.eatChain = 0;         // fantasmas comidos con el pellet actual (0-3); index de la cadena
game.popups = [];          // [{ x, y, text: '200', ttl: 60 }] ttl en frames

// Constantes nuevas en game.js
const FRIGHTENED_FRAMES = 360;   // 6 s
const FRIGHTENED_SPEED  = 0.06;  // media velocidad del modo
const PELLET_POINTS     = 50;

// Fantasma asustado: no es un estado, se DERIVA del timer global.
game.ghost (mismos campos de SPEC 02, ninguno nuevo).

// Convenciones vigentes: origen arriba-izquierda, celdas/frame, reloj en frames a ~60 fps.
```

---

## Implementation plan

1. **`maze.js` + `render.js` (pellet):** `'o'` → 4 en `parseTile`, cambiar los 4 chars a `'o'`, y en `render.js` dibujar el valor 4 como circulo grande (radio ~6 px) con parpadeo de ~0.3 s usando `game.lifeFrames` como reloj. Los pellets ya cuentan y puntúan: en `createGame` el conteo de `dotsRemaining` pasa a contar `v === 2 || v === 4`, y en `movePacman` la celda `4` se come (+50, `dotsRemaining--`). Prueba manual: se ven 4 pellets parpadeando en las esquinas, cada uno suma 50 al marcador.
2. **`game.js` (modo asustado, huida y velocidad):** añadir `frightenedFrames` y `eatChain` a `createGame`; decrementar el timer en `update`; al comer pellet, restaurar a 360, resetear `eatChain`, y dar media vuelta a los fantasmas `out` (`g.dir = OPPOSITE[g.dir]`). En `moveGhost`, si el modo está activo: usar `FRIGHTENED_SPEED` y en `decideGhost` elegir la dirección que MAXIMIZA la distancia Manhattan a Pac-Man (variante de `decideDirToward`, personalidades en pausa). Prueba manual: al coger pellet todos invierten rumbo y huyen lentos hasta que pasan los 6 s.
3. **`game.js` (comer fantasmas):** en el bucle de colisiones de `update`, si el modo está activo y el fantasma está `out`: sumar `200 * 2**game.eatChain` (200/400/800/1600 con `eatChain` 0-3), incrementar `game.eatChain`, apuntar un popup `{ x, y, text: String(puntos), ttl: 60 }`, y devolver el fantasma a la pen (posición de `GHOST_STARTS[i]`, `state = 'pen'`, `releaseDelayFrames = game.lifeFrames + 60`). Sin colisión → muerte (igual que ahora). Prueba manual: comerse a 2 con el mismo pellet suma 200 y luego 400; el fantasma reaparece ~1 s después desde la pen.
4. **`render.js` (visual del modo y popup):** fantasmas asustados en azul (#2121de), alternando a blanco durante los últimos 120 frames (2 s) del modo; dibujar los `popups` de `game.popups` en blanco durante su ttl y limpiar los caducados (el array se recorta en `render` o en `update`, un solo sitio). Prueba manual: fantasmas azules que parpadean al final y número de puntos flotando ~1 s en la casilla del fantasma comido.
5. **Regresión ligera:** perder vida durante el modo asustado debe resetear todo a lo normal (pen + cadena + popup pendientes intactos/limpios) y la partida debe poder ganarse comiendo todo el tablero. Sin cambios de código previstos.

---

## Acceptance criteria

- [ ] Al abrir `src/index.html` no hay errores en consola.
- [ ] Se ven 4 power pellets parpadeando (~0.3 s) en las esquinas (1,3), (26,3), (1,23) y (26,23).
- [ ] Cada pellet comido suma 50 puntos y desaparece del tablero.
- [ ] Al comer un pellet, todos los fantasmas `out` dan media vuelta inmediata, van a ~media velocidad y son azules durante 6 s.
- [ ] Durante el modo, en cada cruce los fantasmas eligen la dirección que más se aleja de Pac-Man (personalidades en pausa).
- [ ] Los últimos 2 s del modo, los fantasmas parpadean entre azul y blanco antes de volver a su color y comportamiento normal.
- [ ] Tocar un fantasma asustado lo come: suma 200, 400, 800 o 1600 según sea el 1º-4º del pellet, y muestra el número flotando en su casilla ~1 s.
- [ ] El fantasma comido reaparece en el mapa ~1 s después, saliendo por el teleport a `PEN_EXIT`.
- [ ] Si el modo sigue activo, los fantasmas recién liberados de la pen salen también asustados.
- [ ] Tras expirar el modo, los fantasmas recuperan color, velocidad y personalidad, y volver a tocarlos quita vida.
- [ ] Empezar el modo de nuevo (otro pellet) reinicia la cadena a 200 y restaura los 6 s.
- [ ] Al perder vida durante el modo, todo vuelve a la normalidad (sin fantasmas azules residuales) y la secuencia de pen se repite.
- [ ] La partida se gana al comer todos los dots y pellets del tablero.

---

## Decisions

- **Sí:** pellets como valor 4 en el grid, contados en `dotsRemaining` y 50 pts (elección 1.a del usuario). Reutiliza el flujo de comer dot tal cual y la victoria exige limpiar el tablero.
- **Sí:** 6 s con parpadeo azul/blanco en los últimos 2 s, huida maximizando distancias, reaparición diferida en pen, cadena 200/400/800/1600 y media velocidad. Son las opciones recomendadas confirmadas por el usuario (3.a, 4.a del bloque 1 y todas las del bloque 2).
- **Sí:** "asustado" es un estado DERIVADO (`state === 'out' && frightenedFrames > 0`), no un flag por fantasma. Un solo timer, y la regla de pen ("sale asustado si el modo sigue activo") sale gratis.
- **No:** modo 'eyes' con pathfinding al pen. Mucho código nuevo para un detalle; el teleport diferido de SPEC 02 da el mismo resultado jugable.
- **Sí:** media vuelta global al coger pellet. Es lo clásico y libera del peligro inmediato de ser atrapado justo al cogerlo.
- **No:** popup para dots o pellets. Solo fantasmas comidos (elección 3.a).
- **Sí:** liberación diferida del fantasma comido como `releaseDelayFrames = game.lifeFrames + 60`. Un solo mecanismo para todo (SPEC 02), sin campo nuevo en el fantasma.
- **Sí:** `frightenedFrames` es global y no por pellet encimado: coger otro pellet durante el modo REINICIA el timer a 360 y la cadena. Comportamiento clásico.
- **Sí:** en el frame en que el timer llega a 0 exactamente sobre una colisión, manda el valor de ese frame: mientras `frightenedFrames > 0` en el frame de la colisión, el fantasma es comestible. Regla determinista, guiada por el orden de evaluación en `update`.
- **Decisión heredada:** reloj por frames (60 fps) del resto del juego; monitores > 60 Hz comprimirán los 6 s. Limitación ya documentada.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Coger un pellet con un fantasma encima no libera el peligro por arte de magia | Puede morir en el frame de comer el pellet; es un caso legítimo de colisión. La media vuelta global reduce el problema en la práctica. |
| La huida por maximizar distancia puede oscilar en el tunel (teleports) | La regla anti-media-vuelta (salvo callejón) ya la mitiga; si se observa, desempatar in-place igual que en SPEC 01. |
| El fantasma comido entra en pen con su `releaseDelayFrames` ya en +60; si luego se pierde vida, `resetPositions` restaura los delays de `GHOST_STARTS` | Sin problema real: los valores originales se restauran por diseño; se cubre en el paso 5 de la regresión. |
| Los `popups` sobreviven a una pérdida de vida y reaparecen tras el reset | El ttl de 60 frames los hace caducar solos; se verifica visualmente en la regresión. |
| Monitores > 60 Hz comprimen los 6 s y el parpadeo | Limitación heredada de SPEC 01 (todo el juego corre por frames); su arreglo (delta time) es otra spec. |

---

## What is **not** in this spec

- Ojos que caminan de vuelta al pen (otra spec si aterriza).
- Duración del modo escalada por nivel.
- Scatter/chase, balance de dificultad, fruta, niveles, high scores, persistencia.
- Score flotante para dots/pellets o efectos de sonido.

Cada uno de esos, si aterriza, va en su propia spec.
