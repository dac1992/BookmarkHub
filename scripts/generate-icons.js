const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

// 创建图标的函数
function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 设置背景
  ctx.fillStyle = '#4285f4';  // Google Blue
  ctx.fillRect(0, 0, size, size);

  // 设置文字
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${size * 0.6}px "Microsoft YaHei"`;
  ctx.fillText('书', size/2, size/2);

  return canvas.toBuffer('image/png');
}

// 确保 assets 目录存在
const assetsDir = path.join(__dirname, '../src/assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// 生成不同尺寸的图标
const sizes = {
  icon16: 16,
  icon48: 48,
  icon128: 128
};

// 生成图标文件
Object.entries(sizes).forEach(([name, size]) => {
  const buffer = createIcon(size);
  const filePath = path.join(assetsDir, `${name}.png`);
  fs.writeFileSync(filePath, buffer);
  console.log(`生成图标: ${filePath}`);
});

console.log('所有图标文件已生成'); 