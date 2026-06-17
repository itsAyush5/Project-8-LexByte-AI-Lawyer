import os
import json
import threading
import time
import webbrowser
from flask import Flask, render_template, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from dotenv import load_dotenv
from google import genai

load_dotenv()

class AI_Lawyer_App:
    def __init__(self):
        self.app = Flask(__name__,
                         static_folder='static',
                         static_url_path='/static',
                         template_folder='.')
        CORS(self.app)

        self.open_browser_on_start = os.environ.get('OPEN_BROWSER', '0').lower() in ('1', 'true', 'yes')
        self.constitution_data = self._load_data()
        self.client = self._init_ai()
        self._setup_routes()

    def _load_data(self):
        try:
            path = os.path.join('static', 'constitution_data.json')
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading constitution data: {e}")
        return {"parts": []}

    def _init_ai(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            print("Warning: GEMINI_API_KEY not found in .env")
            return None
        try:
            client = genai.Client(api_key=api_key)
            print("Gemini client initialized (google.genai)")
            return client
        except Exception as e:
            print(f"Error initializing Gemini: {e}")
            return None

    def _setup_routes(self):
        @self.app.route('/')
        def index():
            return render_template('index.html')

        @self.app.route('/api/consult', methods=['POST'])
        def consult():
            if not self.client:
                return jsonify({'error': 'AI service not configured. Check GEMINI_API_KEY.'}), 503

            data = request.get_json() or {}
            question = data.get('question') or data.get('query', '')
            if not question:
                return jsonify({'error': 'No question provided'}), 400

            return Response(
                stream_with_context(self._stream_response(question)),
                mimetype='text/event-stream',
                headers={
                    'Cache-Control': 'no-cache',
                    'X-Accel-Buffering': 'no',
                    'Connection': 'keep-alive'
                }
            )

        @self.app.route('/api/articles', methods=['GET'])
        def get_articles():
            search = request.args.get('search', '').lower()
            if search:
                return jsonify({'results': self._search_internal(search)})
            return jsonify(self.constitution_data)

    def _search_internal(self, query):
        results = []
        for p in self.constitution_data.get('parts', []):
            for a in p.get('articles', []):
                if (query in a.get('title', '').lower()
                        or query in a.get('text', '').lower()
                        or query == str(a.get('number', ''))):
                    results.append({
                        'number': a['number'],
                        'title': a.get('title', ''),
                        'text': a.get('text', ''),
                        'part': p['part'],
                        'part_title': p['title']
                    })
        return results[:20]

    def _stream_response(self, question):
        prompt = f"""You are an expert AI Lawyer specializing in the Constitution of India.

User Question: "{question}"

Write a clear, informative answer in flowing paragraphs. Cite Article numbers inline naturally (e.g. 'Under Article 21...').
Do NOT use numbered lists, bullet points, markdown formatting, or bold text. Just write clean plain-text paragraphs.
Keep it concise: 3-5 paragraphs max.
End with a brief disclaimer that this is general legal information, not a substitute for professional legal advice.
"""

        MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']

        for model_id in MODELS:
            try:
                response = self.client.models.generate_content_stream(
                    model=model_id,
                    contents=prompt
                )
                for chunk in response:
                    if chunk.text:
                        # Send each chunk as an SSE event
                        data = json.dumps({'text': chunk.text})
                        yield f"data: {data}\n\n"

                # Signal end of stream
                yield f"data: {json.dumps({'done': True})}\n\n"
                return

            except Exception as e:
                print(f"Model {model_id} failed: {e}")
                continue

        # All models failed
        error_data = json.dumps({'text': f'Sorry, the AI service encountered an error. Please try again.', 'done': True})
        yield f"data: {error_data}\n\n"

    def run(self):
        if self.open_browser_on_start:
            threading.Thread(
                target=lambda: (time.sleep(2), webbrowser.open("http://localhost:5000")),
                daemon=True
            ).start()
        self.app.run(debug=False, port=5000)


if __name__ == "__main__":
    ai_lawyer = AI_Lawyer_App()
    ai_lawyer.run()
