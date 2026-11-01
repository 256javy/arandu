"""Labelled answers sent through POST /api/tutor/turn; reports how often the LLM judge agrees."""
import json
import sys
import time
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"

CASES = [
    ("fractions.explain-compare", True, "El de mamá, porque a 3/4 le falta un cuarto y a 2/3 le falta un tercio, que es más grande"),
    ("fractions.explain-compare", True, "3/4 es mas xq si los pasas a doceavos son 9 contra 8"),
    ("fractions.explain-compare", True, "el de mi mama, los cuartos son mas chiquitos pero tiene 3 y le falta menos"),
    ("fractions.explain-compare", False, "El de mi hermano porque 2/3 tiene números más chicos"),
    ("fractions.explain-compare", False, "el de mamá"),
    ("fractions.explain-compare", False, "3/4 porque 4 es más grande que 3"),
    ("fractions.explain-equivalence", True, "No, porque si cortás el chocolate en cuatro y agarrás dos, es la mitad igual"),
    ("fractions.explain-equivalence", True, "no tiene razon son iguales, 2 cuartos forman una mitad"),
    ("fractions.explain-equivalence", True, "Son lo mismo porque si multiplicas 1/2 por 2 arriba y abajo da 2/4"),
    ("fractions.explain-equivalence", False, "Sí tiene razón porque 4 es más que 2"),
    ("fractions.explain-equivalence", False, "son iguales"),
    ("fractions.explain-equivalence", False, "no se, me gusta el chocolate"),
]


def call(path, body=None, token=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json",
                                          **({"Authorization": "Bearer " + token} if token else {})})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read() or b"null")


token = call("/api/auth/signup", {"email": f"judge-{time.time_ns()}@example.com", "password": "judge-pass-1"})["token"]
agree = 0
for exercise, expected, answer in CASES:
    learner = call("/api/learners", {"nickname": "Juez"}, token)["id"]
    res = call("/api/tutor/turn", {"learnerId": learner, "exerciseId": exercise, "event": "submitted",
                                   "message": answer, "history": []}, token)
    got = res["evidence"][0]["ok"] if res["evidence"] else None
    agree += got == expected
    print(f"{'OK ' if got == expected else 'BAD'} expected={expected!s:5} got={got!s:5} {exercise.split('.')[1]:18} {answer[:60]}")
print(f"agreement: {agree}/{len(CASES)}")
