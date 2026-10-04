# Avvio del fork OpenFrontIO

Repository di lavoro: <https://github.com/alessiobargigli-art/OpenFrontIO>.
Origine: <https://github.com/openfrontio/OpenFrontIO>.
Base verificata il 3 ottobre 2026: `e02eeba66b4801ebae0b686e1b0e4bc03fbf3654`.

## Avvio locale

Usare Node.js `>=24.15.0 <25` e npm `>=12.1.0 <13`, come richiesto da
`package.json`. La verifica iniziale ha usato Node 24.19.0 e npm 12.1.0.

```sh
git clone https://github.com/alessiobargigli-art/OpenFrontIO.git
cd OpenFrontIO
npm run inst
npm run dev
```

Aprire <http://localhost:9000>. `npm run inst` esegue
`npm ci --ignore-scripts` usando il lockfile; non sostituirlo con `npm install`.
Per provare il client su altri dispositivi della rete locale usare
`npm run dev:host` e l'indirizzo LAN del computer sulla porta 9000.
Questo verifica lo sviluppo locale, non prepara un servizio pubblico.

## Architettura da mantenere

| Componente          | Responsabilità                                                    | File di riferimento                                       |
| ------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| `src/core`          | Simulazione deterministica, eseguita nel worker di ciascun client | `GameRunner.ts`, `game/GameImpl.ts`                       |
| `src/client`        | Interfaccia Lit, rendering WebGL2, input e rete                   | `Main.ts`, `render/gl/MapRenderer.ts`                     |
| `src/server`        | Lobby, raccolta e inoltro dei comandi, connessioni WebSocket      | `Server.ts`, `Master.ts`, `Worker.ts`, `GameServer.ts`    |
| API account esterna | Autenticazione, statistiche, cosmetici e pagamenti                | Documentata in `docs/API.md`; implementazione non inclusa |

Il server raggruppa i comandi in turni; ogni client applica gli stessi turni
alla propria simulazione. Non è un server che calcola e invia continuamente
l'intero stato del campo. Le estensioni al gameplay devono mantenere il
determinismo e avere test di simulazione, come richiesto da `CLAUDE.md`.
La documentazione storica menziona Pixi.js; il renderer del commit verificato
usa WebGL2 tramite il codice in `src/client/render/gl`.

## Risultati iniziali

| Verifica                                                                         | Esito sulla base originale                                                                |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Installazione da lockfile con npm 12.1.0                                         | Completata                                                                                |
| `tsc --noEmit`                                                                   | Passa                                                                                     |
| `vite build`                                                                     | Passa                                                                                     |
| Generazione hash degli asset con `node --import tsx scripts/buildAssetHashes.ts` | Passa                                                                                     |
| Avvio master e due worker in modalità sviluppo                                   | Completato                                                                                |
| `GET /api/health` sul master                                                     | HTTP 200, `status: ok`                                                                    |
| Pagina servita dal client Vite                                                   | HTTP 200                                                                                  |
| Prima fase di `npm test`                                                         | Fallisce con 10 test falliti; la seconda fase server non parte perché il comando usa `&&` |

Sette fallimenti sono in `tests/RenderDesktopDescriptor.test.ts`: il launcher
CLI di `tsx` non riesce ad aprire un socket Unix (`EPERM`) nell'ambiente di
verifica. Due sono in `tests/client/CosmeticsPaymentsMigration.test.ts`
(timeout e risposta non JSON durante una chiamata API). Uno è in
`tests/server/RenderHtml.test.ts` (aspettativa sul template HTML).
Questi risultati non dimostrano dieci difetti di gameplay: distinguere i
limiti dell'ambiente dai problemi riproducibili prima di modificare il codice.

Anche l'ultimo passaggio di `npm run build-prod` e il launcher server di
`npm run dev` incontrano il limite del socket Unix in questo ambiente.
Type-check e bundle passano; il passaggio hash e il server sono stati
verificati separatamente usando `node --import tsx` invece della CLI `tsx`.
Non è stata verificata una partita completa da browser né un deploy pubblico.

## Render: requisiti rilevati sulla base originale

La configurazione successiva del fork è descritta in [RENDER.md](RENDER.md).
La sezione seguente registra i requisiti riscontrati sulla base originale;
non rappresenta lo stato attuale del branch preparato per Render.

Render supporta Docker e WebSocket per i **Web Service**. La soluzione iniziale
proposta è un solo servizio Docker, con Nginx come ingresso pubblico e master
e worker Node su porte interne. Non pubblicare solo il frontend come Static
Site se serve il multiplayer.

Il repository contiene già `Dockerfile`, `nginx.conf` e `supervisord.conf`,
ma la configurazione originale è legata all'infrastruttura OpenFront.
Prima di considerare il fork pronto per Render occorre:

1. Far ascoltare Nginx su `0.0.0.0:$PORT` (Render usa 10000 di default).
   Il file originale ascolta sulla porta 80; master e worker devono rimanere
   dietro il proxy, perché Render espone una sola porta pubblica per servizio.
2. Configurare il dominio pubblico e il routing dei worker, mantenendo
   gli upgrade WebSocket e gli indirizzi `wss://` dal browser.
3. Definire l'autenticazione e le verifiche di ingresso indipendenti dall'API
   proprietaria. In `GAME_ENV=prod` il codice richiama quell'API anche per
   verificare alcuni ingressi e funzionalità delle lobby: non basta rimuovere
   il negozio dall'interfaccia. Non pubblicare in modalità `dev` per aggirarlo.
4. Sostituire branding e asset proprietari con asset del fork, rispettando
   le licenze e le attribuzioni descritte in `LICENSE`, `LICENSE-ASSETS`
   e `LICENSING.md`.
5. Verificare build Docker, `/api/health`, creazione/join di una stanza,
   partita tra due browser e riconnessione dopo un'interruzione.

Impostazioni Render previste dopo l'adattamento: repository del fork,
runtime Docker, una sola istanza iniziale, health check `/api/health`.
Dimensionare CPU e RAM dopo una prova con il numero di giocatori previsto.
Il piano Free va bene per esperimenti: il servizio si sospende dopo 15 minuti
senza traffico in ingresso e può impiegare circa un minuto a riattivarsi.
Traffico WebSocket in ingresso conta come attività; avere soltanto una
connessione aperta non equivale a inviare messaggi. Per partite regolari
preferire un'istanza senza sospensione per inattività.

Fonti Render consultate il 3 ottobre 2026:

- <https://render.com/docs/web-services>
- <https://render.com/docs/docker>
- <https://render.com/docs/websocket>
- <https://render.com/docs/free>

Questo documento registra la base e il percorso di adattamento; non certifica
che il fork originale sia già distribuibile su Render.
