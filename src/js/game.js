// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Velocidad por personalidad: el hunter corre igual que Pacman.
const GHOST_SPEEDS = { hunter: 0.125 };

const PEN_EXIT = { x: 13, y: 11 }; // casilla del pasillo justo encima de la puerta
const SHY_HOME = { x: 1, y: 29 };  // esquina inferior-izquierda del laberinto

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    // Reloj de la vida actual; se reinicia al perder vida (salida escalonada).
    lifeFrames: 0,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEEDS[ g.kind ] || GHOST_SPEED,
      kind: g.kind,
      releaseDelayFrames: g.releaseDelayFrames,
      // 'pen' (esperando) | 'out' (en juego)
      state: 'pen',
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot (2) o power pellet (4).
    const v = grid[ p.y ][ p.x ];
    if ( v === 2 || v === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += v === 4 ? 50 : 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Personalidad por kind (fantasma en juego, state 'out'):
//   hunter: persigue directamente a Pacman (min Manhattan a su celda).
//   ambush: apunta 4 celdas por delante de Pacman segun su direccion actual.
//   random: direccion aleatoria entre las validas (sin media-vuelta).
//   shy:    persigue; si dista menos de 8 celdas huye hacia SHY_HOME.
function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );

  if ( g.kind === 'random' ) {
    const options = Object.keys( DIRS ).filter(
      ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
    );
    // Sin salida (callejon): permitir el giro de 180.
    const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  let tx = px;
  let ty = py;
  if ( g.kind === 'ambush' ) {
    const pd = DIRS[ p.dir ];
    tx = px + pd.x * 4;
    ty = py + pd.y * 4;
  } else if ( g.kind === 'shy' ) {
    const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
    if ( dist < 8 ) {
      tx = SHY_HOME.x;
      ty = SHY_HOME.y;
    }
  }
  g.dir = decideDirToward( grid, g, tx, ty );
}

// Elige la direccion que minimiza la distancia Manhattan al destino (tx, ty).
// Misma regla que decideGhost: no media-vuelta salvo callejon sin salida.
function decideDirToward( grid, g, tx, ty ) {
  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist = Math.abs( g.x + d.x - tx ) + Math.abs( g.y + d.y - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // En la pen espera sin moverse hasta su turno. La salida es un teleport al
  // mapa (SPEC 02): al cumplirse su delay se coloca en PEN_EXIT y pasa a 'out'.
  if ( g.state === 'pen' ) {
    if ( game.lifeFrames >= g.releaseDelayFrames ) {
      g.x = PEN_EXIT.x;
      g.y = PEN_EXIT.y;
      g.dir = 'left'; // desde la casilla de exit 'up' es muro; decideGhost reelige
      g.state = 'out';
    }
    return;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );

    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Nueva vida: la liberacion escalonada se repite desde cero.
  game.lifeFrames = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.state = 'pen';
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.lifeFrames++;
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
