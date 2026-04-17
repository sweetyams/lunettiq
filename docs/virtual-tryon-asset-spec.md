# Virtual Try-On Asset Specification

## Current Implementation (2D Overlay)

The current try-on uses MediaPipe face landmarks to position a flat PNG over the user's face via canvas.

### Shopify Metafield

- **Namespace:** `custom`
- **Key:** `tryon_image`
- **Type:** File (Image)
- **Storefront access:** Must be enabled

### 2D Image Requirements

| Property | Requirement |
|---|---|
| Format | PNG with transparent background (alpha channel) |
| View | Front-facing, straight-on — no angle or perspective |
| Content | Glasses frame and lenses only, no face/mannequin/background |
| Width | 800–1200 px |
| Aspect ratio | Natural frame proportions (do not force a fixed ratio) |
| Alignment | Nose bridge centered horizontally and vertically in the image |
| Padding | Leave even transparent space around the frame on all sides |

---

## Future Implementation (3D Try-On)

For a future upgrade to 3D rendering (e.g. via Three.js + MediaPipe, Jeeliz, or a SaaS provider), the following 3D asset spec applies.

### 3D Model File Format

| Property | Requirement |
|---|---|
| Format | **glTF 2.0 Binary (.glb)** — the web standard for 3D |
| Fallback | glTF 2.0 (.gltf + .bin + textures) if .glb is not available |
| Do NOT use | OBJ, FBX, STL — these lack material/PBR support or are not web-optimized |

### Model Geometry

| Property | Requirement |
|---|---|
| Polygon count | 5,000–20,000 triangles per frame (balance quality vs. performance) |
| Origin point | Center of the nose bridge, where the frame rests on the nose |
| Orientation | Front-facing along -Z axis (looking toward the camera) |
| Scale | Real-world millimeters (1 unit = 1 mm) |
| Components | Frame, temples (arms), lenses as separate meshes for material control |
| Temple articulation | Optional: rigged joints at hinges for open/fold animation |

### Materials (PBR)

| Property | Requirement |
|---|---|
| Workflow | Metallic-roughness (glTF standard) |
| Textures | Base color, normal map, metallic-roughness map |
| Texture size | 1024×1024 px max (512×512 preferred for mobile) |
| Lens material | Separate material with adjustable opacity/tint for prescription vs. sun |
| Texture format | PNG or JPEG (PNG for anything needing alpha) |

### File Size Targets

| Target | Max Size |
|---|---|
| .glb file | < 2 MB per frame (ideally < 1 MB) |
| Total with textures | < 3 MB |
| Load time budget | < 2 seconds on 4G connection |

### How to Source 3D Models

1. **Frame suppliers** — Ask if they provide glTF/GLB files or CAD exports
2. **3D scanning services** — Hexa (hexa3d.io), CGTrader — send product photos, receive glTF (~$20–50/model)
3. **Photogrammetry** — Luma AI, RealityCapture from 20–30 photos around the frame (variable quality)
4. **Manual modeling** — 3D artist from reference photos ($30–100/frame on Fiverr/Upwork)
5. **CAD conversion** — If supplier provides STEP/IGES files, convert to glTF via Blender

### Shopify Storage (Future)

When 3D models are ready, add a second metafield:

- **Namespace:** `custom`
- **Key:** `tryon_3d_model`
- **Type:** File
- **Accepted:** `.glb` files only
- **Storefront access:** Enabled

The 2D `tryon_image` should remain as a fallback for devices that don't support WebGL.
