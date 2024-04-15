import {
  TextureLoader,
  MeshPhongMaterial,
  BufferGeometry,
  BufferAttribute,
  Mesh,
  Scene as RenderScene,
  AmbientLight,
  DirectionalLight,
  OrthographicCamera,
  WebGLRenderer,
  LineSegments,
  LineBasicMaterial,
} from "three"
import { Tween, update as tweenUpdate, Easing } from "@tweenjs/tween.js"
import { init as RapierInit, World as PhysWorld, ColliderDesc, RigidBodyDesc } from "@dimforge/rapier3d-compat"

const DBG_MODE = false

const COL_LAYER_DICE_OFFSCREEN = 0x1000_0001
const COL_LAYER_DICE_ONSCREEN = 0x0100_1103
const COL_LAYER_WORLD_WEAK = 0x0002_0100
const COL_LAYER_WORLD_STRONG = 0x0001_1100

const DICE_SIDE = 1.25
const TRAY_SIDE = 10
const TRAY_HALF_HEIGHT = 5
const TRAY_BUMPER_SIZE = 500
const TRAY_BUFFER_SIZE = TRAY_SIDE - DICE_SIDE * Math.SQRT2

const GRAVITY = -80
const PHYS_FPS = 60
const PHYS_TICK_PERIOD_MS = 1000 / PHYS_FPS
const DICE_TIMEOUT_TICKS = PHYS_FPS * 0.2
const ROLL_SOFT_TIMEOUT_TICKS = PHYS_FPS * 5
const ROLL_HARD_TIMEOUT_TICKS = PHYS_FPS * 10
const DICE_SPAWN_STAGGER_TICKS = 3

const UP_DOT_THRESHOLD = 0.875
const APPROX_ZERO_LINEAR = 5.0
const APPROX_ZERO_ANGULAR = 0.1
const REROLL_LIMIT = 3
const MAX_DICE_PER_PLAYER = 10

const ARRANGE_SPACING = 2 * 1.5 * DICE_SIDE
const ARRANGE_RESULT_SPACING = 1.2 * ARRANGE_SPACING
const ARRANGE_MAX_COLS = Math.ceil(TRAY_SIDE / ARRANGE_SPACING) + 1
const ARRANGE_START_Y = ARRANGE_SPACING - TRAY_SIDE
const ARRANGE_Z = DICE_SIDE - TRAY_HALF_HEIGHT
const ARRANGE_MS = 500

const VALUE_TO_QUAT = {
  [-1]: { x: 0.35, y: 0.35, z: 0.85, w: 0.15 },
  [1]: { x: 0, y: 0, z: 0, w: 1 },
  [2]: { x: 0.5, y: 0.5, z: 0.5, w: -0.5 },
  [3]: { x: 0.5, y: 0.5, z: 0.5, w: 0.5 },
  [4]: { x: -0.5, y: -0.5, z: 0.5, w: 0.5 },
  [5]: { x: -0.5, y: 0.5, z: 0.5, w: 0.5 },
  [6]: { x: 0, y: 1, z: 0, w: 0 },
}

const TEXTURE_LOADER = new TextureLoader()

const player_mats = {}

function cleanupPlayerMat(idx) {
  for (let i = 0; i < player_mats[idx].length; i++) player_mats[idx][i].dispose()
}

function deletePlayerMat(idx) {
  cleanupPlayerMat(idx)
  delete player_mats[idx]
}

function updatePlayerMats(players) {
  for (let i = 0; i < players.length; i++) {
    if (players[i] == null && player_mats[i]) deletePlayerMat(i)
    else if (players[i] != null) {
      if (player_mats[i]) cleanupPlayerMat(i)
      player_mats[i] = [
        new MeshPhongMaterial({
          color: players[i].dice.bg_clr,
          map: TEXTURE_LOADER.load(window.d6t.getDiceImage(players[i].dice.bg_id)),
        }),
        new MeshPhongMaterial({
          color: players[i].dice.val_clr,
          map: TEXTURE_LOADER.load(window.d6t.getDiceImage(players[i].dice.val_id)),
          alphaTest: 0.5,
        }),
      ]
    }
  }
  for (let i in player_mats) {
    if (i < 0 || i > players.length) deletePlayerMat(i)
  }
}

function createDiceGeom(length) {
  const geometry = new BufferGeometry()

  const verts = []
  const uvs = []
  function appendVertData(v) {
    verts.push(v.x)
    verts.push(v.y)
    verts.push(v.z)
    uvs.push(v.u)
    uvs.push(v.v)
  }

  function appendFace(xx, yy, zz, zl) {
    const vert_data = []
    const uv_left = xx == "x" ? 0 : xx == "y" ? 0.333 : 0.666
    const uv_top = zl < 0 ? 0 : 0.5
    for (let fv = 0; fv < 4; fv++) {
      const left = fv % 3 == 0
      const top = fv <= 1
      vert_data.push({
        [xx]: left ? -length : length,
        [yy]: top ? -length : length,
        [zz]: zl,
        u: uv_left + ((zl > 0 ? left : !left) ? 0 : 0.333),
        v: uv_top + (top ? 0 : 0.5),
      })
    }
    const wind_a = zl > 0 ? 1 : 3
    const wind_b = zl > 0 ? 3 : 1
    appendVertData(vert_data[0])
    appendVertData(vert_data[wind_a])
    appendVertData(vert_data[wind_b])
    appendVertData(vert_data[wind_b])
    appendVertData(vert_data[wind_a])
    appendVertData(vert_data[2])
  }
  appendFace("x", "y", "z", length)
  appendFace("x", "y", "z", -length)
  appendFace("y", "z", "x", length)
  appendFace("y", "z", "x", -length)
  appendFace("z", "x", "y", length)
  appendFace("z", "x", "y", -length)

  geometry.setAttribute("position", new BufferAttribute(new Float32Array(verts), 3))
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2))
  geometry.computeVertexNormals()
  return geometry
}

const DICE_GEOM = createDiceGeom(DICE_SIDE)
DICE_GEOM.clearGroups()
DICE_GEOM.addGroup(0, Infinity, 0)
DICE_GEOM.addGroup(0, Infinity, 1)

function splitmix32(a) {
  return function () {
    a |= 0
    a = (a + 0x9e3779b9) | 0
    var t = a ^ (a >>> 16)
    t = Math.imul(t, 0x21f0aaad)
    t = t ^ (t >>> 15)
    t = Math.imul(t, 0x735a2d97)
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296
  }
}

let rng
function seedRNG(s) {
  rng = splitmix32(s)
}

function rngRange(min, max) {
  return rng() * (max - min) + min
}

function rngSign() {
  return rng() > 0.5 ? 1 : -1
}

function rngRangePn(min, max) {
  return rngSign() * rngRange(min, max)
}

function isPhysZeroApprox(f, against) {
  return Math.abs(f) < against
}

function isXyzPhysZeroApprox(xyz, against = 0.001) {
  return (
    isPhysZeroApprox(xyz.x, against) &&
    isPhysZeroApprox(xyz.y, against) &&
    isPhysZeroApprox(xyz.z, against)
  )
}

const dice = []
const requested_dice = []
let roll_boss_id = -1
let roll_take_lowest = false
let roll_ticks = 0
let roll_soft_target = 0

class Dice3D {
  owner_id
  idx = -1
  offscreen = true
  finished = false

  mesh
  body
  dbg_mat

  final_value = -1

  timeout_ticks = DICE_TIMEOUT_TICKS
  num_rerolls = 0

  constructor(owner_id) {
    this.owner_id = owner_id

    const side_sign = owner_id == roll_boss_id ? 1 : -1
    const rand_q = { x: rng(), y: rng(), z: rng(), w: rng() }
    const ndenom = Math.sqrt(rand_q.x ** 2 + rand_q.y ** 2 + rand_q.z ** 2 + rand_q.w ** 2)
    rand_q.x /= ndenom
    rand_q.y /= ndenom
    rand_q.z /= ndenom
    rand_q.w /= ndenom

    this.body = PHYS_WORLD.createRigidBody(
      DICE_BODY_PARAMS.setTranslation(
        TRAY_BUFFER_SIZE * (rng() - 0.5),
        -side_sign * (TRAY_SIDE + DICE_SIDE),
        TRAY_HALF_HEIGHT * 0.5
      ).setRotation(rand_q)
    )
    PHYS_WORLD.createCollider(DICE_COL_SHAPE, this.body).setCollisionGroups(
      COL_LAYER_DICE_OFFSCREEN
    )

    this.mesh = new Mesh(DICE_GEOM, player_mats[owner_id])
    this.moveMeshToBody()
    RENDER_SCENE.add(this.mesh)

    this.body.applyImpulse(
      {
        x: rngRangePn(50, 150),
        y: side_sign * rngRange(500, 750),
        z: 5,
      },
      true
    )
    this.body.applyTorqueImpulse(
      {
        x: rngRangePn(250, 400),
        y: rngRangePn(250, 400),
        z: rngRangePn(250, 400),
      },
      true
    )

    this.idx = dice.length
    dice.push(this)
  }

  isMoving() {
    return (
      !isXyzPhysZeroApprox(this.body.linvel(), APPROX_ZERO_LINEAR) ||
      !isXyzPhysZeroApprox(this.body.angvel(), APPROX_ZERO_ANGULAR)
    )
  }

  parseResult(force = false) {
    const ix = 2,
      iy = 6,
      iz = 10
    const abs_x = Math.abs(this.mesh.matrix.elements[ix])
    const abs_y = Math.abs(this.mesh.matrix.elements[iy])
    const abs_z = Math.abs(this.mesh.matrix.elements[iz])
    const best_abs = Math.max(abs_x, abs_y, abs_z)
    const i = best_abs == abs_x ? ix : best_abs == abs_y ? iy : iz

    if (!force && best_abs < UP_DOT_THRESHOLD) {
      return -1
    }
    if (this.mesh.matrix.elements[i] > 0) {
      if (i == ix) {
        return 2
      }
      if (i == iz) {
        return 1
      }
      return 3
    }
    if (i == ix) {
      return 5
    }
    if (i == iz) {
      return 6
    }
    return 4
  }

  fullReroll() {
    this.offscreen = true
    this.finished = false
    this.num_rerolls = 0
    this.resetTimeout()

    this.body.applyImpulse(
      {
        x: rngRangePn(75, 250),
        y: rngRangePn(75, 250) + 150,
        z: 500,
      },
      true
    )
    this.body.applyTorqueImpulse(
      {
        x: rngRangePn(350, 550),
        y: rngRangePn(350, 550),
        z: rngRangePn(350, 550),
      },
      true
    )
  }

  reroll_cocked() {
    this.resetTimeout()
    const pos = this.body.translation()
    this.body.applyImpulse(
      {
        x: 250 * (pos.x == 0 ? rngSign() : pos.x < 0 ? 1 : -1),
        y: 250 * (pos.y == 0 ? rngSign() : pos.y < 0 ? 1 : -1),
        z: 150,
      },
      true
    )
    this.body.applyTorqueImpulse(
      {
        x: rngRangePn(50, 150),
        y: rngRangePn(50, 150),
        z: rngRangePn(50, 150),
      },
      true
    )

    resetSoftTimeout()
    this.num_rerolls++
  }

  lock(l) {
    this.body.lockTranslations(l, true)
    this.body.lockRotations(l, true)
  }

  endRoll(force) {
    this.final_value = this.parseResult(force)
    if (this.final_value <= 0) {
      this.reroll_cocked()
    } else {
      this.finished = true
      this.lock(true)
      this.body.sleep()
      dieFinished()
    }
  }

  moveMeshToBody() {
    const pos = this.body.translation()
    const rot = this.body.rotation()
    this.mesh.position.set(pos.x, pos.y, pos.z)
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
  }

  moveToFinalSpot(x, y, z) {
    const q = VALUE_TO_QUAT[this.final_value]
    if (
      q.x * this.mesh.quaternion.x +
        q.y * this.mesh.quaternion.y +
        q.z * this.mesh.quaternion.z +
        q.w * this.mesh.quaternion.w <
      0
    ) {
      q.x *= -1
      q.y *= -1
      q.z *= -1
      q.w *= -1
    }
    this.body.setRotation(q, false)
    this.body.setTranslation({ x: x, y: y, z: z }, false)

    new Tween({
      px: this.mesh.position.x,
      py: this.mesh.position.y,
      pz: this.mesh.position.z,
      rx: this.mesh.quaternion.x,
      ry: this.mesh.quaternion.y,
      rz: this.mesh.quaternion.z,
      rw: this.mesh.quaternion.w,
    })
      .to(
        {
          px: x,
          py: y,
          pz: z,
          rx: q.x,
          ry: q.y,
          rz: q.z,
          rw: q.w,
        },
        ARRANGE_MS
      )
      .easing(Easing.Quadratic.InOut)
      .onUpdate((o) => {
        this.mesh.position.set(o.px, o.py, o.pz)
        this.mesh.quaternion.set(o.rx, o.ry, o.rz, o.rw)
        this.mesh.quaternion.normalize()
      })
      .start()
  }

  resetTimeout() {
    this.timeout_ticks = DICE_TIMEOUT_TICKS
  }

  tickPhys() {
    if (this.finished) {
      return
    }
    this.moveMeshToBody()

    if (this.offscreen) {
      const pos = this.body.translation()
      if (pos.y > -TRAY_BUFFER_SIZE && pos.y < TRAY_BUFFER_SIZE) {
        this.offscreen = false
        this.body.collider(0).setCollisionGroups(COL_LAYER_DICE_ONSCREEN)
        this.body.resetForces()
      } else {
        this.body.addForce(
          {
            x: -pos.x / TRAY_SIDE,
            y: -pos.y,
            z: 0,
          },
          true
        )
      }
    } else {
      if (this.isMoving()) {
        this.resetTimeout()
      } else if (this.timeout_ticks > 0) {
        this.timeout_ticks--
        if (this.timeout_ticks <= 0) {
          this.endRoll(this.num_rerolls >= REROLL_LIMIT)
        }
      }
    }
  }

  cleanup() {
    RENDER_SCENE.remove(this.mesh)
    PHYS_WORLD.removeRigidBody(this.body)
  }
}

function isPoolReqEmpty(pr) {
  for (let p in pr) {
    if (pr[p] > 0) return false
  }
  return true
}

function resetSoftTimeout() {
  roll_soft_target = roll_ticks + ROLL_SOFT_TIMEOUT_TICKS
}

function actionRoll(boss_id, plr_dice_counts, seed) {
  roll_take_lowest = isPoolReqEmpty(plr_dice_counts)
  if (roll_take_lowest) {
    plr_dice_counts[boss_id] = 2
  }
  clear()
  createPhysWorld() // to ensure determinism, we merely recreate the entire world every roll
  roll_boss_id = boss_id
  addDice(plr_dice_counts, seed)
}

function poolRoll(boss_id, plr_dice_counts, seed) {
  clear()
  createPhysWorld()
  roll_boss_id = boss_id
  addDice(plr_dice_counts, seed)
}

function prepRoll(seed) {
  seedRNG(seed)
  if (phys_timeout) clearTimeout(phys_timeout)

  roll_ticks = 0
  resetSoftTimeout()
}

function addDice(plr_dice_counts, seed) {
  if (!isReady()) {
    return
  }
  prepRoll(seed)

  requested_dice.length = 0
  // we want requested_dice[0] to always refer to the
  // roll boss, even when the roll boss isn't rolling
  if (!plr_dice_counts[roll_boss_id]) plr_dice_counts[roll_boss_id] = 0
  for (let pid in plr_dice_counts) {
    const d = Math.min(MAX_DICE_PER_PLAYER, plr_dice_counts[pid])
    if (d > 0 || pid == roll_boss_id) {
      requested_dice.push({
        p: pid,
        n: d,
      })
    }
  }
  requested_dice.sort((a, b) => {
    return a.p == roll_boss_id ? -1 : b.p == roll_boss_id ? 1 : a.p - b.p
  })
  tickPhys()
}

function getNextDiceRequestIdx() {
  return requested_dice.length > 1 ? requested_dice.length - 1 : -1
}

function popDiceRequest(req_idx = getNextDiceRequestIdx()) {
  if (req_idx >= 0 && requested_dice[req_idx].n > 0) {
    new Dice3D(requested_dice[req_idx].p)
    requested_dice[req_idx].n--
    if (req_idx > 0 && requested_dice[req_idx].n <= 0) requested_dice.length -= 1
  }
}

function isDiceRequestFinished() {
  return requested_dice.length == 0 || (requested_dice.length == 1 && requested_dice[0].n == 0)
}

function reroll(seed) {
  if (!isReady() || dice.length == 0) {
    return
  }
  prepRoll(seed)
  num_finished = 0

  for (let d of dice) {
    d.lock(false)
    d.fullReroll()
  }
  tickPhys()
}

function clear() {
  requested_dice.length = 0
  for (let d of dice) {
    d.cleanup()
  }
  dice.length = 0
  num_finished = 0
}

function isReady() {
  return phys_ready
}

let num_finished = 0
function dieFinished() {
  num_finished++

  if (!areDicePhysing()) {
    dice.sort((a, b) => {
      if (a.final_value == b.final_value) {
        if (a.owner_id == b.owner_id) {
          return a.idx - b.idx
        }
        return a.owner_id == roll_boss_id
          ? 1
          : b.owner_id == roll_boss_id
          ? -1
          : a.owner_id - b.owner_id
      }
      return roll_take_lowest ? b.final_value - a.final_value : a.final_value - b.final_value
    })

    const num_dice = dice.length
    const num_result_dice =
      !roll_take_lowest &&
      num_dice > 1 &&
      dice[num_dice - 1].final_value == 6 &&
      dice[num_dice - 2].final_value == 6
        ? 2
        : 1
    const num_extra_dice = num_dice - num_result_dice
    const top_y = Math.min(
      TRAY_SIDE - ARRANGE_RESULT_SPACING - ARRANGE_SPACING,
      ARRANGE_START_Y + (Math.ceil(num_extra_dice / ARRANGE_MAX_COLS) - 1.0) * ARRANGE_SPACING
    )

    for (let i = 0; i < num_result_dice; i++) {
      dice[num_dice - i - 1].moveToFinalSpot(
        (-0.5 * (num_result_dice - 1) + i) * ARRANGE_SPACING,
        top_y > -ARRANGE_RESULT_SPACING ? top_y + ARRANGE_RESULT_SPACING : 0.0,
        ARRANGE_Z
      )
    }

    let col = -1
    let row = -1
    let row_size = -1
    let left_x = -1
    for (let i = num_extra_dice - 1; i >= 0; i--) {
      if (col >= row_size) {
        col = 0
        row += 1
        row_size = Math.min(ARRANGE_MAX_COLS, i + 1)
        left_x = -0.5 * ARRANGE_SPACING * (row_size - 1)
      }
      dice[i].moveToFinalSpot(
        left_x + ARRANGE_SPACING * col,
        top_y - ARRANGE_SPACING * row,
        ARRANGE_Z
      )
      col += 1
    }
  }
}

function areDicePhysing() {
  return num_finished < dice.length
}

let phys_ready = false
let RENDER_SCENE, PHYS_WORLD
let DICE_BODY_PARAMS, DICE_COL_SHAPE
let dbg_lines
let renderer, camera
function tickRender() {
  requestAnimationFrame(tickRender)

  if (dbg_lines) {
    if (DBG_MODE) {
      const buffers = PHYS_WORLD.debugRender()
      dbg_lines.geometry.setAttribute("position", new BufferAttribute(buffers.vertices, 3))
      dbg_lines.geometry.setAttribute("color", new BufferAttribute(buffers.colors, 4))
    }
    dbg_lines.visible = DBG_MODE
  }

  tweenUpdate()
  renderer.render(RENDER_SCENE, camera)
}

function createRenderScene() {
  RENDER_SCENE = new RenderScene()
  RENDER_SCENE.add(new AmbientLight(0xffffff, 0.5))
  const sun = new DirectionalLight(0xffffff, 2.5)
  sun.position.set(TRAY_SIDE, 0, TRAY_HALF_HEIGHT)
  RENDER_SCENE.add(sun)

  const frustumSize = 2 * (TRAY_SIDE - 1)
  camera = new OrthographicCamera(
    frustumSize / -2,
    frustumSize / 2,
    frustumSize / 2,
    frustumSize / -2,
    0,
    20
  )

  renderer = new WebGLRenderer()
  renderer.setSize(1000, 1000)

  camera.position.z = TRAY_HALF_HEIGHT

  dbg_lines = new LineSegments(
    new BufferGeometry(),
    new LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
    })
  )
  RENDER_SCENE.add(dbg_lines)
  tickRender()
}

let phys_timeout
function tickPhys() {
  PHYS_WORLD.step()

  if (roll_ticks % DICE_SPAWN_STAGGER_TICKS == 0 && !isDiceRequestFinished()) {
    popDiceRequest(0)
    popDiceRequest()
  }

  for (let d of dice) {
    d.tickPhys()
  }

  roll_ticks++
  if (roll_ticks > roll_soft_target || roll_ticks > ROLL_HARD_TIMEOUT_TICKS) {
    for (let d of dice) {
      d.endRoll(true)
    }
  }

  if (areDicePhysing()) phys_timeout = setTimeout(tickPhys, PHYS_TICK_PERIOD_MS)
}

function createPhysWorld() {
  if (!isReady()) return

  PHYS_WORLD = new PhysWorld({
    x: 0,
    y: 0,
    z: GRAVITY,
  })

  const FLOOR_SHAPE = ColliderDesc.cuboid(TRAY_SIDE, TRAY_BUMPER_SIZE, 1)
  const WALL_LR_COL_SHAPE = ColliderDesc.cuboid(1, TRAY_BUMPER_SIZE, TRAY_HALF_HEIGHT * 2)
  const WALL_TB_COL_SHAPE = ColliderDesc.cuboid(TRAY_SIDE, 1, TRAY_HALF_HEIGHT * 2)
  PHYS_WORLD.createCollider(FLOOR_SHAPE.setTranslation(0, 0, -TRAY_HALF_HEIGHT))
  PHYS_WORLD.createCollider(FLOOR_SHAPE.setTranslation(0, 0, TRAY_HALF_HEIGHT))
  PHYS_WORLD.createCollider(WALL_LR_COL_SHAPE.setTranslation(TRAY_SIDE, 0, 0)).setCollisionGroups(
    COL_LAYER_WORLD_STRONG
  )
  PHYS_WORLD.createCollider(WALL_LR_COL_SHAPE.setTranslation(-TRAY_SIDE, 0, 0)).setCollisionGroups(
    COL_LAYER_WORLD_STRONG
  )
  PHYS_WORLD.createCollider(WALL_TB_COL_SHAPE.setTranslation(0, TRAY_SIDE, 0)).setCollisionGroups(
    COL_LAYER_WORLD_WEAK
  )
  PHYS_WORLD.createCollider(WALL_TB_COL_SHAPE.setTranslation(0, -TRAY_SIDE, 0)).setCollisionGroups(
    COL_LAYER_WORLD_WEAK
  )
}

async function initialize(dom_parent) {
  await RapierInit()
  DICE_BODY_PARAMS = RigidBodyDesc.dynamic()
  DICE_COL_SHAPE = ColliderDesc.cuboid(DICE_SIDE, DICE_SIDE, DICE_SIDE)

  phys_ready = true
  createPhysWorld()
  createRenderScene()

  dom_parent.appendChild(renderer.domElement)
  renderer.domElement.classList.add("h-full", "w-full")
  renderer.domElement.style = ""
}

export { initialize, isReady, updatePlayerMats, actionRoll, poolRoll, addDice, reroll, clear }
