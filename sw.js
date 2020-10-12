var APP_PREFIX = 'SutekinaGen_'     // Identifier for this app (this needs to be consistent across every cache update)
var VERSION = 'version_03'              // Version of the off-line cache (change this value everytime you want to update cache)
var CACHE_NAME = APP_PREFIX + VERSION
var URLS = [                            // Add URL you want to cache in this list.
    '/',
    '/index.html',
    '/app.css',
    '/app.js',
    '/jspdf.min.js',
    '/JTUQjIg1_i6t8kCHKm459WxRyS7m.woff2',
    '/JTURjIg1_i6t8kCHKm45_cJD3gnD_g.woff2',
    '/JTURjIg1_i6t8kCHKm45_dJE3gnD_g.woff2',
    '/JTUSjIg1_i6t8kCHKm459Wlhyw.woff2',
    '/logos.js',
    '/mithril.min.js',
    '/Montserrat-Fonts.js',
    '/pdfgenerator.js',
    '/xlsx.full.min.js',
    '/favicon.ico',
    '/favicon-192x192.png',
    '/favicon-512x512.png',
    '/site.webmanifest'
]

// Respond with cached resources
self.addEventListener('fetch', function (e) {
    console.log('Fetch request : ' + e.request.url)
    e.respondWith(
        caches.match(e.request).then(function (request) {
            if (request) { // if cache is available, respond with cache
                console.log('Responding with cache : ' + e.request.url)
                return request
            } else {       // if there are no cache, try fetching request
                console.log('File is not cached, fetching : ' + e.request.url)
                return fetch(e.request)
            }

            // You can omit if/else for console.log & put one line below like this too.
            // return request || fetch(e.request)
        })
    )
})

// Cache resources
self.addEventListener('install', function (e) {
    e.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            console.log('Installing cache : ' + CACHE_NAME)
            return cache.addAll(URLS)
        })
    )
})

// Delete outdated caches
self.addEventListener('activate', function (e) {
    e.waitUntil(
        caches.keys().then(function (keyList) {
            // `keyList` contains all cache names under your username.github.io
            // filter out ones that has this app prefix to create white list
            var cacheWhitelist = keyList.filter(function (key) {
                return key.indexOf(APP_PREFIX)
            })
            // add current cache name to white list
            cacheWhitelist.push(CACHE_NAME)

            return Promise.all(keyList.map(function (key, i) {
                if (cacheWhitelist.indexOf(key) === -1) {
                    console.log('Deleting cache : ' + keyList[i])
                    return caches.delete(keyList[i])
                }
            }))
        })
    )
})