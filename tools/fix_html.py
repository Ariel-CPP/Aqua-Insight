import os
import re

pages_dir = os.path.join(os.path.dirname(__file__), 'pages')

# Pattern to find malformed closing tags with data-i18n injected
pattern = re.compile(r'</([a-zA-Z0-9]+)\s+data-i18n="([^"]+)">([^<]+)<')

for filename in os.listdir(pages_dir):
    if filename.endswith(".html"):
        filepath = os.path.join(pages_dir, filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        fixed_content = pattern.sub(r'</\1> <span data-i18n="\2">\3</span><', content)

        if content != fixed_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(fixed_content)
            print(f"Fixed: {filename}")
        else:
            print(f"No fixes needed: {filename}")
