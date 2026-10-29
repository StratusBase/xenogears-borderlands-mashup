"""Rebuild the portable atlas after editing ../story.json or atlas-template.html.

Browser edits live in local browser storage and exported atlas revisions. Import
the exported JSON into ../story.json before rebuilding if those edits should be
the new workspace master. Never regenerate story.json from an earlier seed.
"""
from pathlib import Path
import json

source = Path(__file__).parent
root = source.parent
data = json.loads((root / 'story.json').read_text())
ids = {n['id'] for n in data['nodes']}
assert len(ids) == len(data['nodes']), 'Duplicate card IDs'
assert all(ref in ids for n in data['nodes'] for ref in n['links']), 'Missing association'
assert all(e['source'] in ids and e['target'] in ids for e in data['edges']), 'Missing event'
degree = dict.fromkeys(ids, 0)
for edge in data['edges']:
    degree[edge['target']] += 1
queue = [id for id, value in degree.items() if value == 0]
visited = 0
while queue:
    id = queue.pop()
    visited += 1
    for edge in data['edges']:
        if edge['source'] == id:
            degree[edge['target']] -= 1
            if degree[edge['target']] == 0:
                queue.append(edge['target'])
assert visited == len(ids), 'The causal graph contains a cycle'
embedded = json.dumps(data, ensure_ascii=False, indent=2).replace('<', '\\u003c')
template = (source / 'atlas-template.html').read_text()
(root / 'machines-made-gods-atlas.html').write_text(template.replace('__STORY_DATA__', embedded))
print(f"Built atlas: {len(data['nodes'])} cards, {len(data['edges'])} causal arrows")
