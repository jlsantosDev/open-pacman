# AGENTS.md — Pac-Man MVP

Juego Pac-Man en vanilla JS (canvas) para aprender desarrollo guiado por specs. Proyecto 100% estático: sin `package.json`, sin build, sin tests, sin linter. Para ejecutarlo, abre `src/index.html` en el navegador (usa rutas relativas y no hace peticiones; funciona con `file://`).

## Estructura y cableado

- `src/js/` son scripts planos con globals compartidos, NO módulos ES. El orden de carga en `src/index.html` importa: `maze.js → game.js → render.js → main.js`. Cualquier fichero nuevo debe añadirse como `<script>` ahí, después de sus dependencias.
- `maze.js` expone su estado vía `window.` (`MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`); `game.js` expone `createGame`/`update`/`draw`.
- Invariante de geometría: `TILE = 20` (`render.js`) × laberinto 28×31 (`maze.js`) = canvas 560×620 (`index.html`). Cambiar uno obliga a cambiar los demás.
- `MAZE` es la matriz prístina por diseño (comentario explícito): cada partida copia; nunca mutar.
- El tablero se codifica como strings legibles (`#` pared, `.` punto, `-` puerta pen, espacio transitable); no editar el array numérico a mano.

## Estilo de código

- Comillas simples, espacios dentro de paréntesis `( e ) =>`, identificadores en inglés y comentarios en español sin tildes (ASCII). Sigue el estilo del fichero que toques.

## Flujo spec-driven (el propósito del repo)

- Skills en `.agents/skills/` (`spec`, `spec-impl`), fijadas por `skills-lock.json` (fuente: klerith/fernando-skills). Son comandos invocados por el usuario (`/spec`, `/spec-impl`) con `disable-model-invocation: true`: no los actives por tu cuenta ni saltes el flujo.
- Ciclo: `/spec` crea `specs/NN-slug.md` numerado secuencialmente en estado `Draft` → el humano lo marca `Aprobado` → `/spec-impl` implementa paso a paso en la rama `spec-NN-slug`, con pausas para revisar diff, y nunca hace commit automáticamente.
- `specs/` aún no existe: se crea en la primera `/spec` (junto a `specs/.spec-config.yml`).
- Responde en el idioma del usuario; la prosa del repo es en español.
