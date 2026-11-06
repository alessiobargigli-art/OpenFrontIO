# Effetti sonori delle skin

Le quattro skin tematiche includono **14 effetti ciascuna**, attivi per default.
La skin **Default** usa gli effetti OpenFront esistenti.

In **Impostazioni → Audio → Skin sound effects** si può disattivare il tema
sonoro durante una partita: i suoni successivi tornano subito a quelli standard.
La preferenza è locale, persistente e torna attiva con il reset delle opzioni audio.
I controlli Master/Effetti e le regole audio mobile restano quelli esistenti:
questa opzione non alza il volume e non riattiva un dispositivo silenziato.

## Ascolto

[Anteprima dei quattro pacchetti, 18 secondi](skin-sounds-preview.mp3).
Ogni segmento contiene costruzione città, lancio atomica e impatto bomba H.

| Inizio  | Skin         | Timbro                                                 |
| ------- | ------------ | ------------------------------------------------------ |
| 0:00    | Flower Power | Campanelli, armonici e scivolate sonore                |
| 0:04,52 | Warcraft     | Toni gravi, accordi aperti e colpi metallici           |
| 0:09,04 | FFVII Mako   | Sintesi FM metallica, impulsi industriali e sweep      |
| 0:13,56 | Dragon Ball  | Cariche ascendenti, raffiche ed esplosioni energetiche |

Sono **effetti sintetizzati originali**: nessun doppiaggio, campione, musica
o registrazione estratta dalle opere. Sono richiami al tema, non riproduzioni
degli effetti ufficiali. I suoni sono brevi (0,55–1,35 secondi), MP3 mono
44,1 kHz a 96 kbps; i 56 file occupano complessivamente meno di 600 KB.

## Eventi e scelta del tema

- Lancio atomica, bomba H e MIRV.
- Impatto atomica/testata MIRV e bomba H.
- Costruzione città, porto, difesa, nave da guerra, SAM, silo, fabbrica e stazione.
- Creazione del trasporto navale.

Il tema segue **la skin visibile del proprietario dell'unità**, come gli sprite.
I missili nemici usano quindi il tema del nemico. Bot, nazioni e God seguono
il tema locale già risolto dal gioco; per lo spettatore vale il suo tema scelto.
Le preferenze che nascondono le skin vengono rispettate anche dall'audio.
Gli effetti di costruzione restano limitati alle proprie strutture come prima.

Avvisi nucleari, messaggi, alleanze, menu, vittoria/sconfitta, musica e ambiente
restano comuni. Non sono aggiunti nuovi eventi per spari di cannoni o SAM.

Tutte le skin condividono il limite esistente di sei effetti contemporanei,
separato dal canale degli avvisi. I lanci vengono raggruppati al massimo uno
ogni due tick; le testate MIRV mantengono il limite di un impatto ogni cinque
tick. Nessuna modifica alla simulazione o al protocollo di rete.

Il caricamento è su richiesta e la cache distingue tema ed effetto. Se un
file tematico non si carica, le voci pendenti vengono rilasciate, si ripiega
una volta sull'effetto standard e quel file non viene richiesto di nuovo
nella stessa sessione. Gli altri effetti del pacchetto restano disponibili.

## File e rigenerazione

- Asset e manifest: `resources/sounds/skins/`.
- Registro degli eventi tematici: `src/client/sound/SkinSounds.ts`.
- Generatore: `scripts/skins/build_sounds.py`.

```sh
python scripts/skins/build_sounds.py
```

Richiede Python, numpy e ffmpeg **solo per rigenerare** i suoni. I file MP3
sono inclusi nel repository e pubblicati dalla normale pipeline degli asset
con hash. Docker/Render non deve installare sintetizzatori o encoder.

Il generatore usa oscillatori e rumore con seed deterministico per ciascun
tema/evento, con attacco/rilascio, normalizzazione RMS e margine sui picchi.
I test coprono il passaggio vista → evento → mixer, le scelte indipendenti
dei proprietari, il toggle live, il reset, le cache, il fallback e i limiti
condivisi. I file codificati vengono controllati anche mediante decodifica.
La riproduzione su dispositivi fisici e una partita completa su Render
richiedono ancora una verifica d'ascolto.
