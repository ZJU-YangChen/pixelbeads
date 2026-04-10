/**
 * MARD 色卡精准取色脚本 v2
 * 策略：qwen-vl 识别色块坐标 → jimp 像素采样
 * 用法: QWEN_API_KEY=xxx node skills/extract-mard-colors-v2.js
 */
const fs = require('fs');
const path = require('path');
const { Jimp, intToRGBA } = require('jimp');

const IMAGE_PATH = process.argv[2] || 'C:/Users/23361/xwechat_files/wxid_yx1o2s3mui5321_eab5/temp/RWTemp/2026-04/2a4abb1d6fd4c987165750f6ec8867cc.jpg';
const API_KEY = process.env.QWEN_API_KEY;

if (!API_KEY) {
    console.error('请设置环境变量 QWEN_API_KEY');
    process.exit(1);
}

const BATCHES = [
    { label: '分组1和2', desc: '图片左上角标有①的大框中的第1组（含B3 C3 D9 E2 G1 A4等24个色块）和第2组（含C2 C13 D19等色块）' },
    { label: '分组3和4', desc: '图片左上角第3组（含A3 B20等色块）和第4组（含E11 E14 F1等色块）' },
    { label: '分组5和6', desc: '图片中部第5组（含A15 A5 A8等色块）和第6组（含H8 G15 A2等色块）' },
    { label: '分组9', desc: '图片中部左侧标有⑨的分组（含H17 H18 H19等色块）' },
    { label: '分组10和11', desc: '图片中部右侧第10组（含A26 A25等色块）和第11组（含F15 F19等色块）' },
    { label: '分组A和B', desc: '图片下部左侧标有A的大框和B大框中的色块' },
    { label: '分组C和D', desc: '图片下部标有C的大框和D大框中的色块' },
    { label: '分组E', desc: '图片最下部标有E的大框中的色块（含E15 F1 E14 F11 H2 H1等）' },
];

async function callQwenForCoords(base64, batchDesc) {
    const prompt = `这是MARD品牌拼豆色卡图片。

请识别【${batchDesc}】中每一个六边形色块的：
1. 色块内部的文字编号（如 B3、H1、A15 等）
2. 该色块中心点在图片中的像素坐标 x 和 y（图片左上角为原点）

只返回 JSON 数组，格式如下，不要输出任何其他内容：
[{"id":"B3","x":123,"y":456},{"id":"C3","x":200,"y":456},...]`;

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
    return (data.choices?.[0]?.message?.content || '').trim();
}

function isColorPixel(c) {
    // 只过滤纯白背景 (三通道同时 >248) 和纯黑文字 (三通道同时 <25)
    return !(c.r > 248 && c.g > 248 && c.b > 248) &&
           !(c.r < 25 && c.g < 25 && c.b < 25);
}

async function sampleColorAt(image, x, y) {
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    // 收集 10px 范围内所有有效像素
    const pixels = [];
    for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -10; dx <= 10; dx++) {
            const px = Math.max(0, Math.min(w - 1, x + dx));
            const py = Math.max(0, Math.min(h - 1, y + dy));
            const color = intToRGBA(image.getPixelColor(px, py));
            if (isColorPixel(color)) {
                pixels.push(color);
            }
        }
    }

    if (pixels.length === 0) {
        const color = intToRGBA(image.getPixelColor(x, y));
        return { hex: rgbToHex(color.r, color.g, color.b), snapX: x, snapY: y };
    }

    // 用中位数颜色（对边框噪点更鲁棒）
    const rs = pixels.map(c => c.r).sort((a, b) => a - b);
    const gs = pixels.map(c => c.g).sort((a, b) => a - b);
    const bs = pixels.map(c => c.b).sort((a, b) => a - b);
    const mid = Math.floor(pixels.length / 2);

    return {
        hex: rgbToHex(rs[mid], gs[mid], bs[mid]),
        snapX: x,
        snapY: y
    };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

async function main() {
    console.log('读取色卡图片...');
    const imageBuffer = fs.readFileSync(IMAGE_PATH);
    const base64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
    const image = await Jimp.read(IMAGE_PATH);
    console.log(`图片尺寸: ${image.bitmap.width} x ${image.bitmap.height}`);

    const allBeads = [];

    for (let i = 0; i < BATCHES.length; i++) {
        const batch = BATCHES[i];
        console.log(`\n[${i + 1}/${BATCHES.length}] 识别坐标: ${batch.label} ...`);

        const rawText = await callQwenForCoords(base64, batch.desc);

        const jsonMatch = rawText.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) {
            console.warn(`  无法解析 JSON，跳过。原始: ${rawText.slice(0, 150)}`);
            continue;
        }

        let beads;
        try {
            beads = JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.warn(`  JSON 解析失败: ${e.message}`);
            continue;
        }

        console.log(`  识别到 ${beads.length} 个色块坐标，像素取色中...`);

        for (const bead of beads) {
            const x = Math.round(Number(bead.x));
            const y = Math.round(Number(bead.y));
            if (isNaN(x) || isNaN(y) || x < 0 || y < 0) continue;
            const result = await sampleColorAt(image, x, y);
            allBeads.push({ id: bead.id, hex: result.hex, x: result.snapX, y: result.snapY });
        }

        if (i < BATCHES.length - 1) {
            await new Promise(r => setTimeout(r, 800));
        }
    }

    // 去重（id 为主键）
    const seen = new Set();
    const unique = allBeads.filter(b => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
    });

    const result = {
        brand: 'mard',
        total: unique.length,
        colors: unique.map(({ id, hex }) => ({ id, hex }))
    };

    const outDir = path.join(__dirname, '../docs/data');
    fs.mkdirSync(outDir, { recursive: true });

    const jsonPath = path.join(outDir, 'mard-colors.json');
    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8');
    console.log(`\n完成！共提取 ${result.total} 种颜色 -> ${jsonPath}`);

    // 生成调试图（标注采样点位置）
    const debugImage = image.clone();
    for (const b of unique) {
        const found = allBeads.find(a => a.id === b.id);
        if (!found) continue;
        const red = 0xFF0000FF;
        for (let d = -6; d <= 6; d++) {
            if (found.x + d >= 0 && found.x + d < image.bitmap.width)
                debugImage.setPixelColor(red, found.x + d, found.y);
            if (found.y + d >= 0 && found.y + d < image.bitmap.height)
                debugImage.setPixelColor(red, found.x, found.y + d);
        }
    }
    const debugPath = path.join(outDir, 'mard-debug.jpg');
    await debugImage.write(debugPath);
    console.log(`调试图 (采样点标注): ${debugPath}`);

    // HTML 预览
    const htmlPath = path.join(outDir, 'mard-preview.html');
    fs.writeFileSync(htmlPath, generateHtml(result.colors), 'utf8');
    console.log(`HTML 预览: ${htmlPath}`);

    console.log('\n前20条预览:');
    result.colors.slice(0, 20).forEach(c => {
        console.log(`  ${c.id.padEnd(5)} ${c.hex}`);
    });
}

function generateHtml(colors) {
    const items = colors.map(c => `
        <div class="bead" style="background:${c.hex}" title="${c.id}  ${c.hex}">
            <span>${c.id}</span>
        </div>`).join('');
    return `<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8">
<title>MARD 色卡 - 像素取色结果</title>
<style>
body{font-family:sans-serif;padding:20px;background:#f0f0f0}
h1{color:#333;font-size:18px}
.info{color:#666;font-size:13px;margin-bottom:12px}
.grid{display:flex;flex-wrap:wrap;gap:6px}
.bead{width:64px;height:64px;border-radius:8px;display:flex;align-items:center;
  justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25);cursor:pointer;position:relative}
.bead span{background:rgba(255,255,255,.85);border-radius:4px;padding:1px 4px;
  font-size:11px;font-weight:bold;color:#222}
.bead:hover::after{content:attr(title);position:absolute;bottom:-26px;left:0;
  background:#333;color:#fff;padding:2px 6px;border-radius:4px;font-size:11px;
  white-space:nowrap;z-index:10}
</style></head><body>
<h1>MARD 豆子色卡 — 像素取色结果（共 ${colors.length} 色）</h1>
<p class="info">鼠标悬停查看色号 · 点击复制 hex</p>
<div class="grid">${items}</div>
<script>
document.querySelectorAll('.bead').forEach(el=>{
  el.addEventListener('click',()=>navigator.clipboard?.writeText(el.style.background));
});
</script></body></html>`;
}

main().catch(err => {
    console.error('运行出错:', err);
    process.exit(1);
});
