import ws from "./ws.js"
import Chessboard, { Color, setTexture } from "/$/classes"
// import Chessboard from "../../js/classes.mjs"


export default class Game {
  constructor() {
    this.box = document.querySelector( `.game` )
    this.box.innerHTML = /* html */ `
      <canvas class="canvas-main"></canvas>
    `

    /** @type {HTMLCanvasElement} */
    this.canvas = this.box.querySelector( `.canvas-main` )
    this.ctx = this.canvas.getContext( `2d` )

    this.map = null
    this.chessmanSize = null
    this.lastClickedField = { x:null, y:null }
    this.camera = {
      spaceAroundgame: 100,
      cursor: { x:null, y:null },
      action: null,
      x: null,
      y: null,
    }

    this.resize()

    ws.send( `game-init`, `chess-standard` )
    ws.on( `game-init`, ( { chessmanSize, player, chessboard } ) => {
      const { width, height, tileSize, fields } = chessboard
      const c = this.camera

      this.chessmanSize = chessmanSize
      this.chessboard = new Chessboard( width, height, tileSize, fields, true )

      this.player = this.chessboard.get( player.x, player.y )

      player = this.player
      chessboard = this.chessboard

      c.x = window.innerWidth / 2 - (player.x + .5) * tileSize
      c.y = window.innerHeight / 2 - (player.y + .5) * tileSize

      if ( c.y > c.spaceAroundgame )
        c.y = c.spaceAroundgame
      else if ( c.y < window.innerHeight - c.spaceAroundgame - height * tileSize )
        c.y = window.innerHeight - c.spaceAroundgame - height * tileSize
      if ( c.x > c.spaceAroundgame )
        c.x = c.spaceAroundgame
      else if ( c.x < window.innerWidth - c.spaceAroundgame - width * tileSize )
        c.x = window.innerWidth - c.spaceAroundgame - width * tileSize

      setInterval( () => {
        this.logic()
        requestAnimationFrame( () => this.draw() )
      }, 1000 / 60 )
      requestAnimationFrame( () => this.draw() )

      window.addEventListener( `resize`, () => this.resize() )
      document.addEventListener( `mouseup`, () => {
        const field = this.lastClickedField
        const x = Math.floor( (c.cursor.x - c.x) / tileSize )
        const y = Math.floor( (c.cursor.y - c.y) / tileSize )

        const from = { x:field.x, y:field.y }
        const to = { x, y }

        if ( !field || !chessboard.isAbove( x, y ) )
          return

        if ( c.action == `jump` ) {
          if ( field.x == x && field.y == y )
            c.action = `jump-2_clicks`
          else if ( chessboard.checkJump( from, to ) ) {
            ws.send( `game-update-player`, { from, to } )
            c.action = null
          }
        }
        else if ( c.action == `jump-2_clicks` ) {
          if ( (field.x != x || field.y != y) && chessboard.checkJump( from, to ) )
            ws.send( `game-update-player`, { from, to } )

          c.action = null
        }
        else
          c.action = null
      } )
      document.addEventListener( `mousedown`, () => {
        const x = Math.floor( (c.cursor.x - c.x) / tileSize )
        const y = Math.floor( (c.cursor.y - c.y) / tileSize )
        const field = chessboard.get( x, y )

        if ( Color.isEqual( field, player ) ) {
          this.lastClickedField = field
          c.action = `jump`
        }
        else if ( c.action != `jump-2_clicks` )
          c.action = `moving`
      } )
      document.addEventListener( `mousemove`, e => {
        c.cursor.x = e.clientX
        c.cursor.y = e.clientY

        const x = Math.floor( (c.cursor.x - c.x) / tileSize )
        const y = Math.floor( (c.cursor.y - c.y) / tileSize )

        if ( Color.isEqual( chessboard.get( x, y ), player ) )
          this.box.style.cursor = `pointer`
        else
          this.box.style.cursor = `default`

        if ( c.action != `moving` )
          return

        const { width, height } = this.chessboard

        let newX = e.clientX - c.cursor.x + c.x
        let newY = e.clientY - c.cursor.y + c.y

        if ( window.innerWidth - c.spaceAroundgame - width * tileSize < newX && newX < c.spaceAroundgame )
          c.x = newX

        if ( window.innerHeight - c.spaceAroundgame - height * tileSize < newY && newY < c.spaceAroundgame )
          c.y = newY
      } )
      ws.on( `game-update-spawn`, chessman => chessboard.set( chessman, true ) )
      ws.on( `game-update-despawn`, ( { x, y } ) => chessboard.remove( x, y ) )
      ws.on( `game-update-jumps`, jumps => jumps.forEach( ( { from, to } ) =>
        chessboard.move( from, to ) === player.id  ?  this.end()  :  null
      ) )
    } )
  }

  logic() {
    const cb = this.chessboard
    const c = this.camera
    // const p = this.player

    let cameraJump = cb.tileSize / 2

    if ( Game.key( `w` ) && c.y < c.spaceAroundgame )
      c.y += cameraJump
    if ( Game.key( `s` ) && c.y > window.innerHeight - c.spaceAroundgame - cb.height * cb.tileSize )
      c.y -= cameraJump
    if ( Game.key( `a` ) && c.x < c.spaceAroundgame )
      c.x += cameraJump
    if ( Game.key( `d` ) && c.x > window.innerWidth - c.spaceAroundgame - cb.width * cb.tileSize )
      c.x -= cameraJump
  }

  draw() {
    const cb = this.chessboard
    const c = this.camera
    const ctx = this.ctx
    const tSize = cb.tileSize

    ctx.clearRect( 0, 0, ctx.canvas.width, ctx.canvas.height )

    ctx.strokeStyle = `white`
    ctx.lineWidth = 1

    ctx.fillStyle = `#333`

    for ( let y = 0;  y < cb.height;  y++ )
      for ( let x = 0;  x < cb.width;  x++ )
        if ( (y + x) % 2 )
          ctx.fillRect( c.x + x * tSize, c.y + y * tSize, tSize, tSize )

    if ( /^jump/.test( c.action ) ) {
      const entity = this.lastClickedField

      ctx.fillStyle = `${entity.color}22`

      for ( const { x, y } of entity.availableFields( cb ) )
        ctx.fillRect( c.x + x * tSize, c.y + y * tSize, tSize, tSize )
    }

    for ( let y = 0;  y < cb.height;  y++ )
      for ( let x = 0;  x < cb.width;  x++ ) {
        const entity = cb.get( x, y )

        if ( !entity )
          continue

        let eX = c.x + (x + .5) * tSize - this.chessmanSize / 2
        let eY = c.y + (y + .5) * tSize - this.chessmanSize / 2

        ctx.drawImage( entity.tex, eX, eY, this.chessmanSize, this.chessmanSize )
      }
  }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight

    this.ctx.imageSmoothingEnabled = false
  }

  end() {
    alert( `game over` )
  }

  static key( key ) {
    const k = Game.keys

    if ( typeof key === `string`)
      switch ( key ) {
        case `left`: return k[ 37 ]
        case `right`: return k[ 39 ]
        case `up`: return k[ 38 ]
        case `down`: return k[ 40 ]
        case `arrow`: return k[ 37 ]  ||  k[ 38 ]  ||  k[ 39 ]  ||  k[ 40 ]

        case `w`: return k[ 87 ]
        case `s`: return k[ 83 ]
        case `a`: return k[ 65 ]
        case `d`: return k[ 68 ]
        case `wsad`: case `WSAD`: return k[ 87 ]  ||  k[ 83 ]  ||  k[ 65 ]  ||  k[ 68 ]
      }

    return k[ key ]
  }
}
Game.keys = []


document.addEventListener( `keydown`, e => Game.keys[ e.keyCode ] = true )
document.addEventListener( `keyup`, e => Game.keys[ e.keyCode ] = false )