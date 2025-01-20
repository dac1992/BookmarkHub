console.log('调试文件加载');

export function initDebug() {
  console.log('初始化调试');
  
  const button = document.querySelector('.test-button');
  if (button) {
    console.log('找到测试按钮');
    button.addEventListener('click', () => {
      console.log('按钮被点击');
    });
  } else {
    console.error('未找到测试按钮');
  }
} 