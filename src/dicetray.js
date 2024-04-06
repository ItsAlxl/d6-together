import * as THREE from "three"
import RAPIER from "https://cdn.skypack.dev/@dimforge/rapier3d-compat"

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
const DRAW_DBG = false

const DOT_THRESHOLD = 0.9
const APPROX_ZERO_PHYS = 2.5
const REROLL_LIMIT = 3

const dice = []

let phys_ready = false

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
seed_rng(Date.now() * Math.random())

function rng_range(min, max) {
  return rng() * (max - min) + min
}

function rng_sign() {
  return rng() > 0.5 ? 1 : -1
}

function rng_range_pn(min, max) {
  return rng_sign() * rng_range(min, max)
}

export function is_ready() {
  return phys_ready
}

let num_finished = 0
function _on_die_finished() {
  num_finished++
  if (num_finished == dice.length) {
    const results = []
    for (let d of dice) {
      results.push(d.final_value)
    }
    results.sort()
    console.log(results)
  }
}

function _is_phys_zero_approx(f) {
  return Math.abs(f) < APPROX_ZERO_PHYS
}

function _is_xyz_phys_zero_approx(xyz) {
  return _is_phys_zero_approx(xyz.x) && _is_phys_zero_approx(xyz.y) && _is_phys_zero_approx(xyz.z)
}

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

RAPIER.init().then(() => {
  const RENDER_SCENE = new THREE.Scene()
  const PHYS_WORLD = new RAPIER.World({
    x: 0,
    y: 0,
    z: GRAVITY,
  })
  const TEXTURE_LOADER = new THREE.TextureLoader()

  RENDER_SCENE.add(new THREE.AmbientLight(0xffffff, 0.5))
  const sun = new THREE.DirectionalLight(0xffffff, 2.5)
  sun.position.set(TRAY_SIDE, 0, TRAY_HALF_HEIGHT)
  RENDER_SCENE.add(sun)

  const DICE_MAT_BASE = new THREE.MeshPhongMaterial({
    color: "#fff",
    map: TEXTURE_LOADER.load("fallback_dice/marble.png"),
  })
  const DICE_MAT_PIPS = new THREE.MeshPhongMaterial({
    color: "#000",
    map: TEXTURE_LOADER.load("fallback_dice/numerals_outlined.png"),
    alphaTest: 0.5,
  })
  const DICE_GEOM = _create_dice_geom(DICE_SIDE)
  DICE_GEOM.clearGroups()
  DICE_GEOM.addGroup(0, Infinity, 0)
  DICE_GEOM.addGroup(0, Infinity, 1)

  const DICE_BODY_PARAMS = RAPIER.RigidBodyDesc.dynamic()
  const DICE_COL_SHAPE = RAPIER.ColliderDesc.cuboid(DICE_SIDE, DICE_SIDE, DICE_SIDE)

  class Dice3D {
    owner_id
    offscreen = true

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
      this.sync_mesh_to_body()
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

      dice.push(this)
    }

    is_moving() {
      return (
        !_is_xyz_phys_zero_approx(this.body.linvel()) ||
        !_is_xyz_phys_zero_approx(this.body.angvel())
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

      if (!force && best_abs < DOT_THRESHOLD) {
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
        this.dbg_mat.color.setHex(0x0000ff)
        this.body.lockTranslations(true, true)
        this.body.lockRotations(true, true)
        this.body.sleep()
        _on_die_finished()
      }
    }

    sync_mesh_to_body() {
      let pos = this.body.translation()
      let rot = this.body.rotation()
      this.mesh.position.set(pos.x, pos.y, pos.z)
      this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
    }

    reset_timeout() {
      this.timeout_ticks = DICE_TIMEOUT_TICKS
    }

    phys_tick() {
      this.sync_mesh_to_body()

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
      this.dbg_mat.dispose()
    }
  }

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
  document.body.appendChild(renderer.domElement)

  camera.position.z = TRAY_HALF_HEIGHT

  // create the box
  const FLOOR_SHAPE = RAPIER.ColliderDesc.cuboid(TRAY_SIDE, TRAY_BUMPER_SIZE, 1)
  const WALL_LR_COL_SHAPE = RAPIER.ColliderDesc.cuboid(1, TRAY_BUMPER_SIZE, TRAY_HALF_HEIGHT * 2)
  const WALL_TB_COL_SHAPE = RAPIER.ColliderDesc.cuboid(TRAY_SIDE, 1, TRAY_HALF_HEIGHT * 2)
  PHYS_WORLD.createCollider(FLOOR_SHAPE.setTranslation(0, 0, -TRAY_HALF_HEIGHT))
  PHYS_WORLD.createCollider(FLOOR_SHAPE.setTranslation(0, 0, TRAY_HALF_HEIGHT))
  PHYS_WORLD.createCollider(
    WALL_LR_COL_SHAPE.setTranslation(TRAY_SIDE, 0, 0)
  ).setCollisionGroups(COL_LAYER_WORLD_STRONG)
  PHYS_WORLD.createCollider(
    WALL_LR_COL_SHAPE.setTranslation(-TRAY_SIDE, 0, 0)
  ).setCollisionGroups(COL_LAYER_WORLD_STRONG)
  PHYS_WORLD.createCollider(
    WALL_TB_COL_SHAPE.setTranslation(0, TRAY_SIDE, 0)
  ).setCollisionGroups(COL_LAYER_WORLD_WEAK)
  PHYS_WORLD.createCollider(
    WALL_TB_COL_SHAPE.setTranslation(0, -TRAY_SIDE, 0)
  ).setCollisionGroups(COL_LAYER_WORLD_WEAK)

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

    if (dice.length < 40) {
      new Dice3D(1)
    }
    for (let d of dice) {
      d.phys_tick()
    }

    setTimeout(phys_tick, PHYS_TICK_PERIOD_MS)
  }
  phys_tick()
  phys_ready = true

  function render_tick() {
    requestAnimationFrame(render_tick)

    if (DRAW_DBG) {
      let buffers = PHYS_WORLD.debugRender()
      dbg_lines.geometry.setAttribute("position", new THREE.BufferAttribute(buffers.vertices, 3))
      dbg_lines.geometry.setAttribute("color", new THREE.BufferAttribute(buffers.colors, 4))
    }
    dbg_lines.visible = DRAW_DBG

    renderer.render(RENDER_SCENE, camera)
  }
  render_tick()
})
