"""Prueba de una conversación completa: Thommy debe mantener el contexto entre turnos."""


def test_thommy_keeps_context(client):
    r = client.post("/session/start", json={"student_id": "ctx-student", "level": "B1", "topic": "pets",
                                            "learning_goal": "Describe a pet", "student_name": "Ana"})
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    print("\nTHOMMY:", r.json()["greeting"])

    turns = [
        "I have a dog. His name is Rocky and he is three years old.",
        "He likes playing in the park with a red ball.",
        "Do you remember my dog's name and what he likes to play with?",
    ]
    replies = []
    for msg in turns:
        r = client.post("/conversation/text", json={"session_id": sid, "message": msg, "include_audio": False})
        assert r.status_code == 200, r.text
        replies.append(r.json()["reply"])
        print("STUDENT:", msg, "\nTHOMMY:", replies[-1])

    last = replies[-1].lower()
    assert "rocky" in last, f"Thommy forgot the dog's name: {replies[-1]}"
    assert "ball" in last or "park" in last, f"Thommy forgot the activity: {replies[-1]}"
    # No debe mezclar datos de los ejemplos del prompt (fuga de ejemplos en modelos pequeños).
    for leaked in ("luna", "sofa", "hospital", "grandparents", "mountains"):
        assert leaked not in last, f"Thommy mixed in prompt-example facts ('{leaked}'): {replies[-1]}"

    progress = client.get(f"/session/{sid}/progress").json()
    assert progress["student_turns"] == 3
    end = client.post("/session/end", json={"session_id": sid}).json()
    print("SUMMARY:", end["summary"])
    assert end["status"] == "ended"
