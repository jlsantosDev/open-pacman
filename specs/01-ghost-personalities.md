# SPEC 01 — Cuatro fantasmas con personalidades propias

> **Estado:** Implementado
> **Depende de:** ninguna
> **Fecha:** 2026-10-27
> **Objetivo:** Tener cuatro fantasmas con cuatro comportamientos distintos —uno de ellos persigue agresivamente a Pac-Man— que salen de la pen escalonadamente cada 2 segundos.

---

## Scope

**In:**

- Ampliar `GHOST_STARTS` (`src/js/maze.js`) de 2 a 4 fantasmas, cada uno con su `kind` y su momento de liberación.
- Cuatro personalidades de movimiento en `src/js/game.js`:
  - `hunter` (agresivo): persigue directamente a Pac-Man. Es el punto clave del objetivo.
  - `ambush`: apunta a la casilla situada 4 celdas por delante de Pac-Man según su dirección actual.
  - `random`: elige dirección aleatoria entre las válidas (comportamiento existente, sin cambios).
  - `shy`: persigue cuando está a 8 o más celdas (distancia Manhattan) y huye hacia su esquina cuando está más cerca.
- Velocidad por personalidad: `hunter` a `0.125` celdas/frame, el resto a `0.1`.
- Salida escalonada de la pen: los 4 nacen dentro; uno se libera cada 2 segundos en el orden `hunter` → `ambush` → `random` → `shy`, saliendo por la puerta hacia el pasillo superior.
- Los fantasmas que esperan en la pen se balancean verticalmente (solo visual).
- Tras perder una vida: los fantasmas vuelven a la pen y la liberación escalonada se repite desde cero.
- Color por personalidad en `src/js/render.js`: `hunter` rojo, `ambush` rosa, `random` cyan, `shy` naranja.

**Out of scope (para futuras specs):**

- Ciclos globales scatter/chase con temporizador.
- Power pellets y modo asustado de fantasmas (no existen power pellets aún).
- Niveles, high scores, persistencia.
- Blinky-acelera-con-dots (estilo "Elroy").

---

## Data model

```js
// maze.js — GHOST_STARTS pasa de 2 a 4 entradas.
// Todos dentro de la pen (interior cols 11-16, filas 13-15; puerta en cols 13-14, fila 12).
// releaseDelayFrames: frames de vida que pasan antes de liberar (60 fps => 2 s = 120 frames).
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter', releaseDelayFrames: 0   }, // justo bajo la puerta
  { x: 14, y: 14, kind: 'ambush', releaseDelayFrames: 120 }, // justo bajo la puerta
  { x: 11, y: 14, kind: 'random', releaseDelayFrames: 240 },
  { x: 16, y: 14, kind: 'shy',    releaseDelayFrames: 360 },
];
```

```js
// game.js — cada fantasma gana un estado de salida
ghost = {
  x: 13,
  y: 14,
  dir: 'up',
  speed: GHOST_SPEED, // hunter usara 0.125
  kind: 'hunter',
  state: 'pen', // 'pen' (esperando) | 'exiting' (yendo a por la puerta) | 'out' (en juego)
};

// Estado de partida nuevo (reloj de la vida actual; se reinicia al perder vida)
game.lifeFrames = 0;

// Constante nueva
const PEN_EXIT = { x: 13, y: 11 }; // casilla del pasillo justo encima de la puerta
const SHY_HOME = { x: 1, y: 29 };  // esquina inferior-izquierda del laberinto
```

Convenciones vigentes: origen arriba-izquierda, velocidades en celdas/frame, bucle por `requestAnimationFrame` asumiendo ~60 fps (asunción que ya usa la animación actual de la boca y las velocidades).

---

## Implementation plan

1. **`maze.js`:** ampliar `GHOST_STARTS` a las 4 entradas de arriba (kind + releaseDelayFrames + posición en la pen). El juego sigue funcional: habra 4 fantasmas, los nuevos se comportan como `random` mientras tanto. Prueba manual: ver 4 fantasmas dentro de la pen al arrancar.
2. **`game.js` (salida escalonada):** añadir `game.lifeFrames` (incrementado en `update`), campo `state` por fantasma y tres reglas: en `pen` no se mueve; al llegar a `releaseDelayFrames` pasa a `exiting`; en `exiting` elige en cada celda la dirección que minimiza la distancia Manhattan a `PEN_EXIT` (puede cruzar la puerta, permitido para fantasmas) y al alcanzarla pasa a `out`. `resetPositions` reinicia `lifeFrames` a 0, devuelve a todos a la pen y devuelve el `state`. Prueba manual: `hunter` sale al instante; el resto a los 2/4/6 segundos; al morir, todo se repite.
3. **`game.js` (velocidades):** asignar `speed` en `createGame` según kind (`hunter` → `0.125`, resto → `GHOST_SPEED`). Prueba manual: se ve a `hunter` ganando terreno.
4. **`game.js` (personalidades):** extender `decideGhost` para kind `out`: `hunter` (distancia Manhattan a la celda de Pac-Man, ya existe), `ambush` (destino = celda de Pac-Man + 4 × `DIRS[p.dir]`), `shy` (distancia a Pac-Man < 8 → destino `SHY_HOME`), `random` sin cambios. Prueba manual: cada fantasma se comporta de forma reconocible y distinta.
5. **`render.js`:** cambiar `GHOST_COLORS` a un mapa por kind (`hunter` `#ff0000`, `ambush` `#ffb8ff`, `random` `#00ffff`, `shy` `#ffb852`) y añadir al balanceo en pen un pequeño desplazamiento vertical senoidal (y de amplitud ≤ 2 px) según `frame`. Prueba manual: colores correctos y balanceo visible sin que se separen de su celda.

---

## Acceptance criteria

- [ ] Al abrir `src/index.html` en el navegador no aparece ningún error en la consola.
- [ ] Al empezar una partida hay 4 fantasmas dentro de la pen y `hunter` sale de la pen al instante.
- [ ] `ambush`, `random` y `shy` salen de la pen a los 2, 4 y 6 segundos de vida de la partida, respectivamente.
- [ ] Los fantasmas pendientes de liberación se balancean verticalmente sin desplazarse de su celda.
- [ ] `hunter` elige en cada cruce la dirección que minimiza la distancia Manhattan a Pac-Man y es claramente más rápido que los otros tres.
- [ ] `ambush` se dirige hacia la casilla 4 celdas por delante de Pac-Man según su dirección actual.
- [ ] `random` sigue eligiendo direcciones aleatorias válidas sin dar media vuelta.
- [ ] `shy` persigue cuando dista 8 o más celdas de Pac-Man y huye hacia la casilla (1, 29) cuando está más cerca.
- [ ] Tras perder una vida, los 4 fantasmas vuelven a la pen y la liberación escalonada se repite desde cero.
- [ ] Ningún fantasma se queda atrapado: los 4 acaban circulando por el laberinto.
- [ ] Cada personalidad conserva su color estable durante toda la partida aunque se pierdan vidas o se reinicie.

---

## Decisions

- **Sí:** 4 personalidades "reducidas de los clásicos" (hunter/ambush/random/shy). Encajan con el `decideGhost` actual y evitan la complejidad de Inky.
- **No:** los 4 originales fieles (Blinky/Pinky/Inky/Clyde). Inky exige dependencia entre dos fantasmas (vector doble); no compensa en esta spec.
- **Sí:** liberación escalonada con un solo reloj (`game.lifeFrames`) y `releaseDelayFrames` por fantasma. Simple y suficiente.
- **No:** abrir/cerrar la puerta con bloqueos ni timers independientes por fantasma. En `pen` el fantasma simplemente no se mueve; la puerta ya es transitable para fantasmas.
- **Sí:** orden de liberación `hunter` (0 s) → `ambush` (2 s) → `random` (4 s) → `shy` (6 s). El agresivo abre camino desde el primer segundo.
- **Sí:** `hunter` a `0.125` celdas/frame (igual que Pac-Man) y el resto a `0.1`. La agresividad viene del algoritmo y del ritmo de salida, no de mucha más velocidad.
- **Sí:** balanceo vertical solo visual en `render.js`. Moverlos físicamente rompería la alineación en celda que usa toda la lógica de movimiento.
- **Sí:** re-liberación completa tras perder una vida. Reutiliza el mismo mecanismo sin casos especiales.
- **Sí:** colores por mapa de `kind` y no por índice del array. Permite reordenar `GHOST_STARTS` sin romper los colores.
- **No:** ciclos scatter/chase. El `shy` ya simula retiradas parciales; quedan para una posible spec futura.
- **Decisión rápida sin ronda extra:** reloj por frames (60 fps) en lugar de tiempo medido. Es la asunción que ya usa el resto del juego.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `ambush`/`shy` con destino Manhattan pueden oscilar si el destino es inalcanzable (detrás de muros) | La regla anti-media-vuelta evita idas y vueltas inmediatas. Si se observa oscilación visiblemente mala, desempatar con una elección aleatoria entre opciones válidas (cambio local de 3 líneas). |
| `hunter` a la misma velocidad que Pac-Man puede ser imposible de esquivar en un corredor largo | Todo está en una constante (`0.125` en `createGame`); se baja a `0.11` con un solo cambio si la partida se vuelve injusta. |
| Pantallas de más de 60 Hz aceleran el juego x2 o x3 (velocidad por frame) | Es una limitación ya presente en el juego actual, se documenta; normalizar por tiempo delta iría en otra spec. |

---

## What is **not** in this spec

- Ciclos scatter/chase globales por temporizador.
- Power pellets, modo asustado y puntos por comer fantasmas.
- Niveles, dificultad progresiva, high scores, persistencia.
- IA de generación de laberintos o nivel 2.

Cada uno de esos, si aterriza, va en su propia spec.
