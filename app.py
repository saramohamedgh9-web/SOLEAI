import os
import json
import uuid
import base64
import requests
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from dotenv import load_dotenv

load_dotenv(override=True)
app = Flask(__name__)
# Read secret key from environment for security, fallback to dev key
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "sneaker-studio-dev-key")

def get_hf_api_key():
    load_dotenv(override=True)
    return os.environ.get("HF_API_KEY", "").strip('\"\'')

HF_IMAGE_URL = "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell"

def hex_to_color_name(h):
    h = h.lstrip("#").lower()
    try: r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
    except: return h
    mx, mn = max(r,g,b), min(r,g,b)
    br, sat = mx/255, (mx-mn)/mx if mx else 0
    if br < 0.15: return "black"
    if br > 0.88 and sat < 0.15: return "white"
    if sat < 0.18: return "dark gray" if br < 0.4 else "gray" if br < 0.65 else "light gray"
    if mx == r: return ("orange" if g > 120 else "dark orange") if g > b+60 else "magenta" if b > g+40 else "red"
    if mx == g: return "yellow-green" if r > b+60 else "cyan-green" if b > r+40 else "green"
    if mx == b: return "purple" if r > g+60 else "cyan" if g > r+40 else "blue"
    return "colorful"

def build_image_prompt(prefs):
    p = hex_to_color_name(prefs["primary_color"])
    a = hex_to_color_name(prefs["accent_color"])
    prompt = (f"Professional product photography of a {prefs['style']} sneaker, "
              f"{p} {prefs['material']} upper, {a} accent, {a} heel, white sole, "
              f"side view, white background, sharp focus, 8k, shoe only")
    if prefs.get("inspiration"):
        prompt += f", {prefs['inspiration']} theme"
    return prompt

def generate_sneaker_image(prompt):
    hf_key = get_hf_api_key()
    if not hf_key:
        return None
    try:
        r = requests.post(HF_IMAGE_URL,
            headers={"Authorization": f"Bearer {hf_key}", "Content-Type": "application/json"},
            json={"inputs": prompt}, timeout=60)
        if r.status_code == 200 and r.headers.get("content-type","").startswith("image"):
            mime = r.headers["content-type"].split(";")[0].strip()
            return f"data:{mime};base64,{base64.b64encode(r.content).decode()}"
    except Exception:
        pass
    return None

# --- LESSON 6: SESSION HISTORY ---
def save_to_history(concept, prefs, image_url=None):
    session.setdefault("history", [])
    history_id = str(uuid.uuid4())[:8]
    entry = {
        "id": history_id,
        "timestamp": datetime.now().strftime("%b %d, %Y - %I:%M %p"),
        "concept": concept,
        "prefs": prefs,
        "image_url": image_url,
    }
    # Prepend new entry and keep only the last 20
    session["history"] = ([entry] + session["history"])[:20]
    return history_id

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/studio")
def studio():
    return render_template("studio.html", hcaptcha_site_key="")

@app.route("/history")
def history():
    # Read directly from session, fallback to empty list
    return render_template("history.html", designs=session.get("history", []))

@app.route("/clear-history", methods=["POST"])
def clear_history():
    # Safely pop the history key and redirect back
    session.pop("history", None)
    return redirect(url_for("history"))

@app.route("/generate", methods=["POST"])
def generate():
    prefs = request.get_json(silent=True) or {}
    
    # Mocking concept generation 
    concept = {
        "name": f"The {prefs.get('style', 'Sneaker').title()} Concept",
        "tagline": "AI Generated Sneaker Design",
        "colorways": []
    }
    concept["image_prompt"] = build_image_prompt(prefs)
    
    # LESSON 6: Save to session
    history_id = save_to_history(concept, prefs)
    
    return jsonify({"success": True, "concept": concept, "prefs": prefs, "history_id": history_id})

@app.route("/generate-image", methods=["POST"])
def generate_image():
    data   = request.get_json(silent=True) or {}
    prompt = data.get("image_prompt", "")
    history_id = data.get("history_id", "")
    
    if not prompt:
        return jsonify({"error": "No image prompt."}), 400
    if not get_hf_api_key():
        return jsonify({"error": "HF_API_KEY not configured."}), 503
    
    image_url = generate_sneaker_image(prompt)
    
    if not image_url:
        return jsonify({"error": "Image generation failed. Try again."}), 500
        
    # LESSON 6: Update the specific history entry with the new image
    if history_id and "history" in session:
        for entry in session["history"]:
            if entry["id"] == history_id:
                entry["image_url"] = image_url
                break
        session.modified = True
        
    return jsonify({"success": True, "image_url": image_url})

if __name__ == "__main__":
    app.run(debug=True, port=5000)