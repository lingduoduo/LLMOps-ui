<template>
  <div class="about">
    <h1>This is an about page</h1>
    <h1 class="text-3xl font-bold underline text-blue-700">Hello world!</h1>
    <p>The Dream Factory for Programmers</p>
    <a-button type="primary">Register/Login</a-button>
    <a-avatar :style="{ backgroundColor: '#3370ff' }">
      <icon-user />
    </a-avatar>
  </div>
</template>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
</style>
