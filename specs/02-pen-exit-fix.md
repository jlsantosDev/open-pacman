# SPEC 02 — Salida rápida de la pen

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-30
> **Objetivo:** Que los cuatro fantasmas salgan de la pen de forma escalonada y rápida —nunca más de 1,5 s de espera— apareciendo directamente en el mapa en la casilla de exit, sin caminar por dentro de la jaula.

---

## Scope

**In:**

- Reducir los `releaseDelayFrames` de `GHOST_STARTS` (`src/js/maze.js`) de 0/120/240/360 a **0/30/60/90** (0 / 0,5 / 1 / 1,5 s a 60 fps), manteniendo el orden `hunter` → `ambush` → `random` → `shy`.
- Cambiar la liberación en `src/js/game.js`: al cumplirse el delay, el fantasma **se coloca directamente en `PEN_EXIT` (13,11)** y pasa a `out`. Se elimina el paseo Manhattan por dentro del pen y con él el estado `exiting` (y su rama en `moveGhost`), que pasa a ser código muerto.
- `resetPositions` sin cambios de diseño: al perder vida los 4 vuelven a la pen y la secuencia se repite desde cero (elección del usuario: mantener comportamiento actual de SPEC 01).
- El balanceo visual en pen de `render.js` se mantiene tal cual (los que esperan, máximo ~1,5 s).

**Out of scope (para futuras specs):**

- Balance de dificultad (velocidades de fantasmas, frecuencias de captura de Pac-Man).
- Ciclos scatter/chase, power pellets, modo asustado, puntos por comer fantasmas.
- Normalización por delta time o monitores > 60 Hz (limitación ya documentada en SPEC 01).
- Cambiar el flujo tras perder vida (seguirá siendo re-liberación completa).
- Nota de diagnóstico: durante la definición no se llegó a confirmar el síntoma exacto observado en el navegador (la simulación demostró que el paseo por dentro del pen y el reloj de 2 s por fantasma son la causa del efecto "atrapados"); este diseño de salida rápida lo tapa por completo: el delay más largo del juego pasa a ser 1,5 s.

---

## Data model

```js
// maze.js — solo cambia releaseDelayFrames (120->30, 240->60, 360->90)
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'hunter', releaseDelayFrames: 0  },
  { x: 14, y: 14, kind: 'ambush', releaseDelayFrames: 30 },
  { x: 11, y: 14, kind: 'random', releaseDelayFrames: 60 },
  { x: 16, y: 14, kind: 'shy',    releaseDelayFrames: 90 },
];
```

```js
// game.js — la maquina de estados se simplifica: 'exiting' desaparece
ghost.state: 'pen' | 'out'

// En moveGhost, la liberacion pasa a ser un teleport:
if ( g.state === 'pen' && game.lifeFrames >= g.releaseDelayFrames ) {
  g.x = PEN_EXIT.x;
  g.y = PEN_EXIT.y;
  g.dir = 'left'; // 'up' es muro desde (13,11); decideGhost lo corrige al stride siguiente
  g.state = 'out';
}
```

Se mantienen `PEN_EXIT = { x: 13, y: 11 }`, `isWall` con puerta pasable para fantasmas, velocidades (`GHOST_SPEEDS`/`GHOST_SPEED`) y personalidades de `decideGhost`. `decideDirToward` conserva un único cliente (las personalidades); su uso para el exit desaparece.

---

## Implementation plan

1. **`maze.js`:** actualizar `releaseDelayFrames` a 0/30/60/90 en `GHOST_STARTS` y el comentario de la constante. El juego sigue jugable. Prueba manual: los 4 fantasmas dentro de la pen y la salida escalonada visiblemente más rápida.
2. **`game.js` (liberación por teleport):** sustituir el cambio `pen` → `exiting` por la colocación directa en `PEN_EXIT` + `state = 'out'`; borrar la rama `if ( g.state === 'exiting' )` de `moveGhost` y las menciones a `exiting` en comentarios (creación de fantasma y `resetPositions`). Prueba manual: `hunter` aparece en la casilla (13,11) al primer segundo y desfila por el laberinto con su personalidad.
3. **Regresión ligera:** comprobar que tras perder una vida los 4 vuelven al pen y la secuencia se repite desde cero, y que colores/personalidades no cambiaron. Sin cambios de código previstos.

---

## Acceptance criteria

- [ ] Al abrir `src/index.html` no hay errores en consola.
- [ ] `hunter` está fuera de la pen y en el mapa antes del primer segundo de partida.
- [ ] `ambush`, `random` y `shy` aparecen en el mapa a los 0,5, 1 y 1,5 s de vida de la partida, respectivamente (a 60 fps).
- [ ] Ningún fantasma recorre las celdas (11-16, 13-15) tras ser liberado: la salida es un salto a `PEN_EXIT`, no un paseo.
- [ ] Los fantasmas pendientes de liberar se balancean verticalmente en su celda del pen.
- [ ] Tras perder una vida, los 4 vuelven a la pen y la secuencia de salida se repite desde cero.
- [ ] Personalidades (`hunter`/`ambush`/`random`/`shy`), colores y velocidades quedan intactos.
- [ ] En su primer stride tras el teleport, cada fantasma elige una dirección válida desde (13,11) y no se bloquea ni da una media vuelta ilegal.

---

## Decisions

- **Sí:** colocación directa en `PEN_EXIT` (teleport) al cumplirse el delay. Elimina de raíz el paseo por dentro de la jaula y su riesgo de atasco — es la fuente del síntoma "quedan atrapados".
- **No:** mantener el estado `exiting` solo para animar el cruce de la puerta (2 frames útiles). Dejarlo sería código muerto con una regla más que mantener; el paso por la puerta sigue siendo posible para los fantasmas `out` (la puerta sigue pasable en `isWall`).
- **Sí:** delays de 0/30/60/90 frames. Mantiene el orden de SPEC 01 y la sensación escalonada sin que nadie espere más de 1,5 s — antes el más desfavorecido esperaba 6 s y con vidas perdidas podía quedar sin liberar nunca.
- **Sí:** mantener el reset completo tras perder vida (elección explícita del usuario; no se toca `resetPositions` salvo comentarios).
- **Sí:** `dir` inicial `'left'` tras el teleport: desde (13,11) `up` es muro; el siguiente `decideGhost` lo re-elige al estar alineado, así que cualquier dirección válida vale para arrancar.
- **No:** tocar velocidades, personalidades, colores ni nada fuera de la máquina de estados del pen (alcance cerrado por el usuario).
- **Sí:** dejar la puerta pasable para los fantasmas `out` tal cual estaba. En la verificación se observó que `random` puede colarse de nuevo por ella y rondar el interior del pen 1,5-3 s antes de salir solo; se acepta como comportamiento de la personalidad intacta y queda documentado en Risks.

---

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El teleport a (13,11) podría caer sobre Pac-Man si este pasa justo por ahí — muerte instantánea | En el arranque Pac-Man está en (13,23) y tras cada muerte ambos se resetean a sus inicios: hay 12 filas de separación garantizadas. El caso solo podría darse paseando, donde la colisión es legítima de todas formas. |
| Monitores > 60 Hz comprimen la secuencia escalonada (delays en frames) | Limitación ya documentada en SPEC 01; su arreglo (delta time) es otra spec. |
| La puerta sigue pasable para fantasmas `out`, así que `random` puede colarse de nuevo por ella y rondar 1,5-3 s dentro del interior del pen antes de salir solo | Limitación de re-entrada aceptada y documentada en la verificación (la salida sigue siendo un salto limpio a `PEN_EXIT`; ninguna personalidad queda bloqueada). Si molesta en juego, impedir la re-entrada es un cambio de 1 línea descrito en la discusión de cierre. |

---

## What is **not** in this spec

- Balance de dificultad y velocidades.
- Scatter/chase, power pellets, modo asustado, puntos por comer fantasmas.
- Niveles, high scores, persistencia.
- Normalización de fps / delta time.

Cada uno, si aterriza, va en su propia spec.
