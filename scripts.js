/**
 * 游戏乐园主脚本文件
 * 处理高级交互、动画和功能
 */

// 全局变量
const GAME_DATA = {
  games: [
    {
      id: 1,
      title: "超级马里奥",
      category: "平台游戏",
      rating: 4.72,
      playtime: 25,
      description: "经典的平台跳跃游戏，控制马里奥穿越各种关卡，收集金币，打败敌人！",
      image: "SuperMario/website/assets/1.png",
      url: "SuperMario/website/index.html",
      tags: ["热门", "经典", "平台跳跃"],
      plays: 56824,
      active: true,
      releaseDate: "2023-10-15",
      lastUpdated: "2023-11-02",
      developer: "乐园工作室",
      platform: "Web端",
      achievements: 15,
      difficulty: "中等",
      players: "单人",
      recentPlays: 1253,
      completionRate: "68.4%"
    },
    {
      id: 2,
      title: "GunTower",
      category: "射击游戏",
      rating: 4.65,
      playtime: 18,
      description: "塔楼射击游戏，保卫你的阵地，消灭来袭的敌人，解锁更多武器和升级！",
      image: "GunTower/website/GunTower/assets/2.svg",
      url: "GunTower/HTML/GunTower.html",
      tags: ["射击", "策略", "防守"],
      plays: 49352,
      active: true,
      releaseDate: "2023-09-28",
      lastUpdated: "2023-10-25",
      developer: "乐园工作室",
      platform: "Web端",
      achievements: 20,
      difficulty: "较高",
      players: "单人",
      recentPlays: 987,
      completionRate: "72.1%"
    },
    {
      id: 3,
      title: "GunTower 无限模式",
      category: "射击游戏",
      rating: 4.87,
      playtime: 42,
      description: "GunTower的无限模式版本，挑战你的极限，看看你能坚持多久！",
      image: "GunTower/website/GunTower-Endless/assets/1.svg",
      url: "GunTower/HTML/GunTower-Endless.html",
      tags: ["无限模式", "高难度", "射击"],
      plays: 50651,
      active: true,
      releaseDate: "2023-10-10",
      lastUpdated: "2023-10-28",
      developer: "乐园工作室",
      platform: "Web端",
      achievements: 30,
      difficulty: "高",
      players: "单人",
      recentPlays: 1456,
      completionRate: "54.8%"
    }
  ],
  statistics: {
    totalPlays: 156827,
    totalHours: 89423,
    activePlayers: 32450,
    avgRating: 4.74,
    totalUsers: 87654,
    dailyActiveUsers: 4567,
    weeklyActiveUsers: 18932,
    monthlyActiveUsers: 54321,
    averageSessionTime: 12.5,
    userRetentionRate: 68.3,
    totalAchievementsUnlocked: 123456,
    serverUptime: 99.9,
    lastServerUpdate: "2023-11-05 14:30:00",
    peakConcurrentUsers: 1243,
    averageLevelCompleted: 3.7,
    mostPopularGameId: 1
  }
};

// DOM元素加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  // 初始化所有功能
  initGameFeatures();
  initUserFeedback();
  initGameFilter();
  initAnalytics();
  initResponsiveFeatures();
  initAccessibilityFeatures();
});

/**
 * 初始化游戏相关功能
 */
function initGameFeatures() {
  // 增强游戏卡片交互
  const gameCards = document.querySelectorAll('.game-card-hover');
  gameCards.forEach(card => {
    // 添加鼠标进入效果
    card.addEventListener('mouseenter', function() {
      this.classList.add('shadow-xl');
    });
    
    // 添加鼠标离开效果
    card.addEventListener('mouseleave', function() {
      this.classList.remove('shadow-xl');
    });
    
    // 添加点击波纹效果
    card.addEventListener('click', function(e) {
      // 只有点击链接时才触发
      if (e.target.closest('a')) {
        createRippleEffect(e, this);
      }
    });
  });
  
  // 游戏启动前的加载动画
  const gameLinks = document.querySelectorAll('a[href*="index.html"], a[href*="GunTower.html"]');
  gameLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      // 如果不是在新标签页打开，则显示加载动画
      if (!this.hasAttribute('target') || this.getAttribute('target') !== '_blank') {
        e.preventDefault();
        showGameLoadingScreen(this.href);
      }
    });
  });
}

/**
 * 创建点击波纹效果
 */
function createRippleEffect(event, element) {
  const ripple = document.createElement('span');
  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  ripple.classList.add('absolute', 'rounded-full', 'bg-white/30', 'transform', 'scale-0', 'animate-ping');
  
  element.style.position = 'relative';
  element.appendChild(ripple);
  
  // 移除波纹效果
  setTimeout(() => {
    ripple.remove();
  }, 600);
}

/**
 * 显示游戏加载屏幕
 */
function showGameLoadingScreen(gameUrl) {
  // 创建加载屏幕
  const loadingScreen = document.createElement('div');
  loadingScreen.id = 'game-loading-screen';
  loadingScreen.className = 'fixed inset-0 bg-dark z-50 flex flex-col items-center justify-center';
  
  loadingScreen.innerHTML = `
    <div class="loading-spinner mb-6"></div>
    <h2 class="text-white text-2xl font-bold mb-2">准备游戏中...</h2>
    <p class="text-gray-300">请稍候，游戏即将开始</p>
    <div class="mt-8 w-64 bg-gray-700 rounded-full h-2">
      <div id="loading-progress" class="bg-primary h-2 rounded-full" style="width: 0%"></div>
    </div>
  `;
  
  document.body.appendChild(loadingScreen);
  
  // 模拟加载进度
  let progress = 0;
  const progressBar = document.getElementById('loading-progress');
  
  const interval = setInterval(() => {
    progress += Math.random() * 20;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      
      // 加载完成后跳转到游戏页面
      setTimeout(() => {
        window.location.href = gameUrl;
      }, 500);
    }
    progressBar.style.width = progress + '%';
  }, 300);
}

/**
 * 初始化用户反馈系统
 */
function initUserFeedback() {
  // 表单验证增强
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      // 简单的表单验证
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const message = document.getElementById('message').value.trim();
      
      let isValid = true;
      
      if (!name) {
        showError('name', '请输入您的姓名');
        isValid = false;
      }
      
      if (!email || !isValidEmail(email)) {
        showError('email', '请输入有效的邮箱地址');
        isValid = false;
      }
      
      if (!message) {
        showError('message', '请输入您的留言');
        isValid = false;
      }
      
      if (isValid) {
        // 显示提交成功消息
        showNotification('感谢您的留言！我们会尽快回复您。', 'success');
        contactForm.reset();
        
        // 这里可以添加实际的表单提交逻辑
        // submitFormData({ name, email, message });
      }
    });
    
    // 添加输入字段的焦点事件
    const formInputs = contactForm.querySelectorAll('input, textarea');
    formInputs.forEach(input => {
      input.addEventListener('focus', function() {
        // 移除错误消息
        const errorElement = document.getElementById(`${this.id}-error`);
        if (errorElement) {
          errorElement.remove();
        }
        
        // 添加焦点样式
        this.classList.add('border-primary');
      });
      
      input.addEventListener('blur', function() {
        // 移除焦点样式
        this.classList.remove('border-primary');
      });
    });
  }
  
  // 添加用户评分功能
  const ratingElements = document.querySelectorAll('.rating-stars');
  ratingElements.forEach(element => {
    const stars = element.querySelectorAll('i');
    stars.forEach((star, index) => {
      star.addEventListener('click', function() {
        // 更新评分
        updateRating(stars, index + 1);
        
        // 显示感谢消息
        showNotification('感谢您的评分！', 'success');
      });
      
      star.addEventListener('mouseenter', function() {
        // 临时高亮
        highlightStars(stars, index + 1);
      });
      
      star.addEventListener('mouseleave', function() {
        // 恢复当前评分
        const currentRating = parseInt(element.getAttribute('data-rating') || '0');
        highlightStars(stars, currentRating);
      });
    });
  });
}

/**
 * 显示表单错误消息
 */
function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  
  // 检查是否已有错误消息
  let errorElement = document.getElementById(`${fieldId}-error`);
  if (!errorElement) {
    errorElement = document.createElement('p');
    errorElement.id = `${fieldId}-error`;
    errorElement.className = 'text-red-500 text-sm mt-1';
    field.parentNode.appendChild(errorElement);
  }
  
  errorElement.textContent = message;
  
  // 添加错误样式到输入字段
  field.classList.add('border-red-500');
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * 更新评分星星
 */
function updateRating(stars, rating) {
  stars.forEach((star, index) => {
    if (index < rating) {
      star.className = 'fa fa-star text-yellow-400';
    } else {
      star.className = 'fa fa-star-o text-gray-300';
    }
  });
  
  // 保存评分
  stars[0].parentElement.setAttribute('data-rating', rating);
}

/**
 * 高亮评分星星
 */
function highlightStars(stars, rating) {
  stars.forEach((star, index) => {
    if (index < rating) {
      star.className = 'fa fa-star text-yellow-400';
    } else {
      star.className = 'fa fa-star-o text-gray-300';
    }
  });
}

/**
 * 显示通知消息
 */
function showNotification(message, type = 'info') {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.className = `fixed top-20 right-4 max-w-sm w-full bg-white shadow-lg rounded-lg overflow-hidden transform transition-all duration-300 translate-x-full z-50`;
  
  // 设置通知类型样式
  let iconClass = 'fa-info-circle text-blue-500';
  let bgClass = 'bg-blue-500';
  
  if (type === 'success') {
    iconClass = 'fa-check-circle text-green-500';
    bgClass = 'bg-green-500';
  } else if (type === 'error') {
    iconClass = 'fa-exclamation-circle text-red-500';
    bgClass = 'bg-red-500';
  } else if (type === 'warning') {
    iconClass = 'fa-exclamation-triangle text-yellow-500';
    bgClass = 'bg-yellow-500';
  }
  
  notification.innerHTML = `
    <div class="p-4 flex items-center">
      <i class="fa ${iconClass} mr-3 text-lg"></i>
      <p class="text-gray-700">${message}</p>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // 显示通知
  setTimeout(() => {
    notification.classList.remove('translate-x-full');
    notification.classList.add('translate-x-0');
  }, 10);
  
  // 自动关闭通知
  setTimeout(() => {
    notification.classList.add('translate-x-full');
    notification.classList.remove('translate-x-0');
    
    // 移除元素
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}

/**
 * 初始化游戏过滤器
 */
function initGameFilter() {
  // 这里可以添加游戏搜索和过滤功能
  const searchInput = document.getElementById('game-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      filterGames(searchTerm);
    });
  }
  
  // 类别过滤器
  const categoryFilters = document.querySelectorAll('.category-filter');
  categoryFilters.forEach(filter => {
    filter.addEventListener('click', function() {
      // 移除所有活动状态
      categoryFilters.forEach(f => f.classList.remove('active'));
      
      // 添加当前活动状态
      this.classList.add('active');
      
      const category = this.getAttribute('data-category');
      filterGamesByCategory(category);
    });
  });
}

/**
 * 根据搜索词过滤游戏
 */
function filterGames(searchTerm) {
  const gameCards = document.querySelectorAll('.game-card-hover');
  
  gameCards.forEach(card => {
    const title = card.querySelector('h3').textContent.toLowerCase();
    const description = card.querySelector('p').textContent.toLowerCase();
    
    if (title.includes(searchTerm) || description.includes(searchTerm)) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

/**
 * 根据类别过滤游戏
 */
function filterGamesByCategory(category) {
  const gameCards = document.querySelectorAll('.game-card-hover');
  
  gameCards.forEach(card => {
    if (category === 'all' || card.getAttribute('data-category') === category) {
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

/**
 * 初始化分析功能
 */
function initAnalytics() {
  // 这里可以添加游戏分析代码
  // 记录页面访问
  recordPageView();
  
  // 记录用户交互
  trackUserInteractions();
  
  // 显示统计数据（带有动画效果）
  animateStatistics();
}

/**
 * 动画显示统计数字
 */
function animateStatistics() {
  // 确保DOM元素存在
  const totalPlaysEl = document.getElementById('total-plays');
  const totalHoursEl = document.getElementById('total-hours');
  const activePlayersEl = document.getElementById('active-players');
  const avgRatingEl = document.getElementById('avg-rating');
  
  if (!totalPlaysEl || !totalHoursEl || !activePlayersEl || !avgRatingEl) {
    return;
  }
  
  // 使用Intersection Observer检测元素是否在视口中
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 开始动画
        animateNumber(totalPlaysEl, 0, GAME_DATA.statistics.totalPlays, 2000);
        animateNumber(totalHoursEl, 0, GAME_DATA.statistics.totalHours, 2000);
        animateNumber(activePlayersEl, 0, GAME_DATA.statistics.activePlayers, 2000);
        animateNumber(avgRatingEl, 0, GAME_DATA.statistics.avgRating, 2000, true);
        
        // 只观察一次
        observer.disconnect();
      }
    });
  }, { threshold: 0.1 });
  
  // 观察统计区域的任意一个元素
  observer.observe(totalPlaysEl);
}

/**
 * 数字增长动画
 */
function animateNumber(element, start, end, duration, isDecimal = false) {
  let startTime = null;
  const step = (timestamp) => {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // 缓动函数
    
    let value;
    if (isDecimal) {
      value = (start + (end - start) * easeProgress).toFixed(2);
    } else {
      value = Math.floor(start + (end - start) * easeProgress).toLocaleString();
    }
    
    element.textContent = value;
    
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };
  
  requestAnimationFrame(step);
}

/**
 * 记录页面访问
 */
function recordPageView() {
  console.log('页面访问记录');
  // 这里可以添加实际的分析代码
}

/**
 * 跟踪用户交互
 */
function trackUserInteractions() {
  // 跟踪游戏点击
  const gameLinks = document.querySelectorAll('a[href*="index.html"], a[href*="GunTower.html"]');
  gameLinks.forEach(link => {
    link.addEventListener('click', function() {
      const gameTitle = this.closest('.game-card-hover').querySelector('h3').textContent;
      console.log('游戏点击:', gameTitle);
      // 这里可以添加实际的分析代码
    });
  });
}

/**
 * 初始化响应式功能
 */
function initResponsiveFeatures() {
  // 检测窗口大小变化
  window.addEventListener('resize', handleResize);
  
  // 初始调用
  handleResize();
  
  // 触摸设备检测
  if (isTouchDevice()) {
    document.body.classList.add('touch-device');
    initTouchGestures();
  }
}

/**
 * 处理窗口大小变化
 */
function handleResize() {
  // 这里可以添加响应式设计的调整逻辑
  const viewportWidth = window.innerWidth;
  
  // 根据屏幕大小调整导航
  const navbar = document.getElementById('navbar');
  if (navbar) {
    if (viewportWidth < 768) {
      // 移动端导航调整
    } else {
      // 桌面端导航调整
    }
  }
}

/**
 * 检测是否为触摸设备
 */
function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * 初始化触摸手势
 */
function initTouchGestures() {
  // 这里可以添加触摸手势支持
  let touchStartX = 0;
  let touchEndX = 0;
  
  document.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
  });
  
  document.addEventListener('touchend', function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  });
  
  function handleSwipe() {
    const swipeThreshold = 50;
    
    if (touchEndX < touchStartX - swipeThreshold) {
      // 向左滑动
      console.log('向左滑动');
    } else if (touchEndX > touchStartX + swipeThreshold) {
      // 向右滑动
      console.log('向右滑动');
    }
  }
}

/**
 * 初始化辅助功能
 */
function initAccessibilityFeatures() {
  // 添加键盘导航支持
  document.addEventListener('keydown', handleKeyboardNavigation);
  
  // 增强焦点样式
  enhanceFocusStyles();
}

/**
 * 处理键盘导航
 */
function handleKeyboardNavigation(e) {
  // ESC键关闭弹窗或菜单
  if (e.key === 'Escape') {
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
      mobileMenu.classList.add('hidden');
    }
  }
  
  // 箭头键导航
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    // 这里可以添加游戏选择时的箭头键导航
  }
}

/**
 * 增强焦点样式
 */
function enhanceFocusStyles() {
  // 添加焦点可见性
  const focusableElements = document.querySelectorAll('a, button, input, textarea, select');
  
  focusableElements.forEach(element => {
    element.classList.add('focus:outline-none', 'focus:ring-2', 'focus:ring-primary', 'focus:ring-offset-2');
  });
}

/**
 * 平滑滚动功能
 */
function smoothScrollTo(element, offset = 0) {
  const elementPosition = element.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - offset;
  
  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  });
}

/**
 * 预加载图片资源
 */
function preloadImages(imageUrls) {
  imageUrls.forEach(url => {
    const img = new Image();
    img.src = url;
  });
}

/**
 * 延迟执行函数
 */
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * 节流函数
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const context = this;
    const args = arguments;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 导出常用函数供其他脚本使用
window.GamePark = {
  showNotification,
  smoothScrollTo,
  preloadImages,
  debounce,
  throttle,
  gameData: GAME_DATA
};