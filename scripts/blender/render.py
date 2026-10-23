import bpy, json, math, os, sys, random
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SCENE = json.load(open(os.path.join(ROOT, 'public/scenes/your-house.json'), encoding='utf-8'))
NODES = SCENE['nodes']
STYLE = os.environ.get('STYLE', 'warm')
OUT = os.path.join(ROOT, 'public/renders', STYLE)
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- palette
PALETTES = {
    'warm': {
        'name': '奶油暖木',
        'wall': '#e5dbcb', 'ceiling': '#f4eee4',
        'tile': '#dbcfbb', 'grout': '#b7a891',
        'wood': '#ab8760', 'wood_dark': '#705238', 'wood_grain': '#9a7956',
        'joinery': '#efe7d8', 'joinery2': '#e7dcc9', 'joinery_dark': '#d4c5b0',
        'stone': '#c9beac', 'stone_vein': '#b1a48f', 'backsplash': '#dcd2c2',
        'fabric': '#bda98e', 'fabric2': '#d6c7b0', 'accent': '#7c6242',
        'accent2': '#55634a', 'accent3': '#9c563d',
        'linen': '#e5dac8', 'sheer': '#f3ece1',
        'bedding': '#f1eadf', 'bed_accent': '#b99a72',
        'rug': '#9b8b74', 'rug_edge': '#7f7160',
        'metal': '#a9854e', 'metal_dark': '#3c352d',
        'art1': '#b46a4c', 'art2': '#c39a5e', 'art3': '#8d9a83', 'art4': '#3f3a33',
        'leaf': '#5f6f50', 'leaf2': '#79865f', 'pot': '#b9a58b', 'lamp': '#f1e6d3',
        'exposure': 0.20, 'sun': 5.0, 'warm_light': (1.0, 0.90, 0.78), 'fill_light': (1.0, 0.97, 0.92),
    },
    'grey': {
        'name': '现代灰调',
        'wall': '#dcdcd7', 'ceiling': '#f1f1ed',
        'tile': '#d1d2cf', 'grout': '#aeb0ac',
        'wood': '#7d6a58', 'wood_dark': '#4f4136', 'wood_grain': '#6d5b4a',
        'joinery': '#ececea', 'joinery2': '#dcddd9', 'joinery_dark': '#c6c7c3',
        'stone': '#c3c4c1', 'stone_vein': '#a5a7a4', 'backsplash': '#cfd0cc',
        'fabric': '#85827b', 'fabric2': '#a09d95', 'accent': '#40423f',
        'accent2': '#8a5a3e', 'accent3': '#5c6b63',
        'linen': '#d4d3cc', 'sheer': '#e9eae5',
        'bedding': '#eeede7', 'bed_accent': '#7a7b76',
        'rug': '#b0b0aa', 'rug_edge': '#8f908a',
        'metal': '#2e2f30', 'metal_dark': '#1e1f20',
        'art1': '#3f4643', 'art2': '#a86e4a', 'art3': '#d8d2c5', 'art4': '#22252a',
        'leaf': '#5e6d5b', 'leaf2': '#7a8a72', 'pot': '#8f8c84', 'lamp': '#e9e4d8',
        'exposure': 0.13, 'sun': 5.2, 'warm_light': (1.0, 0.90, 0.78), 'fill_light': (1.0, 0.98, 0.95),
    },
    'dark': {
        'name': '深色雅奢',
        'wall': '#cfc6b7', 'ceiling': '#e8e1d5',
        'tile': '#d8cbb7', 'grout': '#b3a58e',
        'wood': '#6d4d33', 'wood_dark': '#3b2a1d', 'wood_grain': '#573d2a',
        'joinery': '#4c3827', 'joinery2': '#e0d6c4', 'joinery_dark': '#33251a',
        'stone': '#575147', 'stone_vein': '#3d3933', 'backsplash': '#b9aa94',
        'fabric': '#3a4a40', 'fabric2': '#4f6154', 'accent': '#a37f4a',
        'accent2': '#c0a682', 'accent3': '#7f4636',
        'linen': '#c9bca7', 'sheer': '#e7ddcd',
        'bedding': '#eae1d3', 'bed_accent': '#536354',
        'rug': '#64584a', 'rug_edge': '#4a4034',
        'metal': '#b08a52', 'metal_dark': '#241f1a',
        'art1': '#435148', 'art2': '#b98a52', 'art3': '#d9cdb9', 'art4': '#1e1d1a',
        'leaf': '#3f5542', 'leaf2': '#5f7154', 'pot': '#8d7b62', 'lamp': '#e7dbc5',
        'exposure': 0.15, 'sun': 4.0, 'warm_light': (1.0, 0.82, 0.60), 'fill_light': (1.0, 0.93, 0.86),
    },
}
S = PALETTES[STYLE]
random.seed(7)


def lin(c):
    c = c.lstrip('#')
    vals = [int(c[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    out = []
    for v in vals:
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def to_bl(x, y, z):
    return (x, -z, y)


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


# ---------------------------------------------------------------- materials
def _bsdf(m):
    return m.node_tree.nodes['Principled BSDF']


def plain_mat(name, color, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = _bsdf(m)
    b.inputs['Base Color'].default_value = (*lin(color), 1.0)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


def plaster_mat(name, color, rough=0.92, bump=0.035, scale=55):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    b.inputs['Base Color'].default_value = (*lin(color), 1.0)
    b.inputs['Roughness'].default_value = rough
    coord = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 3.0
    noise.inputs['Roughness'].default_value = 0.6
    bmp = nt.nodes.new('ShaderNodeBump')
    bmp.inputs['Strength'].default_value = bump
    bmp.inputs['Distance'].default_value = 0.02
    nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], bmp.inputs['Height'])
    nt.links.new(bmp.outputs['Normal'], b.inputs['Normal'])
    return m


def fabric_mat(name, color, rough=0.96, bump=0.08, scale=140):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    b.inputs['Base Color'].default_value = (*lin(color), 1.0)
    b.inputs['Roughness'].default_value = rough
    try:
        b.inputs['Sheen Weight'].default_value = 0.35
        b.inputs['Sheen Roughness'].default_value = 0.5
    except Exception:
        pass
    coord = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 2.0
    bmp = nt.nodes.new('ShaderNodeBump')
    bmp.inputs['Strength'].default_value = bump
    bmp.inputs['Distance'].default_value = 0.005
    nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], bmp.inputs['Height'])
    nt.links.new(bmp.outputs['Normal'], b.inputs['Normal'])
    return m


def wood_mat(name, base, dark, rough=0.48):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    b.inputs['Roughness'].default_value = rough
    coord = nt.nodes.new('ShaderNodeTexCoord')
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.inputs['Scale'].default_value = 26.0
    wave.inputs['Distortion'].default_value = 2.0
    wave.inputs['Detail'].default_value = 2.0
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 0.16
    mix = nt.nodes.new('ShaderNodeMixRGB')
    mix.blend_type = 'MIX'
    mix.inputs['Color1'].default_value = (*lin(base), 1)
    mix.inputs['Color2'].default_value = (*lin(dark), 1)
    nt.links.new(coord.outputs['Object'], wave.inputs['Vector'])
    nt.links.new(wave.outputs['Fac'], mul.inputs[0])
    nt.links.new(mul.outputs['Value'], mix.inputs['Fac'])
    nt.links.new(mix.outputs['Color'], b.inputs['Base Color'])
    bmp = nt.nodes.new('ShaderNodeBump')
    bmp.inputs['Strength'].default_value = 0.04
    bmp.inputs['Distance'].default_value = 0.002
    nt.links.new(wave.outputs['Fac'], bmp.inputs['Height'])
    nt.links.new(bmp.outputs['Normal'], b.inputs['Normal'])
    return m


def stone_mat(name, base, vein, rough=0.32, scale=2.1, distortion=1.2):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    b.inputs['Roughness'].default_value = rough
    coord = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = scale
    noise.inputs['Detail'].default_value = 10.0
    noise.inputs['Roughness'].default_value = 0.62
    noise.inputs['Distortion'].default_value = distortion
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.42
    ramp.color_ramp.elements[0].color = (*lin(base), 1)
    ramp.color_ramp.elements[1].position = 0.62
    ramp.color_ramp.elements[1].color = (*lin(vein), 1)
    nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    bmp = nt.nodes.new('ShaderNodeBump')
    bmp.inputs['Strength'].default_value = 0.035
    bmp.inputs['Distance'].default_value = 0.003
    nt.links.new(noise.outputs['Fac'], bmp.inputs['Height'])
    nt.links.new(bmp.outputs['Normal'], b.inputs['Normal'])
    return m


def tile_mat(name, base, grout, rough=0.24, wet=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    b.inputs['Roughness'].default_value = rough
    coord = nt.nodes.new('ShaderNodeTexCoord')
    brick = nt.nodes.new('ShaderNodeTexBrick')
    brick.offset = 0.0
    brick.squash = 1.0
    brick.inputs['Scale'].default_value = 1 / 3.0
    brick.inputs['Mortar Size'].default_value = 0.0026
    brick.inputs['Brick Width'].default_value = 0.5
    brick.inputs['Row Height'].default_value = 0.25
    brick.inputs['Color1'].default_value = (*lin(base), 1)
    brick.inputs['Color2'].default_value = (*lin(base), 1)
    brick.inputs['Mortar'].default_value = (*lin(grout), 1)
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.5
    noise.inputs['Detail'].default_value = 5.0
    mixc = nt.nodes.new('ShaderNodeMixRGB')
    mixc.blend_type = 'MULTIPLY'
    mixc.inputs['Fac'].default_value = 0.12
    nt.links.new(coord.outputs['Object'], brick.inputs['Vector'])
    nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(brick.outputs['Color'], mixc.inputs['Color1'])
    nt.links.new(noise.outputs['Color'], mixc.inputs['Color2'])
    nt.links.new(mixc.outputs['Color'], b.inputs['Base Color'])
    bmp = nt.nodes.new('ShaderNodeBump')
    bmp.inputs['Strength'].default_value = 0.10
    bmp.inputs['Distance'].default_value = 0.0015
    nt.links.new(brick.outputs['Fac'], bmp.inputs['Height'])
    nt.links.new(bmp.outputs['Normal'], b.inputs['Normal'])
    return m


def subway_mat(name, base, grout, rough=0.28):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    b.inputs['Roughness'].default_value = rough
    coord = nt.nodes.new('ShaderNodeTexCoord')
    brick = nt.nodes.new('ShaderNodeTexBrick')
    brick.offset = 0.5
    brick.inputs['Scale'].default_value = 3.0
    brick.inputs['Mortar Size'].default_value = 0.006
    brick.inputs['Brick Width'].default_value = 0.5
    brick.inputs['Row Height'].default_value = 0.25
    brick.inputs['Color1'].default_value = (*lin(base), 1)
    brick.inputs['Color2'].default_value = (*lin(base), 1)
    brick.inputs['Mortar'].default_value = (*lin(grout), 1)
    nt.links.new(coord.outputs['Object'], brick.inputs['Vector'])
    nt.links.new(brick.outputs['Color'], b.inputs['Base Color'])
    bmp = nt.nodes.new('ShaderNodeBump')
    bmp.inputs['Strength'].default_value = 0.15
    bmp.inputs['Distance'].default_value = 0.002
    nt.links.new(brick.outputs['Fac'], bmp.inputs['Height'])
    nt.links.new(bmp.outputs['Normal'], b.inputs['Normal'])
    return m


def emissive_mat(name, color, strength=8.0, base=None):
    m = plain_mat(name, base or color, 0.4)
    b = _bsdf(m)
    b.inputs['Emission Color'].default_value = (*lin(color), 1)
    b.inputs['Emission Strength'].default_value = strength
    return m


def glass_mat(name, tint='#dfe9ec', alpha=1.0, rough=0.02, ior=1.45):
    m = plain_mat(name, tint, rough)
    b = _bsdf(m)
    b.inputs['Transmission Weight'].default_value = 1.0
    b.inputs['IOR'].default_value = ior
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
    return m


def mirror_mat(name):
    m = plain_mat(name, '#d8dade', 0.03, 1.0)
    return m


M_WALL = plaster_mat('Wall', S['wall'], 0.93, 0.04)
M_CEIL = plaster_mat('Ceiling', S['ceiling'], 0.95, 0.02)
M_TILE = tile_mat('Tile', S['tile'], S['grout'], 0.24)
M_TILE_WET = tile_mat('TileWet', S['tile'], S['grout'], 0.38, True)
M_BACK = subway_mat('Backsplash', S['backsplash'], S['grout'], 0.3)
M_WOOD = wood_mat('Wood', S['wood'], S['wood_grain'], 0.5)
M_WOOD_DARK = wood_mat('WoodDark', S['wood_dark'], '#2a1c12', 0.42)
M_JOIN = plain_mat('Joinery', S['joinery'], 0.62)
M_JOIN2 = plain_mat('Joinery2', S['joinery2'], 0.62)
M_JOIN_D = plain_mat('JoineryDark', S['joinery_dark'], 0.6)
M_WARD = M_WOOD if STYLE == 'warm' else (M_JOIN if STYLE == 'grey' else M_WOOD_DARK)
M_STONE = stone_mat('Stone', S['stone'], S['stone_vein'], 0.3)
M_STONE_SOFT = stone_mat('StoneSoft', S['stone'], S['stone_vein'], 0.42, 1.4, 0.8)
M_FAB = fabric_mat('Fabric', S['fabric'])
M_FAB2 = fabric_mat('Fabric2', S['fabric2'])
M_ACCENT = fabric_mat('AccentFabric', S['accent'])
M_ACCENT2 = fabric_mat('AccentFabric2', S['accent2'])
M_ACCENT3 = fabric_mat('AccentFabric3', S['accent3'])
M_LINEN = fabric_mat('Linen', S['linen'], 0.92, 0.05, 90)
M_SHEER = fabric_mat('Sheer', S['sheer'], 0.9, 0.02, 90)
M_SHEER.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0.16
M_BED = fabric_mat('Bedding', S['bedding'], 0.95, 0.03, 120)
M_BED_ACCENT = fabric_mat('BedAccent', S['bed_accent'], 0.95, 0.05, 120)
M_RUG = fabric_mat('Rug', S['rug'], 1.0, 0.16, 70)
M_RUG_EDGE = fabric_mat('RugEdge', S['rug_edge'], 1.0, 0.1, 90)
M_METAL = plain_mat('Metal', S['metal'], 0.3, 0.9)
M_METAL_DARK = plain_mat('MetalDark', S['metal_dark'], 0.35, 0.8)
M_TRIM = M_WOOD_DARK if STYLE == 'warm' else M_METAL_DARK
M_CERAMIC = plain_mat('Ceramic', '#ece7dc', 0.28)
M_CERAMIC_DARK = plain_mat('CeramicDark', S['stone_vein'], 0.35)
M_LEAF = plain_mat('Leaf', S['leaf'], 0.6)
M_LEAF2 = plain_mat('Leaf2', S['leaf2'], 0.65)
M_POT = plain_mat('Pot', S['pot'], 0.7)
M_GLASS = glass_mat('Glass', '#f4f7f6', 0.6, 0.02, 1.04)
M_BLACK_GLASS = plain_mat('BlackGlass', '#0a0b0c', 0.08, 0.35)
M_LIGHT = emissive_mat('Downlight', '#ffe9c8', 4.0, '#fff4de')
M_COVE = emissive_mat('Cove', '#ffd9a8', 2.0, '#fff0d4')
M_LED = emissive_mat('Led', '#ffe1b4', 3.0, '#fff2da')
M_MIRROR = mirror_mat('Mirror')
M_SCREEN = plain_mat('Screen', '#08090a', 0.12, 0.2)
M_STEEL = plain_mat('Steel', '#c7cbcc', 0.28, 0.88)
M_WHITE_APP = plain_mat('WhiteAppliance', '#eceae5', 0.32)

# ---------------------------------------------------------------- geometry helpers
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


def fb(name, sx, sz_, sy, x, z, y0, m, rot=0.0):
    return box(name, (x, -z, y0 + sy / 2), (sx, sz_, sy), rot, m)


def rb(name, sx, sz_, sy, x, z, y0, m, bevel=0.025, rot=0.0, smooth=True, seg=3):
    ob = fb(name, sx, sz_, sy, x, z, y0, m, rot)
    b = min(bevel, min(sx, sz_, sy) / 2.5)
    if b > 0.002:
        mod = ob.modifiers.new('bev', 'BEVEL')
        mod.width = b
        mod.segments = seg
        mod.limit_method = 'ANGLE'
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


def cyl(name, r, h, x, z, y0, m, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h,
                                        location=(x, -z, y0 + h / 2), rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def cyl_at(name, r, h, loc, m, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def cone(name, r1, r2, h, x, z, y0, m, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=h,
                                    location=(x, -z, y0 + h / 2), rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def sphere(name, r, x, z, y, m, scale=(1, 1, 1), rot=(0, 0, 0), seg=24, ring=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=ring, radius=r, location=(x, -z, y), rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = scale
    ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def torus(name, major, minor, x, z, y, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
                                     major_segments=40, minor_segments=8,
                                     location=(x, -z, y), rotation=rot)
    ob = bpy.context.active_object
    ob.name = name
    ob.data.materials.append(m)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob


def point_light(loc, power, color, radius=0.08, name='pl'):
    d = bpy.data.lights.new(name, 'POINT')
    d.energy = power
    d.color = color
    d.shadow_soft_size = radius
    o = bpy.data.objects.new(name, d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    return o


# ---------------------------------------------------------------- architecture
clear_scene()
LEVEL_H = max([n['height'] for n in NODES.values() if n['type'] == 'wall'] or [2.95])

M_OUT = plain_mat('Outdoor', '#b9b5ab', 0.95)
bpy.ops.mesh.primitive_plane_add(size=90, location=(6.5, -5.5, -0.06))
ground = bpy.context.active_object
ground.name = 'Ground'
ground.data.materials.append(M_OUT)

for node in NODES.values():
    if node['type'] == 'slab':
        poly = node['polygon']
        n = len(poly)
        verts = [(p[0], -p[1], node.get('elevation', 0.0)) for p in poly] + \
                [(p[0], -p[1], node.get('elevation', 0.0) - node.get('thickness', 0.05)) for p in poly]
        faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
        mesh_obj(node['id'], verts, faces, plain_mat('SlabBase', '#8d8578', 0.95))


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
            box('sill_' + cid, (cx, -cz, cy - hh / 2 - 0.02), (w + 0.08, th + 0.06, 0.04), ang, M_JOIN)
            box('head_' + cid, (cx, -cz, cy + hh / 2 + 0.02), (w + 0.08, th + 0.04, 0.05), ang, M_METAL_DARK)
            for side in (-0.5, 0.5):
                jx = cx + (dx / length) * (w / 2) * side
                jz = cz + (dz / length) * (w / 2) * side
                box('jamb_w_' + cid + str(side), (jx, -jz, cy), (0.05, th + 0.04, hh), ang, M_METAL_DARK)
            for dy in (-0.5, 0.5):
                box('fr_' + cid + str(dy), (cx, -cz - dy * 0.06, cy - hh / 2 + 0.03), (w, 0.06, 0.06), ang, M_METAL_DARK)
        else:
            box('frame_' + cid, (cx, -cz, cy + hh / 2), (w + 0.1, th + 0.06, 0.05), ang, M_JOIN)
            # 门套：两侧竖框
            for side in (-0.5, 0.5):
                jx = cx + (dx / length) * (w / 2) * side
                jz = cz + (dz / length) * (w / 2) * side
                box('jamb_' + cid + str(side), (jx, -jz, hh / 2 + 0.02),
                    (0.06, th + 0.05, hh + 0.04), ang, M_JOIN)


for node in NODES.values():
    if node['type'] == 'wall':
        build_wall(node)


def add_skirting():
    for node in NODES.values():
        if node['type'] != 'wall':
            continue
        sx, sz = node['start']; ex, ez = node['end']
        dx, dz = ex - sx, ez - sz
        L = math.hypot(dx, dz)
        if L < 0.3:
            continue
        dirx, dirz = dx / L, dz / L
        nx, nz = -dirz, dirx
        ang = math.atan2(-dz, dx)
        th = node['thickness']
        holes = []
        for cid in node.get('children', []):
            c = NODES.get(cid)
            if c and c['type'] == 'door':
                p = c['position'][0]
                holes.append((p - c['width'] / 2 - 0.04, p + c['width'] / 2 + 0.04))
        holes.sort()
        segs = []
        cur = 0.04
        for a, b in holes:
            if a - cur > 0.12:
                segs.append((cur, a))
            cur = max(cur, b)
        if L - 0.04 - cur > 0.12:
            segs.append((cur, L - 0.04))
        for t0, t1 in segs:
            tm = (t0 + t1) / 2
            seg_len = t1 - t0
            for side in (-1, 1):
                off = th / 2 + 0.015
                cx = sx + dirx * tm + nx * off * side
                cz = sz + dirz * tm + nz * off * side
                box('skirt', (cx, -cz, 0.04), (seg_len, 0.025, 0.08), ang, M_JOIN)


add_skirting()

# 地面：全屋通铺 750x1500 柔光地砖
ZONE_NAME = {n['id']: n.get('name', '') for n in NODES.values() if n['type'] == 'zone'}
WET = ('公共卫生间', '主卫', '封闭阳台', '露台')
FLOOR_Z = 0.055
fixtures = 0
for node in list(NODES.values()):
    if node['type'] != 'ceiling':
        continue
    poly = node['polygon']
    room = ZONE_NAME.get(node.get('zoneId'), '')
    mat_floor = M_TILE_WET if any(k in room for k in WET) else M_TILE
    n = len(poly)
    verts = [(p[0], -p[1], FLOOR_Z) for p in poly] + [(p[0], -p[1], FLOOR_Z - 0.01) for p in poly]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    mesh_obj('floor_' + node['id'], verts, faces, mat_floor)

    xs = [p[0] for p in poly]; zs = [p[1] for p in poly]
    x0, x1 = min(xs), max(xs); z0, z1 = min(zs), max(zs)
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    if '客厅' in room:
        # 回字形吊顶 + 灯带
        n = len(poly)
        verts = [(p[0], -p[1], LEVEL_H) for p in poly] + [(p[0], -p[1], LEVEL_H - 0.02) for p in poly]
        faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
        mesh_obj('ceil_' + node['id'], verts, faces, M_CEIL)
        bw = 0.45; drop = 0.22
        for (ax, az, sx, sz) in [
            (cx, z0 + bw / 2, x1 - x0, bw),
            (cx, z1 - bw / 2, x1 - x0, bw),
            (x0 + bw / 2, cz, bw, z1 - z0 - 2 * bw),
            (x1 - bw / 2, cz, bw, z1 - z0 - 2 * bw),
        ]:
            fb('tray', sx, sz, drop, ax, az, LEVEL_H - drop, M_CEIL)
        ins = bw + 0.06
        for (ax, az, sx, sz) in [
            (cx, z0 + ins, x1 - x0 - 2 * ins, 0.04),
            (cx, z1 - ins, x1 - x0 - 2 * ins, 0.04),
            (x0 + ins, cz, 0.04, z1 - z0 - 2 * ins),
            (x1 - ins, cz, 0.04, z1 - z0 - 2 * ins),
        ]:
            fb('cove', sx, sz, 0.02, ax, az, LEVEL_H - drop + 0.01, M_COVE)
        n_dl = 6
    else:
        n = len(poly)
        verts = [(p[0], -p[1], LEVEL_H) for p in poly] + [(p[0], -p[1], LEVEL_H - 0.02) for p in poly]
        faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        for i in range(n):
            j = (i + 1) % n
            faces.append((i, j, n + j, n + i))
        mesh_obj('ceil_' + node['id'], verts, faces, M_CEIL)
        n_dl = 2 if any(k in room for k in ('卧室',)) else (1 if '厨房' not in room else 0)
    for i in range(n_dl):
        fx = x0 + (x1 - x0) * (i + 1) / (n_dl + 1)
        fz = cz + ((z1 - z0) * 0.18 if n_dl > 2 else 0)
        cyl('dl_' + node['id'] + str(i), 0.055, 0.012, fx, fz, LEVEL_H - 0.028, M_LIGHT, verts=20)
        fixtures += 1

print('architecture/floors built, style=', STYLE)

# ---------------------------------------------------------------- decor helpers
def art_x(name, x, z, y, w, h, face, colors):
    # 画框、画布与抽象色块，法线朝向 ±X
    fb(name + '_frame', 0.045, w, h, x + face * 0.02, z, y - h / 2, M_WOOD_DARK)
    fb(name + '_canvas', 0.02, w - 0.09, h - 0.09, x + face * 0.045, z, y - h / 2 + 0.045, M_LINEN)
    cx = x + face * 0.058
    # 两三个错落的色块
    specs = [
        (-0.22, 0.18, 0.42, 0.38, colors[0]),
        (0.20, -0.05, 0.30, 0.55, colors[1]),
        (-0.02, -0.22, 0.22, 0.22, colors[2]),
    ]
    for i, (dz, dy, sw, sh, col) in enumerate(specs):
        m = plain_mat(name + '_c%d' % i, col, 0.85)
        fb(name + '_shape%d' % i, 0.004, sw * w, sh * h, cx, z + dz * w, y + dy * h - (sh * h) / 2, m)
    cyl_at(name + '_dot', min(w, h) * 0.09, 0.004, (cx, -z - 0.22 * w, y + 0.18 * h), plain_mat(name + '_c3', colors[3], 0.8),
           rot=(0, math.pi / 2, 0), verts=32)


def art_z(name, x, z, y, w, h, face, colors):
    fb(name + '_frame', w, 0.045, h, x, z + face * 0.02, y - h / 2, M_WOOD_DARK)
    fb(name + '_canvas', w - 0.09, 0.02, h - 0.09, x, z + face * 0.045, y - h / 2 + 0.045, M_LINEN)
    cz = z + face * 0.058
    specs = [
        (-0.20, 0.16, 0.44, 0.40, colors[0]),
        (0.18, -0.06, 0.32, 0.50, colors[1]),
        (0.0, -0.24, 0.20, 0.20, colors[2]),
    ]
    for i, (dx, dy, sw, sh, col) in enumerate(specs):
        m = plain_mat(name + '_c%d' % i, col, 0.85)
        fb(name + '_shape%d' % i, sw * w, 0.004, sh * h, x + dx * w, cz, y + dy * h - (sh * h) / 2, m)
    cyl_at(name + '_dot', min(w, h) * 0.09, 0.004, (x + 0.2 * w, -cz, y + 0.16 * h), plain_mat(name + '_c3', colors[3], 0.8),
           rot=(math.pi / 2, 0, 0), verts=32)


def rug(name, x, z, sx, sz, fringe=False):
    fb(name, sx, sz, 0.016, x, z, 0.071, M_RUG)
    fb(name + '_edge1', sx, 0.045, 0.008, x, z - sz / 2 + 0.03, 0.082, M_RUG_EDGE)
    fb(name + '_edge2', sx, 0.045, 0.008, x, z + sz / 2 - 0.03, 0.082, M_RUG_EDGE)
    fb(name + '_edge3', 0.045, sz, 0.008, x - sx / 2 + 0.03, z, 0.082, M_RUG_EDGE)
    fb(name + '_edge4', 0.045, sz, 0.008, x + sx / 2 - 0.03, z, 0.082, M_RUG_EDGE)
    if fringe:
        n = max(8, int(sx / 0.11))
        for i in range(n):
            fx = x - sx / 2 + sx * (i + 0.5) / n
            fb(name + '_f1%d' % i, 0.018, 0.06, 0.005, fx, z - sz / 2 - 0.03, 0.071, M_LINEN)
            fb(name + '_f2%d' % i, 0.018, 0.06, 0.005, fx, z + sz / 2 + 0.03, 0.071, M_LINEN)


def plant(name, x, z, size=1.0, pot=None, leaf=None):
    pot_m = plain_mat(name + '_pot', pot or S['pot'], 0.72)
    leaf_m = plain_mat(name + '_leaf', leaf or S['leaf'], 0.62)
    leaf2_m = plain_mat(name + '_leaf2', leaf or S['leaf2'], 0.68)
    cyl(name + '_pot', 0.17 * size, 0.32 * size, x, z, 0, pot_m, verts=28)
    cyl(name + '_soil', 0.155 * size, 0.02 * size, x, z, 0.30 * size, M_WOOD_DARK, verts=28)
    stems = 7
    for i in range(stems):
        ang = random.uniform(0, math.tau)
        rr = random.uniform(0.02, 0.10) * size
        hh = random.uniform(0.55, 1.15) * size
        sx = x + math.cos(ang) * rr
        sz = z + math.sin(ang) * rr
        cyl(name + '_stem%d' % i, 0.006 * size, hh, sx, sz, 0.30 * size, M_WOOD_DARK, verts=8)
        nleaf = random.randint(3, 5)
        for j in range(nleaf):
            t = (j + 1) / (nleaf + 1)
            lx = sx + math.cos(ang + random.uniform(-0.6, 0.6)) * 0.13 * size * (0.4 + t)
            lz = sz + math.sin(ang + random.uniform(-0.6, 0.6)) * 0.13 * size * (0.4 + t)
            ly = 0.30 * size + hh * t
            ob = sphere(name + '_l%d_%d' % (i, j), 0.12 * size, lx, lz, ly, leaf_m if j % 2 else leaf2_m,
                        scale=(1.0, 0.16, 0.55), rot=(random.uniform(-0.5, 0.5), random.uniform(-0.4, 0.4), ang))
    return


def table_lamp(name, x, z, y0, shade_color=None):
    shade_color = shade_color or S['lamp']
    shade_m = fabric_mat(name + '_shade', shade_color, 0.9, 0.02, 80)
    cyl(name + '_base', 0.06, 0.025, x, z, y0, M_METAL, verts=24)
    cyl(name + '_stem', 0.012, 0.24, x, z, y0 + 0.02, M_METAL, verts=12)
    cone(name + '_shade', 0.15, 0.11, 0.20, x, z, y0 + 0.23, shade_m, verts=28)
    cyl(name + '_glow', 0.10, 0.006, x, z, y0 + 0.235, M_LIGHT, verts=20)
    point_light((x, -z, y0 + 0.32), 7.0, S['warm_light'], 0.15, name + '_light')


def books(name, x, z, y, along='z', n=7, width=0.55):
    sp = width / n
    for i in range(n):
        h = random.uniform(0.20, 0.30)
        w = sp * random.uniform(0.55, 0.82)
        col = random.choice([S['accent3'], S['accent2'], S['stone_vein'], S['art1'], S['art3'], '#e7ded0'])
        m = plain_mat(name + '_b%d' % i, col, 0.85)
        if along == 'z':
            fb(name + '_book%d' % i, 0.20, w, h, x, z - width / 2 + sp * (i + 0.5), y, m)
        else:
            fb(name + '_book%d' % i, w, 0.20, h, x - width / 2 + sp * (i + 0.5), z, y, m)


def vase(name, x, z, y0, h=0.25, color=None, branches=3):
    m = plain_mat(name + '_v', color or S['stone_vein'], 0.4)
    cyl(name + '_body', 0.055, h * 0.75, x, z, y0, m, verts=24)
    cone(name + '_neck', 0.035, 0.028, h * 0.25, x, z, y0 + h * 0.75, m, verts=20)
    for i in range(branches):
        ang = random.uniform(-0.5, 0.5)
        cyl_at(name + '_br%d' % i, 0.004, h * 0.9, (x + math.sin(ang) * 0.05, -z, y0 + h + h * 0.35), M_WOOD_DARK,
               rot=(ang, random.uniform(-0.4, 0.4), 0), verts=6)


def bowl(name, x, z, y0, r=0.14, color='#e9e3d7'):
    m = plain_mat(name + '_m', color, 0.32)
    cone(name + '_b', r, r * 0.55, 0.06, x, z, y0, m, verts=32)


def tv_and_console():
    fb('tvwall', 0.05, 2.60, 2.55, 3.87, 8.20, 0, M_STONE)
    fb('tvwall_gap', 0.06, 0.02, 2.50, 3.90, 6.89, 0, M_METAL_DARK)
    fb('tvpanel', 0.045, 1.52, 0.86, 3.955, 8.20, 1.02, M_BLACK_GLASS)
    fb('tvframe', 0.05, 1.58, 0.92, 3.925, 8.20, 0.99, M_METAL_DARK)
    fb('tv_screen', 0.012, 1.46, 0.80, 3.975, 8.20, 1.05, M_SCREEN)
    # 悬空电视柜
    fb('tvcons', 0.40, 2.05, 0.34, 4.12, 8.20, 0.25, M_JOIN)
    fb('tvcons_gap', 0.42, 1.98, 0.012, 4.12, 8.20, 0.60, M_JOIN_D)
    fb('tvcons_led', 0.36, 1.90, 0.012, 4.12, 8.20, 0.238, M_LED)
    fb('tvcons_handle', 0.02, 1.10, 0.018, 4.33, 8.20, 0.40, M_METAL_DARK)
    fb('soundbar', 0.10, 0.92, 0.07, 4.05, 8.20, 0.68, M_METAL_DARK)
    # 台面陈设
    bowl('cons_bowl', 4.12, 7.55, 0.60, 0.10, S['stone_vein'])
    books('cons_books', 4.10, 8.55, 0.60, along='z', n=4, width=0.30)
    vase('cons_vase', 4.12, 8.90, 0.60, 0.22, S['stone_vein'], 2)
    plant('cons_plant', 4.14, 7.90, 0.42, S['pot'], S['leaf'])
    # 电视墙两侧木格栅
    for zz in (6.96, 9.44):
        for i in range(5):
            fb('slat', 0.035, 0.035, 2.45, 3.91, zz + (i - 2) * 0.075, 0.02, M_WOOD_DARK)


def sofa():
    # 三人位，面向西侧电视墙；背靠东侧
    rb('sofa_base', 0.88, 2.30, 0.30, 7.38, 8.35, 0.12, M_FAB, 0.04, smooth=False)
    rb('sofa_back', 0.17, 2.30, 0.62, 7.76, 8.35, 0.30, M_FAB, 0.05, smooth=False)
    for zz in (7.30, 9.40):
        rb('sofa_arm', 0.90, 0.16, 0.52, 7.38, zz, 0.28, M_FAB, 0.05, smooth=False)
    for zz in (7.82, 8.88):
        rb('sofa_seat', 0.64, 1.00, 0.20, 7.20, zz, 0.40, M_FAB2, 0.06)
        rb('sofa_bc', 0.16, 0.96, 0.44, 7.65, zz, 0.55, M_FAB2, 0.055)
    # 抱枕
    for i, (zz, m, rot) in enumerate([(7.45, M_ACCENT2, 0.18), (8.15, M_ACCENT3, -0.12), (9.18, M_ACCENT, 0.15)]):
        rb('sofa_pillow%d' % i, 0.14, 0.40, 0.38, 7.52, zz, 0.53, m, 0.06, rot)
    # 搭毯
    rb('sofa_throw', 0.52, 0.62, 0.035, 7.22, 9.08, 0.56, M_ACCENT, 0.01, 0.08)
    fb('sofa_throw_drop', 0.42, 0.035, 0.34, 7.08, 9.08, 0.34, M_ACCENT)
    for x, z in ((7.0, 7.3), (7.0, 9.4), (7.75, 7.3), (7.75, 9.4)):
        cyl('sofa_leg', 0.035, 0.14, x, z, 0.0, M_METAL_DARK, verts=12)


def coffee_table():
    rb('coffee_top', 0.70, 1.28, 0.055, 5.80, 8.35, 0.34, M_WOOD, 0.02, smooth=False)
    rb('coffee_shelf', 0.60, 1.12, 0.025, 5.80, 8.35, 0.14, M_WOOD_DARK, 0.01, smooth=False)
    for zz in (7.82, 8.88):
        for xx in (5.54, 6.06):
            cyl('coffee_leg', 0.018, 0.34, xx, zz, 0.0, M_METAL_DARK, verts=10)
    books('ct_books', 5.72, 8.62, 0.395, along='z', n=4, width=0.32)
    bowl('ct_bowl', 5.85, 8.02, 0.395, 0.11, S['stone_vein'])
    vase('ct_vase', 5.84, 8.92, 0.395, 0.22, S['lamp'], 4)


def living_extras():
    # 客厅地毯
    rug('living_rug', 6.35, 8.35, 3.55, 2.65, fringe=True)
    # 沙发近端搭毯
    rb('sofa_throw2', 0.52, 0.16, 0.28, 7.38, 7.30, 0.52, M_ACCENT2, 0.02)
    fb('sofa_throw2_drop', 0.30, 0.03, 0.30, 7.18, 7.30, 0.30, M_ACCENT2)
    # 沙发旁圆边几
    x, z = 8.52, 9.02
    cyl('side_top', 0.27, 0.035, x, z, 0.50, M_WOOD, verts=32)
    for i in range(3):
        a = math.tau * i / 3 + 0.3
        cyl('side_leg', 0.014, 0.50, x + math.cos(a) * 0.18, z + math.sin(a) * 0.18, 0, M_METAL_DARK, verts=10)
    books('side_books', x, z, 0.54, along='z', n=2, width=0.24)
    bowl('side_bowl', x, z + 0.02, 0.535, 0.07, S['stone_vein'])
    # 电视墙与阳台转角的绿植
    plant('living_plant', 4.28, 9.58, 0.82, S['pot'], S['leaf'])


def bedroom_lighting():
    area_light((1.55, -1.75, 2.75), 2.0, 26)
    area_light((4.45, -1.75, 2.75), 2.0, 26)
    area_light((12.0, -8.20, 2.75), 2.0, 22)
    area_light((6.70, -5.00, 2.75), 2.4, 18)


def floor_lamp():
    x, z = 8.58, 7.32
    cyl('fl_base', 0.09, 0.03, x, z, 0.06, M_METAL_DARK, verts=24)
    cyl('fl_pole', 0.012, 1.42, x, z, 0.09, M_METAL_DARK, verts=12)
    cone('fl_shade', 0.20, 0.15, 0.24, x, z, 1.50, M_LINEN, verts=28)
    cyl('fl_glow', 0.13, 0.006, x, z, 1.51, M_LIGHT, verts=20)
    point_light((x, -z, 1.56), 16.0, S['warm_light'], 0.2, 'fl_light')


def window_bench():
    # 南窗下坐凳，补足客厅坐席
    fb('wbench', 1.35, 0.42, 0.32, 8.90, 9.62, 0.06, M_WOOD)
    rb('wbench_cushion', 1.30, 0.38, 0.07, 8.90, 9.62, 0.38, M_FAB2, 0.02)
    for i, (dz, m) in enumerate([(-0.28, M_ACCENT3), (0.28, M_ACCENT2)]):
        rb('wbench_p%d' % i, 0.30, 0.12, 0.28, 8.90 + dz, 9.66, 0.42, m, 0.05, 0.08)


def pendant_living():
    x, z = 5.80, 8.35
    if STYLE == 'warm':
        cone('pend_shade', 0.30, 0.08, 0.28, x, z, 2.30, M_LINEN, verts=36)
        cyl('pend_cord', 0.006, 0.52, x, z, 2.55, M_METAL_DARK, verts=8)
        cyl('pend_glow', 0.16, 0.006, x, z, 2.31, M_LIGHT, verts=24)
        point_light((x, -z, 2.18), 18.0, S['warm_light'], 0.3, 'pend_living_light')
    elif STYLE == 'grey':
        torus('pend_ring', 0.40, 0.018, x, z, 2.34, M_METAL_DARK)
        torus('pend_glow_ring', 0.37, 0.008, x, z, 2.32, M_LIGHT)
        for i in range(3):
            a = math.tau * i / 3
            cyl('pend_rod', 0.006, 0.55, x + math.cos(a) * 0.36, z + math.sin(a) * 0.36, 2.40, M_METAL_DARK, verts=8)
        point_light((x, -z, 2.22), 20.0, S['warm_light'], 0.3, 'pend_living_light')
    else:
        for i, (dx, dz, yy) in enumerate([(-0.16, 0.0, 2.26), (0.14, 0.10, 2.38), (0.02, -0.14, 2.50)]):
            sphere('pend_glass%d' % i, 0.11, x + dx, z + dz, yy, M_GLASS, scale=(1, 1, 1), seg=24, ring=12)
            sphere('pend_core%d' % i, 0.045, x + dx, z + dz, yy, M_LIGHT, seg=16, ring=8)
            cyl('pend_cord%d' % i, 0.005, 2.95 - yy - 0.1, x + dx, z + dz, yy + 0.1, M_METAL_DARK, verts=8)
        point_light((x, -z, 2.25), 24.0, S['warm_light'], 0.35, 'pend_living_light')


def dining_sideboard():
    # 西墙餐区端景：主卧门旁的大盆栽，不遮挡门洞
    plant('dining_corner_plant', 3.55, 6.56, 1.05, S['pot'], S['leaf'])


def dining_set():
    # 2.4m 长桌，长轴南北
    x, z = 7.35, 5.55
    rug('dining_rug', x, z, 2.85, 3.25, fringe=True)
    rb('dtable_top', 1.02, 2.40, 0.055, x, z, 0.735, M_WOOD, 0.015, smooth=False)
    fb('dtable_apron', 0.90, 2.20, 0.06, x, z, 0.69, M_WOOD_DARK)
    for zz in (4.58, 6.52):
        for xx in (6.93, 7.77):
            cyl('dtable_leg', 0.028, 0.69, xx, zz, 0.0, M_WOOD_DARK, verts=16)
    # 桌旗 + 中心陈设
    fb('runner', 0.42, 2.60, 0.008, x, z, 0.795, M_LINEN)
    bowl('dtable_bowl', x, z - 0.30, 0.80, 0.16, S['stone_vein'])
    vase('dtable_vase', x, z + 0.36, 0.80, 0.34, S['lamp'], 5)
    for zz in (4.92, 6.18):
        cyl('candle', 0.025, 0.20, x, zz, 0.80, M_CERAMIC, verts=16)
        cyl('candle_flame', 0.012, 0.03, x, zz, 1.00, M_LIGHT, verts=10)
    # 六把餐椅
    for zz in (4.85, 5.55, 6.25):
        chair(6.35, zz, 1)
        chair(8.35, zz, -1)
    # 餐桌上方线性吊灯
    fb('d_pendant', 0.10, 1.50, 0.055, x, z, 1.98, M_METAL_DARK)
    fb('d_pendant_diff', 0.08, 1.40, 0.012, x, z, 1.948, M_LIGHT)
    for zz in (4.90, 6.20):
        cyl('d_pendant_rod', 0.006, 0.92, x, zz, 2.04, M_METAL_DARK, verts=8)
    point_light((x, -z, 1.86), 18.0, S['warm_light'], 0.25, 'dining_pendant')


def chair(x, z, face):
    # face=+1 面向东，-1 面向西；靠背在背面
    back_x = x - face * 0.21
    rb('dchair_seat', 0.50, 0.48, 0.12, x, z, 0.42, M_FAB, 0.035)
    rb('dchair_back', 0.09, 0.46, 0.38, back_x, z, 0.50, M_FAB, 0.05)
    for dz in (-0.20, 0.20):
        fb('dchair_stile', 0.045, 0.035, 0.44, back_x, z + dz, 0.45, M_WOOD_DARK)
    for dz in (-0.17, 0.17):
        for dx in (-0.17, 0.17):
            cyl('dchair_leg', 0.018, 0.42, x + dx, z + dz, 0.0, M_WOOD_DARK, verts=10)


def kitchen():
    # 北墙一字型橱柜
    x0, x1 = 6.12, 8.62
    zc = 0.40
    cx = (x0 + x1) / 2
    width = x1 - x0
    base_mat = M_JOIN if STYLE != 'dark' else M_WOOD
    top_mat = M_STONE_SOFT
    fb('k_toe', width, 0.52, 0.10, cx, zc, 0.0, M_METAL_DARK)
    fb('k_body', width, 0.60, 0.82, cx, zc, 0.10, base_mat)
    # 柜门分缝
    n = 4
    step = width / n
    for i in range(n):
        dx = x0 + step * (i + 0.5)
        fb('k_door%d' % i, step - 0.02, 0.02, 0.72, dx, zc + 0.305, 0.15, base_mat)
        fb('k_handle%d' % i, 0.18, 0.018, 0.018, dx, zc + 0.322, 0.76, M_METAL)
    fb('k_counter', width + 0.06, 0.66, 0.045, cx, zc + 0.01, 0.92, top_mat)
    # 水槽
    fb('k_sink', 0.56, 0.40, 0.012, 6.72, zc, 0.962, M_STEEL)
    fb('k_sink_in', 0.46, 0.30, 0.005, 6.72, zc, 0.969, M_BLACK_GLASS)
    cyl('k_faucet', 0.018, 0.30, 6.72, zc + 0.25, 0.95, M_STEEL, verts=16)
    cyl_at('k_spout', 0.012, 0.24, (6.72, -(zc + 0.18), 1.22), M_STEEL, rot=(0, math.pi / 2, 0), verts=10)
    # 灶台
    fb('k_hob', 0.62, 0.48, 0.012, 7.78, zc, 0.962, M_BLACK_GLASS)
    for dx in (-0.14, 0.14):
        for dz in (-0.11, 0.11):
            torus('k_burner', 0.065, 0.004, 7.78 + dx, zc + dz, 0.972, M_METAL_DARK)
    # 吊柜
    fb('k_upper', 1.45, 0.35, 0.78, 6.86, 0.245, 1.55, M_JOIN2)
    for dx in (6.62, 7.10):
        fb('k_up_rev', 0.012, 0.012, 0.70, dx, 0.425, 1.59, M_METAL_DARK)
    for dx in (6.62, 7.10):
        fb('k_up_handle', 0.012, 0.02, 0.20, dx, 0.432, 1.60, M_METAL)
    fb('k_upled', 1.40, 0.02, 0.012, 6.86, 0.43, 1.535, M_LED)
    # 烟机
    fb('k_hood', 0.72, 0.50, 0.10, 7.78, 0.38, 1.75, M_STEEL)
    fb('k_chimney', 0.32, 0.28, 0.85, 7.78, 0.32, 1.85, M_STEEL)
    # 背板
    fb('k_backsplash', width, 0.02, 0.56, cx, 0.075, 0.95, M_BACK)
    # 台面陈设
    fb('k_board', 0.30, 0.20, 0.018, 7.25, 0.58, 0.985, M_WOOD)
    cyl('k_jar1', 0.045, 0.15, 6.22, 0.58, 0.985, M_CERAMIC, verts=20)
    cyl('k_jar2', 0.036, 0.20, 6.34, 0.60, 0.985, M_CERAMIC_DARK, verts=20)
    # 窗下咖啡角
    fb('k_coffee', 0.34, 0.30, 0.34, 8.38, 0.44, 0.985, M_STEEL)
    fb('k_coffee_top', 0.36, 0.32, 0.03, 8.38, 0.44, 1.325, M_METAL_DARK)
    for i in range(2):
        cyl('k_cup%d' % i, 0.045, 0.09, 8.18 + i * 0.10, 0.30, 0.985, M_CERAMIC, verts=18)
    # 窗台香草盆栽
    cyl('k_herb_pot', 0.065, 0.12, 8.62, 0.24, 0.985, M_POT, verts=20)
    for i in range(7):
        sphere('k_herb_leaf%d' % i, 0.075, 8.62 + (i % 3 - 1) * 0.045, 0.24 + (i // 3 - 0.5) * 0.04,
               1.11 + (i % 2) * 0.035, M_LEAF if i % 2 else M_LEAF2, scale=(1, 0.8, 0.6), seg=12, ring=8)
    bowl('k_fruit', 7.20, 0.56, 0.985, 0.11, S['stone_vein'])
    for i in range(3):
        sphere('k_orange%d' % i, 0.045, 7.18 + (i - 1) * 0.07, 0.56 + (i % 2) * 0.05, 1.04, plain_mat('orange', '#d18a41', 0.5), seg=16, ring=8)
    cyl('k_kettle', 0.075, 0.17, 7.24, 0.28, 0.985, M_METAL_DARK, verts=24)
    # 冰箱：东墙，双开门 + 高柜围合
    fx = 9.86; fz = 2.48
    fb('fridge_body', 0.86, 0.72, 1.98, fx, fz, 0.02, M_STEEL)
    fb('fridge_gap', 0.02, 0.74, 0.012, fx - 0.435, fz, 1.02, M_METAL_DARK)
    for dz in (-0.16, 0.16):
        fb('fridge_handle', 0.016, 0.018, 0.65, fx - 0.448, fz + dz, 0.75, M_METAL)
    fb('fridge_top_cab', 0.86, 0.72, 0.55, fx, fz, 2.05, M_JOIN2)
    for zz in (2.10, 2.86):
        fb('fridge_side', 0.82, 0.03, 2.30, fx, zz, 0, M_JOIN2)
    # 高柜/储藏柜
    px, pz = 10.02, 1.24
    fb('k_pantry_body', 0.60, 0.95, 2.30, px, pz, 0, M_JOIN2)
    for dz in (-0.24, 0.24):
        fb('k_pantry_door', 0.02, 0.45, 2.20, px - 0.305, pz + dz, 0.05, M_JOIN2)
        fb('k_pantry_handle', 0.02, 0.018, 0.40, px - 0.322, pz + dz * 0.10, 0.95, M_METAL)
    fb('k_pantry_gap', 0.018, 0.012, 2.20, px - 0.312, pz, 0.05, M_METAL_DARK)
    fb('k_pantry_top', 0.62, 0.97, 0.03, px, pz, 2.30, M_JOIN2)
    # 高柜内嵌烤箱
    fb('k_oven', 0.02, 0.56, 0.42, px - 0.316, pz, 1.26, M_BLACK_GLASS)
    fb('k_oven_handle', 0.02, 0.46, 0.02, px - 0.330, pz, 1.64, M_STEEL)
    fb('k_oven_trim', 0.022, 0.58, 0.012, px - 0.317, pz, 1.24, M_STEEL)
    # 水槽旁：皂液器 + 沥水盘
    cyl('k_soap', 0.028, 0.14, 6.42, 0.62, 0.985, M_CERAMIC_DARK, verts=16)
    cyl('k_soap_pump', 0.008, 0.05, 6.42, 0.62, 1.125, M_METAL, verts=8)
    fb('k_dishrack', 0.34, 0.26, 0.015, 7.18, 0.56, 0.985, M_METAL_DARK)
    for i, dx in enumerate((-0.08, 0.0, 0.08)):
        cyl('k_plate%d' % i, 0.085, 0.012, 7.16 + dx, 0.55, 1.00, M_CERAMIC, verts=24)


def wardrobes():
    # 主卧衣柜：西墙，门朝东
    x, z = 0.36, 7.45
    fb('wardM_body', 0.60, 1.90, 2.40, x, z, 0, M_WARD)
    for dz in (-0.475, 0.475):
        fb('wardM_door', 0.02, 0.92, 2.30, x + 0.305, z + dz, 0.05, M_WARD)
        fb('wardM_gap', 0.018, 0.012, 2.30, x + 0.312, z + dz + 0.46, 0.05, M_METAL_DARK)
        fb('wardM_handle', 0.02, 0.02, 0.55, x + 0.325, z + dz * 0.06, 0.95, M_METAL)
        for off in (-0.40, 0.40):
            fb('wardM_panelv', 0.012, 0.012, 1.98, x + 0.317, z + dz + off, 0.22, M_TRIM)
        for yy in (0.22, 2.18):
            fb('wardM_panelh', 0.012, 0.80, 0.012, x + 0.317, z + dz, yy, M_TRIM)
    fb('wardM_top', 0.02, 1.86, 0.025, x + 0.31, z, 2.35, M_METAL_DARK)
    fb('wardM_bottom', 0.02, 1.86, 0.018, x + 0.31, z, 0.10, M_METAL_DARK)
    fb('wardM_plinth', 0.54, 1.80, 0.08, x, z, 0.0, M_METAL_DARK)
    # 北次卧 A/B：南墙，门朝北
    for i, (cx, w) in enumerate([(1.01, 1.90), (3.90, 1.80)]):
        z = 3.14
        fb('wardN%d_body' % i, w, 0.60, 2.40, cx, z, 0, M_WARD)
        for s in (-1, 1):
            fb('wardN%d_door' % i, w / 2 - 0.03, 0.02, 2.30, cx + s * w / 4, z - 0.305, 0.05, M_WARD)
            fb('wardN%d_handle' % i, 0.02, 0.02, 0.55, cx + s * 0.04, z - 0.325, 0.95, M_METAL)
        fb('wardN%d_gap' % i, 0.012, 0.018, 2.30, cx, z - 0.312, 0.05, M_METAL_DARK)
        fb('wardN%d_top' % i, w - 0.04, 0.02, 0.025, cx, z - 0.31, 2.35, M_METAL_DARK)
        fb('wardN%d_plinth' % i, w - 0.10, 0.54, 0.08, cx, z, 0, M_METAL_DARK)
    # 南次卧：北墙，门朝南
    x, z = 12.20, 6.76
    fb('wardC_body', 1.60, 0.60, 2.40, x, z, 0, M_WARD)
    for s in (-1, 1):
        fb('wardC_door', 0.78, 0.02, 2.30, x + s * 0.395, z + 0.305, 0.05, M_WARD)
        fb('wardC_handle', 0.02, 0.02, 0.55, x + s * 0.04, z + 0.325, 0.95, M_METAL)
    fb('wardC_gap', 0.012, 0.018, 2.30, x, z + 0.312, 0.05, M_METAL_DARK)
    fb('wardC_top', 1.56, 0.02, 0.025, x, z + 0.31, 2.35, M_METAL_DARK)
    fb('wardC_plinth', 1.50, 0.54, 0.08, x, z, 0, M_METAL_DARK)


def bed(name, head, x, z, w, L=2.02, master=False):
    # head: 'N' 床头在北, 'W' 床头在西, 'E' 床头在东
    if head == 'N':
        d = (0, 1); across = (1, 0)
    elif head == 'W':
        d = (1, 0); across = (0, 1)
    else:
        d = (-1, 0); across = (0, 1)

    def bx(nm, a, b, h, t, y0, m, bevel=0.03, smooth=True):
        cx = x + d[0] * t + across[0] * 0
        cz = z + d[1] * t
        sx = a if d[0] != 0 else b
        sz = b if d[0] != 0 else a
        return rb(nm, sx, sz, h, cx, cz, y0, m, bevel, smooth=smooth)

    # 床头板
    hb_mat = M_FAB if not master else (M_WOOD_DARK if STYLE == 'dark' else M_FAB)
    bx(name + '_head', 0.12, w + 0.14, 1.12, -0.06, 0.10, hb_mat, 0.035)
    for k in (-0.32, 0.0, 0.32):
        if d[0] != 0:
            fb(name + '_channel%d' % int(k * 100), 0.015, 0.016, 0.92, x + d[0] * 0.012, z + k * w, 0.20, M_JOIN_D)
        else:
            fb(name + '_channel%d' % int(k * 100), 0.016, 0.015, 0.92, x + k * w, z + d[1] * 0.012, 0.20, M_JOIN_D)
    for s in (-1, 1):
        if d[0] != 0:
            fb(name + '_post%d' % s, 0.15, 0.10, 1.24, x, z + s * (w / 2 + 0.07), 0.05, M_WOOD_DARK)
        else:
            fb(name + '_post%d' % s, 0.10, 0.15, 1.24, x + s * (w / 2 + 0.07), z, 0.05, M_WOOD_DARK)
    # 床架、床垫
    bx(name + '_base', 1.94, w + 0.06, 0.26, 1.03, 0.10, M_FAB2, 0.03)
    bx(name + '_mattress', 2.00, w, 0.20, 1.02, 0.33, M_BED, 0.06)
    bx(name + '_plinth', 1.86, w - 0.06, 0.10, 1.03, 0.0, M_METAL_DARK, 0.01, smooth=False)
    # 被子
    bx(name + '_duvet', 1.45, w + 0.10, 0.12, 1.30, 0.50, M_BED, 0.06)
    for s in (-1, 1):
        if d[0] != 0:
            fb(name + '_drape%d' % s, 1.42, 0.05, 0.36, x + d[0] * 1.05, z + s * (w / 2 + 0.02), 0.28, M_BED)
        else:
            fb(name + '_drape%d' % s, 0.05, 1.42, 0.36, x + s * (w / 2 + 0.02), z + d[1] * 1.05, 0.28, M_BED)
    # 被头翻边 + 绗缝线
    if d[0] != 0:
        fb(name + '_fold', 0.20, w + 0.06, 0.03, x + d[0] * 0.78, z, 0.625, M_LINEN)
        for i, tt in enumerate((1.02, 1.30, 1.58)):
            fb(name + '_quilt%d' % i, 0.012, w + 0.06, 0.005, x + d[0] * tt, z, 0.623, M_LINEN)
    else:
        fb(name + '_fold', w + 0.06, 0.20, 0.03, x, z + d[1] * 0.78, 0.625, M_LINEN)
        for i, tt in enumerate((1.02, 1.30, 1.58)):
            fb(name + '_quilt%d' % i, w + 0.06, 0.012, 0.005, x, z + d[1] * tt, 0.623, M_LINEN)
    # 立枕 + 靠枕
    for s in (-1, 1):
        px = x + across[0] * s * (w * 0.22)
        pz = z + across[1] * s * (w * 0.22)
        if d[0] != 0:
            rb(name + '_spillow%d' % s, 0.16, w * 0.40, 0.46, x + d[0] * 0.21, pz, 0.54, M_BED, 0.06)
            rb(name + '_apillow%d' % s, 0.14, w * 0.26, 0.24, x + d[0] * 0.46, pz, 0.59, M_BED_ACCENT, 0.06)
        else:
            rb(name + '_spillow%d' % s, w * 0.40, 0.16, 0.46, px, z + d[1] * 0.21, 0.54, M_BED, 0.06)
            rb(name + '_apillow%d' % s, w * 0.26, 0.14, 0.24, px, z + d[1] * 0.46, 0.59, M_BED_ACCENT, 0.06)
    # 床尾搭毯（带垂边）
    tt = 1.56
    if d[0] != 0:
        fb(name + '_throw', 0.32, w + 0.04, 0.035, x + d[0] * tt, z, 0.625, M_BED_ACCENT)
        for s in (-1, 1):
            fb(name + '_throw_drop%d' % s, 0.32, 0.03, 0.30, x + d[0] * tt, z + s * (w / 2 + 0.02), 0.33, M_BED_ACCENT)
    else:
        fb(name + '_throw', w + 0.04, 0.32, 0.035, x, z + d[1] * tt, 0.625, M_BED_ACCENT)
        for s in (-1, 1):
            fb(name + '_throw_drop%d' % s, 0.03, 0.32, 0.30, x + s * (w / 2 + 0.02), z + d[1] * tt, 0.33, M_BED_ACCENT)


def nightstand(name, x, z, face):
    # face: 门/抽屉朝 ±X；这里用正面朝向床
    fb(name + '_body', 0.44, 0.42, 0.44, x, z, 0.08, M_WOOD)
    fb(name + '_top', 0.46, 0.44, 0.03, x, z, 0.52, M_STONE_SOFT)
    fb(name + '_drawer', 0.40, 0.02, 0.16, x, z + face * 0.212, 0.30, M_WOOD)
    fb(name + '_handle', 0.14, 0.015, 0.015, x, z + face * 0.225, 0.36, M_METAL)
    for dx in (-0.17, 0.17):
        for dz in (-0.16, 0.16):
            cyl(name + '_leg', 0.015, 0.08, x + dx, z + dz, 0, M_METAL_DARK, verts=8)
    table_lamp(name + '_lamp', x, z, 0.55)


def bedrooms():
    # 北次卧 A：床头靠北窗
    rug('rugA', 1.45, 1.55, 2.35, 1.80)
    bed('bedA', 'N', 1.56, 0.405, 1.50, 2.00)
    nightstand('nsA', 0.31, 0.34, 1)
    plant('plantA', 2.62, 2.95, 0.72, S['pot'], S['leaf'])
    art_x('artA', 0.03, 2.50, 1.72, 0.90, 0.66, 1, [S['art1'], S['art2'], S['art3'], S['art4']])
    # 北次卧 B：床头靠北窗
    rug('rugB', 4.25, 1.55, 2.35, 1.80)
    bed('bedB', 'N', 4.26, 0.405, 1.50, 2.00)
    nightstand('nsB', 5.51, 0.34, 1)
    plant('plantB', 3.18, 2.92, 0.70, S['pot'], S['leaf'])
    art_x('artBwest', 2.93, 1.70, 1.66, 0.75, 0.55, 1, [S['art2'], S['art3'], S['art1'], S['art4']])
    art_x('artB', 5.97, 1.75, 1.68, 0.90, 0.66, -1, [S['art2'], S['art1'], S['art3'], S['art4']])
    # 主卧：床头靠西墙
    rug('rugM', 1.72, 9.45, 2.90, 2.20)
    bed('bedM', 'W', 0.405, 9.40, 1.78, 2.05, master=True)
    nightstand('nsM', 0.31, 10.72, 1)
    plant('plantM', 3.50, 6.72, 0.88, S['pot'], S['leaf'])
    art_x('artM', 0.03, 9.38, 1.86, 1.35, 0.86, 1, [S['art1'], S['art2'], S['art3'], S['art4']])
    for zz in (8.55, 10.22):
        cyl_at('msconce_arm', 0.012, 0.13, (0.06, -zz, 1.60), M_METAL, rot=(0, math.pi / 2, 0), verts=8)
        cone('msconce_shade', 0.065, 0.035, 0.12, 0.12, zz, 1.50, M_LINEN, verts=20)
        point_light((0.18, -zz, 1.66), 4.0, S['warm_light'], 0.08, 'msconce')
    # 床尾凳
    rb('benchM_top', 0.42, 1.50, 0.10, 2.68, 9.40, 0.38, M_FAB2, 0.02)
    rb('benchM_cushion', 0.36, 1.42, 0.06, 2.68, 9.40, 0.48, M_ACCENT2, 0.02)
    for dz in (8.78, 10.02):
        for dx in (2.50, 2.86):
            cyl('benchM_leg', 0.018, 0.38, dx, dz, 0.0, M_METAL_DARK, verts=10)
    # 南次卧：床头靠东墙
    rug('rugC', 12.12, 8.55, 2.40, 1.90)
    bed('bedC', 'E', 13.175, 8.55, 1.50, 2.00)
    nightstand('nsC', 13.29, 7.28, 1)
    plant('plantC', 10.85, 9.45, 0.7, S['pot'], S['leaf'])
    art_x('artC', 13.57, 8.55, 1.86, 1.20, 0.80, -1, [S['art2'], S['art3'], S['art1'], S['art4']])


def study():
    # 东墙书墙 + 书桌（避让南次卧门）
    zc = 8.68
    fb('shelf_back', 0.10, 2.30, 2.20, 10.30, zc, 0, M_WOOD)
    for sy in (0.35, 0.75, 1.15, 1.55, 1.95):
        fb('shelf', 0.32, 2.30, 0.03, 10.14, zc, sy, M_WOOD)
    fb('shelf_n', 0.32, 0.03, 2.20, 10.14, zc - 1.15, 0, M_WOOD)
    fb('shelf_s', 0.32, 0.03, 2.20, 10.14, zc + 1.15, 0, M_WOOD)
    for shelf_y in (0.35, 0.75, 1.15, 1.55, 1.95):
        books('shelf_books%d' % int(shelf_y * 100), 10.16, zc - 0.62, shelf_y + 0.03, along='z', n=7, width=0.58)
        if shelf_y in (0.75, 1.55):
            vase('shelf_vase%d' % int(shelf_y * 100), 10.17, zc + 0.52, shelf_y + 0.03, 0.24, S['stone_vein'], 2)
        else:
            bowl('shelf_bowl%d' % int(shelf_y * 100), 10.17, zc + 0.56, shelf_y + 0.03, 0.09, S['stone_vein'])
    fb('shelf_led', 0.02, 2.20, 0.012, 10.31, zc, 2.17, M_LED)
    # 书桌
    rb('desk_top', 0.62, 1.55, 0.04, 9.55, zc, 0.73, M_WOOD, 0.01, smooth=False)
    fb('desk_apron', 0.54, 1.44, 0.07, 9.55, zc, 0.66, M_WOOD_DARK)
    for dz in (8.09, 9.27):
        for dx in (9.35, 9.75):
            cyl('desk_leg', 0.02, 0.73, dx, dz, 0.0, M_METAL_DARK, verts=10)
    # 桌面：笔记本、台灯、笔筒
    fb('laptop_base', 0.26, 0.20, 0.012, 9.55, 8.40, 0.77, M_METAL_DARK)
    fb('laptop_screen', 0.012, 0.28, 0.20, 9.43, 8.40, 0.78, M_BLACK_GLASS)
    cyl('pen_pot', 0.035, 0.11, 9.58, 8.95, 0.77, M_CERAMIC, verts=18)
    cyl('desk_lamp_base', 0.05, 0.015, 9.64, 9.15, 0.77, M_METAL_DARK, verts=18)
    cyl('desk_lamp_stem', 0.008, 0.34, 9.64, 9.15, 0.78, M_METAL_DARK, verts=8)
    cone('desk_lamp_shade', 0.09, 0.05, 0.09, 9.64, 9.02, 1.08, M_LINEN, rot=(0.4, 0, 0), verts=20)
    point_light((9.62, -9.0, 1.10), 5.0, S['warm_light'], 0.1, 'desk_lamp')    # 书桌椅
    chair(9.00, zc, 1)


def curtains():
    def pair(name, cx, z, w, axis='x', sheer=True):
        for s in (-1, 1):
            x0 = cx + s * (w / 2 + 0.22)
            if axis == 'x':
                # 沿 X 方向的一对帘（窗在南北墙）
                for i in range(6):
                    fb(name + '_fold%d%d' % (s, i), 0.088, 0.09, 2.62,
                       x0 - 0.24 + i * 0.083, z + (0.012 if i % 2 else 0.0), 0.06, M_LINEN)
                fb(name + '_rail%d' % s, 0.55, 0.035, 0.035, x0, z + 0.03, 2.73, M_METAL_DARK)
            if sheer:
                if axis == 'x':
                    fb(name + '_sheer%d' % s, w, 0.012, 2.55, cx, z + 0.045, 0.08, M_SHEER)
                else:
                    fb(name + '_sheer%d' % s, 0.012, w, 2.55, 3.83, z, 0.08, M_SHEER)
    # 北次卧两间
    pair('curA', 1.45, 0.12, 1.50)
    pair('curB', 4.45, 0.12, 1.50)
    # 主卧南窗
    pair('curM', 1.90, 10.86, 1.60)
    # 南次卧南窗
    pair('curC', 12.00, 9.77, 1.50)
    # 封闭阳台：两侧帘 + 通长纱帘
    for x0 in (4.05, 10.15):
        for i in range(6):
            fb('curBal_fold%d%d' % (int(x0 * 10), i), 0.088, 0.09, 2.62, x0 - 0.22 + i * 0.083, 10.82 + (0.012 if i % 2 else 0.0), 0.06, M_LINEN)
    fb('curBal_rail', 6.30, 0.035, 0.035, 7.10, 10.88, 2.73, M_METAL_DARK)


def balcony():
    # 洗烘柜，藏在西侧
    x = 4.55; z = 10.50
    fb('laundry_body', 1.35, 0.62, 2.30, x, z, 0, M_JOIN)
    fb('laundry_front_top', 1.33, 0.03, 1.45, x, z - 0.315, 0.86, M_JOIN)
    fb('laundry_gap', 0.012, 0.03, 1.40, x, z - 0.32, 0.89, M_METAL_DARK)
    fb('laundry_handle', 0.16, 0.02, 0.02, x - 0.28, z - 0.34, 1.40, M_METAL)
    fb('laundry_top', 1.38, 0.64, 0.035, x, z, 2.30, M_STONE_SOFT)
    # 阳台花池
    fb('bal_planter', 3.00, 0.28, 0.42, 6.95, 10.54, 0.0, M_POT)
    for i in range(11):
        x = 5.60 + i * 0.27
        z = 10.54 + (i % 3 - 1) * 0.05
        h = 0.24 + (i % 5) * 0.06
        cyl('bal_stem%d' % i, 0.010, h + 0.18, x, z, 0.40, M_WOOD_DARK, verts=6)
        for j in range(3):
            bx_ = x + math.sin(i * 1.7 + j * 2.1) * 0.13
            bz_ = z + math.cos(i * 1.3 + j * 1.9) * 0.08
            by_ = 0.52 + h * (0.25 + j * 0.28)
            sphere('bal_leaf%d_%d' % (i, j), 0.115, bx_, bz_, by_,
                   M_LEAF if (i + j) % 2 else M_LEAF2,
                   scale=(1.15, 0.55, 0.55), rot=(0.3 * j, 0.5 * i, 0.8 * j), seg=12, ring=8)
    plant('bal_plant1', 9.35, 10.45, 0.90, S['pot'], S['leaf'])
    plant('bal_plant2', 9.88, 10.62, 0.62, S['pot'], S['leaf2'])
    # 露台
    plant('terr_plant1', 12.55, 10.42, 0.85, S['pot'], S['leaf'])
    plant('terr_plant2', 10.90, 10.55, 0.6, S['pot'], S['leaf2'])


def bathrooms():
    # 公卫干区
    x, z = 3.05, 3.84
    fb('vanity1', 1.20, 0.50, 0.82, x, z, 0, M_JOIN)
    fb('vanity1_top', 1.24, 0.54, 0.035, x, z, 0.82, M_STONE_SOFT)
    fb('vanity1_basin', 0.56, 0.34, 0.12, x, z, 0.855, M_CERAMIC)
    cyl('vanity1_faucet', 0.014, 0.24, x, z - 0.18, 0.86, M_STEEL, verts=12)
    fb('mirror1', 1.00, 0.03, 0.90, x, z - 0.27, 1.15, M_MIRROR)
    fb('mirror1_frame', 1.04, 0.025, 0.94, x, z - 0.285, 1.13, M_METAL)
    # 主卫
    x, z = 1.45, 5.10
    fb('vanity2', 0.90, 0.48, 0.82, x, z, 0, M_JOIN)
    fb('vanity2_top', 0.94, 0.52, 0.035, x, z, 0.82, M_STONE_SOFT)
    fb('vanity2_basin', 0.44, 0.30, 0.12, x, z, 0.855, M_CERAMIC)
    cyl('vanity2_faucet', 0.014, 0.24, x, z - 0.17, 0.86, M_STEEL, verts=12)
    fb('mirror2', 0.80, 0.03, 0.85, x, z - 0.26, 1.12, M_MIRROR)
    fb('mirror2_frame', 0.84, 0.025, 0.89, x, z - 0.275, 1.10, M_METAL)
    # 毛巾 + 小植物
    for i, zz in enumerate((3.58, 4.06)):
        fb('towel%d' % i, 0.28, 0.06, 0.5, 2.34, zz, 1.10, M_LINEN)
    plant('bath_plant', 0.35, 4.65, 0.38, S['pot'], S['leaf'])


def entry_decor():
    # 入户门内侧：换鞋凳 + 挂画（不挡门）
    bx, bz = 8.95, 3.88
    rb('entry_bench', 0.95, 0.32, 0.14, bx, bz, 0.34, M_WOOD)
    for dx in (-0.40, 0.40):
        cyl('entry_leg', 0.02, 0.34, bx + dx, bz, 0, M_METAL_DARK, verts=10)
    art_z('entry_art', 8.95, 3.56, 1.72, 0.80, 0.62, 1, [S['art3'], S['art2'], S['art1'], S['art4']])


def outdoor():
    # 窗外：草坪 + 绿篱，保持景深但不抢画面
    fb('lawn', 12.0, 6.0, 0.04, 7.0, 13.6, -0.05, plain_mat('Lawn', '#7f8b69', 0.95))
    fb('hedge_back', 10.0, 0.45, 0.85, 7.0, 16.4, 0.0, M_LEAF2)
    fb('hedge_front', 10.5, 0.35, 0.45, 7.0, 15.75, 0.0, M_LEAF)


# ---------------------------------------------------------------- build styling
tv_and_console()
sofa()
coffee_table()
living_extras()
floor_lamp()
window_bench()
pendant_living()
dining_sideboard()
dining_set()
kitchen()
wardrobes()
bedrooms()
study()
curtains()
balcony()
bathrooms()
entry_decor()
outdoor()

# 灯具与建筑筒灯
for loc, pw in [((7.1, -6.4, LEVEL_H - 0.1), 20), ((2.4, -8.2, LEVEL_H - 0.1), 14), ((8.0, -1.6, LEVEL_H - 0.1), 12)]:
    point_light(loc, pw, S['warm_light'], 0.2, 'room_light')

pend = bpy.data.lights.new('Pendant', 'POINT')
pend.energy = 16
pend.color = S['warm_light']
pend.shadow_soft_size = 0.25
pend_o = bpy.data.objects.new('Pendant', pend)
bpy.context.collection.objects.link(pend_o)
pend_o.location = (7.35, -5.55, 1.90)

# 卫生间与门厅补光
point_light((3.05, -4.2, 2.35), 8, S['warm_light'], 0.15, 'bath_light')
point_light((12.0, -8.2, 2.35), 8, S['warm_light'], 0.2, 'south_light')

# 冰箱等电器（直接程序化，无需外部模型）
print('styling built')

# ---------------------------------------------------------------- world / light
world = bpy.data.worlds.new('World')
bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.50, 0.60, 0.72, 1)
bg.inputs['Strength'].default_value = 0.40

sun_data = bpy.data.lights.new('Sun', 'SUN')
sun_data.energy = S['sun'] + 0.8
sun_data.angle = math.radians(1.2)
sun_data.color = (1.0, 0.95, 0.88)
sun = bpy.data.objects.new('Sun', sun_data)
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (math.radians(60), 0, math.radians(-24))


def area_light(loc, size, power, color=None):
    d = bpy.data.lights.new('fill', 'AREA')
    d.energy = power
    d.size = size
    d.color = color or S.get('fill_light', S['warm_light'])
    o = bpy.data.objects.new('fill', d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (0, 0, 0)
    return o


area_light((7.1, -6.6, 2.78), 4.0, 32)
area_light((1.9, -8.6, 2.78), 3.0, 18)
area_light((1.35, -4.2, 2.78), 1.6, 14)
area_light((8.2, -1.7, 2.78), 3.0, 20)
area_light((12.0, -8.2, 2.78), 2.5, 15)
bedroom_lighting()
point_light((7.1, -1.1, 2.35), 10.0, S['warm_light'], 0.2, 'kitchen_light')

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = int(os.environ.get('SAMPLES', '48'))
scene.cycles.use_denoising = True
scene.render.resolution_x = int(os.environ.get('RES_X', '1500'))
scene.render.resolution_y = int(os.environ.get('RES_Y', '950'))
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = S['exposure'] - 0.30
scene.view_settings.look = 'AgX - Medium High Contrast'

cam_data = bpy.data.cameras.new('Cam')
cam_data.lens = 24
cam = bpy.data.objects.new('Cam', cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam

VIEWS = [
    ('overview', (14.7, -19.0, 13.6), (6.7, -5.2, 0.1), True, 0.10),
    ('living', (4.35, -6.45, 1.60), (7.55, -8.70, 1.05), False, S['exposure']),
    ('tvwall', (8.95, -9.35, 1.55), (3.90, -7.45, 1.10), False, S['exposure']),
    ('dining', (9.85, -4.15, 1.62), (5.85, -6.35, 1.02), False, S['exposure'] + 0.05),
    ('kitchen', (6.20, -3.30, 1.66), (8.80, -1.20, 1.22), False, S['exposure'] + 0.05),
    ('master', (3.55, -10.90, 1.74), (1.10, -8.35, 0.65), False, S['exposure']),
    ('bedroom', (5.90, -2.72, 1.60), (4.10, -0.55, 0.98), False, S['exposure'] + 0.12),
    ('plan3d', (6.8, -5.5, 20.0), (6.8, -5.5, 0.0), True, -0.9),
]
LENS = {'overview': 28, 'living': 22, 'dining': 22, 'kitchen': 20, 'master': 16, 'bedroom': 18}

only = os.environ.get('ONLY')
names = [n for n in (only or '').split(',') if n]
for name, pos, target, hide_ceil, exposure in VIEWS:
    if names and name not in names:
        continue
    for ob in bpy.data.objects:
        if ob.name.startswith(('ceil_', 'tray', 'cove', 'dl_', 'pend', 'd_pendant', 'sconce', 'hedge', 'lawn')):
            ob.hide_render = hide_ceil
    cam.location = pos
    direction = Vector(target) - Vector(pos)
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    if name == 'plan3d':
        cam_data.type = 'ORTHO'
        cam_data.ortho_scale = 16.6
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 1330
        scene.view_settings.exposure = -0.9
    else:
        cam_data.type = 'PERSP'
        cam_data.lens = LENS.get(name, 24)
        scene.render.resolution_x = int(os.environ.get('RES_X', '1500'))
        scene.render.resolution_y = int(os.environ.get('RES_Y', '950'))
        scene.view_settings.exposure = exposure - 0.30
    scene.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', name)
