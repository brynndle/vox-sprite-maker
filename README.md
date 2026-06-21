# Vox Sprite Maker

Voxel character editor that exports pixel-perfect 16×32 sprites for 2D games.

## Godot import

All exports use Nearest filter (no smoothing). In Godot:
- Texture import → Filter: Nearest

### Single frame (16×32)
Sprite2D → texture = sprite_16x32.png

### 8-direction static (128×32)
AnimatedSprite2D → Hframes: 8, Vframes: 1
Directions: S SW W NW N NE E SE (columns 0–7)

### Walk animation (512×32)
AnimatedSprite2D → Hframes: 32, Vframes: 1
Or slice manually: each direction = 4 consecutive frames
- South walk: frames 0–3
- Southwest walk: frames 4–7
- West walk: frames 8–11
- Northwest walk: frames 12–15
- North walk: frames 16–19
- Northeast walk: frames 20–23
- East walk: frames 24–27
- Southeast walk: frames 28–31
FPS: 8 (matches Stardew Valley walk speed)
