import bpy, math, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'items')
os.makedirs(OUT, exist_ok=True)


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.objects):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def m(name, color, rough=0.6, metal=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return mat


def box(name, size, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.data.materials.append(mat)
    return o


def cyl(name, r, h, loc, mat, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
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
    print("joined", name, tuple(round(v, 2) for v in obj.dimensions))
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + ".glb"), export_format="GLB", use_selection=True, export_apply=True)
    print("exported", name)


# dining table 2.5 x 1.0 x 0.8, top at 0.75
reset()
oak = m("Oak", (0.55, 0.38, 0.24), 0.45)
box("top", (2.5, 1.0, 0.06), (0, 0, 0.75), oak)
for sx in (-1, 1):
    for sy in (-1, 1):
        box("leg", (0.07, 0.07, 0.72), (sx * 1.12, sy * 0.40, 0.36), oak)
box("apron", (2.3, 0.06, 0.10), (0, 0.42, 0.66), oak)
box("apron", (2.3, 0.06, 0.10), (0, -0.42, 0.66), oak)
export("dining-table")

# dining chair 0.5 x 0.5 x 1.0, faces +Z (back at +Y in blender)
reset()
oak = m("Oak", (0.55, 0.38, 0.24), 0.45)
fabric = m("SeatFabric", (0.30, 0.29, 0.28), 0.9)
box("seat", (0.48, 0.48, 0.06), (0, 0, 0.45), fabric)
for sx in (-1, 1):
    for sy in (-1, 1):
        box("leg", (0.04, 0.04, 0.44), (sx * 0.20, sy * 0.20, 0.22), oak)
box("back", (0.48, 0.06, 0.55), (0, 0.22, 0.72), oak)
box("back_pad", (0.42, 0.03, 0.34), (0, 0.185, 0.74), fabric)
export("dining-chair")

# stove 1.0 x 1.0 x 1.0, front at -Y (scene +Z)
reset()
steel = m("Steel", (0.55, 0.56, 0.57), 0.25, metal=0.85)
dark = m("Dark", (0.06, 0.06, 0.07), 0.3, metal=0.4)
box("body", (1.0, 0.95, 0.9), (0, 0, 0.45), steel)
box("cooktop", (0.98, 0.92, 0.03), (0, 0, 0.915), dark)
box("backguard", (1.0, 0.05, 0.16), (0, 0.45, 0.99), steel)
for sx in (-0.22, 0.22):
    for sy in (-0.20, 0.20):
        cyl("burner", 0.105, 0.012, (sx, sy, 0.935), dark)
        cyl("grate", 0.14, 0.008, (sx, sy, 0.945), steel, verts=24)
for i in range(5):
    cyl("knob", 0.028, 0.03, (-0.36 + i * 0.18, -0.49, 0.78), dark, rot=(math.radians(90), 0, 0), verts=20)
box("handle", (0.9, 0.03, 0.03), (0, -0.49, 0.60), dark)
export("stove")

# fridge 1 x 1 x 2.0, front at -Y
reset()
white = m("ApplianceWhite", (0.86, 0.87, 0.86), 0.35, metal=0.1)
dark = m("Dark", (0.10, 0.10, 0.11), 0.35, metal=0.3)
box("body", (0.95, 0.92, 2.0), (0, 0, 1.0), white)
box("gap", (0.95, 0.005, 0.012), (0, -0.465, 1.32), dark)
box("handle1", (0.03, 0.04, 0.55), (0.36, -0.48, 1.62), dark)
box("handle2", (0.03, 0.04, 0.35), (0.36, -0.48, 1.05), dark)
export("fridge")

# washing machine 1 x 1 x 1, front at -Y
reset()
white = m("ApplianceWhite", (0.88, 0.89, 0.88), 0.3, metal=0.1)
dark = m("Dark", (0.08, 0.08, 0.09), 0.25, metal=0.3)
glass = m("Glass", (0.05, 0.06, 0.08), 0.1, metal=0.5)
box("body", (0.98, 0.98, 0.86), (0, 0, 0.43), white)
box("top", (0.98, 0.98, 0.14), (0, 0, 0.93), white)
box("panel", (0.90, 0.01, 0.10), (0, -0.496, 0.86), dark)
cyl("door", 0.26, 0.04, (0, -0.50, 0.40), glass, rot=(math.radians(90), 0, 0), verts=40)
cyl("rim", 0.30, 0.02, (0, -0.492, 0.40), dark, rot=(math.radians(90), 0, 0), verts=40)
cyl("knob", 0.03, 0.03, (0.42, -0.50, 0.88), dark, rot=(math.radians(90), 0, 0), verts=20)
export("washing-machine")

# drying rack 2.0 x 1.0 x 1.1
reset()
alu = m("Aluminum", (0.72, 0.73, 0.74), 0.3, metal=0.9)
for sy in (-0.45, 0.45):
    for sx in (-0.92, 0.92):
        box("leg", (0.03, 0.03, 1.10), (sx, sy, 0.55), alu)
for sy in (-0.45, 0.45):
    box("rail", (1.88, 0.03, 0.03), (0, sy, 1.08), alu)
for i in range(5):
    y = -0.3 + i * 0.15
    box("hang", (1.84, 0.018, 0.018), (0, y, 1.05), alu)
for sx in (-0.9, 0.9):
    box("side", (0.03, 0.90, 0.03), (sx, 0, 0.45), alu)
export("drying-rack")
print("all done")
