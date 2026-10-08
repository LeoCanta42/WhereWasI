// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  vite: {
    resolve: {
      preserveSymlinks: true
    }
  },

  telemetry: false,

  fonts: {
    providers: {
      google: false,
      bunny: false,
      fontshare: false,
      fontsource: false
    }
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'it'
      },
      title: 'WhereWasI? — Traccia serie, libri e film con gli amici',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#6366f1' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'WhereWasI?' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'format-detection', content: 'telephone=no' }
      ],
      link: [
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' }
      ]
    }
  },

  colorMode: {
    preference: 'system',
    fallback: 'dark',
    classSuffix: ''
  },

  modules: ['@nuxtjs/supabase', '@nuxt/ui', '@vite-pwa/nuxt'],

  supabase: {
    redirect: false
  },

  pwa: {
    registerType: 'autoUpdate',
    registerWebManifestInRouteRules: true,
    devOptions: {
      enabled: false,
      suppressWarnings: true
    },
    client: {
      installPrompt: 'where-was-i:install-dismissed'
    },
    manifest: {
      id: '/',
      name: 'WhereWasI? — Tracker Serie, Libri e Film',
      short_name: 'WhereWasI?',
      description: 'Tieni traccia di episodi, pagine lette e condividi i tuoi progressi con gli amici.',
      lang: 'it',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'any',
      background_color: '#0f172a',
      theme_color: '#6366f1',
      categories: ['entertainment', 'books', 'lifestyle'],
      prefer_related_applications: false,
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ],
      shortcuts: [
        { name: 'Le mie Serie', short_name: 'Serie', url: '/?type=series' },
        { name: 'I miei Libri', short_name: 'Libri', url: '/?type=book' },
        { name: 'Attività Amici', short_name: 'Amici', url: '/friends' }
      ]
    }
  }
})
