# Azeroth · All Expansions

Mappa custom selezionabile nelle categorie **New** e **Fictional**, per partite
private e singleplayer. La rotazione pubblica ha peso zero. Il tema Flower Power
rimane attivo per le unità anche su questa mappa.

![Azeroth e i settori delle espansioni](azeroth-preview.png)

## Copertura

La mappa rappresenta la geografia principale di Classic e di tutte le undici
espansioni pubblicate fino a **Midnight**, con le principali aggiunte delle patch.
Non contiene ogni dungeon, raid o sottozona, né pretende di essere una copia
esatta della cartografia di WoW.

| Capitolo               | Territori rappresentati                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| Classic                | Kalimdor e Regni Orientali, con città e regioni principali                                   |
| The Burning Crusade    | Terre Esterne, Quel'Thalas, Quel'Danas, Azuremyst e Bloodmyst                                |
| Wrath of the Lich King | Northrend, con dieci posizioni di partenza                                                   |
| Cataclysm              | Hyjal, Uldum, Gilneas, Twilight Highlands, Vashj'ir, Kezan, Lost Isles, Tol Barad e Deepholm |
| Mists of Pandaria      | Pandaria, Wandering Isle, Isle of Thunder e Timeless Isle                                    |
| Warlords of Draenor    | Draenor e le sue sette regioni                                                               |
| Legion                 | Broken Isles, Broken Shore e i tre settori di Argus                                          |
| Battle for Azeroth     | Kul Tiras, Zandalar, Mechagon e Nazjatar                                                     |
| Shadowlands            | Bastion, Maldraxxus, Ardenweald, Revendreth, The Maw, Oribos, Korthia e Zereth Mortis        |
| Dragonflight           | Dragon Isles, Forbidden Reach, Zaralek Cavern ed Emerald Dream                               |
| The War Within         | Isle of Dorn, Ringing Deeps, Hallowfall, Azj-Kahet, Undermine e K'aresh                      |
| Midnight               | Silvermoon/Eversong, Zul'Aman, Harandar e Voidstorm                                          |

**The Last Titan** è un'espansione futura: Northrend è presente, ma non sono state
inventate le sue nuove zone o interpretate come contenuti già pubblicati.

## Adattamento per OpenFront

- Il terreno misura **1920 × 1536**, con 123 posizioni nominate. Il formato
  Compact misura 960 × 768. Sono inclusi anche binari e miniatura a scala ridotta.
- Le coste sono sagome originali semplificate, con piccole insenature generate in
  modo ripetibile. I continenti di superficie conservano la disposizione generale:
  Kalimdor a ovest, Regni Orientali a est, Northrend a nord e Pandaria a sud.
- Terre Esterne, Draenor, Argus, Shadowlands, K'aresh e Voidstorm occupano settori
  sulla destra. Sotterranei e altri reami occupano settori inferiori. La loro
  posizione nell'atlante serve al gameplay e **non** indica che siano isole
  fisicamente adiacenti ad Azeroth.
- I settori comunicano tramite il normale mare navigabile. Non sono introdotti
  portali, caricamenti di nuove mappe o livelli sovrapposti. Le regole di barche,
  missili e conquista sono quelle standard.
- Vashj'ir e Nazjatar sono adattati a territori emersi conquistabili; il Maelstrom
  è un motivo sul mare, senza muri invisibili. I rilievi influenzano i costi del
  terreno. Non viene usato terreno invalicabile.
- Le proporzioni privilegiano spazio per spawn, costruzioni e battaglie. Isole e
  regni minori sono ingranditi per rimanere utilizzabili anche in Compact.
- I colori regionali e i nomi dei continenti sono due livelli grafici opzionali,
  disattivabili nelle impostazioni. Non influenzano lo stato della simulazione.
  Le 123 nazioni usano ora tribù e fazioni legate alle località dell'atlante.

## Avversari di Warcraft

Il catalogo editabile è [`scripts/maps/azeroth_factions.json`](../scripts/maps/azeroth_factions.json):
**449 nomi** di tribù, clan, fazioni e popoli, suddivisi fra 123 nazioni e 326
nomi per i bot. Include gruppi storici, alleati e antagonisti da Classic alle
espansioni rappresentate. È un catalogo ampio, non una pretesa di censire ogni
organizzazione minore di trent'anni di Warcraft.

Le nazioni partono nelle 123 posizioni geografiche già definite: ad esempio
Darkspear a Orgrimmar, Bloodhoof a Thunder Bluff, Amani a Zul'Aman, Scourge a
Icecrown, Mag'har a Nagrand nelle Terre Esterne e Hara'ti a Harandar. Queste
associazioni sono un adattamento per il gameplay, non confini canonici o una
ricostruzione di una singola epoca. Le etichette dei continenti e la geometria
non cambiano. Non vengono importati stemmi o artwork Blizzard.

Per i bot, tutti i 326 nomi vengono utilizzati prima di ripetere nomi dal
medesimo elenco: fino al limite di 400 bot non compaiono nomi generici. Più
bande possono quindi avere lo stesso nome, ma identità e posizioni distinte.
Le nazioni extra attingono ai medesimi 326 nomi, coprendo senza nomi inventati
anche una configurazione da 400 nazioni. I numeri impostati nella lobby
continuano a decidere quanti avversari compaiono; disabilitando le nazioni non
compaiono le 123 fazioni regionali. Le alleanze seguono le regole esistenti di
OpenFront, senza diplomazia predefinita fra Orda e Alleanza.

Il tema `azeroth` in `resources/tribeNameThemes.json` usa il campo opzionale
`names` per ripetere nomi completi invece di combinare prefissi e suffissi.
Le altre mappe conservano la sequenza precedente di nomi e numeri casuali.

Riferimenti per i nomi, consultati il 9 ottobre 2026:

- [Warcraft Wiki: tribù](https://warcraft.wiki.gg/wiki/Tribe)
- [Warcraft Wiki: clan](https://warcraft.wiki.gg/wiki/Clan)
- [Warcraft Wiki: centauri](https://warcraft.wiki.gg/wiki/Centaur)
- [Warcraft Wiki: furbolg](https://warcraft.wiki.gg/wiki/Furbolg)
- [Blizzard: Harandar e Hara'ti](https://news.blizzard.com/en-gb/article/24250355/explore-the-zones-of-midnight-harandar)
- [Blizzard: cartelli di Undermine](https://worldofwarcraft.blizzard.com/en-us/news/24179386/)
- [Blizzard: K'aresh](https://worldofwarcraft.blizzard.com/en-us/news/24226730/)

## Modifica e rigenerazione

La geometria editabile è in [`scripts/maps/create_azeroth.py`](../scripts/maps/create_azeroth.py):
`COASTS` contiene i contorni normalizzati, `REGIONS` posizione/dimensione di ogni
regione e spawn, `RIDGES` i rilievi. Non occorre una texture o un servizio esterno.

Serve Python 3 con Pillow ≥ 10.1 per rigenerare le sorgenti, e Go ≥ 1.24.4 per la pipeline
ufficiale. Le build Docker/Render usano direttamente gli asset già inclusi:

```sh
python scripts/maps/create_azeroth.py
cd map-generator
go run . --maps=azeroth
cd ..
npx --no-install prettier --write resources/maps/azeroth/manifest.json src/core/game/Maps.gen.ts resources/lang/en.json
```

Sorgenti: `map-generator/assets/maps/azeroth/`.
Asset runtime: `resources/maps/azeroth/`.
Il generatore registra automaticamente l'enum e il selettore in
`src/core/game/Maps.gen.ts`, oltre alla voce inglese in `resources/lang/en.json`.

## Verifica

`tests/AzerothMap.test.ts` usa i binari reali: caricamento Normal/Compact,
validità delle posizioni nominate, conteggio del terreno, Maelstrom navigabile,
assenza di muri invalicabili e avvio/avanzamento della simulazione con giocatori
su continenti e reami differenti. I test generali controllano registro, manifest,
flag e livelli. In tutte e tre le scale, le 45 masse di terra hanno accesso allo
stesso oceano connesso. La rigenerazione delle sorgenti e dei binari, seguita dalla formattazione
indicata sopra, produce gli stessi byte; gli asset della build con hash corrispondono ai file runtime.
I test includono inoltre spawn e avanzamento reale di 400 bot in Normal e
Compact, identità/posizioni riproducibili, catalogo completo ed espansione a 400
nazioni con soli nomi Warcraft. La verifica completa di una partita nel browser
resta da fare.

## Riferimenti geografici

Consultati il 9 ottobre 2026. La fonte cartografica è stata usata come riferimento
visivo della disposizione generale; nessun pixel del suo artwork è distribuito.

- [Atlante di Azeroth con Khaz Algar](https://media.mmo-champion.com/images/news/2024/july/947azerothunexplored.png)
- [Blizzard: zone di Midnight](https://worldofwarcraft.blizzard.com/news/24223893/explore-the-zones-of-midnight)
- [Blizzard: Khaz Algar](https://worldofwarcraft.blizzard.com/it-it/news/24125258/esplora-le-zone-e-le-spedizioni-di-the-war-within)
- [Blizzard: Ghosts of K'aresh](https://worldofwarcraft.blizzard.com/en-us/news/24226730/the-war-within-ghosts-of-karesh-goes-live-august-5)
- [Blizzard: Undermine](https://worldofwarcraft.blizzard.com/en-us/news/24174172/)
- [Blizzard: Guardians of the Dream](https://worldofwarcraft.blizzard.com/en-us/news/24020034)
- [Blizzard: Shadowlands](https://worldofwarcraft.blizzard.com/en-us/news/23187291/world-of-warcraft-what-s-next-panel-recap)
- [Blizzard: Cataclysm](https://worldofwarcraft.blizzard.com/en-us/news/24095666)

È un atlante fan non ufficiale. Nomi e geografia di Warcraft appartengono a
Blizzard Entertainment. Contorni, terreno, livelli e codice di generazione sono
stati creati per questo fork; non sono incluse texture, loghi o mappe ufficiali.
