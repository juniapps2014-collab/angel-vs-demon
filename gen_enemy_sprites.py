#!/usr/bin/env python3
"""
Angel vs Demon — Enemy Sprite Sheet Generator
Generates 512x512 PNG sprite sheets (4 cols x 4 rows, 128x128 per frame)

Row layout:  row0=south(front) / row1=west(left) / row2=north(back) / row3=east(right)
Col layout:  col0=idle1 / col1=idle2 / col2=move1 / col3=move2

Usage: python3 gen_enemy_sprites.py
"""

from PIL import Image, ImageDraw
import os

F = 128
OUT = os.path.join(os.path.dirname(__file__),
    "angel-vs-demon-client/assets/resources/images/characters")

# ─── colour helpers ────────────────────────────────────────────────────────────

def dk(c, f=0.55):
    return (int(c[0]*f), int(c[1]*f), int(c[2]*f), c[3] if len(c) > 3 else 255)

def lt(c, f=1.4):
    return (min(255,int(c[0]*f)), min(255,int(c[1]*f)), min(255,int(c[2]*f)),
            c[3] if len(c) > 3 else 255)

def blend(c1, c2, t=0.5):
    return tuple(int(c1[i]*(1-t)+c2[i]*t) for i in range(4))

# ─── primitive draw helpers ────────────────────────────────────────────────────

def el(draw, cx, cy, rx, ry, fill, ow=2):
    fill = tuple(fill)
    draw.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=fill, outline=dk(fill), width=ow)

def bx(draw, x, y, w, h, fill, ow=2):
    fill = tuple(fill)
    draw.rectangle([x, y, x+w-1, y+h-1], fill=fill, outline=dk(fill), width=ow)

def tri(draw, pts, fill):
    fill = tuple(fill)
    draw.polygon(pts, fill=fill, outline=dk(fill))

def circ(draw, cx, cy, r, fill, ow=2):
    el(draw, cx, cy, r, r, fill, ow)

def new_img():
    img = Image.new('RGBA', (F, F), (0, 0, 0, 0))
    return img, ImageDraw.Draw(img)

def make_sheet(draw_fn):
    sheet = Image.new('RGBA', (F * 4, F * 4), (0, 0, 0, 0))
    for row, direction in enumerate(['south', 'west', 'north', 'east']):
        for col, anim in enumerate(['idle1', 'idle2', 'move1', 'move2']):
            frame = draw_fn(direction, anim)
            sheet.paste(frame, (col * F, row * F), frame)
    return sheet

# ─── animation helpers ─────────────────────────────────────────────────────────

def anim_offsets(anim):
    """Returns (body_bob, ll_x, rl_x, la_y, ra_y) offsets for given animation state."""
    bob  = -2 if anim == 'idle2' else 0
    ll_x = -8 if anim == 'move1' else (8  if anim == 'move2' else 0)
    rl_x =  8 if anim == 'move1' else (-8 if anim == 'move2' else 0)
    la_y =  5 if anim == 'move1' else (-5 if anim == 'move2' else 0)
    ra_y = -5 if anim == 'move1' else (5  if anim == 'move2' else 0)
    return bob, ll_x, rl_x, la_y, ra_y

# ─── HUMANOID base ─────────────────────────────────────────────────────────────

def draw_humanoid(direction, anim, skin, cloth, cloth2, eye_c, grin=True,
                  body_w=40, body_h=34, head_r=18, tall=False,
                  stocky=False, extra=None):
    """
    Draw a two-legged humanoid in any of 4 directions.
    extra(draw, direction, anim, bob) → draw accessories on top.
    """
    img, draw = new_img()
    bob, ll_x, rl_x, la_y, ra_y = anim_offsets(anim)

    h_ofs = -6 if tall else (4 if stocky else 0)     # vertical offset for height variant
    cx = 64

    # ── SOUTH (front) ──────────────────────────────────────────────────────────
    if direction == 'south':
        # far legs first
        RL_X = cx + 4 + rl_x
        LL_X = cx - 16 + ll_x
        body_top = 50 + bob + h_ofs

        # Back leg (right when drawing south)
        bx(draw, RL_X, body_top + body_h - 2, 13, 24, dk(cloth, 0.8))
        el(draw, RL_X + 6, body_top + body_h + 22, 9, 5, dk(cloth, 0.75))

        # Body
        bx(draw, cx - body_w//2, body_top, body_w, body_h, cloth2)

        # Front leg
        bx(draw, LL_X, body_top + body_h - 2, 13, 24, cloth)
        el(draw, LL_X + 6, body_top + body_h + 22, 9, 5, dk(cloth, 0.85))

        # Arms
        la_top = body_top + 4 + la_y
        ra_top = body_top + 4 + ra_y
        bx(draw, cx - body_w//2 - 15, la_top, 13, 28, skin)
        el(draw, cx - body_w//2 - 9, la_top + 28, 7, 5, skin)
        bx(draw, cx + body_w//2 + 2, ra_top, 13, 28, skin)
        el(draw, cx + body_w//2 + 8, ra_top + 28, 7, 5, skin)

        # Neck
        bx(draw, cx - 5, body_top - 8, 10, 10, skin)

        # Head
        hcy = body_top - head_r - 2
        el(draw, cx, hcy, head_r, head_r, skin)

        # Eyes
        ey = hcy - 4
        el(draw, cx - 7, ey, 5, 5, (255,255,255,255))
        el(draw, cx + 7, ey, 5, 5, (255,255,255,255))
        el(draw, cx - 7, ey, 3, 3, eye_c)
        el(draw, cx + 7, ey, 3, 3, eye_c)

        # Mouth
        if grin:
            draw.arc([cx-10, ey+4, cx+10, ey+14], 15, 165, fill=(30,5,5,255), width=2)
            for tx in [cx-8, cx-2, cx+4]:
                bx(draw, tx, ey+5, 4, 4, (240,240,240,255), ow=1)
        else:
            draw.arc([cx-7, ey+5, cx+7, ey+13], 200, 340, fill=(50,20,20,255), width=2)

    # ── NORTH (back) ──────────────────────────────────────────────────────────
    elif direction == 'north':
        body_top = 50 + bob + h_ofs
        RL_X = cx + 4 + rl_x
        LL_X = cx - 16 + ll_x

        bx(draw, RL_X, body_top + body_h - 2, 13, 24, dk(cloth, 0.7))
        el(draw, RL_X + 6, body_top + body_h + 22, 9, 5, dk(cloth, 0.65))

        bx(draw, cx - body_w//2, body_top, body_w, body_h, dk(cloth2, 0.85))

        bx(draw, LL_X, body_top + body_h - 2, 13, 24, dk(cloth, 0.8))
        el(draw, LL_X + 6, body_top + body_h + 22, 9, 5, dk(cloth, 0.75))

        la_top = body_top + 4 + la_y
        ra_top = body_top + 4 + ra_y
        bx(draw, cx - body_w//2 - 15, la_top, 13, 28, dk(skin, 0.9))
        bx(draw, cx + body_w//2 + 2,  ra_top, 13, 28, dk(skin, 0.9))

        bx(draw, cx - 5, body_top - 8, 10, 10, dk(skin, 0.9))

        hcy = body_top - head_r - 2
        el(draw, cx, hcy, head_r, head_r, dk(skin, 0.9))
        # Hair/hood hint at back
        el(draw, cx, hcy - head_r + 6, head_r - 2, 8, dk(skin, 0.75))

    # ── WEST (left side) ──────────────────────────────────────────────────────
    elif direction in ('west', 'east'):
        body_top = 50 + bob + h_ofs
        px = cx - 14   # profile pivot

        near_ll = ll_x if direction == 'west' else rl_x
        far_ll  = rl_x if direction == 'west' else ll_x

        # Far leg
        bx(draw, px + 6, body_top + body_h - 2 + far_ll // 2, 11, 22, dk(cloth, 0.75))

        # Body (narrower)
        bx(draw, px, body_top, 24, body_h, cloth2)

        # Near leg
        bx(draw, px - 2, body_top + body_h - 2 + near_ll // 2, 11, 22, cloth)
        el(draw, px + 3, body_top + body_h + 22 + near_ll // 2, 9, 5, dk(cloth, 0.85))

        # Far arm (partially visible)
        bx(draw, px + 8, body_top + 4, 9, 22, dk(skin, 0.8))

        # Near arm (more visible, slightly in front)
        near_arm_x = px - 12
        bx(draw, near_arm_x, body_top + 4 + la_y, 13, 26, skin)
        el(draw, near_arm_x + 6, body_top + 30 + la_y, 7, 5, skin)

        # Neck
        bx(draw, px + 4, body_top - 8, 10, 10, skin)

        # Head (profile oval)
        hcy = body_top - head_r - 2
        el(draw, px + 10, hcy, 14, head_r, skin)

        # Eye
        ey = hcy - 4
        el(draw, px + 4, ey, 4, 4, (255,255,255,255))
        el(draw, px + 4, ey, 2, 2, eye_c)

        # Mouth
        if grin:
            draw.arc([px-2, ey+4, px+12, ey+13], 20, 155, fill=(30,5,5,255), width=2)
        else:
            draw.arc([px, ey+6, px+10, ey+13], 200, 340, fill=(50,20,20,255), width=2)

        if direction == 'east':
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
            if extra:
                # re-draw on flipped (extra already drawn below)
                pass
            return img

    if extra:
        extra(draw, direction, anim, bob)

    return img

# ─── BLOB base (for slimes) ────────────────────────────────────────────────────

def draw_blob(direction, anim, body_c, eye_c, pupil_c, r=28, bubbles=None, name='slime'):
    img, draw = new_img()
    bob, *_ = anim_offsets(anim)

    squash_x = r + (2 if anim in ('move1','move2') else 0)
    squash_y = r - (2 if anim in ('move1','move2') else 0)
    cx, cy = 64, 80 + bob

    # Shadow
    el(draw, cx, cy + squash_y - 2, squash_x - 2, 6, (0,0,0,60))

    # Body blob
    el(draw, cx, cy, squash_x, squash_y, body_c)

    # Highlight
    el(draw, cx - 8, cy - 10, squash_x//3, squash_y//4, lt(body_c, 1.5))

    # Eyes
    eye_y = cy - squash_y // 3
    el(draw, cx - 10, eye_y, 8, 8, (255,255,255,255))
    el(draw, cx + 10, eye_y, 8, 8, (255,255,255,255))
    el(draw, cx - 10, eye_y, 5, 5, eye_c)
    el(draw, cx + 10, eye_y, 5, 5, eye_c)
    el(draw, cx - 9, eye_y - 1, 2, 2, pupil_c)
    el(draw, cx + 11, eye_y - 1, 2, 2, pupil_c)

    # Toxic bubbles
    if bubbles:
        offsets = [(20, -24), (-22, -20), (26, -10), (-18, 2)]
        for i, (bx_off, by_off) in enumerate(offsets):
            br = 5 - i % 2
            el(draw, cx + bx_off, cy + by_off, br, br, bubbles)

    return img

# ─── QUADRUPED base (hellhound) ───────────────────────────────────────────────

def draw_hound(direction, anim, body_c, eye_c, mane_c):
    img, draw = new_img()
    bob, ll_x, rl_x, *_ = anim_offsets(anim)

    if direction == 'south':
        # 4 paws bottom
        paw_y = 106 + bob
        fl_x = 40 + ll_x // 2
        fr_x = 76 + rl_x // 2
        bl_x = 44 + rl_x // 2
        br_x = 80 + ll_x // 2
        bx(draw, fl_x - 6, paw_y, 14, 12, dk(body_c, 0.75))
        bx(draw, fr_x - 6, paw_y, 14, 12, dk(body_c, 0.75))
        bx(draw, bl_x - 5, paw_y, 12, 10, dk(body_c, 0.65))
        bx(draw, br_x - 5, paw_y, 12, 10, dk(body_c, 0.65))

        # Legs
        bx(draw, fl_x - 5, 82 + bob, 12, 26, body_c)
        bx(draw, fr_x - 5, 82 + bob, 12, 26, body_c)
        bx(draw, bl_x - 4, 82 + bob, 10, 22, dk(body_c, 0.85))
        bx(draw, br_x - 4, 82 + bob, 10, 22, dk(body_c, 0.85))

        # Body
        el(draw, 64, 72 + bob, 28, 18, body_c)

        # Head
        el(draw, 64, 50 + bob, 18, 14, body_c)

        # Mane/collar
        el(draw, 64, 55 + bob, 16, 8, mane_c)

        # Snout
        el(draw, 64, 54 + bob, 10, 7, dk(body_c, 0.9))
        el(draw, 64, 56 + bob, 4, 3, (30, 10, 10, 255))  # nose

        # Eyes
        el(draw, 55, 46 + bob, 6, 5, eye_c)
        el(draw, 73, 46 + bob, 6, 5, eye_c)
        el(draw, 55, 46 + bob, 3, 3, (255,80,0,255))
        el(draw, 73, 46 + bob, 3, 3, (255,80,0,255))

        # Ears
        tri(draw, [(52,40+bob),(44,28+bob),(58,36+bob)], mane_c)
        tri(draw, [(76,40+bob),(84,28+bob),(70,36+bob)], mane_c)

        # Tail stub
        el(draw, 88, 62 + bob, 6, 8, mane_c)

    elif direction == 'north':
        paw_y = 106 + bob
        for px2 in [40, 55, 73, 86]:
            bx(draw, px2 - 5, paw_y, 12, 10, dk(body_c, 0.7))
        for lx2 in [40, 55, 73, 86]:
            bx(draw, lx2 - 4, 82 + bob, 10, 24, dk(body_c, 0.8))
        el(draw, 64, 72 + bob, 26, 17, dk(body_c, 0.85))
        el(draw, 64, 50 + bob, 16, 14, dk(body_c, 0.85))
        el(draw, 64, 46 + bob, 14, 8, dk(mane_c, 0.9))
        # Tail (prominent from back)
        el(draw, 64, 58 + bob, 10, 14, mane_c)
        el(draw, 64, 44 + bob, 10, 18, mane_c)

    elif direction in ('west', 'east'):
        ll = ll_x if direction == 'west' else rl_x
        rl2 = rl_x if direction == 'west' else ll_x
        paw_y = 106 + bob

        # Far legs
        bx(draw, 70, 86 + bob + ll//2, 10, 22, dk(body_c, 0.75))
        bx(draw, 55, 86 + bob + rl2//2, 10, 20, dk(body_c, 0.7))
        bx(draw, 70, paw_y, 12, 10, dk(body_c, 0.7))
        bx(draw, 55, paw_y, 12, 10, dk(body_c, 0.65))

        # Body
        el(draw, 58, 72 + bob, 24, 16, body_c)

        # Near legs
        bx(draw, 42, 86 + bob + rl2//2, 11, 22, body_c)
        bx(draw, 58, 86 + bob + ll//2, 11, 24, body_c)
        el(draw, 46, paw_y + 10, 9, 5, dk(body_c, 0.8))
        el(draw, 62, paw_y + 10, 9, 5, dk(body_c, 0.8))

        # Head (profile)
        el(draw, 44, 50 + bob, 16, 14, body_c)
        # Snout extended
        el(draw, 32, 54 + bob, 14, 8, dk(body_c, 0.9))
        el(draw, 24, 56 + bob, 4, 3, (30,10,10,255))

        # Mane
        el(draw, 48, 55 + bob, 12, 8, mane_c)

        # Eye
        el(draw, 40, 46 + bob, 5, 5, eye_c)
        el(draw, 40, 46 + bob, 3, 3, (255,80,0,255))

        # Ear
        tri(draw, [(42,38+bob),(38,26+bob),(52,36+bob)], mane_c)

        # Tail
        el(draw, 74, 62 + bob, 8, 12, mane_c)
        el(draw, 76, 56 + bob, 6, 10, mane_c)

        if direction == 'east':
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
            return img

    return img

# ─── ENEMY DRAW FUNCTIONS ─────────────────────────────────────────────────────

ZOMBIE_SKIN  = (85,  195, 90,  255)
ZOMBIE_CLOTH = (75,  72,  82,  255)
ZOMBIE_CLOTH2= (65,  62,  72,  255)
ZOMBIE_EYE   = (255, 50,  50,  255)

def draw_smile_zombie(direction, anim):
    return draw_humanoid(direction, anim,
        skin=ZOMBIE_SKIN, cloth=ZOMBIE_CLOTH, cloth2=ZOMBIE_CLOTH2,
        eye_c=ZOMBIE_EYE, grin=True)


def draw_shield_zombie(direction, anim):
    def shield_extra(draw, dir_, anim_, bob):
        if dir_ == 'south':
            bx(draw, 24, 50 + bob, 16, 30, (130,90,50,255))
            el(draw, 32, 65 + bob, 10, 18, (150,110,60,255))
            bx(draw, 30, 62 + bob, 4, 12, (80,55,30,255))
        elif dir_ == 'west':
            bx(draw, 22, 50 + bob, 14, 28, (140,100,55,255))
            el(draw, 29, 65 + bob, 8, 16, (160,120,65,255))
    return draw_humanoid(direction, anim,
        skin=ZOMBIE_SKIN, cloth=(80,58,38,255), cloth2=(90,65,42,255),
        eye_c=(255,80,50,255), grin=False, body_w=42, stocky=True,
        extra=shield_extra)


def draw_slime(direction, anim):
    return draw_blob(direction, anim,
        body_c=(60, 210, 85, 230),
        eye_c=(80, 255, 100, 255),
        pupil_c=(20, 120, 40, 255))


IMP_SKIN  = (230, 110, 40, 255)
IMP_WING  = (200,  80, 30, 255)
IMP_EYE   = (255, 220, 50, 255)

def draw_bomb_imp(direction, anim):
    def bomb_extra(draw, dir_, anim_, bob):
        # Small wings
        if dir_ == 'south':
            tri(draw, [(38,58+bob),(22,44+bob),(38,50+bob)], IMP_WING)
            tri(draw, [(90,58+bob),(106,44+bob),(90,50+bob)], IMP_WING)
        elif dir_ == 'west':
            tri(draw, [(36,58+bob),(18,46+bob),(36,52+bob)], IMP_WING)
        elif dir_ == 'north':
            # Bomb visible on back
            el(draw, 64, 62 + bob, 12, 12, (120,120,130,255))
            el(draw, 64, 52 + bob, 4, 4, (80,80,90,255))
            bx(draw, 62, 50 + bob, 4, 14, (100,100,110,255))
            tri(draw, [(38,58+bob),(22,44+bob),(38,52+bob)], IMP_WING)
            tri(draw, [(90,58+bob),(106,44+bob),(90,52+bob)], IMP_WING)
    return draw_humanoid(direction, anim,
        skin=IMP_SKIN, cloth=(60,30,80,255), cloth2=(50,20,70,255),
        eye_c=IMP_EYE, grin=False, body_w=32, head_r=16,
        extra=bomb_extra)


def draw_hellhound(direction, anim):
    return draw_hound(direction, anim,
        body_c=(140, 35, 35, 255),
        eye_c=(255, 160, 30, 255),
        mane_c=(80, 15, 15, 255))


def draw_elite_jumper(direction, anim):
    SPOT = (230, 220, 40, 255)
    def clown_extra(draw, dir_, anim_, bob):
        if dir_ == 'south':
            # Polka dot spots on body
            el(draw, 52, 60 + bob, 5, 5, SPOT)
            el(draw, 68, 70 + bob, 5, 5, SPOT)
            el(draw, 76, 58 + bob, 4, 4, SPOT)
            # Party hat
            tri(draw, [(64, 4+bob),(54, 20+bob),(74, 20+bob)], (200,50,200,255))
            el(draw, 64, 6 + bob, 4, 4, SPOT)
        elif dir_ == 'west':
            el(draw, 50, 62 + bob, 5, 5, SPOT)
            el(draw, 60, 72 + bob, 4, 4, SPOT)
            tri(draw, [(54, 4+bob),(46, 20+bob),(62, 20+bob)], (200,50,200,255))
        elif dir_ == 'north':
            el(draw, 52, 60 + bob, 5, 5, SPOT)
            el(draw, 72, 70 + bob, 5, 5, SPOT)
        elif dir_ == 'east':
            pass  # flipped west handles this
    return draw_humanoid(direction, anim,
        skin=ZOMBIE_SKIN,
        cloth=(200, 50, 200, 255),
        cloth2=(180, 30, 180, 255),
        eye_c=ZOMBIE_EYE, grin=True,
        tall=True, head_r=18,
        extra=clown_extra)


def draw_elite_drummer(direction, anim):
    DRUM_C = (130, 70, 30, 255)
    def drum_extra(draw, dir_, anim_, bob):
        if dir_ == 'south':
            # Drum hanging at waist
            el(draw, 64, 80 + bob, 20, 14, DRUM_C)
            el(draw, 64, 68 + bob, 20, 8, lt(DRUM_C, 1.3))
            # Drumsticks
            draw.line([(46, 56+bob), (56, 76+bob)], fill=(240,220,180,255), width=3)
            draw.line([(82, 56+bob), (72, 76+bob)], fill=(240,220,180,255), width=3)
        elif dir_ == 'west':
            el(draw, 52, 78 + bob, 14, 12, DRUM_C)
            el(draw, 52, 68 + bob, 14, 8, lt(DRUM_C, 1.3))
            draw.line([(36, 56+bob), (46, 74+bob)], fill=(240,220,180,255), width=3)
    return draw_humanoid(direction, anim,
        skin=(60, 30, 80, 255),
        cloth=(40, 18, 60, 255),
        cloth2=(35, 14, 52, 255),
        eye_c=(200, 60, 255, 255), grin=False,
        stocky=True,
        extra=drum_extra)


def draw_pitcher_imp(direction, anim):
    FIRE = (255, 200, 50, 255)
    def fireball_extra(draw, dir_, anim_, bob):
        if dir_ == 'south':
            # Fireball in raised right hand
            cx2 = 64 + 22
            cy2 = 48 + bob + (la_swing(anim))
            el(draw, cx2, cy2, 10, 10, FIRE)
            el(draw, cx2, cy2,  6,  6, (255,255,180,255))
            # Fire glow
            for gr in range(3, 13, 4):
                el(draw, cx2, cy2, gr+8, gr+8, (255,150,50,max(0,100-gr*8)))
        elif dir_ == 'west':
            el(draw, 30, 46 + bob, 9, 9, FIRE)
            el(draw, 30, 46 + bob, 5, 5, (255,255,180,255))
        elif dir_ == 'east':
            pass  # handled by flip
        elif dir_ == 'north':
            pass
        # Small wings
        if dir_ == 'south':
            tri(draw, [(38,60+bob),(22,46+bob),(38,52+bob)], IMP_WING)
            tri(draw, [(90,60+bob),(106,46+bob),(90,52+bob)], IMP_WING)

    def la_swing(anim_):
        if anim_ == 'move1': return -8
        if anim_ == 'move2': return 8
        return 0

    return draw_humanoid(direction, anim,
        skin=(240, 130, 55, 255),
        cloth=(60, 30, 80, 255),
        cloth2=(50, 20, 70, 255),
        eye_c=IMP_EYE, grin=False, body_w=30, head_r=15,
        extra=fireball_extra)


def draw_toxic_slime(direction, anim):
    return draw_blob(direction, anim,
        body_c=(115, 40, 155, 210),
        eye_c=(80, 255, 100, 255),
        pupil_c=(30, 160, 50, 255),
        r=34,
        bubbles=(100, 255, 120, 200))


def draw_summoner_priest(direction, anim):
    ROBE  = (80,  28, 120, 255)
    ROBE2 = (60,  18,  90, 255)
    SKIN  = (200, 180, 160, 255)
    ORB   = (200, 100, 255, 255)

    def staff_extra(draw, dir_, anim_, bob):
        if dir_ == 'south':
            # Staff (left side)
            draw.line([(30, 20+bob), (38, 90+bob)], fill=(140,100,50,255), width=4)
            el(draw, 29, 18 + bob, 10, 10, ORB)
            el(draw, 29, 18 + bob,  6,  6, (230,160,255,255))
            # Glowing aura around orb
            el(draw, 29, 18 + bob, 14, 14, (180,80,255,60))
            # Hood rim
            bx(draw, 44, 12 + bob, 40, 6, ROBE2)
        elif dir_ == 'west':
            draw.line([(26, 22+bob), (32, 90+bob)], fill=(140,100,50,255), width=4)
            el(draw, 24, 20 + bob, 9, 9, ORB)
            el(draw, 24, 20 + bob, 5, 5, (230,160,255,255))
            el(draw, 24, 20 + bob, 13, 13, (180,80,255,60))
        elif dir_ == 'north':
            draw.line([(30, 20+bob), (36, 90+bob)], fill=(140,100,50,255), width=4)
            el(draw, 29, 18 + bob, 10, 10, ORB)
            el(draw, 29, 18 + bob, 14, 14, (180,80,255,60))
        elif dir_ == 'east':
            pass  # handled by west flip

    return draw_humanoid(direction, anim,
        skin=SKIN,
        cloth=ROBE,
        cloth2=ROBE2,
        eye_c=(200, 80, 255, 255),
        grin=False,
        body_w=38, head_r=20, tall=True,
        extra=staff_extra)


# ─── MAIN ──────────────────────────────────────────────────────────────────────

ENEMIES = {
    'enemy_smile_zombie':    draw_smile_zombie,
    'enemy_shield_zombie':   draw_shield_zombie,
    'enemy_slime':           draw_slime,
    'enemy_bomb_imp':        draw_bomb_imp,
    'enemy_hellhound':       draw_hellhound,
    'enemy_elite_jumper':    draw_elite_jumper,
    'enemy_elite_drummer':   draw_elite_drummer,
    'enemy_pitcher_imp':     draw_pitcher_imp,
    'enemy_toxic_slime':     draw_toxic_slime,
    'enemy_summoner_priest': draw_summoner_priest,
}

def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in ENEMIES.items():
        sheet = make_sheet(fn)
        path = os.path.join(OUT, f"{name}.png")
        sheet.save(path)
        print(f"  Generated: {name}.png  ({sheet.size[0]}x{sheet.size[1]})")
    print(f"\nDone — {len(ENEMIES)} sprite sheets written to:\n  {OUT}")

if __name__ == '__main__':
    main()
