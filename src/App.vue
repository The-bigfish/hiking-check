<script setup>
import { onMounted } from 'vue'
import { useGearStore } from './stores/gear'
import { useRouteStore } from './stores/route'
import { useRecordStore } from './stores/record'

const gearStore = useGearStore()
const routeStore = useRouteStore()
const recordStore = useRecordStore()

onMounted(async () => {
  await Promise.all([gearStore.load(), routeStore.load(), recordStore.load()])
})
</script>

<template>
  <div class="layout">
    <nav class="sidebar">
      <div class="brand">
        徒步装备
        <small>出发前检查清单</small>
      </div>
      <RouterLink to="/">首页</RouterLink>
      <RouterLink to="/gear">装备库</RouterLink>
      <RouterLink to="/routes">路线模板</RouterLink>
      <RouterLink to="/check">出发检查</RouterLink>
      <RouterLink to="/records">历史记录</RouterLink>
    </nav>

    <main class="main">
      <RouterView />
    </main>

    <nav class="app-tabbar">
      <RouterLink to="/">首页</RouterLink>
      <RouterLink to="/gear">装备库</RouterLink>
      <RouterLink to="/routes">路线</RouterLink>
      <RouterLink to="/check">检查</RouterLink>
      <RouterLink to="/records">记录</RouterLink>
    </nav>
  </div>
</template>