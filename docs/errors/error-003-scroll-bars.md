# 双滚动条问题

## 问题描述
主窗口出现双滚动条，影响用户体验

## 原因分析
1. 容器和主内容区域都设置了滚动属性
2. 未正确处理嵌套滚动容器的样式

## 解决方案
1. 容器层面：
   ```css
   .container {
     overflow: hidden;  /* 防止外层出现滚动条 */
   }
   ```

2. 主内容区域：
   ```css
   .main {
     overflow-y: auto;  /* 只允许垂直滚动 */
     overflow-x: hidden;  /* 禁止水平滚动 */
   }
   ```

3. 优化滚动条样式：
   ```css
   .main::-webkit-scrollbar {
     width: 8px;
   }
   
   .main::-webkit-scrollbar-thumb {
     background-color: var(--border-color);
     border-radius: 4px;
   }
   ```

## 相关文件
- src/popup/styles/popup.css

## 预防措施
1. 在嵌套容器中谨慎使用 overflow 属性
2. 明确定义滚动行为的容器
3. 使用 CSS Flexbox 布局时注意溢出处理

## 参考资料
- [MDN: overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)
- [CSS Tricks: Custom Scrollbars](https://css-tricks.com/custom-scrollbars-in-webkit/) 