import bpy, math, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'items')
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def mat(name, color, rough=0.6, metal=0.0, emission=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emission:
        b.inputs["Emission Color"].default_value = (*emission, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


def box(name, size, loc, material, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(material)
    return o


def cyl(name, r, h, loc, material, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(material)
    return o


def export(name):
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    print("joined", name, tuple(round(v, 2) for v in obj.dimensions))
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name, "model.glb"), export_format="GLB", use_selection=True, export_apply=True)
    print("exported", name)


WHITE = lambda: mat("WarmWhite", (0.84, 0.82, 0.77), 0.65)
OAK = lambda: mat("Oak", (0.55, 0.38, 0.24), 0.5)
DARK = lambda: mat("DarkMetal", (0.07, 0.07, 0.08), 0.3, 0.35)
STONE = lambda: mat("Stone", (0.40, 0.39, 0.37), 0.82)
FABRIC = lambda: mat("RugFabric", (0.52, 0.50, 0.46), 0.95)
LINEN = lambda: mat("Linen", (0.72, 0.68, 0.60), 0.95)
STEEL = lambda: mat("Steel", (0.55, 0.56, 0.57), 0.28, 0.8)
LAMP = lambda: mat("Lamp", (0.95, 0.93, 0.86), 0.4, 0.0, (1.0, 0.93, 0.80), 3.0)

# ---- wardrobe 1.8 x 0.6 x 2.4, front at -Y (scene +Z)
reset()
w = WHITE(); d = DARK()
box("body", (1.8, 0.6, 2.4), (0, 0, 1.2), w)
box("front_l", (0.87, 0.02, 2.34), (-0.45, -0.305, 1.2), w)
box("front_r", (0.87, 0.02, 2.34), (0.45, -0.305, 1.2), w)
box("reveal", (0.012, 0.015, 2.34), (0, -0.315, 1.2), d)
box("handle_l", (0.018, 0.025, 0.46), (-0.04, -0.325, 1.25), d)
box("handle_r", (0.018, 0.025, 0.46), (0.04, -0.325, 1.25), d)
box("plinth", (1.72, 0.52, 0.08), (0, 0.02, 0.04), d)
export("wardrobe")

# ---- TV wall: stone panel + TV + floating cabinet, front at -Y
reset()
s = STONE(); d = DARK(); w = WHITE()
box("stone", (2.6, 0.04, 2.4), (0, 0.03, 1.2), s)
box("tv", (1.4, 0.05, 0.8), (0, -0.02, 1.55), d)
box("tv_screen", (1.28, 0.005, 0.68), (0, -0.048, 1.55), mat("Screen", (0.02, 0.025, 0.03), 0.18, 0.1))
box("cabinet", (2.0, 0.4, 0.36), (0, -0.2, 0.38), w)
box("cabinet_reveal", (1.96, 0.012, 0.012), (0, -0.405, 0.38), d)
box("cabinet_handle", (1.2, 0.02, 0.02), (0, -0.41, 0.5), d)
export("tv-wall")

# ---- kitchen upper cabinet 1.9 x 0.8 x 0.35, front at -Y
reset()
w = WHITE(); d = DARK()
box("body", (1.9, 0.35, 0.78), (0, 0, 1.95), w)
for x in (-0.63, 0.0, 0.63):
    box("door", (0.6, 0.02, 0.7), (x, -0.18, 1.95), w)
    box("handle", (0.018, 0.02, 0.26), (x + 0.25, -0.195, 1.72), d)
for x in (-0.315, 0.315):
    box("reveal", (0.01, 0.012, 0.7), (x, -0.19, 1.95), d)
box("led", (1.78, 0.02, 0.012), (0, -0.13, 1.555), LAMP())
export("upper-cabinet")

# ---- linear pendant over the dining table
reset()
lamp = LAMP(); d = DARK()
box("bar", (1.5, 0.07, 0.055), (0, 0, 1.98), lamp)
box("diffuser", (1.42, 0.05, 0.012), (0, 0, 1.948), lamp)
for x in (-0.55, 0.55):
    cyl("rod", 0.006, 0.97, (x, 0, 2.465), d, verts=12)
    box("ceiling_plate", (0.08, 0.08, 0.015), (x, 0, 2.945), d)
export("pendant")

# ---- living rug 3.8 x 2.4, flat
reset()
f = FABRIC(); edge = mat("RugEdge", (0.40, 0.38, 0.34), 0.95)
box("rug", (3.8, 2.4, 0.012), (0, 0, 0.006), f)
box("border_n", (3.8, 0.05, 0.008), (0, -1.175, 0.009), edge)
box("border_s", (3.8, 0.05, 0.008), (0, 1.175, 0.009), edge)
box("border_w", (0.05, 2.4, 0.008), (-1.875, 0, 0.009), edge)
box("border_e", (0.05, 2.4, 0.008), (1.875, 0, 0.009), edge)
export("rug")

# ---- book wall 2.7 x 2.2 x 0.35, front at -Y
reset()
oak = OAK(); d = DARK()
box("back", (2.7, 0.02, 2.2), (0, 0.165, 1.1), oak)
box("top", (2.7, 0.35, 0.04), (0, 0, 2.18), oak)
box("bottom", (2.7, 0.35, 0.04), (0, 0, 0.02), oak)
for x in (-1.33, 1.33):
    box("side", (0.04, 0.35, 2.2), (x, 0, 1.1), oak)
for z in (0.45, 0.9, 1.35, 1.8):
    box("shelf", (2.62, 0.33, 0.03), (0, 0, z), oak)
book_cols = [(0.35, 0.30, 0.26), (0.20, 0.22, 0.24), (0.55, 0.47, 0.35), (0.44, 0.42, 0.36)]
for i, x in enumerate((-1.05, -0.75, -0.48, 0.45, 0.7, 0.95)):
    c = book_cols[i % len(book_cols)]
    box("book", (0.16, 0.22, 0.28 + (i % 3) * 0.05), (x, 0.02, 0.62 + (i % 2) * 0.45), mat("Book%d" % i, c, 0.9))
box("led", (2.5, 0.02, 0.01), (0, 0.13, 2.17), LAMP())
export("bookshelf")

# ---- desk 1.6 x 0.6 x 0.75, front at -Y
reset()
oak = OAK(); d = DARK()
box("top", (1.6, 0.6, 0.045), (0, 0, 0.735), oak)
for sx in (-0.72, 0.72):
    for sy in (-0.25, 0.25):
        box("leg", (0.04, 0.04, 0.72), (sx, sy, 0.36), d)
box("apron", (1.48, 0.04, 0.08), (0, -0.26, 0.68), oak)
export("desk")

print("all scheme assets exported")

# ---- sofa 2.4 x 0.95 x 0.82, front at -Y (scene +Z)
reset()
fabric = mat("SofaFabric", (0.16, 0.15, 0.14), 0.92)
dark = mat("SofaBase", (0.05, 0.05, 0.05), 0.6)
box("base", (2.4, 0.9, 0.3), (0, 0, 0.27), fabric)
box("back", (2.4, 0.2, 0.5), (0, 0.35, 0.57), fabric)
for x in (-1.11, 1.11):
    box("arm", (0.18, 0.9, 0.45), (x, 0, 0.44), fabric)
for x in (-0.56, 0.56):
    box("seat", (1.06, 0.78, 0.14), (x, -0.03, 0.49), fabric)
    box("back_cushion", (1.02, 0.16, 0.34), (x, 0.21, 0.6), fabric)
for sx in (-1.05, 1.05):
    for sy in (-0.32, 0.32):
        box("leg", (0.05, 0.05, 0.12), (sx, sy, 0.06), dark)
export("sofa")
