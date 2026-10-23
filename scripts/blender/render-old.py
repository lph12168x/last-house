import bpy, json, math, os, sys
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SCENE = json.load(open(os.path.join(ROOT, 'public/scenes/your-house.json'), encoding='utf-8'))
NODES = SCENE['nodes']
OUT = os.path.join(ROOT, 'public/renders')
os.makedirs(OUT, exist_ok=True)

def to_bl(x, y, z):
    return (x, -z, y)

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
        for b in list(block):
            if b.users == 0:
                block.remove(b)

def mat(name, color, rough=0.85, metal=0.0, transmission=0.0, ior=1.45, alpha=1.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if transmission:
        bsdf.inputs['Transmission Weight'].default_value = transmission
        bsdf.inputs['IOR'].default_value = ior
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
    return m

def wood_mat():
    m = bpy.data.materials.new('FloorWood')
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.55
    coord = nt.nodes.new('ShaderNodeTexCoord')
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.inputs['Scale'].default_value = 2.2
    wave.inputs['Distortion'].default_value = 3.0
    wave.inputs['Detail'].default_value = 2.0
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.34, 0.20, 0.11, 1)
    ramp.color_ramp.elements[1].color = (0.52, 0.33, 0.19, 1)
    nt.links.new(coord.outputs['Generated'], wave.inputs['Vector'])
    nt.links.new(wave.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    return m

M_WALL = mat('Wall', (0.90, 0.88, 0.84), 0.9)
M_CEIL = mat('Ceiling', (0.95, 0.95, 0.94), 0.95)
M_WOOD = wood_mat()
M_DOOR = mat('Door', (0.36, 0.23, 0.14), 0.6)
M_GLASS = mat('Glass', (0.85, 0.92, 0.95), 0.02, transmission=0.96, ior=1.45)
M_FRAME = mat('Frame', (0.25, 0.26, 0.27), 0.5, metal=0.7)
M_OUT = mat('Outdoor', (0.55, 0.55, 0.53), 0.95)
M_BASE = mat('SlabBase', (0.55, 0.53, 0.50), 0.95)

def mesh_obj(name, verts, faces, material):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    return ob

def box(name, center, size, rot_z, material):
    cx, cy, cz = center
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
    verts = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
             (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    faces = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    ob = mesh_obj(name, verts, faces, material)
    ob.location = (cx, cy, cz)
    ob.rotation_euler = (0, 0, rot_z)
    return ob

def build_prism(name, polygon, z0, thickness, material):
    n = len(polygon)
    verts = [(p[0], -p[1], z0) for p in polygon] + [(p[0], -p[1], z0 - thickness) for p in polygon]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    return mesh_obj(name, verts, faces, material)

def build_wall(node):
    sx, sz = node['start']; ex, ez = node['end']
    dx, dz = ex - sx, ez - sz
    length = math.hypot(dx, dz)
    if length < 1e-6:
        return
    ang = math.atan2(-dz, dx)
    h = node['height']; th = node['thickness']
    ob = box(node['id'], ((sx + ex) / 2, -(sz + ez) / 2, h / 2), (length, th, h), ang, M_WALL)
    for cid in node.get('children', []):
        child = NODES.get(cid)
        if not child or child['type'] not in ('door', 'window'):
            continue
        t = child['position'][0] / length
        cx = sx + dx * t; cz = sz + dz * t
        w = child['width']; hh = child['height']; cy = child['position'][1]
        cut = box('cut', (cx, -cz, cy), (w, th + 0.14, hh), ang, M_WALL)
        mod = ob.modifiers.new('cut', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = cut
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cut, do_unlink=True)
        if child['type'] == 'window':
            box('glass_' + cid, (cx, -cz, cy), (w - 0.04, 0.03, hh - 0.04), ang, M_GLASS)
            for dy in (-0.5, 0.5):
                box('fr_' + cid + str(dy), (cx, -cz - dy * 0.06, cy - hh / 2 + 0.03), (w, 0.06, 0.06), ang, M_FRAME)
        else:
            box('frame_' + cid, (cx, -cz, cy + hh / 2), (w + 0.1, th + 0.06, 0.05), ang, M_FRAME)

clear_scene()
LEVEL_H = max([n['height'] for n in NODES.values() if n['type'] == 'wall'] or [2.95])

bpy.ops.mesh.primitive_plane_add(size=90, location=(6.5, -5.5, -0.06))
ground = bpy.context.active_object
ground.name = 'Ground'
ground.data.materials.append(M_OUT)

for node in NODES.values():
    if node['type'] == 'slab':
        for poly in [node['polygon']]:
            build_prism(node['id'], poly, node.get('elevation', 0.0), node.get('thickness', 0.05), M_BASE)

ceilings = []
for node in NODES.values():
    if node['type'] == 'ceiling':
        ob = build_prism(node['id'], node['polygon'], LEVEL_H, 0.02, M_CEIL)
        ceilings.append(ob)

for node in NODES.values():
    if node['type'] == 'wall':
        build_wall(node)

print('architecture built, ceilings=', len(ceilings), 'level_h=', LEVEL_H)

# ---------- finishes: per-room floors, ceiling design, fixtures ----------
for ob in list(ceilings):
    bpy.data.objects.remove(ob, do_unlink=True)
ceilings.clear()

M_BASE = mat('SlabBase', (0.55, 0.53, 0.50), 0.95)
M_PAINT = mat('Paint', (0.93, 0.91, 0.87), 0.92)
M_LIGHT = mat('Downlight', (1.0, 0.96, 0.88), 0.4)
M_LIGHT.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (1.0, 0.93, 0.82, 1)
M_LIGHT.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 12.0
M_COVE = mat('Cove', (1.0, 0.95, 0.87), 0.4)
M_COVE.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (1.0, 0.90, 0.74, 1)
M_COVE.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 6.0

def tile_mat():
    m = bpy.data.materials.new('Tile')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.25
    coord = nt.nodes.new('ShaderNodeTexCoord')
    brick = nt.nodes.new('ShaderNodeTexBrick')
    brick.inputs['Scale'].default_value = 2.0
    brick.inputs['Mortar Size'].default_value = 0.004
    brick.inputs['Color1'].default_value = (0.82, 0.82, 0.80, 1)
    brick.inputs['Color2'].default_value = (0.78, 0.78, 0.76, 1)
    brick.inputs['Mortar'].default_value = (0.62, 0.62, 0.60, 1)
    nt.links.new(coord.outputs['Object'], brick.inputs['Vector'])
    nt.links.new(brick.outputs['Color'], b.inputs['Base Color'])
    return m

M_TILE = tile_mat()
ZONE_NAME = {n['id']: n.get('name', '') for n in NODES.values() if n['type'] == 'zone'}
TILED = ('厨房', '公共卫生间', '主卫', '封闭阳台', '门厅', '露台')

FLOOR_Z = 0.055
fixtures = 0

for node in list(NODES.values()):
    if node['type'] != 'ceiling':
        continue
    poly = node['polygon']
    room = ZONE_NAME.get(node.get('zoneId'), '')
    tiled = True  # 全屋地面为地板砖（用户 2026-10-21 确认）
    build_prism('floor_' + node['id'], poly, FLOOR_Z, 0.01, M_TILE if tiled else M_WOOD)

    xs = [p[0] for p in poly]; zs = [p[1] for p in poly]
    x0, x1 = min(xs), max(xs); z0, z1 = min(zs), max(zs)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2

    if '客厅' in room:
        build_prism('ceil_' + node['id'], poly, LEVEL_H, 0.02, M_PAINT)
        bw = 0.45; drop = 0.22
        for (ax, az, sx, sz) in [
            (cx, z0 + bw / 2, x1 - x0, bw),
            (cx, z1 - bw / 2, x1 - x0, bw),
            (x0 + bw / 2, cz, bw, z1 - z0 - 2 * bw),
            (x1 - bw / 2, cz, bw, z1 - z0 - 2 * bw),
        ]:
            box('tray', (ax, -az, LEVEL_H - drop / 2), (sx, sz, drop), 0, M_PAINT)
        ins = bw + 0.06
        for (ax, az, sx, sz) in [
            (cx, z0 + ins, x1 - x0 - 2 * ins, 0.04),
            (cx, z1 - ins, x1 - x0 - 2 * ins, 0.04),
            (x0 + ins, cz, 0.04, z1 - z0 - 2 * ins),
            (x1 - ins, cz, 0.04, z1 - z0 - 2 * ins),
        ]:
            box('cove', (ax, -az, LEVEL_H - drop + 0.02), (sx, sz, 0.02), 0, M_COVE)
        n_dl = 6
    else:
        build_prism('ceil_' + node['id'], poly, LEVEL_H, 0.02, M_PAINT)
        n_dl = 2 if any(k in room for k in ('卧室', '厨房')) else 1

    for i in range(n_dl):
        fx = x0 + (x1 - x0) * (i + 1) / (n_dl + 1)
        fz = cz + ((z1 - z0) * 0.18 if n_dl > 2 else 0)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.055, depth=0.012, location=(fx, -fz, LEVEL_H - 0.03))
        d = bpy.context.active_object
        d.name = 'dl_' + node['id'] + str(i)
        d.data.materials.append(M_LIGHT)
        fixtures += 1
    ceilings.append(d)

for loc, pw in [((7.1, -6.4, LEVEL_H - 0.1), 40), ((2.4, -8.2, LEVEL_H - 0.1), 25)]:
    lt = bpy.data.lights.new('dl_light', 'POINT')
    lt.energy = pw
    lt.shadow_soft_size = 0.1
    ob = bpy.data.objects.new('dl_light', lt)
    bpy.context.collection.objects.link(ob)
    ob.location = loc

print('finishes built: fixtures=', fixtures)

# ---------- modern-minimal finishes: joinery, furniture, textiles ----------
M_OAK = mat('Oak', (0.70, 0.55, 0.39), 0.55)
M_WHITE_M = mat('WhiteMatte', (0.90, 0.90, 0.88), 0.55)
M_STONE = mat('Stone', (0.58, 0.58, 0.56), 0.35)
M_FABRIC = mat('Fabric', (0.52, 0.51, 0.49), 0.95)
M_ACCENT = mat('Accent', (0.16, 0.16, 0.17), 0.35, metal=0.7)

def fb(name, sx, sz_, sy, x, z, y0, m):
    return box(name, (x, -z, y0 + sy / 2), (sx, sz_, sy), 0, m)

fb('tvwall', 0.05, 2.60, 2.55, 3.87, 8.20, 0, M_STONE)
fb('tvpanel', 0.04, 1.45, 0.82, 3.92, 8.20, 1.05, M_ACCENT)
fb('shelf_back', 0.10, 2.70, 2.20, 10.30, 8.15, 0, M_OAK)
for sy in (0.35, 0.75, 1.15, 1.55, 1.95):
    fb('shelf', 0.32, 2.70, 0.03, 10.14, 8.15, sy, M_OAK)
fb('shelf_n', 0.32, 0.03, 2.20, 10.14, 6.81, 0, M_OAK)
fb('shelf_s', 0.32, 0.03, 2.20, 10.14, 9.49, 0, M_OAK)
fb('desk_top', 0.72, 1.60, 0.04, 9.60, 8.15, 0.72, M_OAK)
fb('desk_c1', 0.08, 0.08, 0.72, 9.60, 7.55, 0, M_ACCENT)
fb('desk_c2', 0.08, 0.08, 0.72, 9.60, 8.75, 0, M_ACCENT)
fb('desk_panel', 0.22, 0.12, 0.04, 9.72, 8.15, 0.76, M_ACCENT)
fb('rug', 3.60, 2.60, 0.014, 6.35, 8.35, 0.06, M_FABRIC)

# 北向次卧：床头顶北窗，衣柜沿南墙；门在南墙东端
fb('wardA', 1.90, 0.60, 2.40, 1.01, 3.14, 0, M_WHITE_M)
fb('wardB', 1.80, 0.60, 2.40, 3.90, 3.14, 0, M_WHITE_M)
# 主卧：床头靠西，衣柜沿西墙北段
fb('wardM', 0.60, 1.90, 2.40, 0.36, 7.45, 0, M_WHITE_M)
# 南次卧：床头靠东，衣柜沿北墙（避开门扇）
fb('wardC', 1.60, 0.60, 2.40, 12.20, 6.76, 0, M_WHITE_M)

# 公卫外干区洗手台 + 镜柜
fb('vanity1', 1.20, 0.50, 0.82, 3.05, 3.76, 0, M_WHITE_M)
fb('mirror1', 1.00, 0.03, 0.90, 3.05, 3.53, 1.15, M_ACCENT)
fb('vanity2', 0.90, 0.48, 0.82, 1.45, 5.10, 0, M_WHITE_M)
fb('mirror2', 0.80, 0.03, 0.85, 1.45, 4.87, 1.12, M_ACCENT)

for cx in (4.05, 10.15):
    fb('curtain', 0.55, 0.10, 2.80, cx, 10.86, 0.06, M_FABRIC)
fb('rail', 6.30, 0.04, 0.05, 7.10, 10.90, 2.80, M_ACCENT)
fb('curtainA', 1.70, 0.09, 2.60, 1.45, 0.15, 0.06, M_FABRIC)
fb('curtainM', 1.60, 0.09, 2.60, 1.90, 10.86, 0.06, M_FABRIC)
fb('curtainC', 1.50, 0.09, 2.60, 13.54, 8.20, 0.06, M_FABRIC)

print('details built')

# joinery detail: door reveals + handle lines so cabinets read as millwork
def reveals(name, x, z0, z1, face_x, height, panels):
    step = (z1 - z0) / panels
    for i in range(1, panels):
        fb(name + '_rv', 0.012, 0.012, height - 0.06, face_x, z0 + step * i, 0.03, M_ACCENT)
    fb(name + '_hl', 0.03, (z1 - z0) * 0.55, 0.012, face_x + 0.01, (z0 + z1) / 2, 0.95, M_ACCENT)

def reveals_x(name, x0, x1, face_z, height, panels):
    step = (x1 - x0) / panels
    for i in range(1, panels):
        fb(name + '_rv', 0.012, 0.012, height - 0.06, x0 + step * i, face_z, 0.03, M_ACCENT)
    fb(name + '_hl', (x1 - x0) * 0.55, 0.03, 0.012, (x0 + x1) / 2, face_z - 0.01, 0.95, M_ACCENT)

reveals_x('wardA', 0.06, 1.96, 2.835, 2.34, 2)
reveals_x('wardB', 3.00, 4.80, 2.835, 2.34, 2)
reveals('wardM', 0.66, 6.50, 8.40, 0.665, 2.34, 2)
reveals_x('wardC', 11.40, 13.00, 7.065, 2.34, 2)
print('reveals built')

# ---------- kitchen fittings & dining pendant ----------
M_STEEL = mat('Steel', (0.62, 0.63, 0.64), 0.28, metal=0.85)
M_DARK = mat('DarkGlass', (0.05, 0.05, 0.055), 0.15, metal=0.2)
M_LAMP = bpy.data.materials.new('WarmLamp')
M_LAMP.use_nodes = True
_lb = M_LAMP.node_tree.nodes['Principled BSDF']
_lb.inputs['Base Color'].default_value = (1.0, 0.93, 0.82, 1)
_lb.inputs['Emission Color'].default_value = (1.0, 0.85, 0.62, 1)
_lb.inputs['Emission Strength'].default_value = 6.0

def cyl(name, radius, depth, loc, rot, m):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=depth, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(m)
    return ob

fb('kback', 1.95, 0.02, 0.46, 7.00, 0.135, 1.10, M_STONE)
fb('kup', 1.90, 0.34, 0.78, 7.00, 0.30, 1.56, M_WHITE_M)
for x in (6.53, 7.00, 7.47):
    fb('kup_rv', 0.012, 0.012, 0.70, x, 0.472, 1.60, M_ACCENT)

fb('pendant', 0.10, 1.50, 0.055, 7.35, 5.55, 1.98, M_LAMP)
for zz in (4.90, 6.20):
    cyl('pend_rod', 0.006, 0.79, (7.35, -zz, 2.40), (0, 0, 0), M_ACCENT)

fb('kled', 1.84, 0.02, 0.012, 7.00, 0.445, 1.545, M_LAMP)
fb('board', 0.34, 0.24, 0.02, 7.42, 0.45, 1.00, M_OAK)
cyl('kettle', 0.085, 0.18, (7.92, -0.80, 1.09), (0, 0, 0), M_ACCENT)
cyl('jar', 0.055, 0.16, (7.12, -0.32, 1.08), (0, 0, 0), M_WHITE_M)
cyl('table_bowl', 0.17, 0.075, (7.35, -5.55, 0.83), (0, 0, 0), M_WHITE_M)
print('kitchen and pendant built')


ASSETS = os.path.join(ROOT, 'assets/items')
placed = 0
for node in NODES.values():
    if node['type'] != 'item':
        continue
    path = os.path.join(ASSETS, node['asset']['id'] + '.glb')
    if not os.path.exists(path):
        continue
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    x, y, z = node['position']
    rot = node.get('rotation', [0, 0, 0])[1]
    sc = node.get('scale', [1, 1, 1])[0]
    for o in new:
        if o.parent is None:
            o.location = (x, -z, y)
            o.rotation_mode = 'XYZ'
            o.rotation_euler = (0, 0, -rot)
            o.scale = (sc, sc, sc)
    placed += 1
    if node.get('name') == 'Fridge':
        for o in new:
            if o.type == 'MESH':
                o.data.materials.clear()
                o.data.materials.append(M_STEEL)
print('furniture placed:', placed)

world = bpy.data.worlds.new('World')
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.62, 0.70, 0.82, 1)
bg.inputs['Strength'].default_value = 0.30

sun_data = bpy.data.lights.new('Sun', 'SUN')
sun_data.energy = 7.5
sun_data.angle = math.radians(0.7)
sun = bpy.data.objects.new('Sun', sun_data)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(58), 0, math.radians(-28))

def area_light(loc, size, power):
    d = bpy.data.lights.new('fill', 'AREA')
    d.energy = power
    d.size = size
    o = bpy.data.objects.new('fill', d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (0, 0, 0)
    return o

area_light((7.1, -6.6, 2.78), 4.0, 80)
area_light((1.9, -8.6, 2.78), 3.0, 45)
area_light((1.35, -4.2, 2.78), 1.6, 50)
area_light((8.2, -1.7, 2.78), 3.0, 22)
area_light((12.0, -8.2, 2.78), 2.5, 35)

pend = bpy.data.lights.new('Pendant', 'POINT')
pend.energy = 30
pend.color = (1.0, 0.88, 0.72)
pend_o = bpy.data.objects.new('Pendant', pend)
bpy.context.collection.objects.link(pend_o)
pend_o.location = (7.35, -5.55, 1.90)

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = int(os.environ.get('SAMPLES', '48'))
scene.cycles.use_denoising = True
scene.render.resolution_x = int(os.environ.get('RES_X', '1500'))
scene.render.resolution_y = int(os.environ.get('RES_Y', '950'))
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = 0.6
scene.view_settings.look = 'AgX - Medium High Contrast'

cam_data = bpy.data.cameras.new('Cam')
cam_data.lens = 24
cam = bpy.data.objects.new('Cam', cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam

VIEWS = [
    ('overview', (15.5, -20.5, 12.5), (6.6, -5.2, 0.4), True),
    ('living', (9.7, -4.5, 1.6), (5.4, -9.4, 1.05), False),
    ('master', (3.3, -7.4, 1.6), (1.0, -9.9, 1.0), False),
    ('kitchen', (7.55, -3.30, 1.68), (8.15, -0.60, 1.05), False),
    ('northwing', (6.9, -4.7, 1.55), (1.4, -4.2, 1.25), False),
    ('tvwall', (9.9, -8.6, 1.55), (3.4, -6.3, 1.2), False),
    ('shelf', (5.2, -7.2, 1.55), (10.3, -8.4, 1.1), False),
    ('dining', (9.70, -4.05, 1.62), (5.50, -7.05, 0.98), False),
    ('plan3d', (6.8, -5.5, 20.0), (6.8, -5.5, 0.0), True),
]

only = os.environ.get('ONLY')
names = [n for n in (only or '').split(',') if n]
EXPOSURE = {'kitchen': 0.45, 'dining': 0.45}
for name, pos, target, hide_ceil in VIEWS:
    if names and name not in names:
        continue
    for ob in bpy.data.objects:
        if ob.name.startswith(('ceil_', 'tray', 'cove', 'dl_')):
            ob.hide_render = hide_ceil
    cam.location = pos
    direction = Vector(target) - Vector(pos)
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    if name == 'plan3d':
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = 16.6
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 1330
        scene.view_settings.exposure = -1.1
    else:
        cam_data.type = 'PERSP'
        cam_data.lens = 24
        scene.render.resolution_x = int(os.environ.get('RES_X', '1500'))
        scene.render.resolution_y = int(os.environ.get('RES_Y', '950'))
        scene.view_settings.exposure = EXPOSURE.get(name, 0.6)
    scene.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', name)
