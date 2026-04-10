/**
 * MARD 豆子色卡提取脚本
 * 用法: QWEN_API_KEY=xxx node skills/extract-mard-colors.js
 */
const fs = require('fs');
const path = require('path');

const IMAGE_PATH = process.argv[2] || 'C:/Users/23361/xwechat_files/wxid_yx1o2s3mui5321_eab5/temp/RWTemp/2026-04/2a4abb1d6fd4c987165750f6ec8867cc.jpg';
const API_KEY = process.env.QWEN_API_KEY;

if (!API_KEY) {
    console.error('❌ 请设置环境变量 QWEN_API_KEY');
    process.exit(1);
}

async function extractColors() {
    console.log('📷 读取色卡图片...');
    const imageBuffer = fs.readFileSync(IMAGE_PATH);
    const base64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    // 分组分批提取，避免 token 超限
    // 色卡分组：1/2/3/4/A/B/C/D/E/9/10/11 共12组，每批4组
    const groups = [
        { label: '1、2、3、4', desc: '图片左上角的第1组(24色套餐)、第2组、第3组、第4组' },
        { label: 'A、B、C', desc: '图片中部左侧的 A 组、B 组、C 组' },
        { label: 'D、E、9', desc: '图片底部的 D 组、E 组，以及中部的第9组' },
        { label: '10、11', desc: '图片中部右侧的第10组和第11组' }
    ];

    const allColors = [];

    for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        console.log(`\n🤖 [${i+1}/${groups.length}] 提取分组: ${g.label} ...`);

        const prompt = `这是MARD品牌拼豆（Perler Beads）的官方色卡图。图中每个六边形色块代表一种豆子颜色，色块内部标注了颜色编号（如B3、H1、A15等）。

请只识别 ${g.desc} 中的所有六边形色块，提取：
1. 色块内的编号文字（如 B3、H1）
2. 该色块的真实视觉颜色对应的十六进制 hex 值

以最紧凑的 JSON 数组格式返回，不要输出其他任何内容：
[{"id":"B3","hex":"#RRGGBB"},{"id":"C3","hex":"#RRGGBB"},...]`;

        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'qwen-vl-max',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: base64 } },
                        { type: 'text', text: prompt }
                    ]
                }],
                max_tokens: 4000
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`API 错误 (${response.status}): ${err}`);
        }

        const data = await response.json();
        const rawText = (data.choices?.[0]?.message?.content || '').trim();

        // 提取 JSON 数组
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            console.warn(`  ⚠️  组 ${g.label} 无法解析，跳过。原始：`, rawText.slice(0, 200));
            continue;
        }

        try {
            const colors = JSON.parse(jsonMatch[0]);
            console.log(`  ✅ 识别到 ${colors.length} 种颜色`);
            allColors.push(...colors);
        } catch (e) {
            console.warn(`  ⚠️  组 ${g.label} JSON 解析失败: ${e.message}`);
            console.warn('  原始:', jsonMatch[0].slice(0, 300));
        }

        // 避免请求过快
        if (i < groups.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // 去重（以 id 为主键）
    const seen = new Set();
    const uniqueColors = allColors.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
    });

    const result = { brand: 'mard', total: uniqueColors.length, colors: uniqueColors };

    // 保存结果
    const outPath = path.join(__dirname, '../docs/data/mard-colors.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');

    console.log(`\n✅ 提取完成！共识别 ${result.total || result.colors?.length} 种颜色`);
    console.log(`📁 已保存到: ${outPath}`);
    console.log('\n🎨 颜色预览（前20条）:');

    (result.colors || []).slice(0, 20).forEach(c => {
        console.log(`  ${c.id.padEnd(5)} ${c.hex}  ${c.name}`);
    });

    // 生成 HTML 预览
    const htmlPath = path.join(__dirname, '../docs/data/mard-preview.html');
    const html = generatePreviewHtml(result.colors || []);
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`\n🖼️  HTML 色卡预览已生成: ${htmlPath}`);
    console.log('   在浏览器中打开此文件即可查看色差效果');
}

function generatePreviewHtml(colors) {
    const items = colors.map(c => `
        <div class="bead" style="background:${c.hex}" title="${c.id}: ${c.name} ${c.hex}">
            <span>${c.id}</span>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<title>MARD 豆子色卡 - Qwen VL 提取结果</title>
<style>
  body { font-family: sans-serif; padding: 20px; background: #f5f5f5; }
  h1 { color: #333; }
  .grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .bead {
    width: 70px; height: 70px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    cursor: pointer;
    position: relative;
  }
  .bead span {
    background: rgba(255,255,255,0.85);
    border-radius: 4px;
    padding: 1px 4px;
    font-size: 11px;
    font-weight: bold;
    color: #222;
  }
  .bead:hover::after {
    content: attr(title);
    position: absolute; bottom: -28px; left: 0;
    background: #333; color: #fff;
    padding: 2px 6px; border-radius: 4px;
    font-size: 11px; white-space: nowrap; z-index: 10;
  }
  .info { margin-bottom: 12px; color: #666; font-size: 14px; }
</style>
</head>
<body>
<h1>MARD 豆子色卡 - Qwen VL 提取结果</h1>
<p class="info">共 ${colors.length} 种颜色 · 鼠标悬停查看色号</p>
<div class="grid">${items}</div>
<script>
  document.querySelectorAll('.bead').forEach(el => {
    el.addEventListener('click', () => {
      const hex = el.style.background;
      navigator.clipboard?.writeText(hex);
    });
  });
</script>
</body>
</html>`;
}

extractColors().catch(err => {
    console.error('❌ 运行出错:', err.message);
    process.exit(1);
});
