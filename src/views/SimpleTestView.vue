<template>
  <div style="padding: 20px; font-family: sans-serif;">
    <h1 style="color: #333;">游戏数据测试 - 极简版</h1>
    <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto;">
      {{ gameDataJSON }}
    </pre>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// 模拟游戏数据
const mockGames = [
  {
    name: "超级马里奥",
    type: "冒险",
    platform: "Switch",
    tags: ["经典", "动作", "平台"]
  },
  {
    name: "Flappy Bird",
    type: "休闲",
    platform: "移动",
    tags: ["简单", "挑战", "流行"]
  }
]

const gameDataJSON = ref(JSON.stringify(mockGames, null, 2))

onMounted(() => {
  console.log('游戏数据已加载:', mockGames)
})
</script>