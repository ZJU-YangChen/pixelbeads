/**
 * 专门提取 A/B/C/D/E 组的颜色（带 group 标签）
 * 因为这些组和 1-6 组有 ID 重叠，单独提取后追加到 mard-colors.json
 */
const fs = require('fs');
const path = require('path');
const { Jimp, intToRGBA } = require('jimp');

const COLORS_PATH = path.join(__dirname, '../docs/data/mard-colors.json');
const IMAGE_PATH = 'C:/Users/23361/xwechat_files/wxid_yx1o2s3mui5321_eab5/temp/RWTemp/2026-04/2a4abb1d6fd4c987165750f6ec8867cc.jpg';
const API_KEY = process.env.QWEN_API_KEY;
if (!API_KEY) { console.error('请设置 QWEN_API_KEY'); process.exit(1); }

const LETTER_GROUPS = [
    { group: 'A', desc: '图片下部左侧标有大写字母A的白色矩形框内的所有六边形色块', hint: 'B10 C2 C13 B6 C4' },
    { group: 'B', desc: '图片下部中间标有大写字母B的白色矩形框内的所有六边形色块', hint: 'E12 E2 E8 D19 D8' },
    { group: 'C', desc: '图片下部右侧标有大写字母C的白色矩形框内的所有六边形色块', hint: 'C14 B20 C1 B18 M5' },
    { group: 'D', desc: '图片底部左侧标有大写字母D的白色矩形框内的所有六边形色块', hint: 'A15 A3 A11 A9 F14' },
    { group: 'E', desc: '图片底部右侧标有大写字母E的白色矩形框内的所有六边形色块', hint: 'E15 F1 G14 M12 H6' },
];

function isColorPixel(c) {
    return !(c.r > 248 && c.g > 248 && c.b > 248) && !(c.r < 25 && c.g < 25 && c.b < 25);
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

async function sampleColorAt(image, x, y) {
    const w = image.bitmap.width, h = image.bitmap.height;
    const pixels = [];
    for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) {
        const px = Math.max(0, Math.min(w-1, x+dx)), py = Math.max(0, Math.min(h-1, y+dy));
        const color = intToRGBA(image.getPixelColor(px, py));
        if (isColorPixel(color)) pixels.push(color);
    }
    if (!pixels.length) {
        const c = intToRGBA(image.getPixelColor(x, y));
        return rgbToHex(c.r, c.g, c.b);
    }
    const rs = pixels.map(c => c.r).sort((a,b)=>a-b);
    const gs = pixels.map(c => c.g).sort((a,b)=>a-b);
    const bs = pixels.map(c => c.b).sort((a,b)=>a-b);
    const mid = Math.floor(pixels.length / 2);
    return rgbToHex(rs[mid], gs[mid], bs[mid]);
}

async function extractGroup(base64, image, gq) {
    const prompt = `这是MARD拼豆色卡图片。

请找到【${gq.desc}】，识别其中每个六边形色块的：
1. 色块内的文字编号（如 B3、H1 等）
2. 色块中心点的像素坐标 x 和 y（以图片左上角为原点）

提示：该组内有这些色块：${gq.hint}

以JSON数组返回，不输出其他内容：
[{"id":"B10","x":123,"y":456},...]`;

    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'qwen-vl-max',
            messages: [{ role: 'user', content: [
                { type: 'image_url', image_url: { url: base64 } },
                { type: 'text', text: prompt }
            ]}],
            max_tokens: 2000
        })
    });
    if (!response.ok) throw new Error(await response.text());
    const raw = ((await response.json()).choices?.[0]?.message?.content || '').trim();
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) { console.warn(`  组${gq.group}: 无法解析`); return []; }
    let beads;
    try { beads = JSON.parse(match[0]); } catch(e) { console.warn(`  JSON解析失败`); return []; }

    const results = [];
    for (const b of beads) {
        const x = Math.round(Number(b.x)), y = Math.round(Number(b.y));
        if (isNaN(x) || isNaN(y) || x < 0 || y < 0) continue;
        const hex = await sampleColorAt(image, x, y);
        results.push({ id: b.id, hex, group: gq.group });
    }
    return results;
}

async function main() {
    const data = JSON.parse(fs.readFileSync(COLORS_PATH, 'utf8'));
    const image = await Jimp.read(IMAGE_PATH);
    const base64 = `data:image/jpeg;base64,${fs.readFileSync(IMAGE_PATH).toString('base64')}`;

    console.log('提取字母组 A/B/C/D/E 颜色...\n');

    // 移除旧的 A-E 组数据
    data.colors = data.colors.filter(c => !['A','B','C','D','E'].includes(c.group));

    for (const gq of LETTER_GROUPS) {
        process.stdout.write(`组 ${gq.group}: `);
        const colors = await extractGroup(base64, image, gq);
        console.log(`${colors.length} 种颜色`);
        data.colors.push(...colors);
        await new Promise(r => setTimeout(r, 600));
    }

    data.total = data.colors.length;
    fs.writeFileSync(COLORS_PATH, JSON.stringify(data, null, 2), 'utf8');

    const groupCount = {};
    data.colors.forEach(c => { if (c.group) groupCount[c.group] = (groupCount[c.group]||0)+1; });
    console.log('\n各组数量:', Object.entries(groupCount).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).map(([g,n])=>`${g}:${n}`).join('  '));
    console.log(`总计: ${data.colors.length} 种颜色 -> ${COLORS_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
