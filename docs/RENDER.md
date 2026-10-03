# OpenFrontIO su Render

Questo fork include una modalità autonoma `SELF_HOSTED=true`: partite locali,
lobby pubbliche programmate, lobby private e WebSocket usano il proprio server.
I giocatori entrano come ospiti con un'identità casuale salvata nel browser.
Non servono API key, account OpenFront o chiavi Turnstile.

## Deploy con Blueprint

1. In Render scegliere **New → Blueprint** e collegare
   `alessiobargigli-art/OpenFrontIO`.
2. Prima del merge della PR #1 selezionare il branch **setup/fork-baseline**.
   Dopo il merge usare `main`. Il file è **render.yaml** nella root.
3. Controllare il servizio `openfront-alessio` e avviare il deploy.
4. Attendere che il servizio diventi Live e aprire il suo URL HTTPS.

Il Blueprint configura il piano Free e la regione Frankfurt. La configurazione
non è ancora stata distribuita e verificata su Render. Le impostazioni del piano
vanno confermate nel dashboard prima della creazione del servizio.

## Configurazione manuale equivalente

Se il servizio esiste già, usare queste impostazioni:

| Campo                          | Valore                             |
| ------------------------------ | ---------------------------------- |
| Tipo                           | Web Service                        |
| Repository                     | `alessiobargigli-art/OpenFrontIO`  |
| Branch prima del merge         | `setup/fork-baseline`              |
| Runtime / Language             | Docker                             |
| Dockerfile Path                | `./Dockerfile.render`              |
| Docker Build Context           | `.`                                |
| Root Directory                 | vuota                              |
| Build Command                  | gestito dal Dockerfile             |
| Start Command / Docker Command | lasciare il comando del Dockerfile |
| Health Check Path              | `/api/health`                      |
| Instances                      | `1`                                |
| Auto Deploy                    | Off                                |

| Variabile           | Valore  |
| ------------------- | ------- |
| `SELF_HOSTED`       | `true`  |
| `GAME_ENV`          | `prod`  |
| `PORT`              | `10000` |
| `NUM_WORKERS`       | `1`     |
| `INSTANCE_LETTER`   | `a`     |
| `LOBBY_COORDINATOR` | `off`   |

Render fornisce `RENDER_EXTERNAL_HOSTNAME` e `RENDER_GIT_COMMIT`: il server li
usa automaticamente. Non impostare `DOMAIN`, `GIT_COMMIT`, `API_DOMAIN`,
`GAME_HOST`, `CDN_BASE`, `STRIPE_PUBLISHABLE_KEY` o `FARO_COLLECTOR_URL` per
questo primo deploy. Un eventuale dominio personalizzato si aggiunge nel
dashboard; connessioni e API di gioco restano sull'origine della pagina.

Nginx ascolta su `0.0.0.0:$PORT`, serve il master e instrada `/w0/...` al worker.
Master e worker ascoltano sulle porte interne 3000 e 3001. HTTPS è terminato
da Render; dal browser i socket usano `wss://`. Non usare una Static Site per
questo servizio multiplayer.

## Verifiche dopo il deploy

Se i log riportano `unsupported game env: undefined`, Node non sta ricevendo
`GAME_ENV`. In **Settings** verificare il branch `setup/fork-baseline` e il
Dockerfile `./Dockerfile.render`: `main` non contiene queste modifiche prima
del merge della PR #1. In **Environment** impostare le sei variabili della
tabella, poi usare **Save, rebuild, and deploy**. Il Dockerfile originale non
imposta `GAME_ENV`. L'entrypoint dedicato Render applica ora i valori predefiniti
anche quando una variabile è assente o vuota; il server carica `.env` prima di
valutare la configurazione.

Lo stesso controllo vale per `NUM_WORKERS not set`: impostare `NUM_WORKERS=1`
e usare il Dockerfile dedicato. I valori nel solo file `render.yaml` vengono
applicati dal Blueprint; un Web Service creato manualmente va configurato nel
dashboard.

1. Aprire `/api/health`: deve rispondere 200 con `status: "ok"`.
2. Aprire il gioco e verificare il caricamento delle mappe.
3. Creare una lobby privata, copiarne il link e aprirlo in un secondo browser
   o in una finestra privata: due schede dello stesso browser condividono
   l'identità ospite.
4. Avviare la partita dall'host e giocare da entrambi i browser.
5. Interrompere brevemente la rete di un giocatore e verificare la riconnessione.

Se la pagina risponde ma il deploy non diventa Live, controllare i log dei
worker e che `NUM_WORKERS=1` sia identico nel proxy e nel server. Una risposta
503 dall'health check significa che il cluster non è pronto. Un errore
`version_mismatch` richiede di ricaricare la pagina dopo un deploy.

Se la partita rimane su **Game starting** con `Failed to parse URL from
/_assets/maps/...`, aggiornare il deploy all'ultima versione del branch e
ricaricare la pagina. I worker inline partono da URL `blob:`: ora ricevono
l'URL della pagina e lo usano per risolvere gli asset relativi, anche con
`CDN_BASE` vuoto. La correzione vale anche per i replay; non serve impostare
un CDN per aggirare l'errore.

## Comportamento e limiti

Il server mantiene partite e lobby in memoria: un riavvio, redeploy o
sospensione termina le partite in corso. Tenere una sola istanza Render;
aumentare le repliche non condivide questo stato. Il numero di worker cambia
il routing e va modificato soltanto quando non ci sono partite attive.

Il piano Free è adatto a prove, si sospende dopo 15 minuti senza attività in
ingresso e può impiegare circa un minuto a riattivarsi. Per uso regolare
scegliere un piano senza sospensione e dimensionarlo dopo una prova di carico.
Non è stata certificata una capacità specifica di giocatori.

La modalità autonoma disabilita account, pagamenti, cosmetici a pagamento,
ranked, clan riservati, listing a pagamento e archivio/statistiche remoti.
L'ospite usa un UUID casuale come segreto bearer: cancellare i dati del browser
cambia identità e perde la possibilità di riconnettersi come quel giocatore.
Non è un sistema di account o di moderazione persistente.

Il Dockerfile dedicato esclude la cartella `proprietary` e usa un logo del fork.
Le risorse aperte mantengono le licenze e le attribuzioni originali; il footer
conserva il copyright e collega il sorgente del fork.

Il nome/logo provvisorio **OpenFront Fork** va sostituito con un nome proprio
prima di una release: i termini aggiuntivi in `LICENSE` vietano l'uso di
OpenFront come titolo principale delle versioni modificate senza permesso.
Il codice resta AGPL v3 e le risorse aperte CC BY-SA 4.0; distribuendo il
fork, anche come servizio online, offrire il sorgente completo della versione
in uso e conservare licenze, crediti e indicazioni delle modifiche.

## Verifica locale della modalità autonoma

Con Node 24 e npm 12 richiesti dal progetto:

```sh
npm run inst
SELF_HOSTED=true node node_modules/vite/bin/vite.js build
node --import tsx scripts/buildAssetHashes.ts
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run tests/server/SelfHosted.test.ts tests/client/SelfHosted.test.ts tests/server/RenderHtml.test.ts
node --import tsx scripts/selfHostedSmoke.ts
node --import tsx scripts/selfHostedSmoke.ts --env-file
```

Lo smoke test avvia un master e due worker in produzione e verifica HTTP,
creazione/join, autorità dell'host, avvio, inoltro di turni binari e
riconnessione. Richiede le porte 3000–3002 libere. Non sostituisce la prova
del container Docker e della partita completa da browser su Render.
Con `--env-file` passa la configurazione soltanto tramite un `.env` temporaneo,
per verificare che venga caricato prima degli import del server.

Per verificare anche il container, in un ambiente con Docker:

```sh
docker build -f Dockerfile.render -t openfront-render .
docker run --rm -p 10000:10000 -e GIT_COMMIT=local openfront-render
```

Aprire `http://localhost:10000`. Qui il dominio di bootstrap usa `localhost`
come fallback; la rete del gioco segue sempre l'origine della pagina.

Riferimenti Render: [Blueprint](https://render.com/docs/blueprint-spec),
[Docker](https://render.com/docs/docker),
[WebSocket](https://render.com/docs/websocket),
[piano Free](https://render.com/docs/free).
