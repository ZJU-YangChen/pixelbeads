/**
 * 重新提取分组 - 每组单独一次API调用，避免混淆
 * 只做分组识别，不重新取色（合并到现有 mard-colors.json）
 */
const fs = require('fs');
const path = require('path');

const COLORS_PATH = path.join(__dirname, '../docs/data/mard-colors.json');
const IMAGE_PATH = 'C:/Users/23361/xwechat_files/wxid_yx1o2s3mui5321_eab5/temp/RWTemp/2026-04/2a4abb1d6fd4c987165750f6ec8867cc.jpg';
const API_KEY = process.env.QWEN_API_KEY;
if (!API_KEY) { console.error('请设置 QWEN_API_KEY'); process.exit(1); }

const PACKAGES = {
    "24":  ["1"],
    "48":  ["1","2"],
    "72":  ["1","2","3"],
    "96":  ["1","2","3","4"],
    "120": ["A","B","C","D","E"],
    "144": ["A","B","C","D","E","6"],
    "216": ["A","B","C","D","E","6","9","10","11"]
};

// 每组描述：告诉模型 "这个框里有哪些已知ID，请确认"
// 格式: { group, desc, hint } - hint 是该组中确定存在的几个代表性ID
const GROUP_QUERIES = [
    { group: "1", desc: "图片最左上角标有数字①（1）的白色圆角矩形框", hint: "B3 C3 D9 H1 H7" },
    { group: "2", desc: "图片左上角第二个白色矩形框，标有数字②（2）", hint: "C2 C13 D19 E8" },
    { group: "3", desc: "图片左上角第三个白色矩形框，标有数字③（3）", hint: "A3 B20 D16 D8" },
    { group: "4", desc: "图片左上角第四个白色矩形框，标有数字④（4）", hint: "E11 E14 F1 D5 E10" },
    { group: "5", desc: "图片中部左侧标有数字⑤（5）的白色矩形框", hint: "A15 A5 A8 A12 A9" },
    { group: "6", desc: "图片中部右侧标有数字⑥（6）的白色矩形框", hint: "H8 G15 A2 H13 G16" },
    { group: "9", desc: "图片中部左侧标有数字⑨（9）的白色矩形框", hint: "H17 H18 H19 D23 E19" },
    { group: "10", desc: "图片中部右侧标有数字⑩（10）的白色矩形框", hint: "A26 A25 A20 A23 G18" },
    { group: "11", desc: "图片中部右侧标有数字⑪（11）的白色矩形框", hint: "F15 F19 G20 E21 E22" },
    { group: "A", desc: "图片下部左侧标有大写字母A的白色矩形框", hint: "B10 C2 C13 B6 C4" },
    { group: "B", desc: "图片下部中间标有大写字母B的白色矩形框", hint: "E12 E2 E8 D19 D8" },
    { group: "C", desc: "图片下部右侧标有大写字母C的白色矩形框", hint: "C14 B20 C1 B18 M5" },
    { group: "D", desc: "图片底部左侧标有大写字母D的白色矩形框", hint: "A15 A3 A11 A9 F14" },
    { group: "E", desc: "图片底部右侧标有大写字母E的白色矩形框", hint: "E15 F1 E14 G14 M12" },
];

async function queryGroup(base64, gq) {
    const prompt = `这是MARD拼豆色卡图片。

请找到【${gq.desc}】，读取该框内所有六边形色块上的文字编号（如B3、H1、A15等），返回该框内所有色块的编号列表。

该框内已知有这些编号（供你定位参考）：${gq.hint}

只返回该框内的编号，以JSON数组格式输出，不要输出其他内容：
["B3","C3","D9",...]`;

    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'qwen-vl-max',
            messages: [{ role: 'user', content: [
                { type: 'image_url', image_url: { url: base64 } },
                { type: 'text', text: prompt }
            ]}],
            max_tokens: 1000
        })
    });
    if (!response.ok) throw new Error(`API错误: ${await response.text()}`);
    const raw = ((await response.json()).choices?.[0]?.message?.content || '').trim();
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) { console.warn(`  组${gq.group}: 无法解析 - ${raw.slice(0,100)}`); return []; }
    try { return JSON.parse(match[0]); }
    catch(e) { console.warn(`  组${gq.group}: JSON解析失败`); return []; }
}

async function main() {
    const data = JSON.parse(fs.readFileSync(COLORS_PATH, 'utf8'));
    const allIds = new Set(data.colors.map(c => c.id));

    // 清除旧的 group 字段
    data.colors.forEach(c => delete c.group);

    console.log(`共 ${allIds.size} 种颜色，开始逐组识别...\n`);
    const base64 = `data:image/jpeg;base64,${fs.readFileSync(IMAGE_PATH).toString('base64')}`;

    const groupMap = {};
    for (const gq of GROUP_QUERIES) {
        process.stdout.write(`组 ${gq.group.padEnd(3)}: `);
        const ids = await queryGroup(base64, gq);
        let count = 0;
        ids.forEach(id => {
            if (allIds.has(id) && !groupMap[id]) {
                groupMap[id] = gq.group;
                count++;
            }
        });
        console.log(`识别到 ${ids.length} 个ID，有效 ${count} 个`);
        await new Promise(r => setTimeout(r, 500));
    }

    // 写入 group 字段
    let tagged = 0;
    data.colors.forEach(c => {
        if (groupMap[c.id]) { c.group = groupMap[c.id]; tagged++; }
    });

    data.packages = PACKAGES;
    fs.writeFileSync(COLORS_PATH, JSON.stringify(data, null, 2), 'utf8');

    console.log(`\n✅ 完成: ${tagged}/${allIds.size} 个颜色已标注分组`);
    const untagged = data.colors.filter(c => !c.group).map(c => c.id);
    if (untagged.length) console.warn('未标注:', untagged.join(', '));

    const groupCount = {};
    data.colors.forEach(c => { if (c.group) groupCount[c.group] = (groupCount[c.group]||0)+1; });
    console.log('各组数量:', Object.entries(groupCount).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).map(([g,n])=>`${g}:${n}`).join('  '));
}

main().catch(e => { console.error(e); process.exit(1); });
