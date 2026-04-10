/**
 * 给 mard-colors.json 中每种颜色打上分组标签
 * 只做文字识别，不重新取色，1次API调用
 * 用法: QWEN_API_KEY=xxx node skills/tag-mard-groups.js
 */
const fs = require('fs');
const path = require('path');

const COLORS_PATH = path.join(__dirname, '../docs/data/mard-colors.json');
const IMAGE_PATH = 'C:/Users/23361/xwechat_files/wxid_yx1o2s3mui5321_eab5/temp/RWTemp/2026-04/2a4abb1d6fd4c987165750f6ec8867cc.jpg';
const API_KEY = process.env.QWEN_API_KEY;

if (!API_KEY) { console.error('请设置 QWEN_API_KEY'); process.exit(1); }

// 包装定义（根据色卡右下角图例）
const PACKAGES = {
    "24":  ["1"],
    "48":  ["1","2"],
    "72":  ["1","2","3"],
    "96":  ["1","2","3","4"],
    "120": ["A","B","C","D","E"],
    "144": ["A","B","C","D","E","6"],
    "216": ["A","B","C","D","E","6","9","10","11"]
};

async function main() {
    const data = JSON.parse(fs.readFileSync(COLORS_PATH, 'utf8'));
    const ids = data.colors.map(c => c.id);
    console.log(`已有 ${ids.length} 种颜色，开始识别分组...`);

    const base64 = `data:image/jpeg;base64,${fs.readFileSync(IMAGE_PATH).toString('base64')}`;

    const prompt = `这是MARD品牌拼豆色卡图片，图中有多个分组框，框内标有数字编号（1、2、3、4、5、6、9、10、11）或字母（A、B、C、D、E）。

以下是我已知的全部色块编号列表：
${JSON.stringify(ids)}

请识别每个色块编号所在的分组（框），只需返回一个 JSON 数组，格式如下，不要输出任何其他内容：
[{"id":"B3","group":"1"},{"id":"C3","group":"1"},...]

说明：
- 分组值只能是以下之一：1、2、3、4、5、6、9、10、11、A、B、C、D、E
- 如果某个ID实在无法确认，group填null`;

    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'qwen-vl-max',
            messages: [{ role: 'user', content: [
                { type: 'image_url', image_url: { url: base64 } },
                { type: 'text', text: prompt }
            ]}],
            max_tokens: 6000
        })
    });

    if (!response.ok) throw new Error(`API 错误: ${await response.text()}`);
    const raw = ((await response.json()).choices?.[0]?.message?.content || '').trim();

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) { console.error('无法解析JSON:\n', raw.slice(0,300)); process.exit(1); }

    let groups;
    try { groups = JSON.parse(match[0]); }
    catch(e) {
        // 尝试修复截断的JSON
        const fixed = match[0].replace(/,\s*\{[^}]*$/, ']');
        try { groups = JSON.parse(fixed); console.warn('JSON 被截断，已修复'); }
        catch(e2) { console.error('JSON解析失败:', e2.message); process.exit(1); }
    }

    const groupMap = {};
    groups.forEach(g => { if (g.id && g.group) groupMap[g.id] = String(g.group); });

    // 合并
    let matched = 0, unmatched = [];
    data.colors.forEach(c => {
        if (groupMap[c.id]) { c.group = groupMap[c.id]; matched++; }
        else { unmatched.push(c.id); }
    });

    data.packages = PACKAGES;

    fs.writeFileSync(COLORS_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ 分组标注完成: ${matched}/${ids.length} 成功`);
    if (unmatched.length) console.warn('未匹配:', unmatched.join(', '));

    // 统计各组颜色数
    const groupCount = {};
    data.colors.forEach(c => { if (c.group) groupCount[c.group] = (groupCount[c.group]||0)+1; });
    console.log('\n各组颜色数:', Object.entries(groupCount).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).map(([g,n])=>`${g}:${n}`).join('  '));
}

main().catch(e => { console.error(e); process.exit(1); });
