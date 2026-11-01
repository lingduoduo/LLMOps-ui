<template>
  <main class="max-w-2xl mx-auto px-6 py-12">
    <h1 class="text-3xl font-semibold mb-4">Page not found</h1>
    <p class="text-gray-600 mb-6">The page you are looking for does not exist.</p>
    <router-link
      :to="{ name: 'pages-home' }"
      class="inline-block rounded bg-blue-700 text-white px-4 py-2"
    >
      Go to home
    </router-link>
  </main>
</template>
