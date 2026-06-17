import json

def build():
    with open('static/constitution_data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    articles = []
    for p in data.get('parts', []):
        for a in p.get('articles', []):
            articles.append({
                'number': str(a['number']),
                'title': str(a.get('title', '')),
                'part': f"Part {p['part']} — {p['title']}",
                'summary': str(a.get('text', ''))[:200]
            })
    with open('static/constitution-data.js', 'w', encoding='utf-8') as f:
        f.write('window.CONSTITUTION_ARTICLES = ' + json.dumps(articles) + ';')
    print('Data extraction complete!')

if __name__ == '__main__':
    build()
