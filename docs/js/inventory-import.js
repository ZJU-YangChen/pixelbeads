/**
 * 库存批量导入模块
 * 支持：选品牌预设（mard）/ 上传色卡AI识别 / 跳过使用默认
 */

const InventoryImport = (() => {
    let modal = null;
    let mardData = null; // { packages, colors }
    let extractedColors = null; // 上传色卡后AI提取的颜色
    let onDone = null; // 完成回调

    // ── 初始化 ──────────────────────────────────────────────
    function init() {
        modal = new bootstrap.Modal(document.getElementById('inventoryImportModal'), { backdrop: 'static' });

        document.getElementById('importOptMard').addEventListener('change', () => switchOption('mard'));
        document.getElementById('importOptUpload').addEventListener('change', () => switchOption('upload'));
        document.getElementById('importOptDefault').addEventListener('change', () => switchOption('default'));

        document.getElementById('mardPackageSelect').addEventListener('change', renderMardPreview);
        document.getElementById('importConfirmBtn').addEventListener('click', doImport);
        document.getElementById('importSkipBtn').addEventListener('click', skipImport);
        document.getElementById('colorCardUpload').addEventListener('change', handleCardUpload);
    }

    // ── 打开弹窗 ─────────────────────────────────────────────
    async function open(options = {}) {
        onDone = options.onDone || null;

        // 重置状态
        document.getElementById('importOptMard').checked = true;
        switchOption('mard');
        document.getElementById('importDefaultQty').value = 1000;
        document.getElementById('colorCardUpload').value = '';   // 重置文件选择
        document.getElementById('uploadStatusMsg').textContent = '';
        document.getElementById('uploadPreviewGrid').innerHTML = '';
        extractedColors = null;

        // 新用户隐藏"跳过"改为"使用默认"
        const skipBtn = document.getElementById('importSkipBtn');
        const title = document.getElementById('importModalTitle');
        if (options.isNew) {
            title.textContent = '欢迎！设置你的初始豆子库存';
            skipBtn.textContent = '跳过，使用默认配色';
        } else {
            title.textContent = '批量导入豆子库存';
            skipBtn.textContent = '取消';
        }

        await loadMardData();
        renderMardPreview();
        modal.show();
    }

    function close() {
        modal.hide();
    }

    // ── 加载 mard 数据 ───────────────────────────────────────
    async function loadMardData() {
        if (mardData) return;
        try {
            const res = await fetch('/data/mard-colors.json');
            mardData = await res.json();
        } catch (e) {
            console.error('加载mard色卡失败', e);
            mardData = { packages: {}, colors: [] };
        }
    }

    // ── 切换选项 ─────────────────────────────────────────────
    function switchOption(opt) {
        document.getElementById('mardPanel').classList.toggle('d-none', opt !== 'mard');
        document.getElementById('uploadPanel').classList.toggle('d-none', opt !== 'upload');
        document.getElementById('defaultPanel').classList.toggle('d-none', opt !== 'default');
        // 数量行：default 选项时隐藏
        document.getElementById('qtySection').classList.toggle('d-none', opt === 'default');

        const confirmBtn = document.getElementById('importConfirmBtn');
        if (opt === 'upload' && !extractedColors) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = '请先识别色卡';
        } else {
            confirmBtn.disabled = false;
            confirmBtn.textContent = '确认导入';
        }
    }

    // ── mard 预览 ─────────────────────────────────────────────
    function renderMardPreview() {
        if (!mardData) return;
        const pkg = document.getElementById('mardPackageSelect').value; // e.g. "96"
        const groups = mardData.packages?.[pkg] || [];
        const colors = mardData.colors.filter(c => groups.includes(c.group));

        document.getElementById('mardColorCount').textContent = `${colors.length} 种颜色`;

        const grid = document.getElementById('mardPreviewGrid');
        grid.innerHTML = colors.map(c => `
            <div style="width:28px;height:28px;border-radius:5px;background:${c.hex};
                box-shadow:0 1px 4px rgba(0,0,0,.2);flex-shrink:0"
                title="${c.id} ${c.hex}"></div>
        `).join('');
    }

    // ── 上传色卡 AI 识别 ──────────────────────────────────────
    async function handleCardUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const statusMsg = document.getElementById('uploadStatusMsg');
        const confirmBtn = document.getElementById('importConfirmBtn');
        const grid = document.getElementById('uploadPreviewGrid');

        statusMsg.className = 'text-muted small';
        statusMsg.textContent = '🤖 正在识别颜色，请稍候...';
        confirmBtn.disabled = true;
        grid.innerHTML = '';
        extractedColors = null;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const res = await fetch('/api/ai/extract-colorcard', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageBase64: ev.target.result })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                extractedColors = data.colors; // [{id, hex}]
                statusMsg.className = 'text-success small';
                statusMsg.textContent = `✅ 识别完成，共 ${extractedColors.length} 种颜色`;

                grid.innerHTML = extractedColors.map(c => `
                    <div style="width:28px;height:28px;border-radius:5px;background:${c.hex};
                        box-shadow:0 1px 4px rgba(0,0,0,.2);flex-shrink:0"
                        title="${c.id || ''} ${c.hex}"></div>
                `).join('');

                confirmBtn.disabled = false;
                confirmBtn.textContent = '确认导入';
            } catch (err) {
                statusMsg.className = 'text-danger small';
                statusMsg.textContent = `❌ 识别失败：${err.message}`;
            }
        };
        reader.readAsDataURL(file);
    }

    // ── 执行导入 ──────────────────────────────────────────────
    async function doImport() {
        // 读取当前可见面板的 qty
        const opt = document.querySelector('input[name="importOption"]:checked').value;
        const qtyId = opt === 'default' ? 'importDefaultQtyDef' : 'importDefaultQty';
        const qty = parseInt(document.getElementById(qtyId)?.value) || 1000;

        let colors = [];

        if (opt === 'mard') {
            const pkg = document.getElementById('mardPackageSelect').value;
            const groups = mardData.packages?.[pkg] || [];
            colors = mardData.colors.filter(c => groups.includes(c.group));
        } else if (opt === 'upload') {
            colors = extractedColors || [];
        } else {
            // default：不导入，直接用系统默认
            markSetupDone();
            close();
            if (onDone) onDone('default');
            return;
        }

        if (colors.length === 0) {
            alert('没有可导入的颜色，请重新选择');
            return;
        }

        const btn = document.getElementById('importConfirmBtn');
        btn.disabled = true;
        btn.textContent = '导入中...';

        try {
            // 转换为库存格式
            const inventoryItems = colors.map((c, i) => ({
                id: `${c.id || i + 1}`,
                name: c.id || c.hex,
                hex: c.hex,
                count: qty
            }));

            await StorageService.batchImport(inventoryItems);
            markSetupDone();
            close();
            if (onDone) onDone('imported', inventoryItems.length);
        } catch (err) {
            alert('导入失败：' + err.message);
            btn.disabled = false;
            btn.textContent = '确认导入';
        }
    }

    // ── 跳过 ─────────────────────────────────────────────────
    function skipImport() {
        markSetupDone();
        close();
        if (onDone) onDone('skipped');
    }

    function markSetupDone() {
        const user = StorageService.getCurrentUserId();
        if (user) localStorage.setItem(`setup_done_${user}`, '1');
    }

    return { init, open, close };
})();
