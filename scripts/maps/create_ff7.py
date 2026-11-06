"""Build an original, editable FFVII fan map; no game textures are used.

python scripts/maps/create_ff7.py
cd map-generator && go run . --maps=finalfantasyvii

The macro geography follows the 1997 world, including the southern Temple.
Coasts and distances are simplified for OpenFront; sea travel is ordinary.
"""
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "map-generator/assets/maps/finalfantasyvii"
WIDTH, HEIGHT = 1920, 1440
# Percent coordinates: editable coast vertices, drawn independently from references.
COASTS = {
    "WUTAI": [(22,20),(21,25),(18,29),(18,34),(15,39),(15,45),(13,48),(13,52),(15,56),(20,54),(20.5,56),(19,58),(18,61),(20,64),(20,67),(21,68),(20,72),(17,72),(14,69),(13,64),(11,63),(10,58),(10,52),(10,46),(11,40),(13,35),(15,31),(17,27),(19,24)],
    "WESTERN CONTINENT": [(24,39),(28,36),(29,42),(32,45),(35,43),(39,38),(44,36),(47,39),(51,40),(50,43),(46,45),(48,46),(46,48),(47,52),(52,47),(52,51),(49,56),(49,59),(46,56),(45,61),(47,63),(49,59),(52,57),(52,66),(50,69),(48,70),(47,67),(45,69),(45,74),(48,76),(49,79),(46,82),(43,82),(39,85),(34,84),(30,82),(28,78),(27,73),(25,70),(26,67),(24,64),(27,62),(25,58),(22,57),(25,53),(27,51),(26,48),(23,47),(23,44),(21,42)],
    "NORTHERN CONTINENT": [(42,13),(48,8),(57,12),(52,17),(53,22),(50,25),(55,28),(59,27),(63,35),(58,38),(58,40),(55,42),(53,37),(51,35),(49,34),(44,33),(41,31),(36,33),(41,28),(44,28),(46,24),(43,23),(41,25),(40,21),(42,17)],
    "EASTERN CONTINENT": [(60,43),(64,39),(67,40),(69,38),(73,42),(75,40),(77,43),(80,42),(83,46),(82,49),(86,50),(88,46),(89,50),(87,56),(88,61),(84,63),(83,67),(80,67),(78,72),(74,75),(70,78),(65,79),(63,83),(60,81),(59,84),(55,83),(54,80),(58,76),(57,73),(60,68),(62,63),(60,60),(59,55),(56,53),(57,50),(55,49),(58,47)],
    "MIDEEL": [(68,83),(73,84),(75,81),(79,84),(82,84),(85,81),(88,83),(91,80),(93,77),(94,73),(95,75),(94,80),(92,84),(90,85),(89,88),(86,90),(82,90),(79,88),(75,89),(73,86),(70,86)],
    "TEMPLE OF THE ANCIENTS": [(54,86),(57,85),(60,87),(60,90),(58,92),(55,91),(53,89)],
    "GOBLIN ISLAND": [(80,27),(82,28),(84,31),(85,32),(84,35),(82,33),(81,30),(79,29)],
    "ROUND ISLAND": [(86,4),(88,4),(89,6),(88,9),(86,9),(85,7)],
    "CACTUS ISLAND": [(28,93),(30,92),(30,94),(29,96),(27,96),(27,94)],
}
COLORS = {"WUTAI":"#8aab74", "WESTERN CONTINENT":"#a6b57c", "NORTHERN CONTINENT":"#b5cbd1", "EASTERN CONTINENT":"#90a57d", "MIDEEL":"#78b092", "TEMPLE OF THE ANCIENTS":"#b6ae82", "GOBLIN ISLAND":"#85b489", "ROUND ISLAND":"#9ab78e", "CACTUS ISLAND":"#cab57a"}
# Location -> intended spawn. Names come from the separately editable enemy catalog.
SPAWNS = {
    "Midgar":(66,47),"Shinra HQ":(67,45),"Mako Reactor 1":(64,46),"Mako Reactor 5":(69,48),"Wall Market":(65,50),"Sector 7":(63,49),"Midgar Highway":(67,51),
    "Kalm":(74,49),"Chocobo Marsh":(77,56),"Mythril Mine":(72,62),"Junon":(61,57),"Underwater Reactor":(62,59),"Fort Condor":(65,69),"Cargo Ship":(61,61),
    "Costa del Sol":(47,42),"Mt. Corel":(43,47),"North Corel":(41,48),"Gold Saucer":(44,64),"Corel Prison":(42,66),"Gongaga":(37,78),"Cosmo Canyon":(32,70),"Ancient Forest":(35,73),"Nibelheim":(31,58),"Mt. Nibel":(30,54),"Rocket Town":(29,46),"Lucrecia Cave":(38,59),
    "Bone Village":(56,39),"Sleeping Forest":(56,35),"Forgotten Capital":(59,33),"Icicle Inn":(48,31),"Great Glacier":(51,29),"Gaea Cliff":(47,24),"Whirlwind Maze":(50,20),"Northern Crater":(48,12),"Northern Cave":(47,17),
    "Wutai":(12,45),"Wutai Pagoda":(13,39),"Da-chao":(14,43),"Wutai Highlands":(17,30),"Temple of the Ancients":(56,89),"Temple Labyrinth":(58,88),"Mideel":(79,86),"Mideel Jungle":(86,85),"Goblin Island":(82,31),"Cactus Island":(29,94),"Round Island":(87,6),
}
RIDGES = [ [(17,29),(15,40),(12,52),(15,64),(19,68)], [(29,46),(31,51),(32,57)], [(41,45),(39,53),(36,60),(35,69),(36,75)], [(45,12),(48,10),(51,13),(49,19),(48,24),(51,30),(54,32)], [(44,31),(49,34),(55,35)], [(61,54),(66,52),(70,54),(74,54),(77,59),(82,61)], [(76,69),(71,72),(68,75)], [(75,85),(80,86),(84,88),(89,85),(93,79)] ]
LAKES = [(48,15,16),(70,57,19),(38,62,14)]


def point(p): return (round(p[0]*WIDTH/100),round(p[1]*HEIGHT/100))


def coast(points, seed):
    """Deterministic small coves; the hand-authored macro outline stays intact."""
    vertices=[point(p) for p in points];out=[]
    for a,b in zip(vertices,vertices[1:]+vertices[:1]):
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
        for i in range(max(1,math.ceil(length/7))):
            t=i/max(1,math.ceil(length/7));seed=(1664525*seed+1013904223)&0xffffffff
            n=(((seed>>16)%7)-3)*math.sin(math.pi*t)
            out.append((round(a[0]+dx*t-dy*n/length),round(a[1]+dy*t+dx*n/length)))
    return out


def font(size,bold=False):
    path=Path('/usr/share/fonts/truetype/dejavu')/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')
    return ImageFont.truetype(str(path),size) if path.exists() else ImageFont.load_default(size=size)


def main():
    DEST.mkdir(parents=True,exist_ok=True)
    data=json.loads(Path(__file__).with_name('ff7_enemies.json').read_text())
    assert set(SPAWNS)==set(data['nation_names']), 'Regional assignments must be complete'
    enemies=[n for group in data['enemy_groups'].values() for n in group]
    allnames=list(data['nation_names'].values())+enemies
    assert len(set(allnames))==len(allnames) and len(allnames)>=400
    land=Image.new('L',(WIDTH,HEIGHT));ld=ImageDraw.Draw(land)
    biome=Image.new('RGBA',land.size);bd=ImageDraw.Draw(biome)
    polygons={name:coast(p,sum(name.encode())) for name,p in COASTS.items()}
    for name,poly in polygons.items():ld.polygon(poly,fill=255);bd.polygon(poly,fill=COLORS[name]+'c0')
    # Desert, jungle, glacier and industrial wasteland patches are decoration,
    # clipped to land; only grayscale heights enter the deterministic terrain.
    bd.ellipse((*point((39,58)),*point((49,70))),fill='#d9ba7bb0')
    bd.ellipse((*point((27,65)),*point((38,76))),fill='#c99c72c0')
    bd.ellipse((*point((32,74)),*point((42,82))),fill='#6aa28fc0')
    bd.ellipse((*point((60,41)),*point((71,52))),fill='#778d88b0')
    biome.putalpha(Image.composite(biome.getchannel('A'),Image.new('L',land.size),land))
    terrain=Image.new('RGB',land.size,(106,106,106));px=terrain.load();mask=land.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            if mask[x,y]:
                v=144+((x//23+y//29+x*y//4096)%7);px[x,y]=(v,v,v)
    ridge=Image.new('L',land.size);rd=ImageDraw.Draw(ridge)
    for points in RIDGES:
        p=[point(x) for x in points];rd.line(p,fill=165,width=29);rd.line(p,fill=187,width=9)
    terrain.paste(Image.merge('RGB',(ridge,)*3),mask=Image.composite(ridge.point(lambda v:255 if v else 0),Image.new('L',land.size),land))
    td=ImageDraw.Draw(terrain)
    for a,b,r in LAKES:
        x,y=point((a,b));box=(x-r,y-r,x+r,y+r)
        td.ellipse(box,fill=(106,)*3);ld.ellipse(box,fill=0);bd.ellipse(box,fill=(0,0,0,0))
    # Midgar is only an overlay landmark: no artificial obstacles or city buffs.
    center=point(SPAWNS['Midgar']);cx,cy=center
    bd.ellipse((cx-24,cy-24,cx+24,cy+24),fill='#354d4bd8',outline='#70e8bbc0',width=2)
    for i in range(8):
        angle=i*math.pi/4;bd.line((cx,cy,round(cx+23*math.cos(angle)),round(cy+23*math.sin(angle))),fill='#7fada3c0',width=2)
    nations=[]
    for loc,xy in SPAWNS.items():
        x,y=point(xy)
        if not land.getpixel((x,y)):raise ValueError(f'{loc} is not on land: {(x,y)}')
        # Require margin for compact-map filtering, rather than silently moving locations.
        for dx,dy in [(0,0),(4,0),(-4,0),(0,4),(0,-4)]:
            if not land.getpixel((x+dx,y+dy)):raise ValueError(f'{loc} needs more coast margin: {(x,y)}')
        nations.append({'name':data['nation_names'][loc],'coordinates':[x,y]})
    terrain.save(DEST/'image.png',optimize=True);biome.save(DEST/'ff7-biomes.png',optimize=True)
    labels=Image.new('RGBA',land.size);draw=ImageDraw.Draw(labels)
    def text(xy,s,size=18,color='#c8f2df',bold=False):draw.text(point(xy),s,font=font(size,bold),fill=color,anchor='mm',stroke_width=2,stroke_fill='#112b2ce0')
    text((39,4),'FINAL FANTASY VII',31,bold=True);text((39,7),'THE PLANET · WORLD ATLAS',12)
    for xy,label in [((16,18),'WUTAI'),((34,88),'WESTERN CONTINENT'),((68,35),'EASTERN CONTINENT'),((66,19),'NORTHERN CONTINENT'),((83,94),'MIDEEL'),((56,95),'TEMPLE OF THE ANCIENTS'),((81,24),'GOBLIN ISLAND'),((87,2),'ROUND ISLAND'),((28,99),'CACTUS ISLAND')]:text(xy,label,15,bold=True)
    text((60,96),'Original-world geography · ordinary sea travel',10)
    labels.save(DEST/'ff7-atlas.png',optimize=True)
    info={'id':'FinalFantasyVII','name':'Final Fantasy VII','display_name':'Final Fantasy VII · The Planet','translation_key':'map.finalfantasyvii','categories':['new','fictional'],'multiplayer_frequency':0,'themes':['ff7'],'layers':[{'id':'ff7-biomes','placement':'land','nukeable':False,'alpha':0.65},{'id':'ff7-atlas','placement':'water','nukeable':False}],'nations':nations,'additionalNations':[{'name':n} for n in enemies],'custom_tribes':enemies}
    (DEST/'info.json').write_text(json.dumps(info,indent=2,ensure_ascii=False)+'\n')
    themes_path=ROOT/'resources/tribeNameThemes.json';themes=json.loads(themes_path.read_text());themes['ff7']={'prefixes':['Mako'],'suffixes':['Trooper'],'names':enemies};themes_path.write_text(json.dumps(themes,indent=2,ensure_ascii=False)+'\n')
    preview=Image.new('RGBA',land.size,'#173c48');pd=ImageDraw.Draw(preview)
    for poly in polygons.values():pd.polygon(poly,fill='#c8c19a',outline='#e4d7b0',width=2)
    preview.alpha_composite(biome)
    relief=Image.new('RGBA',land.size,'#64726a');relief.putalpha(Image.composite(ridge.point(lambda v:130 if v>=180 else 60 if v else 0),Image.new('L',land.size),land));preview.alpha_composite(relief)
    for a,b,r in LAKES:
        x,y=point((a,b));pd.ellipse((x-r,y-r,x+r,y+r),fill='#173c48')
    preview.alpha_composite(labels)
    # Readable reference atlas with place labels; the game uses water-only labels.
    short={'Mako Reactor 1':'Reactor 1','Mako Reactor 5':'Reactor 5','Temple of the Ancients':'Temple','Forgotten Capital':'Forgotten Capital'}
    omitted={'Shinra HQ','Mako Reactor 1','Mako Reactor 5','Wall Market','Sector 7','Midgar Highway','Cargo Ship','Underwater Reactor','Temple Labyrinth','Wutai Pagoda','Lucrecia Cave','Sleeping Forest','Northern Cave'}
    for loc,xy in SPAWNS.items():
        x,y=point(xy);pd.ellipse((x-3,y-3,x+3,y+3),fill='#e7ffbd')
        if loc not in omitted:pd.text((x+7,y+3),short.get(loc,loc),font=font(14),fill='#fff3ce',stroke_width=2,stroke_fill='#23393c')
    preview.convert('RGB').save(ROOT/'docs/ff7-map-preview.png',optimize=True)
    formatter=ROOT/'node_modules/.bin/prettier'
    if formatter.exists():subprocess.run([str(formatter),'--write',str(DEST/'info.json'),str(themes_path)],check=True)
    print(f'Created {WIDTH}x{HEIGHT} FFVII world, {len(nations)} regional enemies, {len(enemies)} roaming enemy names.')


if __name__=='__main__':main()
