# WhereWasI? 📺 📖 🎬

**WhereWasI?** è una moderna Single Page Application (PWA) costruita con **Nuxt 4**, **Vue 3**, **Nuxt UI (Tailwind CSS v4)** e **Supabase**. Permette a te e ai tuoi amici di tenere traccia di serie TV (stagione ed episodio attuale), libri (pagina corrente o percentuale), film, anime, manga e videogiochi, con una lista personale e la possibilità di vedere i progressi e le attività dei tuoi amici quando vi collegate in-app!

---

## ✨ Funzionalità Principali

### 🎯 1. Tracciamento Personale Intelligente
- **Serie TV & Anime**: contatore puntuale di Stagione ed Episodio (`S3 E5`), totale episodi e pulsante rapido `+1 Ep` direttamente sulle card o nella modale.
- **Libri & Manga**: avanzamento in pagine (`p. 240 / 480 (50%)`) o capitoli con pulsanti rapidi `+10 Pag` e `+1`.
- **Film, Giochi e Altro**: avanzamento percentuale (`0-100%`) e note di avanzamento personalizzate.
- **Stati di avanzamento**: *In Corso*, *Da Iniziare*, *Completato*, *In Pausa*, *Abbandonato*.
- **Valutazioni e Recensioni**: voti da 1 a 10 ⭐ e note/recensioni personali.
- **Privacy per singolo elemento**: flag `🔒 Privato` per nascondere determinati elementi dagli amici.

### 👥 2. Rete di Amici & Condivisione dei Progressi
- **Sistema di Amicizia**: invia e ricevi richieste di amicizia tramite username o email.
- **Feed Social & Attività**: timeline in tempo reale con gli aggiornamenti degli amici (es. *"Mario è arrivato a S3 E5 di Breaking Bad"*, *"Luca ha completato Project Hail Mary (Voto: 9/10)"*).
- **Libreria degli Amici**: clicca su un amico per esplorare la sua lista personale, filtrando per categoria e leggendo le sue recensioni.

### 🎨 3. Design & Esperienza Utente
- **Nuxt 4 + Nuxt UI (Tailwind v4)**: interfaccia moderna, veloce e reattiva in stile glassmorphism con gradienti luminosi.
- **Supporto PWA Completo**: installabile su iOS e Android come app nativa, con icone e splash screen dedicati.
- **Palette Temi Multi-Accento**: scegli il colore principale (Indaco, Viola, Smeraldo, Rosa, Ambra, Ciano, Teal, Azzurro, Blu).
- **Modalità Scura / Chiara / Sistema**: transizioni fluide e contrasto perfetto.
- **Viste Flessibili**: toggle istantaneo tra Griglia di schede ricche e Vista Elenco compatta.

---

## 🏗️ Architettura & Stack Tecnologico

Seguendo l'architettura collaudata di `share-todo`:
- **Nuxt 4** (`nuxt: ^4.6.0`, Vue 3, Vue Router)
- **Supabase** (`@nuxtjs/supabase`) per Autenticazione, Database PostgreSQL e Row Level Security (RLS)
- **Nuxt UI** (`@nuxt/ui`) + **Lucide Icons** (`@iconify-json/lucide`)
- **PWA** (`@vite-pwa/nuxt`)

### Struttura delle Cartelle

```
WhereWasI?/
├── app/
│   ├── assets/css/main.css         # Stili Tailwind v4, scale accento, gradienti
│   ├── components/                 # Componenti UI (MediaCard, DetailModal, QuickAdd, FriendCard, ecc.)
│   ├── composables/                # useAuth, useMediaTracker, useFriends, useActivityFeed, useProfile, usePreferences
│   ├── pages/
│   │   ├── index.vue               # Dashboard principale con libreria, filtri e statistiche
│   │   ├── friends.vue             # Gestione amici, richieste e feed attività
│   │   └── friend/[id].vue         # Visualizzatore tracce del singolo amico
│   ├── plugins/                    # preferences.ts
│   ├── types/                      # TypeScript definitions (MediaItem, FriendProfile, ecc.)
│   ├── utils/                      # Formattazione progresso, date, gradienti, splash
│   ├── app.vue                     # App shell, modali globali, barra di navigazione
│   └── app.config.ts               # Configurazione Nuxt UI
├── supabase/
│   └── schema.sql                  # Schema SQL completo con tabelle, indici, trigger, RPC e RLS
├── public/                         # Icone PWA, splash screens, favicon
├── database.types.ts               # Tipi generati per Supabase
├── nuxt.config.ts                  # Configurazione Nuxt
└── package.json
```

---

## 🚀 Configurazione & Avvio

### 1. Database Supabase
Esegui lo script SQL [supabase/schema.sql](file:///home/leo/Desktop/Projects/WhereWasI?/supabase/schema.sql) nel **SQL Editor** della tua dashboard Supabase.
Lo script è **idempotente** e crea:
- `profiles`: profili utente con username e bio
- `friendships`: richieste di amicizia e relazioni confermate
- `media_items`: serie, libri, film e progressi con Row Level Security (RLS)
- `media_activities`: feed di attività sociale per gli amici
- Funzioni RPC per inviare richieste di amicizia e verificare permessi RLS

### 2. File di ambiente `.env`
Assicurati che il file `.env` contenga l'URL e la Anon Key del tuo progetto Supabase:
```env
NUXT_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co
NUXT_PUBLIC_SUPABASE_KEY=tua-chiave-anon-public
```

### 3. Installazione e Avvio
```bash
npm install
npm run dev
```
L'app sarà disponibile su `http://localhost:3000`.
