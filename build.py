import sys
src='src/'
js='\n'.join(open(src+f).read() for f in ['physics.js','audio.js','space.js','city.js','ui.js'])
js=js.replace("if (typeof module !== 'undefined') module.exports","if (typeof module !== 'undefined' && module.exports) module.exports")
page=open(src+'page.html').read()
def out(name, three):
    pre='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' if 'test' in name else ''
    html=pre+page+f'\n<script src="{three}"></script>\n<script>\n{js}\n</script>\n'
    open(name,'w').write(html)
out('dist/index.html','https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js')
out('dist/test.html','../node_modules/three/build/three.min.js')
print(len(js))
