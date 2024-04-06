import * as THREE from "three"
import RAPIER from "https://cdn.skypack.dev/@dimforge/rapier3d-compat"
import { randFloat } from "three/src/math/MathUtils.js"

const COL_LAYER_DICE_OFFSCREEN = 0x1000_0001
const COL_LAYER_DICE_ONSCREEN = 0x0100_1103
const COL_LAYER_WORLD_WEAK = 0x0002_0100
const COL_LAYER_WORLD_STRONG = 0x0001_1100

const DICE_SIDE = 1.25
const TRAY_SIDE = 10.0
const TRAY_HALF_HEIGHT = 5.0
const TRAY_BUMPER_SIZE = 500.0
const TRAY_BUFFER_SIZE = TRAY_SIDE - DICE_SIDE * Math.SQRT2

const GRAVITY = -80.0
const PHYS_TICK_PERIOD_MS = 1000.0 / 60.0
const DICE_TIMEOUT_TICKS = 15
const DRAW_DBG = false

const APPROX_ZERO = 0.25

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

function _is_zero_approx(f) {
  return Math.abs(f) < APPROX_ZERO
}

function _is_xyz_zero_approx(xyz) {
  return _is_zero_approx(xyz.x) && _is_zero_approx(xyz.y) && _is_zero_approx(xyz.z)
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
    let uv_left = xx == "x" ? 0.0 : xx == "y" ? 0.333 : 0.666
    let uv_top = zl < 0.0 ? 0.0 : 0.5
    for (let fv = 0; fv < 4; fv++) {
      let left = fv % 3 == 0
      let top = fv <= 1
      vert_data.push({
        [xx]: left ? -length : length,
        [yy]: top ? -length : length,
        [zz]: zl,
        u: uv_left + ((zl > 0.0 ? left : !left) ? 0.0 : 0.333),
        v: uv_top + (top ? 0.0 : 0.5),
      })
    }
    let wind_a = zl > 0.0 ? 1 : 3
    let wind_b = zl > 0.0 ? 3 : 1
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
    x: 0.0,
    y: 0.0,
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
    map: TEXTURE_LOADER.load("fallback_dice/pips_outlined.png"),
    alphaTest: 0.5,
  })
  const DICE_GEOM = _create_dice_geom(DICE_SIDE)
  DICE_GEOM.clearGroups();
  DICE_GEOM.addGroup(0, Infinity, 0)
  DICE_GEOM.addGroup(0, Infinity, 1)

  const DICE_BODY_PARAMS = RAPIER.RigidBodyDesc.dynamic()
  const DICE_COL_SHAPE = RAPIER.ColliderDesc.cuboid(DICE_SIDE, DICE_SIDE, DICE_SIDE)

  class Dice3D {
    owner_id
    mesh
    body
    final_value = -1
    timeout_ticks = DICE_TIMEOUT_TICKS
    offscreen = true

    constructor(owner_id) {
      this.owner_id = owner_id

      this.body = PHYS_WORLD.createRigidBody(
        DICE_BODY_PARAMS.setTranslation(TRAY_BUFFER_SIZE, -TRAY_SIDE - DICE_SIDE, 0.0)
      )
      PHYS_WORLD.createCollider(DICE_COL_SHAPE, this.body).setCollisionGroups(
        COL_LAYER_DICE_OFFSCREEN
      )

      this.mesh = new THREE.Mesh(DICE_GEOM, [DICE_MAT_BASE, DICE_MAT_PIPS])
      this.sync_mesh_to_body()
      RENDER_SCENE.add(this.mesh)

      this.body.applyImpulse(
        {
          x: 1000.0,
          y: 750.0,
          z: 10.0,
        },
        true
      )
      this.body.applyTorqueImpulse(
        {
          x: randFloat(1000.0, 2000.0),
          y: randFloat(1000.0, 2000.0),
          z: randFloat(1000.0, 2000.0),
        },
        true
      )

      dice.push(this)
    }

    is_still() {
      return _is_xyz_zero_approx(this.body.linvel()) && _is_xyz_zero_approx(this.body.angvel())
    }

    _parse_result() {
      let ix = 2,
        iy = 6,
        iz = 10
      let abs_x = Math.abs(this.mesh.matrix.elements[ix])
      let abs_y = Math.abs(this.mesh.matrix.elements[iy])
      let abs_z = Math.abs(this.mesh.matrix.elements[iz])
      let i = abs_x > abs_y && abs_x > abs_z ? ix : abs_z > abs_x && abs_z > abs_y ? iz : iy

      if (this.mesh.matrix.elements[i] > 0.0) {
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

    end_roll() {
      this.body.lockTranslations(true, true)
      this.body.lockRotations(true, true)
      this.body.sleep()
      this.final_value = this._parse_result()
      _on_die_finished()
    }

    sync_mesh_to_body() {
      let pos = this.body.translation()
      let rot = this.body.rotation()
      this.mesh.position.set(pos.x, pos.y, pos.z)
      this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w)
    }

    phys_tick() {
      this.sync_mesh_to_body()

      if (this.offscreen) {
        let pos = this.body.translation()
        this.offscreen = pos.y < -TRAY_BUFFER_SIZE || pos.y > TRAY_BUFFER_SIZE
        if (!this.offscreen) {
          this.offscreen = false
          this.body.collider(0).setCollisionGroups(COL_LAYER_DICE_ONSCREEN)
        }
      } else {
        if (!this.is_still()) {
          this.timeout_ticks = DICE_TIMEOUT_TICKS
        } else if (this.timeout_ticks > 0) {
          this.timeout_ticks--
          if (this.timeout_ticks <= 0) {
            this.end_roll()
          }
        }
      }
    }
  }

  const frustumSize = 2 * (TRAY_SIDE - 1.0)
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
  const FLOOR_SHAPE = RAPIER.ColliderDesc.cuboid(TRAY_SIDE, TRAY_BUMPER_SIZE, 1.0)
  const WALL_LR_COL_SHAPE = RAPIER.ColliderDesc.cuboid(1.0, TRAY_BUMPER_SIZE, TRAY_HALF_HEIGHT * 2)
  const WALL_TB_COL_SHAPE = RAPIER.ColliderDesc.cuboid(TRAY_SIDE, 1.0, TRAY_HALF_HEIGHT * 2)
  PHYS_WORLD.createCollider(FLOOR_SHAPE.setTranslation(0.0, 0.0, -TRAY_HALF_HEIGHT))
  PHYS_WORLD.createCollider(FLOOR_SHAPE.setTranslation(0.0, 0.0, TRAY_HALF_HEIGHT))
  PHYS_WORLD.createCollider(
    WALL_LR_COL_SHAPE.setTranslation(TRAY_SIDE, 0.0, 0.0)
  ).setCollisionGroups(COL_LAYER_WORLD_STRONG)
  PHYS_WORLD.createCollider(
    WALL_LR_COL_SHAPE.setTranslation(-TRAY_SIDE, 0.0, 0.0)
  ).setCollisionGroups(COL_LAYER_WORLD_STRONG)
  PHYS_WORLD.createCollider(
    WALL_TB_COL_SHAPE.setTranslation(0.0, TRAY_SIDE, 0.0)
  ).setCollisionGroups(COL_LAYER_WORLD_WEAK)
  PHYS_WORLD.createCollider(
    WALL_TB_COL_SHAPE.setTranslation(0.0, -TRAY_SIDE, 0.0)
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

    if (dice.length < 4) {
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
