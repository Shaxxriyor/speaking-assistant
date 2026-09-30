"""Seat the examiner in the exam room.

Produces, in public/examiner/:
  room.jpg    the room with a soft shadow where she sits (static background plate)
  person.png  her cut-out, room-sized with transparency (animated in the browser)
  scene.json  facial landmarks + desk line in room coordinates, for the live animation
  scene.jpg   still composite, shown when the browser can't run the animation

    pip install mediapipe opencv-python-headless pillow numpy
    curl -L -o selfie_multiclass.tflite https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite
    python scripts/compose_scene.py room-source.png selfie_multiclass.tflite

Placement numbers below are tuned for the current room image and photo.
"""

import json
import sys

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import ImageSegmenter, ImageSegmenterOptions
from PIL import Image

OUT = "public/examiner"
PHOTO = f"{OUT}/photo.jpg"
FACE = f"{OUT}/face.json"

SCALE = 0.30          # photo px -> room px
CHIN_AT = (878, 470)  # where her chin lands in the room (in front of the chair back)
DESK_Y = 707          # top edge of the desk in the room; she is hidden below it


def person_mask(photo_path: str, model: str) -> np.ndarray:
    img = mp.Image.create_from_file(photo_path)
    opts = ImageSegmenterOptions(base_options=BaseOptions(model_asset_path=model), output_confidence_masks=True)
    with ImageSegmenter.create_from_options(opts) as seg:
        res = seg.segment(img)
    conf = 1.0 - res.confidence_masks[0].numpy_view()[..., 0]  # 1 - background
    # Keep only the main silhouette (drops stray blobs from the car window), fill holes.
    hard = (conf > 0.5).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(hard)
    main = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    hard = (labels == main).astype(np.uint8)
    hard = cv2.morphologyEx(hard, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    hard = cv2.morphologyEx(hard, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    soft = cv2.GaussianBlur(hard.astype(np.float32), (0, 0), 2.0)
    return np.clip(soft, 0, 1)


def main(room_path: str, model: str) -> None:
    room = np.asarray(Image.open(room_path).convert("RGB"), np.float32)
    RH, RW = room.shape[:2]
    photo = np.asarray(Image.open(PHOTO).convert("RGB"), np.float32)
    face = json.load(open(FACE))
    ph, pw = photo.shape[:2]

    # Match her to the room's softer, more neutral light.
    lum = photo.mean(axis=2, keepdims=True)
    photo = lum + (photo - lum) * 0.9
    photo = photo * np.array([0.98, 0.99, 1.02]) * 0.97

    mask = person_mask(PHOTO, model)
    p = face["points"]
    P = lambda k: np.array([p[k][0] * pw, p[k][1] * ph])  # noqa: E731

    # Keep only a head-shaped region of the segmentation (drops car-window leftovers beside the hijab).
    jaw_w = P("jawRight")[0] - P("jawLeft")[0]
    head_c = (P("jawLeft") + P("jawRight")) / 2 - [0, jaw_w * 0.35]
    prior = np.zeros((ph, pw), np.uint8)
    cv2.ellipse(prior, (int(head_c[0]), int(head_c[1])), (int(jaw_w * 0.98), int(jaw_w * 1.45)), 0, 0, 360, 1, -1)
    prior[int(P("chin")[1] + jaw_w * 0.1):, :] = 1  # everything below the chin is her drape
    mask = mask * cv2.GaussianBlur(prior.astype(np.float32), (0, 0), 6)

    # Place the photo in the room so her chin sits at CHIN_AT.
    chin = P("chin")
    ox, oy = CHIN_AT[0] - chin[0] * SCALE, CHIN_AT[1] - chin[1] * SCALE
    M = np.array([[SCALE, 0, ox], [0, SCALE, oy]], np.float32)
    photo_r = cv2.warpAffine(photo, M, (RW, RH), flags=cv2.INTER_AREA)
    mask_r = cv2.warpAffine(mask, M, (RW, RH), flags=cv2.INTER_LINEAR)
    frame = cv2.warpAffine(np.ones((ph, pw), np.float32), M, (RW, RH), flags=cv2.INTER_LINEAR)
    frame = cv2.erode(frame, np.ones((9, 9), np.uint8))
    frame = cv2.GaussianBlur(frame, (0, 0), 5)
    photo_a = mask_r * frame

    # Her body below the photo: sloping shoulders under the hijab, down behind the desk.
    cx, cy = CHIN_AT
    jw = jaw_w * SCALE
    sil = np.zeros((RH, RW), np.uint8)
    # Right-hand outline in jaw widths from the chin: the drape falls from the hijab, rounds over the shoulder,
    # then drops behind the desk. Smoothed with Chaikin subdivision; mirrored for the left side.
    ctrl = [(0.9, -0.15), (1.0, 0.3), (1.2, 0.62), (1.5, 0.85), (1.72, 1.08), (1.82, 1.45), (1.86, 2.4), (1.9, 4.0)]
    for _ in range(4):
        ctrl = [ctrl[0]] + [pt for a, b in zip(ctrl, ctrl[1:]) for pt in ((0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]))] + [ctrl[-1]]
    right = [(cx + x * jw, cy + y * jw) for x, y in ctrl]
    left = [(2 * cx - x, y) for x, y in right][::-1]
    sh_hw = 1.86 * jw
    poly = left + right + [(cx + 1.9 * jw, DESK_Y + 30), (cx - 1.9 * jw, DESK_Y + 30)]
    cv2.fillPoly(sil, [np.array(poly, np.int32)], 1)
    sil = cv2.GaussianBlur(sil.astype(np.float32), (0, 0), 1.2)

    # Fabric: the photo's own drape colour, lit from above, with soft vertical folds.
    drape = photo[int(ph * 0.88):, int(pw * 0.25):int(pw * 0.75)].reshape(-1, 3)
    fabric = np.median(drape, axis=0)
    yy, xx = np.mgrid[0:RH, 0:RW].astype(np.float32)
    rng = np.random.default_rng(7)
    folds = cv2.GaussianBlur(rng.normal(0, 1, (RH, RW)).astype(np.float32), (0, 0), sigmaX=7, sigmaY=40)
    folds /= np.abs(folds).max() + 1e-6
    top_light = 1.0 + 0.45 * np.exp(-((yy - (cy + jw * 0.6)) / (jw * 0.7)) ** 2) * np.clip(np.abs(xx - cx) / sh_hw, 0, 1)
    synth = fabric[None, None, :] * (top_light + 0.35 * folds)[..., None] + 3

    rgb_r = synth * (1 - photo_a[..., None]) + photo_r * photo_a[..., None]
    m_r = np.maximum(photo_a, sil)

    # Soft contact shadow on the chair/wall behind her.
    shadow = cv2.GaussianBlur(cv2.warpAffine(m_r, np.float32([[1, 0, 10], [0, 1, 6]]), (RW, RH)), (0, 0), 14)
    shadow[DESK_Y:] = 0
    plate = room * (1 - 0.35 * shadow[..., None])

    Image.fromarray(np.clip(plate, 0, 255).astype(np.uint8)).save(f"{OUT}/room.jpg", quality=86, optimize=True, progressive=True)
    rgba = np.dstack([np.clip(rgb_r, 0, 255), np.clip(m_r * 255, 0, 255)]).astype(np.uint8)
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    Image.fromarray(rgba).save(f"{OUT}/person.png", optimize=True)

    # Still composite for devices without WebGL.
    a = m_r[..., None].copy()
    a[DESK_Y:] = 0
    still = plate * (1 - a) + rgb_r * a
    Image.fromarray(np.clip(still, 0, 255).astype(np.uint8)).save(f"{OUT}/scene.jpg", quality=86, optimize=True, progressive=True)

    points = {k: [round((v[0] * pw * SCALE + ox) / RW, 5), round((v[1] * ph * SCALE + oy) / RH, 5)] for k, v in p.items()}
    json.dump(
        {"width": RW, "height": RH, "deskY": DESK_Y, "bounds": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())], "points": points},
        open(f"{OUT}/scene.json", "w"),
        indent=2,
    )
    print("person bounds", xs.min(), ys.min(), xs.max(), ys.max())


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
