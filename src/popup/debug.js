// 基本控制台输出测试
console.log('Debug script loaded');

// DOM加载完成事件
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired (debug.js)');
    
    // 测试按钮点击
    const button = document.querySelector('.test-button');
    if (button) {
        console.log('Found test button');
        button.addEventListener('click', () => {
            console.log('Button clicked (debug.js)');
        });
    } else {
        console.error('Test button not found');
    }
});

// 错误处理
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// 未处理的Promise拒绝
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
}); 