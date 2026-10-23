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


def cyl(name, r, h, loc, material, rot=(0, 0, 0), verts=28):
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


LINEN = lambda: mat("Linen", (0.72, 0.68, 0.60), 0.95)
DARK = lambda: mat("DarkMetal", (0.07, 0.07, 0.08), 0.35, 0.35)
WHITE = lambda: mat("WarmWhite", (0.85, 0.83, 0.78), 0.6)
STONE = lambda: mat("StoneTop", (0.62, 0.60, 0.57), 0.35)
STEEL = lambda: mat("Steel", (0.55, 0.56, 0.57), 0.28, 0.8)
GLASSM = lambda: mat("MirrorGlass", (0.86, 0.89, 0.91), 0.08, 0.35)

# ---- curtain: pleated linen panel + rail, 1.0 wide x 2.66 high, front at -Y
reset()
lin = LINEN(); d = DARK()
for i in range(6):
    x = -0.42 + i * 0.168
    y = -0.025 if i % 2 == 0 else 0.025
    box("pleat", (0.17, 0.05, 2.56), (x, y, 1.3), lin)
box("rail", (1.06, 0.05, 0.045), (0, 0, 2.625), d)
box("cap_l", (0.05, 0.07, 0.07), (-0.53, 0, 2.625), d)
box("cap_r", (0.05, 0.07, 0.07), (0.53, 0, 2.625), d)
export("curtain")

# ---- kitchen stone backsplash 1.95 x 0.46, at 1.10-1.56 height
reset()
s = STONE(); d = DARK()
box("panel", (1.95, 0.02, 0.46), (0, 0, 1.33), s)
box("seam", (0.008, 0.022, 0.46), (0, 0, 1.33), d)
export("backsplash")

# ---- bathroom vanity 1.2 x 0.55 x 0.86, front at -Y
reset()
w = WHITE(); s = STONE(); st = STEEL(); d = DARK()
box("cabinet", (1.2, 0.5, 0.8), (0, 0, 0.4), w)
box("counter", (1.24, 0.55, 0.04), (0, 0, 0.84), s)
box("basin", (0.56, 0.4, 0.1), (0, -0.02, 0.86), w)
box("basin_inner", (0.46, 0.3, 0.06), (0, -0.02, 0.9), mat("BasinInner", (0.9, 0.9, 0.88), 0.2))
cyl("faucet", 0.02, 0.22, (0, 0.18, 0.97), st, verts=16)
cyl("spout", 0.016, 0.16, (0, 0.1, 1.06), st, rot=(math.radians(90), 0, 0), verts=16)
box("reveal", (0.012, 0.015, 0.78), (0, -0.255, 0.4), d)
box("handle_l", (0.02, 0.025, 0.22), (-0.06, -0.265, 0.6), d)
box("handle_r", (0.02, 0.025, 0.22), (0.06, -0.265, 0.6), d)
export("vanity")

# ---- mirror cabinet 1.0 x 0.9, panel at 1.15-2.05
reset()
d = DARK(); g = GLASSM()
box("frame", (1.0, 0.05, 0.9), (0, 0, 1.6), d)
box("glass", (0.94, 0.02, 0.84), (0, -0.025, 1.6), g)
box("shelf", (1.0, 0.16, 0.04), (0, -0.05, 1.2), d)
export("mirror")

print("all detail assets exported")