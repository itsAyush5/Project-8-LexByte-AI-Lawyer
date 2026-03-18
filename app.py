from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import json
import re
from datetime import datetime

import os

app = Flask(__name__, 
            static_folder='static',
            static_url_path='/static',
            template_folder='templates')

# Disable caching for static files to prevent CSS loading issues
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

CORS(app)

# Load Indian Constitution data
try:
    with open('constitution_data.json', 'r', encoding='utf-8') as f:
        constitution_data = json.load(f)
except (FileNotFoundError, json.JSONDecodeError) as e:
    print(f"Error loading constitution data: {e}")
    constitution_data = {"parts": [], "summary": {"articles_in_this_database": 0, "parts_covered": []}}

def search_articles(query):
    """Search for relevant constitutional articles based on user query"""
    query_lower = query.lower()
    results = []
    
    # Extract keywords from query
    keywords = re.findall(r'\b\w+\b', query_lower)
    
    # Search through all articles
    for part in constitution_data['parts']:
        for article in part['articles']:
            score = 0
            
            # Check if article number is mentioned
            if f"article {article['number']}" in query_lower or f"art {article['number']}" in query_lower:
                score += 100
            
            # Check keywords match
            for keyword in keywords:
                if keyword in article['keywords']:
                    score += 10
                if keyword in article['title'].lower():
                    score += 15
                if keyword in article['text'].lower():
                    score += 5
            
            # Check for specific legal terms
            legal_terms = {
                'fundamental rights': ['14', '15', '16', '17', '18', '19', '20', '21', '21A', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32'],
                'right to equality': ['14', '15', '16', '17', '18'],
                'right to freedom': ['19', '20', '21', '21A', '22'],
                'right against exploitation': ['23', '24'],
                'right to freedom of religion': ['25', '26', '27', '28'],
                'cultural and educational rights': ['29', '30'],
                'directive principles': list(range(36, 52)),
                'fundamental duties': ['51A'],
                'president': list(range(52, 78)),
                'parliament': list(range(79, 123)),
                'supreme court': list(range(124, 148)),
                'citizenship': ['5', '6', '7', '8', '9', '10', '11'],
                'privacy': ['21'],
                'property': ['300A', '31A', '31B', '31C'],
                'emergency': ['352', '356', '360'],
                'secular': ['25', '26', '27', '28'],
                'amnesty': ['72', '161'],
                'women': ['15', '39', '42', '51A'],
                'children': ['24', '39', '45'],
                'environment': ['48A', '51A'],
                'language': ['343', '344', '345']
            }
            
            for term, article_numbers in legal_terms.items():
                if term in query_lower and article['number'] in [str(n) for n in article_numbers]:
                    score += 20
            
            if score > 0:
                results.append({
                    'article': article,
                    'part': part['part'],
                    'part_title': part['title'],
                    'score': score
                })
    
    # Sort by relevance score
    results.sort(key=lambda x: x['score'], reverse=True)
    
    return results[:10]  # Return top 10 results

def generate_legal_advice(query, relevant_articles):
    """Generate AI legal advice based on query and relevant articles"""
    if not relevant_articles:
        return {
            'advice': "I couldn't find specific constitutional articles related to your query. Please try rephrasing your question or ask about specific fundamental rights, directive principles, or constitutional provisions.",
            'articles': [],
            'disclaimer': "This is an AI-generated response based on the Indian Constitution. For specific legal matters, please consult a qualified lawyer."
        }
    
    # Build advice based on top articles
    top_articles = relevant_articles[:5]
    
    advice_parts = []
    advice_parts.append("Based on the Indian Constitution, here's what I found:\n")
    
    for idx, result in enumerate(top_articles, 1):
        article = result['article']
        advice_parts.append(f"\n{idx}. **Article {article['number']}: {article['title']}** (Part {result['part']} - {result['part_title']})")
        advice_parts.append(f"   {article['text'][:300]}{'...' if len(article['text']) > 300 else ''}\n")
    
    # Add contextual advice based on query type
    query_lower = query.lower()
    advice_added = False
    
    if any(word in query_lower for word in ['right', 'rights', 'can i', 'allowed']):
        if not advice_added: advice_parts.append("\n**Legal Interpretation:**")
        advice_parts.append("The above constitutional provisions establish your rights and protections under Indian law. These are fundamental guarantees that the State must respect.")
        advice_added = True
    
    if any(word in query_lower for word in ['arrest', 'detention', 'police']):
        advice_parts.append("\n**Important Rights regarding Arrest:**")
        advice_parts.append("- You have the right to be informed of grounds for arrest (Article 22)")
        advice_parts.append("- Right to legal representation of your choice")
        advice_parts.append("- Must be produced before magistrate within 24 hours")
        advice_parts.append("- Protection against self-incrimination (Article 20)")
        advice_added = True
    
    if any(word in query_lower for word in ['discrimination', 'equality', 'equal']):
        advice_parts.append("\n**Equality Provisions:**")
        advice_parts.append("The Constitution guarantees equality before law (Article 14) and prohibits discrimination on grounds of religion, race, caste, sex, or place of birth (Article 15).")
        advice_added = True
    
    if any(word in query_lower for word in ['speech', 'expression', 'freedom']):
        advice_parts.append("\n**Freedom of Speech:**")
        advice_parts.append("Article 19(1)(a) guarantees freedom of speech and expression, subject to reasonable restrictions in the interest of sovereignty, security, public order, decency, morality, contempt of court, defamation, or incitement to an offence.")
        advice_added = True

    if any(word in query_lower for word in ['emergency', 'president rule']):
        advice_parts.append("\n**Emergency Provisions:**")
        advice_parts.append("The Constitution provides for National Emergency (Art 352), State Emergency (Art 356), and Financial Emergency (Art 360). During emergency, some fundamental rights may be suspended.")
        advice_added = True

    if any(word in query_lower for word in ['environment', 'forest', 'wildlife']):
        advice_parts.append("\n**Environmental Protection:**")
        advice_parts.append("Article 48A (DPSP) and Article 51A(g) (Fundamental Duties) mandate the protection and improvement of the environment.")
        advice_added = True

    if any(word in query_lower for word in ['language', 'hindi', 'english', 'official']):
        advice_parts.append("\n**Official Language:**")
        advice_parts.append("Article 343 declares Hindi in Devanagari script as the official language of the Union, with English continued for official purposes.")
        advice_added = True
    
    return {
        'advice': '\n'.join(advice_parts),
        'articles': [
            {
                'number': r['article']['number'],
                'title': r['article']['title'],
                'text': r['article']['text'],
                'part': r['part'],
                'part_title': r['part_title']
            }
            for r in top_articles
        ],
        'disclaimer': "⚖️ **Legal Disclaimer:** This is an AI-generated response based on the Indian Constitution. It is for informational purposes only and does not constitute legal advice. For specific legal matters, please consult a qualified lawyer or legal professional."
    }

@app.route('/')
def index():
    """Serve the main application page"""
    return render_template('index.html')

@app.route('/api/consult', methods=['POST'])
def consult():
    """Handle legal consultation requests"""
    data = request.get_json()
    query = data.get('query', '')
    
    if not query:
        return jsonify({'error': 'No query provided'}), 400
    
    # Search for relevant articles
    relevant_articles = search_articles(query)
    
    # Generate legal advice
    response = generate_legal_advice(query, relevant_articles)
    
    return jsonify({
        'query': query,
        'timestamp': datetime.now().isoformat(),
        'response': response
    })

@app.route('/api/articles', methods=['GET'])
def get_articles():
    """Get all articles or search by part"""
    part = request.args.get('part', None)
    search = request.args.get('search', '').lower()
    
    if part:
        # Return articles from specific part
        for p in constitution_data['parts']:
            if p['part'] == part:
                return jsonify({
                    'part': p['part'],
                    'title': p['title'],
                    'articles': p['articles']
                })
        return jsonify({'error': 'Part not found'}), 404
    
    if search:
        # Search articles
        results = search_articles(search)
        return jsonify({
            'results': [
                {
                    'number': r['article']['number'],
                    'title': r['article']['title'],
                    'text': r['article']['text'],
                    'part': r['part'],
                    'part_title': r['part_title']
                }
                for r in results
            ]
        })
    
    # Return all parts summary
    return jsonify({
        'parts': [
            {
                'part': p['part'],
                'title': p['title'],
                'article_count': len(p['articles'])
            }
            for p in constitution_data['parts']
        ],
        'summary': constitution_data['summary']
    })

@app.route('/api/article/<article_number>', methods=['GET'])
def get_article(article_number):
    """Get specific article by number"""
    for part in constitution_data['parts']:
        for article in part['articles']:
            if article['number'] == article_number:
                return jsonify({
                    'article': article,
                    'part': part['part'],
                    'part_title': part['title']
                })
    
    return jsonify({'error': 'Article not found'}), 404

if __name__ == '__main__':
    print("🏛️  AI Lawyer - Indian Constitution Legal Assistant")
    print("=" * 60)

    # Control whether to start the Flask server using an environment variable.
    # To skip starting Flask (for example when serving static files via a live server),
    # set the environment variable `SKIP_FLASK=1` (or `true`, `yes`).
    skip_flask = os.environ.get('SKIP_FLASK', '').lower() in ('1', 'true', 'yes')

    # Optionally open the `templates/index.html` in the default browser when skipping Flask.
    open_browser = os.environ.get('OPEN_BROWSER', '').lower() in ('1', 'true', 'yes')

    if skip_flask:
        print("Skipping Flask server because SKIP_FLASK is set.")
        if open_browser:
            try:
                import webbrowser
                file_path = os.path.abspath('templates/index.html')
                webbrowser.open(f'file://{file_path}')
                print(f"Opened {file_path} in default browser.")
            except Exception as e:
                print("Failed to open browser:", e)
    else:
        print("Server starting on http://localhost:5000")
        print("=" * 60)
        app.run(debug=True, port=5000)
