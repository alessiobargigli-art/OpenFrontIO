"""Generate an original Dragon Ball world atlas (Python + Pillow).

python scripts/maps/create_dragonball.py
cd map-generator && go run . --maps=dragonball

Earth locations follow their broad story geography. Other worlds occupy
separate atlas sectors, joined by ordinary sea travel, not space or portals.
No franchise textures or map artwork are imported.
"""
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / 'map-generator/assets/maps/dragonball'
WIDTH, HEIGHT = 1920, 1440
SHAPES = {
    'earth': [(5,20),(12,14),(22,16),(25,8),(38,2),(49,8),(58,4),(65,13),(77,13),(81,22),(96,27),(91,40),(99,49),(90,58),(90,69),(81,78),(74,80),(68,88),(56,84),(49,91),(37,89),(26,95),(21,84),(11,84),(16,70),(10,63),(12,52),(5,47),(9,36),(2,29)],
    'namek': [(15,8),(29,12),(39,2),(55,9),(68,5),(76,17),(92,19),(88,34),(98,45),(88,55),(92,72),(78,81),(67,77),(58,94),(43,89),(32,98),(22,84),(8,87),(12,67),(2,57),(8,43),(0,30),(12,23)],
    'island': [(22,7),(39,0),(52,9),(68,4),(82,18),(87,35),(100,48),(89,62),(91,80),(73,85),(59,99),(42,92),(25,98),(18,81),(5,75),(10,57),(0,45),(9,29),(7,18)],
    'demon': [(17,6),(31,14),(40,0),(54,10),(70,3),(78,24),(97,20),(90,40),(100,54),(84,67),(89,83),(68,87),(54,100),(40,87),(23,95),(16,77),(1,73),(11,54),(0,42),(14,28)],
}
# title, rectangle, coastline, biome and location coordinates within the rectangle.
REGIONS = [
    ('EARTH', (40,120,1180,980), 'earth', '#a4c77e', [
        ('Pilaf Castle',14,40),('Red Ribbon HQ',14,60),('Red Ribbon Forest',18,59),
        ('Muscle Tower',43,12),('North City',47,18),('Gero Laboratory',43,17),
        ('Korin Tower',31,67),('Kami Lookout',33,63),('Central City',56,45),('King Castle',57,41),
        ('West City',25,47),('Capsule Corporation',26,43),('Ginger Town',31,33),
        ('Frieza Landing Site',34,29),('Cell Games',47,34),
        ('Vegeta Battlefield',43,54),('Gohan Training Grounds',39,57),
        ('East City',83,55),('Mount Paozu',78,48),('Babidi Ship',63,70),
        ('Rocky Wasteland',50,38),('Satan City',73,68),('Pirate Cave',56,78),
        ('Martial Arts Temple',37,45),('Diablo Desert',17,48),
    ]),
    ('SOUTH CITY', (1020,1030,180,150), 'island', '#b6c38c', [('South City',50,50)]),
    ('ANDROID ISLANDS', (730,1120,150,100), 'island', '#9ac6aa', [('Android Islands',50,50)]),
    ('PAPAYA ISLAND', (440,1200,250,160), 'island', '#d5c17b', [('Papaya Island',50,50)]),
    ('KAME HOUSE', (800,1250,130,100), 'island', '#8bc4a3', [('Kame House',50,50)]),
    ('BLUE COMPANY', (970,1210,130,100), 'island', '#96bdb3', [('Blue Company Island',50,50)]),
    ('PENGUIN VILLAGE', (1120,1270,140,110), 'island', '#abc59a', [('Penguin Village',50,50)]),
    ('NAMEK', (1400,120,450,400), 'namek', '#83c992', [
        ('Frieza Spaceship',45,28),('Dende Village',24,58),('Namek Cliffs',30,38),
        ('Ginyu Landing',66,30),('Namek Plains',48,64),('Namek Lakes',72,61),
        ('Dragon Ball Valley',60,75),('Elder Plateau',30,72),('Namek Battlefield',72,45),
    ]),
    ('NEW NAMEK', (1420,600,200,170), 'island', '#83c2a9', [('New Namek',40,45),('Galactic Prison Camp',65,65)]),
    ('PLANET VAMPA', (1670,600,180,170), 'demon', '#b0aa6e', [('Planet Vampa',40,45),('Vampa Camp',64,64)]),
    ('SACRED KAI REALM', (1410,890,220,190), 'island', '#c4a6c7', [('Sacred World of the Kai',40,44),('Kai Plateau',65,66)]),
    ('KING KAI', (1255,910,85,85), 'island', '#a7c988', [('King Kai Planet',50,50)]),
    ('HELL', (1670,890,180,190), 'demon', '#c19a85', [('Hell',40,45),('Hell Gate',65,65)]),
    ('DEMON REALM', (1430,1190,190,170), 'demon', '#b29bbc', [('Demon Realm',37,39),('Demon Palace',62,43),('Demon Pass',50,70)]),
    ('TUFFLE PLANET', (1680,1190,180,170), 'namek', '#aab6cd', [('Tuffle Planet',40,43),('Shadow Dragon Grounds',65,68)]),
]


def point(rect,xy):
    x,y,w,h=rect
    return round(x+xy[0]*w/100),round(y+xy[1]*h/100)


def coastline(rect,shape,seed):
    vertices=[point(rect,p) for p in SHAPES[shape]];out=[]
    for a,b in zip(vertices,vertices[1:]+vertices[:1]):
        dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy);steps=max(1,math.ceil(length/7))
        for i in range(steps):
            t=i/steps;seed=(1664525*seed+1013904223)&0xffffffff
            n=(((seed>>16)%7)-3)*math.sin(math.pi*t)
            out.append((round(a[0]+dx*t-dy*n/length),round(a[1]+dy*t+dx*n/length)))
    return out


def font(size,bold=False):
    p=Path('/usr/share/fonts/truetype/dejavu')/('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')
    return ImageFont.truetype(str(p),size) if p.exists() else ImageFont.load_default(size=size)


def main():
    DEST.mkdir(parents=True,exist_ok=True)
    catalog=json.loads(Path(__file__).with_name('dragonball_enemies.json').read_text())
    locations={name for *_,spawns in REGIONS for name,*_ in spawns}
    assert locations==set(catalog['nation_names']), 'Each location needs one opponent'
    enemies=[n for g in catalog['enemy_groups'].values() for n in g]
    names=list(catalog['nation_names'].values())+enemies
    assert len(names)==len(set(names)) and len(names)>=400
    land=Image.new('L',(WIDTH,HEIGHT));ld=ImageDraw.Draw(land)
    biome=Image.new('RGBA',land.size);bd=ImageDraw.Draw(biome)
    outlines=[];locations_by_name={};nations=[]
    for title,rect,shape,color,spawns in REGIONS:
        poly=coastline(rect,shape,sum(title.encode()));outlines.append((title,rect,poly))
        ld.polygon(poly,fill=255);bd.polygon(poly,fill=color+'b0')
        for location,x,y in spawns:
            pos=point(rect,(x,y));locations_by_name[location]=pos
            nations.append({'name':catalog['nation_names'][location],'coordinates':list(pos)})
    terrain=Image.new('RGB',land.size,(106,106,106));px=terrain.load();mask=land.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            if mask[x,y]:
                v=144+((x//21+y//27+x*y//4096)%7);px[x,y]=(v,v,v)
    # Color patches and landmarks are visual-only, never hard obstacles.
    earth=REGIONS[0][1]
    bd.ellipse((*point(earth,(7,37)),*point(earth,(26,57))),fill='#d6b27ab0')
    bd.ellipse((*point(earth,(35,5)),*point(earth,(54,25))),fill='#c3d8d7c0')
    bd.ellipse((*point(earth,(35,47)),*point(earth,(53,61))),fill='#c4a17ba0')
    biome.putalpha(Image.composite(biome.getchannel('A'),Image.new('L',land.size),land))
    ridge=Image.new('L',land.size);rd=ImageDraw.Draw(ridge)
    for path in [[(31,17),(40,12),(49,17),(56,16)],[(35,50),(43,55),(47,61)],[(70,41),(75,45),(80,49)],[(36,64),(41,71),(44,78)]]:
        coords=[point(earth,p) for p in path];rd.line(coords,fill=165,width=29);rd.line(coords,fill=187,width=9)
    rd.line([(1460,230),(1515,190),(1575,216)],fill=165,width=23)
    terrain.paste(Image.merge('RGB',(ridge,)*3),mask=Image.composite(ridge.point(lambda v:255 if v else 0),Image.new('L',land.size),land))
    lakes=[(*point(earth,(60,57)),19),(1598,312,15),(1692,348,13)]
    td=ImageDraw.Draw(terrain)
    for x,y,r in lakes:
        box=(x-r,y-r,x+r,y+r);td.ellipse(box,fill=(106,)*3);ld.ellipse(box,fill=0);bd.ellipse(box,fill=(0,0,0,0))
    for location,(x,y) in locations_by_name.items():
        for dx,dy in [(0,0),(4,0),(-4,0),(0,4),(0,-4)]:
            if not land.getpixel((x+dx,y+dy)):raise ValueError(f'{location} is too close to water: {(x,y)}')
    # Tiny Capsule dome landmark, confined to the optional biome overlay.
    x,y=locations_by_name['Capsule Corporation'];bd.ellipse((x-17,y-17,x+17,y+17),fill='#e6f5edd0',outline='#499fccc0',width=3)
    terrain.save(DEST/'image.png',optimize=True);biome.save(DEST/'dragonball-biomes.png',optimize=True)
    labels=Image.new('RGBA',land.size);draw=ImageDraw.Draw(labels)
    def text(xy,s,size=17,bold=False,color='#f8e5b0'):
        draw.text(xy,s,font=font(size,bold),fill=color,anchor='mm',stroke_width=2,stroke_fill='#223c4bd0')
    text((645,38),'DRAGON BALL · WORLD ATLAS',31,True)
    text((645,72),'EARTH, NAMEK & OTHER REALMS',12)
    # Orange orbs are map decoration, not collectible gameplay objects.
    for i in range(7):
        x=540+i*35;draw.ellipse((x-8,92,x+8,108),fill='#efa63bd0',outline='#ffdb85d0')
    text((640,121),'EARTH / DRAGON WORLD',16,True)
    for title,rect,_ in outlines[1:]:
        x,y,w,h=rect
        if title=='KING KAI':text((x+w//2,y-15),title,12)
        else:text((x+w//2,y-20),title,15 if w>=180 else 12,True)
    for y in range(90,1390,30):draw.line((1365,y,1365,y+13),fill='#d3b67160',width=2)
    text((1635,555),'ATLAS SECTORS · ORDINARY SEA TRAVEL',11)
    labels.save(DEST/'dragonball-atlas.png',optimize=True)
    info={'id':'DragonBall','name':'Dragon Ball','display_name':'Dragon Ball · World Atlas','translation_key':'map.dragonball','categories':['new','fictional'],'multiplayer_frequency':0,'themes':['dragonball'],'layers':[{'id':'dragonball-biomes','placement':'land','nukeable':False,'alpha':0.65},{'id':'dragonball-atlas','placement':'water','nukeable':False}],'nations':nations,'additionalNations':[{'name':n} for n in enemies],'custom_tribes':enemies}
    (DEST/'info.json').write_text(json.dumps(info,indent=2,ensure_ascii=False)+'\n')
    path=ROOT/'resources/tribeNameThemes.json';themes=json.loads(path.read_text());themes['dragonball']={'prefixes':['Dragon'],'suffixes':['Army'],'names':enemies};path.write_text(json.dumps(themes,indent=2,ensure_ascii=False)+'\n')
    preview=Image.new('RGBA',land.size,'#184453');pd=ImageDraw.Draw(preview)
    for _,_,poly in outlines:pd.polygon(poly,fill='#d1cb97',outline='#ecddab',width=2)
    preview.alpha_composite(biome)
    relief=Image.new('RGBA',land.size,'#806c58');relief.putalpha(Image.composite(ridge.point(lambda v:140 if v>=180 else 65 if v else 0),Image.new('L',land.size),land));preview.alpha_composite(relief)
    for x,y,r in lakes:pd.ellipse((x-r,y-r,x+r,y+r),fill='#184453')
    preview.alpha_composite(labels)
    omit={'Red Ribbon Forest','Gero Laboratory','King Castle','Capsule Corporation','Frieza Landing Site','Gohan Training Grounds','Martial Arts Temple','Rocky Wasteland','Namek Plains','Namek Lakes','Elder Plateau','Galactic Prison Camp','Vampa Camp','Kai Plateau','Hell Gate','Demon Palace','Demon Pass','Shadow Dragon Grounds'}
    short={'Sacred World of the Kai':'Sacred Kai Realm','Dragon Ball Valley':'Dragon Ball Valley','Namek Battlefield':'Final Battle','Frieza Spaceship':'Frieza Ship','Ginyu Landing':'Ginyu Force','Red Ribbon HQ':'Red Ribbon HQ'}
    for loc,(x,y) in locations_by_name.items():
        pd.ellipse((x-3,y-3,x+3,y+3),fill='#fff4ad')
        if loc not in omit:pd.text((x+7,y+3),short.get(loc,loc),font=font(13),fill='#fff1cc',stroke_width=2,stroke_fill='#25404c')
    preview.convert('RGB').save(ROOT/'docs/dragonball-map-preview.png',optimize=True)
    formatter=ROOT/'node_modules/.bin/prettier'
    if formatter.exists():subprocess.run([str(formatter),'--write',str(DEST/'info.json'),str(path)],check=True)
    print(f'Created {WIDTH}x{HEIGHT} Dragon Ball atlas: {len(nations)} regional opponents, {len(enemies)} roaming labels.')


if __name__=='__main__':main()
