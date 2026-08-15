import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/gear', name: 'gear', component: () => import('../views/GearView.vue') },
  { path: '/routes', name: 'routes', component: () => import('../views/RoutesView.vue') },
  { path: '/check', name: 'check', component: () => import('../views/CheckView.vue') },
  { path: '/records', name: 'records', component: () => import('../views/RecordsView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router