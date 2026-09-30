"""Build the examiner's animation rig from the reference picture.

Detects her face (incl. irises and eyebrows) and her writing hand, and writes public/examiner/rig.json, which the
PhotoRigRenderer uses to animate eyes, lids, brows, mouth, head, shoulders and the writing hand in the browser.

    pip install mediapipe numpy pillow
    curl -L -o face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
    curl -L -o hand_landmarker.task https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
    python scripts/build_rig.py public/examiner/room-scene.jpg face_landmarker.task hand_landmarker.task > public/examiner/rig.json

The crop boxes and the manual values below (pen, torso, desk) are tuned for the current picture; update them if the
picture changes. Small faces and hands are detected on an enlarged crop for precision.
"""

import json
import sys

import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions, HandLandmarker, HandLandmarkerOptions
from PIL import Image

FACE_CROP = (700, 260, 980, 560)
HAND_CROP = (560, 600, 960, 860)

# MediaPipe Face Mesh indices ("L"/"R" = left/right as seen in the picture).
FACE_POINTS = {
    "mouthLeft": 61, "mouthRight": 291,
    "upperLipTop": 0, "upperLipInner": 13, "lowerLipInner": 14, "lowerLipBottom": 17,
    "chin": 152, "jawLeft": 172, "jawRight": 397, "noseTip": 1, "forehead": 10,
    "eyeLOuter": 33, "eyeLInner": 133, "eyeLTop": 159, "eyeLBottom": 145, "irisL": 468,
    "eyeROuter": 263, "eyeRInner": 362, "eyeRTop": 386, "eyeRBottom": 374, "irisR": 473,
    "browLOuter": 70, "browLMid": 105, "browLInner": 107,
    "browROuter": 300, "browRMid": 334, "browRInner": 336,
}

# Not reliably detectable; measured on the picture (pixels).
PEN_TIP = (757, 781)
PEN_TOP = (668, 662)
TORSO = {"center": (800, 620), "radius": (270, 190)}
DESK_Y = 752


def detect(image: Image.Image, crop, run):
    x0, y0, x1, y1 = crop
    zoom = max(1.0, 768 / max(x1 - x0, y1 - y0))
    region = image.crop(crop).resize((round((x1 - x0) * zoom), round((y1 - y0) * zoom)), Image.LANCZOS)
    result = run(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(np.asarray(region))))
    return lambda lm: (x0 + lm.x * (x1 - x0), y0 + lm.y * (y1 - y0)), result


def main(photo: str, face_model: str, hand_model: str) -> None:
    image = Image.open(photo).convert("RGB")
    W, H = image.size

    with FaceLandmarker.create_from_options(FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=face_model))) as fl:
        to_px, face = detect(image, FACE_CROP, fl.detect)
    if not face.face_landmarks:
        sys.exit("No face found; adjust FACE_CROP.")
    lm = face.face_landmarks[0]
    points = {name: [round(v, 1) for v in to_px(lm[i])] for name, i in FACE_POINTS.items()}

    opts = HandLandmarkerOptions(base_options=BaseOptions(model_asset_path=hand_model), num_hands=2, min_hand_detection_confidence=0.2)
    with HandLandmarker.create_from_options(opts) as hl:
        to_px, hands = detect(image, HAND_CROP, hl.detect)
    if not hands.hand_landmarks:
        sys.exit("No hand found; adjust HAND_CROP.")
    hand = hands.hand_landmarks[0]
    points["wrist"] = [round(v, 1) for v in to_px(hand[0])]
    points["indexTip"] = [round(v, 1) for v in to_px(hand[8])]
    points["thumbTip"] = [round(v, 1) for v in to_px(hand[4])]
    points["penTip"] = list(PEN_TIP)
    points["penTop"] = list(PEN_TOP)

    rig = {
        "image": {"width": W, "height": H},
        "points": points,
        "torso": {"center": list(TORSO["center"]), "radius": list(TORSO["radius"])},
        "deskY": DESK_Y,
    }
    json.dump(rig, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main(*sys.argv[1:4])
