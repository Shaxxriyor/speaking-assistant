"""Detect the examiner's facial landmarks once and save them for the in-browser face animation.

Run again whenever you replace public/examiner/photo.jpg:

    pip install mediapipe
    curl -L -o face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
    python scripts/face_landmarks.py public/examiner/photo.jpg face_landmarker.task > public/examiner/face.json

When the face is small in a wide picture, pass a crop box around the face (x0,y0,x1,y1 in pixels); the crop is
enlarged before detection for more precise points, and the points are mapped back to the full image:

    python scripts/face_landmarks.py public/examiner/room-scene.jpg face_landmarker.task 700,260,980,560 > public/examiner/scene.json
"""

import json
import sys

import mediapipe as mp
import numpy as np
from PIL import Image
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions

# MediaPipe Face Mesh indices. "left"/"right" are as seen in the image.
POINTS = {
    "mouthLeft": 61, "mouthRight": 291,
    "upperLipTop": 0, "upperLipInner": 13, "lowerLipInner": 14, "lowerLipBottom": 17,
    "chin": 152, "jawLeft": 172, "jawRight": 397, "noseTip": 1,
    "eyeLOuter": 33, "eyeLInner": 133, "eyeLTop": 159, "eyeLBottom": 145,
    "eyeROuter": 263, "eyeRInner": 362, "eyeRTop": 386, "eyeRBottom": 374,
    "browL": 105, "browR": 334,
}


def main(photo: str, model: str, crop: str | None = None) -> None:
    full = Image.open(photo).convert("RGB")
    W, H = full.size
    x0, y0, x1, y1 = [int(v) for v in crop.split(",")] if crop else (0, 0, W, H)
    zoom = max(1.0, 768 / max(x1 - x0, y1 - y0))
    region = full.crop((x0, y0, x1, y1)).resize((round((x1 - x0) * zoom), round((y1 - y0) * zoom)), Image.LANCZOS)
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(np.asarray(region)))
    options = FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=model), num_faces=1)
    with FaceLandmarker.create_from_options(options) as landmarker:
        result = landmarker.detect(image)
    if not result.face_landmarks:
        sys.exit("No face found in the photo.")
    lm = result.face_landmarks[0]
    def to_full(i: int) -> list[float]:
        return [round((x0 + lm[i].x * (x1 - x0)) / W, 5), round((y0 + lm[i].y * (y1 - y0)) / H, 5)]

    out = {"width": W, "height": H, "points": {name: to_full(i) for name, i in POINTS.items()}}
    json.dump(out, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
