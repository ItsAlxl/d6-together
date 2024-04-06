import * as THREE from "three"
import * as TWEEN from "@tweenjs/tween.js"
import RAPIER from "https://cdn.skypack.dev/@dimforge/rapier3d-compat"

const DBG_MODE = true

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
const PHYS_TICK_PERIOD_MS = 1000 / 60
const DICE_TIMEOUT_TICKS = 15

const UP_DOT_THRESHOLD = 0.875
const APPROX_ZERO_LINEAR = 5.0
const APPROX_ZERO_ANGULAR = 0.1
const REROLL_LIMIT = 3

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

let phys_ready = false
let RENDER_SCENE
let PHYS_WORLD
let DICE_BODY_PARAMS
let DICE_COL_SHAPE

const TEXTURE_LOADER = new THREE.TextureLoader()

const DICE_MAT_BASE = new THREE.MeshPhongMaterial({
  color: "#fff",
  map: TEXTURE_LOADER.load("fallback_dice/marble.png"),
})
const DICE_MAT_PIPS = new THREE.MeshPhongMaterial({
  color: "#000",
  map: TEXTURE_LOADER.load("fallback_dice/numerals_outlined.png"),
  alphaTest: 0.5,
})

function _create_dice_geom(length) {
  const geometry = new THREE.BufferGeometry()

  const verts = []
  const uvs = []
  function append_vert_data(v) {
    verts.push(v.x)
    verts.push(v.y)
    verts.push(v.z)
    uvs.push(v.u)
    uvs.push(v.v)
  }

  function append_face(xx, yy, zz, zl) {
    let vert_data = []
    let uv_left = xx == "x" ? 0 : xx == "y" ? 0.333 : 0.666
    let uv_top = zl < 0 ? 0 : 0.5
    for (let fv = 0; fv < 4; fv++) {
      let left = fv % 3 == 0
      let top = fv <= 1
      vert_data.push({
        [xx]: left ? -length : length,
        [yy]: top ? -length : length,
        [zz]: zl,
        u: uv_left + ((zl > 0 ? left : !left) ? 0 : 0.333),
        v: uv_top + (top ? 0 : 0.5),
      })
    }
    let wind_a = zl > 0 ? 1 : 3
    let wind_b = zl > 0 ? 3 : 1
    append_vert_data(vert_data[0])
    append_vert_data(vert_data[wind_a])
    append_vert_data(vert_data[wind_b])
    append_vert_data(vert_data[wind_b])
    append_vert_data(vert_data[wind_a])
    append_vert_data(vert_data[2])
  }
  append_face("x", "y", "z", length)
  append_face("x", "y", "z", -length)
  append_face("y", "z", "x", length)
  append_face("y", "z", "x", -length)
  append_face("z", "x", "y", length)
  append_face("z", "x", "y", -length)

  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts), 3))
  geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2))
  geometry.computeVertexNormals()
  return geometry
}

const DICE_GEOM = _create_dice_geom(DICE_SIDE)
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
function seed_rng(s) {
  console.log(s)
  rng = splitmix32(s)
}

function rng_range(min, max) {
  return rng() * (max - min) + min
}

function rng_sign() {
  return rng() > 0.5 ? 1 : -1
}

function rng_range_pn(min, max) {
  return rng_sign() * rng_range(min, max)
}

function _is_phys_zero_approx(f, against) {
  return Math.abs(f) < against
}

function _is_xyz_phys_zero_approx(xyz, against = 0.001) {
  return (
    _is_phys_zero_approx(xyz.x, against) &&
    _is_phys_zero_approx(xyz.y, against) &&
    _is_phys_zero_approx(xyz.z, against)
  )
}

const dice = []
let roll_boss_id = -1
let roll_take_lowest = false

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

    this.body = PHYS_WORLD.createRigidBody(
      DICE_BODY_PARAMS.setTranslation(TRAY_BUFFER_SIZE, -TRAY_SIDE - DICE_SIDE, 0)
    )
    PHYS_WORLD.createCollider(DICE_COL_SHAPE, this.body).setCollisionGroups(
      COL_LAYER_DICE_OFFSCREEN
    )

    this.dbg_mat = DICE_MAT_PIPS.clone()
    this.dbg_mat.color.setHex(0xff0000)
    this.mesh = new THREE.Mesh(DICE_GEOM, [DICE_MAT_BASE, this.dbg_mat])
    this.move_mesh_to_body()
    RENDER_SCENE.add(this.mesh)

    this.body.applyImpulse(
      {
        x: rng_range_pn(500, 1500),
        y: rng_range(500, 1500),
        z: 5,
      },
      true
    )
    this.body.applyTorqueImpulse(
      {
        x: rng_range_pn(1000, 2000),
        y: rng_range_pn(1000, 2000),
        z: rng_range_pn(1000, 2000),
      },
      true
    )

    this.idx = dice.length
    dice.push(this)
  }

  is_moving() {
    return (
      !_is_xyz_phys_zero_approx(this.body.linvel(), APPROX_ZERO_LINEAR) ||
      !_is_xyz_phys_zero_approx(this.body.angvel(), APPROX_ZERO_ANGULAR)
    )
  }

  _parse_result(force = false) {
    let ix = 2,
      iy = 6,
      iz = 10
    let abs_x = Math.abs(this.mesh.matrix.elements[ix])
    let abs_y = Math.abs(this.mesh.matrix.elements[iy])
    let abs_z = Math.abs(this.mesh.matrix.elements[iz])
    let best_abs = Math.max(abs_x, abs_y, abs_z)
    let i = best_abs == abs_x ? ix : best_abs == abs_y ? iy : iz

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

  reroll_cocked() {
    this.reset_timeout()
    let pos = this.body.translation()
    this.body.applyImpulse(
      {
        x: 250 * (pos.x == 0 ? rng_sign() : pos.x < 0 ? 1 : -1),
        y: 250 * (pos.y == 0 ? rng_sign() : pos.y < 0 ? 1 : -1),
        z: 150,
      },
      true
    )
    this.body.applyTorqueImpulse(
      {
        x: rng_range_pn(50, 150),
        y: rng_range_pn(50, 150),
        z: rng_range_pn(50, 150),
      },
      true
    )
    this.num_rerolls++
  }

  end_roll(force) {
    this.final_value = this._parse_result(force)
    if (this.final_value <= 0) {
      this.reroll_cocked()
    } else {
      this.finished = true
      this.dbg_mat.color.setHex(0x0000ff)
      this.body.lockTranslations(true, true)
      this.body.lockRotations(true, true)
      this.body.sleep()
      _on_die_finished()
    }
  }

  move_mesh_to_body() {
    let pos = this.body.translation()
    let rot = this.body.rotation()
    this.mesh.position.set(pos.x, pos.y, pos.z)
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
  }

  move_to_final_spot(x, y, z) {
    let q = VALUE_TO_QUAT[this.final_value]
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

    new TWEEN.Tween({
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
      .easing(TWEEN.Easing.Quadratic.InOut)
      .onUpdate((o) => {
        this.mesh.position.set(o.px, o.py, o.pz)
        this.mesh.quaternion.set(o.rx, o.ry, o.rz, o.rw)
        this.mesh.quaternion.normalize()
      })
      .start()
  }

  reset_timeout() {
    this.timeout_ticks = DICE_TIMEOUT_TICKS
  }

  phys_tick() {
    if (this.finished) {
      return
    }
    this.move_mesh_to_body()

    if (this.offscreen) {
      let pos = this.body.translation()
      if (pos.y > -TRAY_BUFFER_SIZE && pos.y < TRAY_BUFFER_SIZE) {
        this.offscreen = false
        this.body.collider(0).setCollisionGroups(COL_LAYER_DICE_ONSCREEN)
        this.dbg_mat.color.setHex(0x00ff00)
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
      if (this.is_moving()) {
        this.reset_timeout()
      } else if (this.timeout_ticks > 0) {
        this.timeout_ticks--
        if (this.timeout_ticks <= 0) {
          this.end_roll(this.num_rerolls >= REROLL_LIMIT)
        }
      }
    }
  }

  cleanup() {
    RENDER_SCENE.remove(this.mesh)
    PHYS_WORLD.removeRigidBody(this.body)
    this.dbg_mat.dispose()
  }
}

function roll_dice_from_ids(plr_ids, seed) {
  if (!is_ready()) {
    return
  }
  seed_rng(seed)

  for (let id of plr_ids) {
    new Dice3D(id)
  }
}

export function action_roll(boss_id, plr_ids, seed) {
  roll_take_lowest = plr_ids.length == 0
  if (roll_take_lowest) {
    plr_ids.push(boss_id)
    plr_ids.push(boss_id)
  }
  clear()
  roll_boss_id = boss_id
  roll_dice_from_ids(plr_ids, seed)
}

export function add_dice(plr_ids, seed) {
  roll_dice_from_ids(plr_ids, seed)
}

export function clear() {
  for (let d of dice) {
    d.cleanup()
  }
  dice.length = 0
  num_finished = 0
}

if (DBG_MODE) {
  window.action_roll = action_roll
  window.add_dice = add_dice
}

export function is_ready() {
  return phys_ready
}

let num_finished = 0
function _on_die_finished() {
  num_finished++

  if (num_finished == dice.length) {
    dice.sort((a, b) => {
      if (a.final_value == b.final_value) {
        if (a.owner_id == b.owner_id) {
          return a.idx < b.idx
        }
        if (a.owner_id == roll_boss_id || b.owner_id == roll_boss_id) {
          return a.owner_id == roll_boss_id
        }
        return a.owner_id < b.owner_id
      }
      return roll_take_lowest ? a.final_value < b.final_value : a.final_value > b.final_value
    })

    let num_dice = dice.length
    let num_result_dice =
      !roll_take_lowest &&
      num_dice > 1 &&
      dice[num_dice - 1].final_value == 6 &&
      dice[num_dice - 2].final_value == 6
        ? 2
        : 1
    let num_extra_dice = num_dice - num_result_dice
    let top_y = Math.min(
      TRAY_SIDE - ARRANGE_RESULT_SPACING - ARRANGE_SPACING,
      ARRANGE_START_Y + (Math.ceil(num_extra_dice / ARRANGE_MAX_COLS) - 1.0) * ARRANGE_SPACING
    )

    for (let i = 0; i < num_result_dice; i++) {
      dice[num_dice - i - 1].move_to_final_spot(
        (-0.5 * (num_result_dice - 1) + i) * ARRANGE_SPACING,
        top_y > -ARRANGE_RESULT_SPACING ? top_y + ARRANGE_RESULT_SPACING : 0.0,
        ARRANGE_Z
      )
    }

    var col = -1
    var row = -1
    var row_size = -1
    var left_x = -1
    for (let i = num_extra_dice - 1; i >= 0; i--) {
      if (col >= row_size) {
        col = 0
        row += 1
        row_size = Math.min(ARRANGE_MAX_COLS, i + 1)
        left_x = -0.5 * ARRANGE_SPACING * (row_size - 1)
      }
      dice[i].move_to_final_spot(
        left_x + ARRANGE_SPACING * col,
        top_y - ARRANGE_SPACING * row,
        ARRANGE_Z
      )
      col += 1
    }
  }
}

RAPIER.init().then(() => {
  RENDER_SCENE = new THREE.Scene()
  RENDER_SCENE.add(new THREE.AmbientLight(0xffffff, 0.5))
  const sun = new THREE.DirectionalLight(0xffffff, 2.5)
  sun.position.set(TRAY_SIDE, 0, TRAY_HALF_HEIGHT)
  RENDER_SCENE.add(sun)

  PHYS_WORLD = new RAPIER.World({
    x: 0,
    y: 0,
    z: GRAVITY,
  })
  DICE_BODY_PARAMS = RAPIER.RigidBodyDesc.dynamic()
  DICE_COL_SHAPE = RAPIER.ColliderDesc.cuboid(DICE_SIDE, DICE_SIDE, DICE_SIDE)

  const frustumSize = 2 * (TRAY_SIDE - 1)
  const camera = new THREE.OrthographicCamera(
    frustumSize / -2,
    frustumSize / 2,
    frustumSize / 2,
    frustumSize / -2,
    0,
    20
  )

  const renderer = new THREE.WebGLRenderer()
  renderer.setSize(500, 500)

  camera.position.z = TRAY_HALF_HEIGHT

  // create the dicetray
  const FLOOR_SHAPE = RAPIER.ColliderDesc.cuboid(TRAY_SIDE, TRAY_BUMPER_SIZE, 1)
  const WALL_LR_COL_SHAPE = RAPIER.ColliderDesc.cuboid(1, TRAY_BUMPER_SIZE, TRAY_HALF_HEIGHT * 2)
  const WALL_TB_COL_SHAPE = RAPIER.ColliderDesc.cuboid(TRAY_SIDE, 1, TRAY_HALF_HEIGHT * 2)
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

  let dbg_lines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
    })
  )
  RENDER_SCENE.add(dbg_lines)

  let phys_tick = () => {
    PHYS_WORLD.step()
    for (let d of dice) {
      d.phys_tick()
    }
    setTimeout(phys_tick, PHYS_TICK_PERIOD_MS)
  }
  phys_tick()
  phys_ready = true

  function render_tick() {
    requestAnimationFrame(render_tick)

    if (DBG_MODE) {
      let buffers = PHYS_WORLD.debugRender()
      dbg_lines.geometry.setAttribute("position", new THREE.BufferAttribute(buffers.vertices, 3))
      dbg_lines.geometry.setAttribute("color", new THREE.BufferAttribute(buffers.colors, 4))
    }
    dbg_lines.visible = DBG_MODE

    TWEEN.update()
    renderer.render(RENDER_SCENE, camera)
  }
  render_tick()

  document.body.appendChild(renderer.domElement)
  action_roll(1, [1, 1, 2], Date.now() * Math.random())
})
