"""Detect the examiner's facial landmarks once and save them for the in-browser face animation.

Run again whenever you replace public/examiner/photo.jpg:

    pip install mediapipe
    curl -L -o face_landmarker.task https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
    python scripts/face_landmarks.py public/examiner/photo.jpg face_landmarker.task > public/examiner/face.json
"""

import json
import sys

import mediapipe as mp
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


def main(photo: str, model: str) -> None:
    image = mp.Image.create_from_file(photo)
    options = FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=model), num_faces=1)
    with FaceLandmarker.create_from_options(options) as landmarker:
        result = landmarker.detect(image)
    if not result.face_landmarks:
        sys.exit("No face found in the photo.")
    lm = result.face_landmarks[0]
    out = {
        "width": image.width,
        "height": image.height,
        "points": {name: [round(lm[i].x, 5), round(lm[i].y, 5)] for name, i in POINTS.items()},
    }
    json.dump(out, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
