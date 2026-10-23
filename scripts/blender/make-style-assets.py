import bpy, math, os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
STYLE = os.environ.get('STYLE', 'warm')
OUT = os.path.join(ROOT, 'public', 'items', STYLE)
os.makedirs(OUT, exist_ok=True)


def lin(h):
    h = h.lstrip('#')
    v = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in v)


PALETTES = {
    'warm': {
        'wood': '#ab8760', 'wood_dark': '#705238', 'joinery': '#efe7d8', 'joinery2': '#e7dcc9',
        'stone': '#c9beac', 'stone_vein': '#b1a48f', 'fabric': '#bda98e', 'fabric2': '#d6c7b0',
        'accent': '#7c6242', 'accent2': '#55634a', 'accent3': '#9c563d',
        'linen': '#e5dac8', 'bedding': '#f1eadf', 'bed_accent': '#b99a72',
        'rug': '#9b8b74', 'rug_edge': '#7f7160', 'metal': '#a9854e', 'metal_dark': '#3c352d',
        'art1': '#b46a4c', 'art2': '#c39a5e', 'art3': '#8d9a83', 'art4': '#3f3a33',
        'leaf': '#5f6f50', 'lamp': '#f1e6d3', 'curtain': '#e5dac8',
    },
    'grey': {
        'wood': '#7d6a58', 'wood_dark': '#4f4136', 'joinery': '#ececea', 'joinery2': '#dcddd9',
        'stone': '#c3c4c1', 'stone_vein': '#a5a7a4', 'fabric': '#85827b', 'fabric2': '#a09d95',
        'accent': '#40423f', 'accent2': '#8a5a3e', 'accent3': '#5c6b63',
        'linen': '#d4d3cc', 'bedding': '#eeede7', 'bed_accent': '#7a7b76',
        'rug': '#b0b0aa', 'rug_edge': '#8f908a', 'metal': '#2e2f30', 'metal_dark': '#1e1f20',
        'art1': '#3f4643', 'art2': '#a86e4a', 'art3': '#d8d2c5', 'art4': '#22252a',
        'leaf': '#5e6d5b', 'lamp': '#e9e4d8', 'curtain': '#d9d8d2',
    },
    'dark': {
        'wood': '#6d4d33', 'wood_dark': '#3b2a1d', 'joinery': '#4c3827', 'joinery2': '#e0d6c4',
        'stone': '#575147', 'stone_vein': '#3d3933', 'fabric': '#3a4a40', 'fabric2': '#4f6154',
        'accent': '#a37f4a', 'accent2': '#c0a682', 'accent3': '#7f4636',
        'linen': '#c9bca7', 'bedding': '#eae1d3', 'bed_accent': '#536354',
        'rug': '#64584a', 'rug_edge': '#4a4034', 'metal': '#b08a52', 'metal_dark': '#241f1a',
        'art1': '#435148', 'art2': '#b98a52', 'art3': '#d9cdb9', 'art4': '#1e1d1a',
        'leaf': '#3f5542', 'lamp': '#e7dbc5', 'curtain': '#c9bca7',
    },
}
P = PALETTES[STYLE]


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.objects):
        for b in list(block):
            if b.users == 0:
                block.remove(b)
    bpy.context.scene.cursor.location = (0, 0, 0)


def mat(name, color, rough=0.6, metal=0.0, emission=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emission:
        b.inputs['Emission Color'].default_value = (*lin(emission), 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m


def bevel(o, width=0.02, seg=2):
    w = min(width, min(o.dimensions) / 2.2)
    if w <= 0.003:
        return
    mod = o.modifiers.new('bev', 'BEVEL')
    mod.width = w
    mod.segments = seg
    mod.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=mod.name)


def box(name, size, loc, material, rot=(0, 0, 0), bev=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(material)
    if bev:
        bevel(o, bev)
    return o


def cyl(name, r, h, loc, material, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    return o


def export(name):
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='SELECT')
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name, 'model.glb'), export_format='GLB',
                              use_selection=True, export_apply=True)
    print('exported', STYLE, name, tuple(round(v, 2) for v in obj.dimensions))


M = {
    'wood': mat('Oak', P['wood'], 0.5),
    'wood_dark': mat('Walnut', P['wood_dark'], 0.48),
    'joinery': mat('Joinery', P['joinery'], 0.55),
    'joinery2': mat('Joinery2', P['joinery2'], 0.55),
    'stone': mat('Stone', P['stone'], 0.3),
    'stone_vein': mat('StoneVein', P['stone_vein'], 0.35),
    'fabric': mat('Fabric', P['fabric'], 0.95),
    'fabric2': mat('Fabric2', P['fabric2'], 0.95),
    'accent': mat('Accent', P['accent'], 0.9),
    'accent2': mat('Accent2', P['accent2'], 0.9),
    'accent3': mat('Accent3', P['accent3'], 0.9),
    'linen': mat('Linen', P['linen'], 0.95),
    'bedding': mat('Bedding', P['bedding'], 0.95),
    'bed_accent': mat('BedAccent', P['bed_accent'], 0.95),
    'rug': mat('Rug', P['rug'], 1.0),
    'rug_edge': mat('RugEdge', P['rug_edge'], 1.0),
    'metal': mat('Metal', P['metal'], 0.3, 0.85),
    'metal_dark': mat('MetalDark', P['metal_dark'], 0.35, 0.7),
    'lamp': mat('LampGlow', P['lamp'], 0.4, 0.0, '#ffdfae', 4.0),
    'screen': mat('Screen', '#0a0b0c', 0.15, 0.15),
    'mirror': mat('MirrorGlass', '#d8dade', 0.05, 1.0),
    'leaf': mat('Leaf', P['leaf'], 0.65),
    'book1': mat('Book1', P['art1'], 0.9),
    'book2': mat('Book2', P['art2'], 0.9),
    'book3': mat('Book3', P['art3'], 0.9),
    'book4': mat('Book4', P['art4'], 0.9),
    'ceramic': mat('Ceramic', '#e9e3d8', 0.3),
}

WARM_WOOD = STYLE == 'warm'
WARD = M['wood'] if WARM_WOOD else (M['joinery'] if STYLE == 'grey' else M['wood_dark'])
TRIM = M['wood_dark'] if WARM_WOOD else M['metal_dark']

# ---------------------------------------------------------------- sofa 2.4x0.95x0.82, front -Y
reset()
box('base', (2.28, 0.86, 0.26), (0, 0, 0.16), M['fabric'], bev=0.025)
box('back', (2.28, 0.18, 0.58), (0, 0.36, 0.50), M['fabric'], bev=0.03)
for x in (-1.13, 1.13):
    box('arm', (0.16, 0.86, 0.48), (x, 0, 0.35), M['fabric'], bev=0.03)
for x in (-0.55, 0.55):
    box('seat', (1.04, 0.64, 0.17), (x, -0.04, 0.40), M['fabric2'], bev=0.06)
    box('backcushion', (1.02, 0.15, 0.40), (x, 0.235, 0.53), M['fabric2'], bev=0.06)
for i, (x, m, rz) in enumerate([(-0.62, M['accent2'], 0.18), (0.0, M['accent3'], -0.12), (0.62, M['accent'], 0.15)]):
    box('pillow%d' % i, (0.36, 0.13, 0.36), (x, -0.02, 0.53), m, rot=(0, 0, rz), bev=0.05)
box('throw', (0.55, 0.55, 0.03), (0.74, -0.05, 0.535), M['accent2'], rot=(0, 0, 0.08), bev=0.01)
for x in (-1.08, 1.08):
    for y in (-0.34, 0.34):
        box('leg', (0.06, 0.06, 0.12), (x, y, 0.06), M['metal_dark'])
export('sofa')

# ---------------------------------------------------------------- rug 3.8 x 2.4
reset()
box('rug', (3.8, 2.4, 0.014), (0, 0, 0.007), M['rug'], bev=0.008)
for name, size, loc in [
    ('bn', (3.8, 0.05, 0.008), (0, -1.175, 0.012)),
    ('bs', (3.8, 0.05, 0.008), (0, 1.175, 0.012)),
    ('bw', (0.05, 2.4, 0.008), (-1.875, 0, 0.012)),
    ('be', (0.05, 2.4, 0.008), (1.875, 0, 0.012)),
]:
    box(name, size, loc, M['rug_edge'])
for i in range(22):
    x = -1.82 + i * 0.17
    for y in (-1.235, 1.235):
        box('fringe', (0.02, 0.055, 0.006), (x, y, 0.008), M['linen'])
export('rug')

# ---------------------------------------------------------------- curtain 1.1 x 2.66
reset()
for i in range(7):
    x = -0.46 + i * 0.153
    y = 0.014 if i % 2 else -0.014
    box('pleat', (0.16, 0.055, 2.56), (x, y, 1.30), M['linen'], bev=0.012)
box('rail', (1.10, 0.05, 0.045), (0, 0, 2.625), M['metal_dark'])
box('cap_l', (0.05, 0.07, 0.07), (-0.55, 0, 2.625), M['metal_dark'])
box('cap_r', (0.05, 0.07, 0.07), (0.55, 0, 2.625), M['metal_dark'])
export('curtain')

# ---------------------------------------------------------------- wardrobe 1.8x0.6x2.4, front -Y
reset()
box('body', (1.8, 0.6, 2.4), (0, 0, 1.2), WARD)
for x in (-0.45, 0.45):
    box('door', (0.87, 0.02, 2.30), (x, -0.305, 1.2), WARD)
    box('panel_v1', (0.012, 0.012, 1.98), (x - 0.40, -0.317, 1.2), TRIM)
    box('panel_v2', (0.012, 0.012, 1.98), (x + 0.40, -0.317, 1.2), TRIM)
    box('panel_h1', (0.80, 0.012, 0.012), (x, -0.317, 0.22), TRIM)
    box('panel_h2', (0.80, 0.012, 0.012), (x, -0.317, 2.18), TRIM)
    box('handle', (0.018, 0.025, 0.46), (x * 0.08, -0.325, 1.25), M['metal'])
box('reveal', (0.012, 0.015, 2.30), (0, -0.315, 1.2), M['metal_dark'])
box('topgap', (1.74, 0.02, 0.02), (0, -0.31, 2.35), M['metal_dark'])
box('plinth', (1.72, 0.52, 0.08), (0, 0.02, 0.04), M['metal_dark'])
export('wardrobe')

# ---------------------------------------------------------------- TV wall 2.6x0.5x2.4, front -Y
reset()
box('stone', (2.6, 0.04, 2.4), (0, 0.03, 1.2), M['stone'])
box('tvframe', (1.48, 0.05, 0.86), (0, -0.02, 1.5), M['metal_dark'])
box('tv', (1.40, 0.05, 0.80), (0, -0.045, 1.5), M['screen'])
box('console', (2.0, 0.4, 0.34), (0, -0.22, 0.38), M['joinery'])
box('console_gap', (1.96, 0.012, 0.012), (0, -0.425, 0.54), M['metal_dark'])
box('console_led', (1.86, 0.02, 0.01), (0, -0.30, 0.20), M['lamp'])
box('soundbar', (0.9, 0.10, 0.06), (0, -0.07, 0.70), M['metal_dark'])
box('book1', (0.28, 0.20, 0.26), (0.62, -0.22, 0.58), M['book1'])
box('book2', (0.24, 0.18, 0.22), (0.62, -0.19, 0.58), M['book2'])
for i, x in enumerate((-0.62, 0.72, 0.28)):
    cyl('decor%d' % i, 0.05, 0.16 + i * 0.03, (x, -0.24, 0.58), M['ceramic'], verts=18)
export('tv-wall')

# ---------------------------------------------------------------- bookshelf 2.7x0.35x2.2, front -Y
reset()
box('back', (2.7, 0.02, 2.2), (0, 0.165, 1.1), M['wood'])
box('top', (2.7, 0.35, 0.04), (0, 0, 2.18), M['wood'])
box('bottom', (2.7, 0.35, 0.04), (0, 0, 0.02), M['wood'])
for x in (-1.33, 1.33):
    box('side', (0.04, 0.35, 2.2), (x, 0, 1.1), M['wood'])
for z in (0.45, 0.9, 1.35, 1.8):
    box('shelf', (2.62, 0.33, 0.03), (0, 0, z), M['wood'])
bookmats = [M['book1'], M['book2'], M['book3'], M['book4'], M['ceramic']]
for i, x in enumerate((-1.10, -0.86, -0.62, 0.52, 0.76, 1.0)):
    box('book%d' % i, (0.14, 0.20, 0.24 + (i % 3) * 0.05), (x, 0.02, 0.62 + (i % 2) * 0.45), bookmats[i % 5])
for i, x in enumerate((-0.95, -0.55)):
    cyl('vase%d' % i, 0.045, 0.20, (x, 0.02, 1.37), M['ceramic'], verts=18)
box('led', (2.5, 0.02, 0.01), (0, 0.13, 2.17), M['lamp'])
export('bookshelf')

# ---------------------------------------------------------------- desk 1.6x0.6x0.75, front -Y
reset()
box('top', (1.6, 0.6, 0.045), (0, 0, 0.735), M['wood'])
box('apron', (1.48, 0.04, 0.08), (0, -0.26, 0.68), M['wood'])
for sx in (-0.72, 0.72):
    for sy in (-0.25, 0.25):
        box('leg', (0.04, 0.04, 0.72), (sx, sy, 0.36), M['metal_dark'])
box('laptop', (0.28, 0.20, 0.02), (0.0, -0.04, 0.77), M['metal_dark'])
box('screen', (0.28, 0.015, 0.18), (0.0, 0.04, 0.86), M['screen'])
export('desk')

# ---------------------------------------------------------------- pendant
reset()
box('bar', (1.5, 0.07, 0.055), (0, 0, 1.98), M['metal'])
box('diffuser', (1.42, 0.05, 0.012), (0, 0, 1.948), M['lamp'])
for x in (-0.55, 0.55):
    cyl('rod', 0.006, 0.94, (x, 0, 2.45), M['metal_dark'], verts=12)
    box('plate', (0.08, 0.08, 0.015), (x, 0, 2.94), M['metal_dark'])
export('pendant')

# ---------------------------------------------------------------- upper cabinet 1.9x0.35x0.78, front -Y
reset()
box('body', (1.9, 0.35, 0.78), (0, 0, 1.95), M['joinery2'])
for x in (-0.63, 0.0, 0.63):
    box('door', (0.60, 0.02, 0.70), (x, -0.18, 1.95), M['joinery2'])
    box('handle', (0.018, 0.02, 0.26), (x + 0.25, -0.195, 1.72), M['metal'])
for x in (-0.315, 0.315):
    box('reveal', (0.01, 0.012, 0.70), (x, -0.19, 1.95), M['metal_dark'])
box('led', (1.78, 0.02, 0.012), (0, -0.13, 1.555), M['lamp'])
export('upper-cabinet')

# ---------------------------------------------------------------- backsplash 1.95x0.46
reset()
box('panel', (1.95, 0.02, 0.46), (0, 0, 1.33), M['stone_vein'])
box('seam', (0.008, 0.022, 0.46), (0, 0, 1.33), M['metal_dark'])
export('backsplash')

# ---------------------------------------------------------------- vanity 1.2x0.55x0.86, front -Y
reset()
box('cabinet', (1.2, 0.5, 0.80), (0, 0, 0.4), M['joinery'])
box('counter', (1.24, 0.55, 0.04), (0, 0, 0.84), M['stone'])
box('basin', (0.56, 0.4, 0.1), (0, -0.02, 0.86), M['ceramic'])
box('basin_inner', (0.46, 0.30, 0.06), (0, -0.02, 0.9), M['stone_vein'])
cyl('faucet', 0.02, 0.22, (0, 0.18, 0.97), M['metal'], verts=16)
cyl('spout', 0.016, 0.16, (0, 0.1, 1.06), M['metal'], rot=(math.radians(90), 0, 0), verts=16)
box('reveal', (0.012, 0.015, 0.78), (0, -0.255, 0.4), M['metal_dark'])
for x in (-0.06, 0.06):
    box('handle', (0.02, 0.025, 0.22), (x, -0.265, 0.6), M['metal'])
export('vanity')

# ---------------------------------------------------------------- mirror
reset()
box('frame', (1.0, 0.05, 0.9), (0, 0, 1.6), M['metal'])
box('glass', (0.94, 0.02, 0.84), (0, -0.025, 1.6), M['mirror'])
box('shelf', (1.0, 0.16, 0.04), (0, -0.05, 1.2), M['metal'])
export('mirror')

# ---------------------------------------------------------------- bed 1.7 x 2.05, head +Y, foot -Y
reset()
box('base', (1.66, 2.00, 0.30), (0, 0, 0.15), M['fabric2'], bev=0.03)
box('plinth', (1.58, 1.92, 0.10), (0, 0, 0.0), M['metal_dark'])
box('mattress', (1.60, 2.02, 0.22), (0, 0, 0.40), M['bedding'], bev=0.05)
box('duvet', (1.58, 1.48, 0.12), (0, -0.24, 0.52), M['bedding'], bev=0.045)
for x in (-0.40, 0.40):
    box('drape', (0.06, 1.40, 0.34), (x * 2.02, -0.22, 0.28), M['bedding'])
for x in (-0.56, 0.56):
    box('sheet', (0.60, 0.18, 0.035), (x, -0.45, 0.60), M['linen'])
box('throw', (1.62, 0.32, 0.035), (0, -0.80, 0.605), M['bed_accent'])
box('throw_drop_l', (0.035, 0.32, 0.30), (-0.815, -0.80, 0.33), M['bed_accent'])
box('throw_drop_r', (0.035, 0.32, 0.30), (0.815, -0.80, 0.33), M['bed_accent'])
# headboard
box('head', (1.80, 0.12, 1.14), (0, 0.99, 0.66), M['fabric'] if STYLE != 'dark' else M['wood_dark'], bev=0.03)
for x in (-0.88, 0.88):
    box('post', (0.10, 0.16, 1.28), (x, 0.99, 0.64), M['wood_dark'])
for x in (-0.45, 0.0, 0.45):
    box('seam', (0.012, 0.02, 0.92), (x, 0.925, 0.68), M['joinery'] if STYLE != 'dark' else M['metal'])
for x in (-0.40, 0.40):
    box('pillow', (0.58, 0.16, 0.42), (x, 0.62, 0.66), M['bedding'], bev=0.06)
    box('cushion', (0.40, 0.14, 0.24), (x, 0.44, 0.58), M['bed_accent'], bev=0.05)
export('double-bed')

# ---------------------------------------------------------------- bedside table, front -Y
reset()
box('body', (0.44, 0.42, 0.42), (0, 0, 0.25), M['wood'])
box('top', (0.46, 0.44, 0.03), (0, 0, 0.49), M['stone'])
box('drawer', (0.40, 0.02, 0.16), (0, -0.212, 0.33), M['wood'])
box('handle', (0.14, 0.015, 0.015), (0, -0.225, 0.39), M['metal'])
for x in (-0.17, 0.17):
    for y in (-0.16, 0.16):
        cyl('leg', 0.015, 0.08, (x, y, 0.04), M['metal_dark'], verts=8)
# lamp
cyl('lampbase', 0.055, 0.02, (0, 0, 0.515), M['metal'], verts=18)
cyl('lampstem', 0.012, 0.25, (0, 0, 0.535), M['metal'], verts=10)
cyl('lampshade', 0.14, 0.19, (0, 0, 0.80), M['lamp'], verts=24)
export('bedside-table')

# ---------------------------------------------------------------- dining table 2.4x1.0, front -Y
reset()
box('top', (2.4, 1.0, 0.055), (0, 0, 0.735), M['wood'])
box('apron', (2.2, 0.9, 0.06), (0, 0, 0.69), M['wood_dark'])
for x in (-1.05, 1.05):
    for y in (-0.38, 0.38):
        cyl('leg', 0.028, 0.69, (x, y, 0.345), M['metal_dark'], verts=14)
box('runner', (2.55, 0.42, 0.008), (0, 0, 0.767), M['linen'])
cyl('vase', 0.07, 0.30, (0, 0.08, 0.77), M['ceramic'], verts=20)
for i, x in enumerate((-0.55, 0.55)):
    cyl('candle%d' % i, 0.025, 0.20, (x, 0.24, 0.77), M['ceramic'], verts=14)
export('dining-table')

# ---------------------------------------------------------------- dining chair, front -Y
reset()
box('seat', (0.50, 0.48, 0.11), (0, 0, 0.435), M['fabric'], bev=0.03)
box('back', (0.46, 0.08, 0.38), (0, 0.21, 0.65), M['fabric'], bev=0.04)
for x in (-0.21, 0.21):
    box('stile', (0.035, 0.04, 0.46), (x, 0.21, 0.45), M['wood_dark'])
for x in (-0.17, 0.17):
    for y in (-0.17, 0.17):
        cyl('leg', 0.018, 0.40, (x, y, 0.20), M['wood_dark'], verts=10)
export('dining-chair')

# ---------------------------------------------------------------- coffee table 1.4x0.75x0.36, front -Y
reset()
box('top', (1.4, 0.75, 0.055), (0, 0, 0.335), M['wood'])
box('shelf', (1.25, 0.65, 0.025), (0, 0, 0.14), M['wood_dark'])
for x in (-0.60, 0.60):
    for y in (-0.28, 0.28):
        cyl('leg', 0.018, 0.335, (x, y, 0.1675), M['metal_dark'], verts=10)
box('book1', (0.28, 0.20, 0.06), (-0.18, 0.08, 0.395), M['book1'])
box('book2', (0.24, 0.18, 0.04), (-0.16, 0.06, 0.445), M['book3'])
cyl('bowl', 0.12, 0.07, (0.35, -0.05, 0.40), M['ceramic'], verts=24)
export('coffee-table')

# ---------------------------------------------------------------- kitchen base 2.4x0.68x0.95, front -Y
reset()
base_m = M['wood'] if STYLE == 'dark' else M['joinery']
box('toe', (2.30, 0.55, 0.10), (0, 0, 0.05), M['metal_dark'])
box('body', (2.40, 0.62, 0.80), (0, 0, 0.50), base_m)
for i in range(4):
    x = -0.90 + i * 0.60
    box('door', (0.58, 0.02, 0.74), (x, -0.32, 0.50), base_m)
    box('handle', (0.18, 0.018, 0.018), (x, -0.335, 0.80), M['metal'])
box('counter', (2.46, 0.68, 0.045), (0, 0, 0.925), M['stone'])
box('sink', (0.55, 0.40, 0.012), (-0.58, -0.04, 0.948), M['stone_vein'])
box('sink_in', (0.45, 0.30, 0.006), (-0.58, -0.04, 0.955), M['screen'])
cyl('faucet', 0.018, 0.30, (-0.58, 0.20, 0.95), M['metal'], verts=14)
cyl('spout', 0.012, 0.24, (-0.58, 0.10, 1.22), M['metal'], rot=(math.radians(90), 0, 0), verts=10)
box('hob', (0.62, 0.46, 0.012), (0.62, -0.06, 0.952), M['screen'])
for dx in (-0.15, 0.15):
    for dy in (-0.11, 0.11):
        cyl('burner', 0.075, 0.004, (0.62 + dx, -0.06 + dy, 0.960), M['metal_dark'], verts=24)
export('kitchen')

print('all style assets exported:', STYLE)
