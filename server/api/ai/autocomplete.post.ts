import { GoogleGenAI } from '@google/genai'
import type { MediaType } from '~/types'

interface AutocompleteRequestBody {
  title: string
  mediaType?: MediaType
}

interface AutocompleteResult {
  title: string
  media_type: MediaType
  creator: string | null
  release_year: number | null
  genre: string
  description: string
  cover_url: string | null
  // Series
  total_seasons: number | null
  total_episodes: number | null
  season_episodes: Record<string, number> | null
  // Movie
  duration_minutes: number | null
  total_duration: string | null
  // Book
  total_pages: number | null
}

async function isValidImageUrl(url?: string | null): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: controller.signal
    })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

async function fetchWikiImage(title: string, suffixes: string[] = []): Promise<string | null> {
  const candidates = [title, ...suffixes.map((s) => `${title} (${s})`)]
  for (const lang of ['it', 'en']) {
    for (const cand of candidates) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2500)
        const res = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cand)}`,
          {
            headers: { 'User-Agent': 'WhereWasI-App/1.0 (entertainment tracker)' },
            signal: controller.signal
          }
        )
        clearTimeout(timeout)
        if (res.ok) {
          const data = await res.json()
          const img = data?.thumbnail?.source || data?.originalimage?.source
          if (img && typeof img === 'string') {
            return img
          }
        }
      } catch {
        // Continue to next candidate
      }
    }
  }
  return null
}

async function fetchOpenCover(title: string, mediaType: MediaType): Promise<string | null> {
  const cleanTitle = title.trim()
  if (!cleanTitle) return null

  try {
    if (mediaType === 'book') {
      // 1. Try OpenLibrary
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2500)
        const res = await fetch(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(cleanTitle)}&limit=1`,
          { signal: controller.signal }
        )
        clearTimeout(timeout)
        if (res.ok) {
          const data = await res.json()
          const coverId = data?.docs?.[0]?.cover_i
          if (coverId) {
            const olUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
            return olUrl
          }
        }
      } catch {
        // Fall back to Wikipedia
      }

      // 2. Wikipedia fallback for books
      const wikiCover = await fetchWikiImage(cleanTitle, ['romanzo', 'libro', 'novel', 'book'])
      if (wikiCover) return wikiCover
    } else if (mediaType === 'series') {
      // 1. Try TVMaze
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2500)
        const res = await fetch(
          `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(cleanTitle)}`,
          { signal: controller.signal }
        )
        clearTimeout(timeout)
        if (res.ok) {
          const data = await res.json()
          const img = data?.image?.original || data?.image?.medium
          if (img) return img
        }
      } catch {
        // Fall back to Wikipedia
      }

      // 2. Wikipedia fallback for series
      const wikiCover = await fetchWikiImage(cleanTitle, ['serie televisiva', 'TV series', 'serie'])
      if (wikiCover) return wikiCover
    } else if (mediaType === 'movie') {
      // Wikipedia for movies
      const wikiCover = await fetchWikiImage(cleanTitle, ['film', 'movie'])
      if (wikiCover) return wikiCover
    } else if (mediaType === 'podcast') {
      // 1. iTunes podcast search
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2500)
        const res = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&media=podcast&limit=1`,
          { signal: controller.signal }
        )
        clearTimeout(timeout)
        if (res.ok) {
          const data = await res.json()
          const art = data?.results?.[0]?.artworkUrl600 || data?.results?.[0]?.artworkUrl100
          if (art) return art
        }
      } catch {
        // Fall through
      }

      // 2. Wikipedia fallback
      const wikiCover = await fetchWikiImage(cleanTitle, ['podcast'])
      if (wikiCover) return wikiCover
    } else if (mediaType === 'game') {
      // Wikipedia for games
      const wikiCover = await fetchWikiImage(cleanTitle, ['videogioco', 'video game', 'gioco'])
      if (wikiCover) return wikiCover
    } else {
      const wikiCover = await fetchWikiImage(cleanTitle)
      if (wikiCover) return wikiCover
    }
  } catch {
    // Non-fatal
  }

  return null
}

export default defineEventHandler(async (event): Promise<AutocompleteResult> => {
  const body = await readBody<AutocompleteRequestBody>(event).catch(() => null)
  if (!body || !body.title || !body.title.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Titolo mancante o non valido.'
    })
  }

  const userTitle = body.title.trim()
  const requestedType = body.mediaType || 'series'

  const config = useRuntimeConfig()
  const apiKey = (config.geminiApiKey as string) || process.env.GEMINI_API_KEY || ''

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'Chiave Gemini API non configurata. Imposta GEMINI_API_KEY nel file .env (puoi ottenerla gratis su https://aistudio.google.com/).'
    })
  }

  const prompt = `Sei un assistente enciclopedico specializzato in intrattenimento, film, serie TV, libri, videogiochi e podcast.
Analizza il seguente titolo dell'opera inserito dall'utente e fornisci i dati strutturati accurati.

Titolo cercato dall'utente: "${userTitle}"
Categoria indicata: "${requestedType}" (serie, book, movie, game, podcast, other)

Restituisci un oggetto JSON valido con ESATTAMENTE la seguente struttura:
{
  "title": "Titolo canonico/ufficiale dell'opera (in italiano se ha titolo italiano noto, altrimenti originale)",
  "media_type": "${requestedType}",
  "creator": "Nome dell'autore per i libri, del regista per i film, del creatore/showrunner per le serie tv, dello studio sviluppatore per i videogiochi, dell'host/autore per i podcast",
  "release_year": 2020,
  "genre": "Genere o generi principali separati da virgola in italiano (es. Fantascienza, Thriller, Fantasy)",
  "description": "Una sinossi o trama coinvolgente e concisa in italiano (massimo 2-3 frasi)",
  "cover_url": "URL pubblico ad alta risoluzione della locandina o copertina se disponibile con certezza, altrimenti stringa vuota o null",
  "total_seasons": 5,
  "total_episodes": 62,
  "season_episodes": {
    "1": 7,
    "2": 13,
    "3": 13
  },
  "duration_minutes": 120,
  "total_pages": 350
}

Regole importanti:
1. Se è una serie tv ("series"): compila accuratamente "total_seasons", "total_episodes" e "season_episodes" (mappa della stagione e numero di episodi per quella stagione, es. {"1": 10, "2": 8}).
2. Se è un film ("movie"): compila "duration_minutes" con la durata in minuti (es. 148 per Inception). Imposta total_seasons e total_pages a null.
3. Se è un libro ("book"): compila "total_pages" con il numero indicativo di pagine dell'edizione principale (es. 412). Imposta duration_minutes e total_seasons a null.
4. "creator": sii preciso (es. Christopher Nolan per film Inception, Vince Gilligan per Breaking Bad, J.K. Rowling per Harry Potter).
5. Rispondi SOLO con il JSON valido senza backticks markdown né testo introduttivo.`

  let parsed: any = null

  try {
    const ai = new GoogleGenAI({ apiKey })

    let responseText = ''
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      })
      responseText = response.text || ''
    } catch (err: any) {
      console.warn('Gemini 3.5 flash lite error, trying gemini-3.1-flash-lite:', err?.message)
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      })
      responseText = fallbackResponse.text || ''
    }

    if (!responseText) {
      throw new Error('Risposta vuota da Gemini')
    }

    const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
    parsed = JSON.parse(cleaned)
  } catch (err: any) {
    console.error('Gemini autocomplete error:', err)
    throw createError({
      statusCode: 502,
      statusMessage: `Errore durante la chiamata a Gemini AI: ${err?.message || 'Risposta non valida'}`
    })
  }

  // Resolve cover image:
  // 1. Try dedicated public CDN search (TVMaze, Wikipedia, OpenLibrary, iTunes) using canonical title
  const canonicalTitle = parsed?.title || userTitle
  let resolvedCover = await fetchOpenCover(canonicalTitle, requestedType)

  // 2. If not found by canonical title, try user's original query
  if (!resolvedCover && userTitle !== canonicalTitle) {
    resolvedCover = await fetchOpenCover(userTitle, requestedType)
  }

  // 3. If still not found and Gemini returned a URL, check if Gemini's URL is valid
  if (!resolvedCover && parsed?.cover_url && typeof parsed.cover_url === 'string' && parsed.cover_url.startsWith('http')) {
    const valid = await isValidImageUrl(parsed.cover_url)
    if (valid) {
      resolvedCover = parsed.cover_url
    }
  }

  // Format movie duration if duration_minutes provided
  let formattedTotalDuration: string | null = null
  if (parsed.duration_minutes && parsed.duration_minutes > 0) {
    const hours = Math.floor(parsed.duration_minutes / 60)
    const mins = parsed.duration_minutes % 60
    if (hours > 0 && mins > 0) {
      formattedTotalDuration = `${hours}h ${mins}m`
    } else if (hours > 0) {
      formattedTotalDuration = `${hours}h`
    } else {
      formattedTotalDuration = `${mins}m`
    }
  }

  return {
    title: parsed.title || userTitle,
    media_type: requestedType,
    creator: parsed.creator || null,
    release_year: typeof parsed.release_year === 'number' ? parsed.release_year : null,
    genre: parsed.genre || '',
    description: parsed.description || '',
    cover_url: resolvedCover,
    total_seasons: typeof parsed.total_seasons === 'number' ? parsed.total_seasons : null,
    total_episodes: typeof parsed.total_episodes === 'number' ? parsed.total_episodes : null,
    season_episodes: (parsed.season_episodes && typeof parsed.season_episodes === 'object') ? parsed.season_episodes : null,
    duration_minutes: typeof parsed.duration_minutes === 'number' ? parsed.duration_minutes : null,
    total_duration: formattedTotalDuration,
    total_pages: typeof parsed.total_pages === 'number' ? parsed.total_pages : null
  }
})
