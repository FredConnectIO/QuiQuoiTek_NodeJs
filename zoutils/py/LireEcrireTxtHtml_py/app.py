from flask import Flask, render_template, request, jsonify
from pathlib import Path

app = Flask(__name__)

FICHIER = Path("text.txt")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/enregistrer", methods=["POST"])
def enregistrer():
    data = request.get_json()

    texte = data.get("texte", "")

    FICHIER.write_text(texte, encoding="utf-8")

    return jsonify({"status": "ok"})


@app.route("/lire", methods=["GET"])
def lire():
    if not FICHIER.exists():
        return ""

    return FICHIER.read_text(encoding="utf-8")


if __name__ == "__main__":
    app.run(debug=True)