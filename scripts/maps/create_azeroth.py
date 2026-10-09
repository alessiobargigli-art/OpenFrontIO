"""Create the original, editable Azeroth terrain atlas (Python 3 + Pillow).

Run from any directory: python scripts/maps/create_azeroth.py
Then cd map-generator && go run . --maps=azeroth

Geometry is deliberately simplified for OpenFront. Other worlds and underground
zones occupy atlas sectors connected by ordinary navigable water, not portals.
No Blizzard artwork is imported, traced pixel-by-pixel, or required at runtime.
"""

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
WIDTH, HEIGHT = 1920, 1536
DEST = ROOT / "map-generator/assets/maps/azeroth"
PREVIEW = ROOT / "docs/azeroth-preview.png"

# Normalized coastlines; every region is editable independently of its placement.
COASTS = {
    "kalimdor": [(22,0),(37,3),(47,0),(65,5),(79,4),(89,12),(88,20),
                 (94,25),(86,30),(92,34),(83,42),(83,48),(77,52),(82,58),
                 (77,63),(90,68),(93,76),(85,81),(91,87),(75,92),(70,100),
                 (56,94),(46,96),(38,90),(24,91),(17,86),(19,78),(12,72),
                 (17,65),(10,58),(12,51),(5,46),(13,39),(11,33),(19,29),
                 (22,21),(20,15),(15,11)],
    "eastern-north": [(70,0),(77,6),(71,12),(82,17),(84,28),(94,36),
                      (99,48),(97,64),(86,72),(89,80),(75,90),(57,87),
                      (48,100),(35,96),(27,89),(12,94),(6,82),(0,72),
                      (12,64),(7,56),(22,48),(38,47),(50,39),(58,33),
                      (58,24),(65,16),(61,9)],
    "eastern-south": [(19,0),(35,4),(47,0),(60,4),(71,2),(85,9),(95,8),
                      (100,22),(89,31),(90,43),(85,55),(72,59),(71,70),
                      (58,78),(49,88),(41,100),(29,96),(30,88),(22,82),
                      (24,71),(15,65),(18,51),(10,42),(17,32),(7,24),(10,12)],
    "northrend": [(13,36),(18,24),(30,18),(30,12),(40,9),(50,13),(59,0),
                  (66,4),(68,13),(80,20),(85,30),(82,41),(93,49),(91,59),
                  (98,67),(98,81),(89,86),(89,98),(81,100),(74,91),
                  (76,76),(69,69),(62,65),(64,57),(50,62),(36,58),
                  (28,67),(15,66),(5,74),(0,62),(8,54),(4,44)],
    "pandaria": [(17,7),(35,0),(50,4),(59,15),(74,9),(79,21),(86,25),
                 (94,37),(87,50),(100,61),(95,72),(81,75),(73,90),
                 (59,86),(51,100),(37,91),(27,97),(17,84),(20,74),
                 (5,77),(0,64),(8,50),(2,37),(9,28),(5,18)],
    "dragon": [(27,0),(42,4),(46,14),(60,8),(71,17),(75,32),(91,31),
               (88,43),(100,53),(89,66),(77,69),(74,82),(60,85),(53,99),
               (35,96),(21,84),(10,86),(0,75),(9,65),(0,52),(14,43),
               (13,31),(26,26),(19,13)],
    "broken": [(29,0),(43,5),(50,15),(65,9),(74,22),(87,24),(88,38),
               (100,48),(88,62),(69,66),(69,83),(54,79),(47,95),(32,100),
               (21,88),(6,82),(11,64),(0,53),(15,39),(12,23),(23,18)],
    "zandalar": [(26,0),(34,15),(43,6),(55,12),(65,0),(71,17),(86,13),
                 (100,28),(92,38),(82,38),(93,54),(85,68),(76,71),
                 (68,86),(52,100),(36,92),(24,78),(16,67),(3,59),
                 (0,42),(9,31),(8,15)],
    "island": [(19,8),(38,1),(54,9),(69,0),(79,16),(92,22),(89,36),
               (100,49),(91,63),(83,65),(84,80),(63,86),(56,100),
               (40,89),(23,95),(17,81),(4,75),(8,57),(0,46),(9,30),(7,20)],
    "outland": [(14,9),(28,0),(39,13),(56,7),(67,1),(74,16),(94,12),
                (100,29),(88,39),(94,52),(77,55),(87,74),(71,81),
                (65,96),(49,88),(35,100),(25,82),(10,86),(4,70),
                (14,59),(0,47),(10,34),(1,22)],
    "draenor": [(16,0),(31,4),(39,15),(50,2),(64,8),(75,3),(91,19),
                (87,31),(100,41),(94,54),(100,63),(88,80),(73,78),
                (65,93),(51,100),(44,88),(28,94),(22,83),(8,79),
                (0,64),(5,47),(0,34),(13,22)],
}

# title, rectangle, coastline, biome colour, and named spawn locations (0..100).
# The relative placement of the surface continents follows the Azeroth atlas.
REGIONS = [
    ("KALIMDOR", (125,365,285,655), "kalimdor", "#80aa77", [
        ("Darkshore",25,18),("Mount Hyjal",62,15),("Winterspring",75,12),
        ("Ashenvale",44,28),("Orgrimmar",79,35),("Stonetalon",30,39),
        ("Desolace",30,50),("Thunder Bluff",47,55),("The Barrens",65,47),
        ("Dustwallow Marsh",72,65),("Feralas",38,67),("Silithus",30,81),
        ("Un'Goro",55,80),("Tanaris",77,81),("Uldum",48,90),
    ]),
    ("NORTHREND", (510,100,355,265), "northrend", "#9fbdc7", [
        ("Borean Tundra",20,52),("Sholazar Basin",29,35),("Icecrown",44,28),
        ("Storm Peaks",66,29),("Dragonblight",48,49),("Wintergrasp",35,48),
        ("Zul'Drak",76,46),("Grizzly Hills",81,67),("Howling Fjord",86,82),
        ("Crystalsong Forest",59,47),
    ]),
    ("QUEL'THALAS / LORDAERON", (1050,375,260,350), "eastern-north", "#8aaa75", [
        ("Silvermoon",70,19),("Eversong Woods",73,30),("Zul'Aman",84,42),
        ("Eastern Plaguelands",67,62),("Western Plaguelands",46,64),
        ("Undercity",28,68),("Silverpine Forest",25,79),("Gilneas",23,88),
        ("Hillsbrad",43,81),("The Hinterlands",67,81),("Arathi Highlands",65,86),
    ]),
    ("KHAZ MODAN / STORMWIND", (1075,747,250,350), "eastern-south", "#a8b47a", [
        ("Wetlands",57,18),("Twilight Highlands",78,21),("Loch Modan",63,35),
        ("Ironforge",38,29),("Dun Morogh",30,33),("Badlands",58,45),
        ("Blackrock Mountain",43,48),("Stormwind",32,61),("Elwynn Forest",45,60),
        ("Westfall",31,72),("Duskwood",48,71),("Blasted Lands",61,67),
        ("Stranglethorn",41,84),
    ]),
    ("PANDARIA", (585,940,265,245), "pandaria", "#92b484", [
        ("Townlong Steppes",24,31),("Dread Wastes",24,64),("Kun-Lai Summit",43,25),
        ("Vale of Eternal Blossoms",49,48),("Valley of Four Winds",47,67),
        ("Jade Forest",75,39),("Krasarang Wilds",60,81),
    ]),
    ("DRAGON ISLES", (995,125,225,245), "dragon", "#b99d77", [
        ("Waking Shores",39,30),("Ohn'ahran Plains",40,54),
        ("Azure Span",40,76),("Thaldraszus",73,49),
    ]),
    ("BROKEN ISLES", (730,415,195,235), "broken", "#9caa83", [
        ("Highmountain",45,24),("Val'sharah",26,45),("Stormheim",72,43),
        ("Suramar",52,60),("Azsuna",24,72),("Broken Shore",49,82),
    ]),
    ("ZANDALAR", (725,750,195,180), "zandalar", "#b7a473", [
        ("Vol'dun",26,37),("Nazmir",68,35),("Zuldazar",53,70),
    ]),
    ("TIRAGARDE SOUND", (945,646,100,125), "island", "#a3ad86", [
        ("Boralus",52,45),
    ]),
    ("Drustvar", (865,704,85,75), "island", "#8ca581", [("Drustvar",50,50)]),
    ("Stormsong Valley", (956,573,80,74), "island", "#b2b487", [("Stormsong Valley",50,50)]),
    ("KHAZ ALGAR", (407,1000,155,155), "island", "#bea67f", [("Isle of Dorn",51,48)]),
    ("Teldrassil", (165,273,58,58), "island", "#809e8b", [("Teldrassil",50,50)]),
    ("Azuremyst", (50,389,56,62), "island", "#94b6bc", [("Azuremyst Isle",50,50)]),
    ("Bloodmyst", (58,320,50,52), "island", "#b9989e", [("Bloodmyst Isle",50,50)]),
    ("Quel'Danas", (1225,331,36,33), "island", "#cabb8c", [("Quel'Danas",50,50)]),
    ("Forbidden Reach", (1100,65,50,43), "island", "#bdad89", [("Forbidden Reach",50,50)]),
    ("Mechagon", (911,587,36,38), "island", "#a7a091", [("Mechagon",50,50)]),
    ("Tol Barad", (1038,672,38,43), "island", "#9baf91", [("Tol Barad",50,50)]),
    ("Nazjatar", (627,736,76,65), "island", "#99bec0", [("Nazjatar",50,50)]),
    ("Kezan", (493,853,48,40), "island", "#b5a186", [("Kezan",50,50)]),
    ("Lost Isles", (550,832,47,46), "island", "#97af79", [("Lost Isles",50,50)]),
    ("Vashj'ir", (946,816,64,80), "island", "#9bc5ba", [("Vashj'ir",50,50)]),
    ("Darkmoon", (1024,929,33,37), "island", "#a68ea9", [("Darkmoon Island",50,50)]),
    ("Thunder", (535,920,41,50), "island", "#b9b596", [("Isle of Thunder",50,50)]),
    ("Timeless", (879,1110,41,45), "island", "#aab18b", [("Timeless Isle",50,50)]),
    ("Wandering", (567,859,43,47), "island", "#9fb280", [("Wandering Isle",50,50)]),
    ("OUTLAND", (1485,69,353,168), "outland", "#ab948d", [
        ("Blade's Edge",36,23),("Netherstorm",69,22),("Zangarmarsh",26,43),
        ("Hellfire Peninsula",66,47),("Nagrand (Outland)",25,70),
        ("Terokkar Forest",47,65),("Shadowmoon (Outland)",67,77),
    ]),
    ("DRAENOR", (1485,313,353,179), "draenor", "#b2ac86", [
        ("Frostfire Ridge",25,24),("Gorgrond",57,22),("Tanaan Jungle",77,43),
        ("Nagrand (Draenor)",24,57),("Talador",48,48),("Spires of Arak",48,78),
        ("Shadowmoon (Draenor)",75,65),
    ]),
    ("Krokuun", (1469,611,109,100), "outland", "#ab9485", [("Krokuun",50,50)]),
    ("Eredath", (1601,560,109,100), "broken", "#b9a795", [("Eredath",50,50)]),
    ("Antoran Wastes", (1739,610,109,100), "outland", "#9d8894", [("Antoran Wastes",50,50)]),
    ("Bastion", (1630,779,92,91), "island", "#c5bd92", [("Bastion",50,50)]),
    ("Maldraxxus", (1760,816,94,89), "broken", "#a7b08a", [("Maldraxxus",50,50)]),
    ("Ardenweald", (1653,975,101,90), "island", "#9c9cb9", [("Ardenweald",50,50)]),
    ("Revendreth", (1473,939,94,91), "draenor", "#b29799", [("Revendreth",50,50)]),
    ("The Maw", (1469,787,92,88), "outland", "#a39c90", [("The Maw",50,50)]),
    ("Oribos", (1601,900,52,48), "island", "#c7b3a6", [("Oribos",50,50)]),
    ("Korthia", (1480,879,52,43), "island", "#ad9b8d", [("Korthia",50,50)]),
    ("Zereth Mortis", (1779,973,87,81), "island", "#bec49a", [("Zereth Mortis",50,50)]),
    ("K'ARESH", (1473,1158,220,142), "outland", "#a9a5bc", [("K'aresh",50,50)]),
    ("VOIDSTORM", (1730,1158,137,142), "broken", "#b1a2c0", [("Voidstorm",50,50)]),
    ("Ringing Deeps", (55,1355,143,118), "island", "#aca798", [("Ringing Deeps",50,50)]),
    ("Hallowfall", (249,1355,143,118), "island", "#b9bd95", [("Hallowfall",50,50)]),
    ("Azj-Kahet", (443,1355,143,118), "broken", "#a4a0b6", [("Azj-Kahet",50,50)]),
    ("Undermine", (637,1355,112,118), "island", "#b7a28b", [("Undermine",50,50)]),
    ("Zaralek Cavern", (805,1355,133,118), "draenor", "#b69ca3", [("Zaralek Cavern",50,50)]),
    ("Deepholm", (994,1355,133,118), "island", "#9eaac1", [("Deepholm",50,50)]),
    ("Harandar", (1183,1355,133,118), "broken", "#9fb59c", [("Harandar",50,50)]),
    ("EMERALD DREAM", (1492,1390,339,105), "island", "#9fbb8e", [("Emerald Dream",50,50)]),
]

# Highlands and mountains are attack-cost terrain, never artificial void walls.
RIDGES = [
    [(310,430),(305,495),(291,560),(301,620),(289,675)],
    [(282,795),(298,855),(287,920)],
    [(600,166),(653,154),(708,178),(755,176)],
    [(700,201),(758,227),(805,269)],
    [(1148,827),(1194,857),(1180,913)],
    [(1166,526),(1191,575),(1182,615)],
    [(644,1000),(687,988),(718,1029)],
    [(1066,202),(1105,224),(1140,256),(1101,299)],
    [(804,466),(824,501),(806,535)],
    [(1545,125),(1590,108),(1625,143)],
    [(1570,371),(1610,361),(1638,406)],
]


def point(rect, xy):
    x, y, w, h = rect
    return (round(x + xy[0] * w / 100), round(y + xy[1] * h / 100))


def font(size, bold=False):
    suffix = "-Bold" if bold else ""
    candidate = Path(f"/usr/share/fonts/truetype/dejavu/DejaVuSans{suffix}.ttf")
    return ImageFont.truetype(str(candidate), size) if candidate.exists() else ImageFont.load_default(size=size)


def coastline(rect, shape, seed):
    """Add repeatable small coves without changing the macro geography."""
    points = [point(rect,p) for p in COASTS[shape]]
    result = []
    for start,end in zip(points,points[1:]+points[:1]):
        dx,dy=end[0]-start[0],end[1]-start[1]
        length=math.hypot(dx,dy)
        steps=max(1,math.ceil(length/6))
        for i in range(steps):
            t=i/steps
            seed=(1664525*seed+1013904223)&0xffffffff
            jitter=((seed>>16)%7-3)*math.sin(math.pi*t)*min(1,length/18)
            result.append((round(start[0]+dx*t-dy*jitter/length),
                           round(start[1]+dy*t+dx*jitter/length)))
    return result


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    land = Image.new("L", (WIDTH, HEIGHT), 0)
    ld = ImageDraw.Draw(land)
    biome = Image.new("RGBA", (WIDTH, HEIGHT))
    bd = ImageDraw.Draw(biome)
    nations = []
    outlines = []
    for title, rect, shape, color, locations in REGIONS:
        polygon = coastline(rect,shape,sum(title.encode()))
        outlines.append((title, rect, polygon))
        ld.polygon(polygon, fill=255)
        bd.polygon(polygon, fill=color + "a0")
        for name, x, y in locations:
            pos = point(rect, (x, y))
            if not land.getpixel(pos):
                raise ValueError(f"Spawn {name} lies outside its land silhouette: {pos}")
            nations.append({"name": name, "coordinates": list(pos)})

    terrain = Image.new("RGB", (WIDTH, HEIGHT), (106,106,106))
    # Deterministic integer-only terrain: mostly plains, with gentle ridges.
    px = terrain.load()
    mask = land.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            if mask[x,y]:
                level = 144 + ((x//19 + y//23 + (x*y)//4096) % 7)
                px[x,y] = (level,level,level)
    ridge = Image.new("L", (WIDTH, HEIGHT))
    rd = ImageDraw.Draw(ridge)
    for points in RIDGES:
        rd.line(points, fill=164, width=27)
        rd.line(points, fill=187, width=9)
    terrain.paste(Image.merge("RGB", (ridge,ridge,ridge)), mask=Image.composite(ridge.point(lambda v: 255 if v else 0), Image.new("L",land.size), land))
    # Inland lakes are large enough to survive the official lake-size filter.
    td=ImageDraw.Draw(terrain)
    for x,y,r in [(227,738,13),(1252,907,11),(644,1072,12)]:
        td.ellipse((x-r,y-r,x+r,y+r),fill=(106,106,106))
        ld.ellipse((x-r,y-r,x+r,y+r),fill=0)
        bd.ellipse((x-r,y-r,x+r,y+r),fill=(0,0,0,0))
    for nation in nations:
        if not land.getpixel(tuple(nation["coordinates"])):
            raise ValueError(f"Lake intersects spawn: {nation['name']}")
    terrain.save(DEST / "image.png", optimize=True)
    biome.save(DEST / "azeroth-biomes.png", optimize=True)

    # Water-only labels keep the playable terrain clear. They are optional in
    # graphics settings and do not modify ownership, movement or projectile paths.
    labels = Image.new("RGBA", (WIDTH, HEIGHT))
    draw = ImageDraw.Draw(labels)
    def text(xy, value, size=19, color="#e1cf9d", anchor="mm", bold=False):
        draw.text(xy, value, font=font(size,bold), fill=color, anchor=anchor,
                  stroke_width=2, stroke_fill="#122936d0")
    text((683,37), "AZEROTH", 32, bold=True)
    text((683,68), "SURFACE CONTINENTS", 12)
    # Titles are in clear water above their regions, rather than drawn on tiles.
    for title, rect, polygon in outlines[:12]:
        x,y,w,h = rect
        if title in {"Drustvar", "Stormsong Valley", "TIRAGARDE SOUND",
                     "QUEL'THALAS / LORDAERON", "KHAZ MODAN / STORMWIND"}:
            continue
        text((x+w//2,y-20), title, 16 if len(title)<20 else 13, bold=True)
    text((967,551), "KUL TIRAS", 17, bold=True)
    text((1198,1134), "EASTERN KINGDOMS", 17, bold=True)
    for x,y,value in [(1670,45,"OUTLAND"),(1670,287,"DRAENOR"),
                      (1670,535,"ARGUS"),(1670,752,"SHADOWLANDS"),
                      (1583,1134,"K'ARESH"),(1798,1134,"VOIDSTORM"),
                      (1660,1364,"EMERALD DREAM")]:
        text((x,y),value,19,bold=True)
    text((683,1268), "UNDERGROUND & OTHER REALMS", 21, bold=True)
    for title, rect, _shape, _color, _spawns in REGIONS[-8:-1]:
        x,y,w,h=rect
        text((x+w//2,y-21),title,14)
    # Maelstrom: decoration on water; no hidden impassable ring.
    center=(595,641)
    spiral=[]
    for i in range(400):
        angle=i*0.055
        radius=6+i*0.17
        spiral.append((round(center[0]+math.cos(angle)*radius),round(center[1]+math.sin(angle)*radius)))
    draw.line(spiral, fill="#aec5c780", width=3)
    text((595,740),"THE MAELSTROM",15)
    text((1670,1326),"ATLAS SECTORS · ORDINARY SEA TRAVEL",10)
    labels.save(DEST / "azeroth-atlas.png", optimize=True)

    info = {
        "id": "Azeroth", "name": "Azeroth", "display_name": "Azeroth · All Expansions",
        "translation_key": "map.azeroth", "categories": ["new", "fictional"],
        "multiplayer_frequency": 0,
        "layers": [
            {"id":"azeroth-biomes", "placement":"land", "nukeable":False, "alpha":0.55},
            {"id":"azeroth-atlas", "placement":"water", "nukeable":False},
        ],
        "nations": nations,
    }
    (DEST / "info.json").write_text(json.dumps(info,indent=2,ensure_ascii=False)+"\n")
    # The labeled contact atlas is documentation only. Runtime uses the real
    # generated binary terrain plus optional layers above, never this preview.
    preview = Image.new("RGBA", (WIDTH,HEIGHT), "#163442")
    pd = ImageDraw.Draw(preview)
    for title,rect,polygon in outlines:
        pd.polygon(polygon,fill="#cab88d",outline="#dfd3ad",width=2)
    preview.alpha_composite(biome)
    ridge_preview=Image.new("RGBA",land.size,"#79644b")
    ridge_preview.putalpha(Image.composite(ridge.point(lambda v: 170 if v>=179 else 90 if v else 0),Image.new("L",land.size),land))
    preview.alpha_composite(ridge_preview)
    for x,y,r in [(227,738,13),(1252,907,11),(644,1072,12)]:
        pd.ellipse((x-r,y-r,x+r,y+r),fill="#163442")
    preview.alpha_composite(labels)
    for n in nations:
        x,y=n["coordinates"]
        pd.ellipse((x-2,y-2,x+2,y+2),fill="#f7e4b8")
    PREVIEW.parent.mkdir(exist_ok=True)
    preview.convert("RGB").save(PREVIEW, optimize=True)
    print(f"Created {WIDTH}x{HEIGHT} terrain, 2 optional layers, {len(nations)} named spawns.")


if __name__ == "__main__":
    main()
