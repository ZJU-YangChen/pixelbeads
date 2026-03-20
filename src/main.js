
document.addEventListener('DOMContentLoaded', () => {
    // Check if dependencies loaded
    if (typeof pixelit === 'undefined') {
        console.error("PixelIt library not loaded");
        alert("错误: 核心库未加载，请检查 js/pixelit.js 是否存在");
        return;
    }

    // Elements - Studio
    const fileInput = document.getElementById('fileInput');
    const sourceImage = document.getElementById('sourceImage');
    const scaleInput = document.getElementById('scaleInput');
    const scaleVal = document.getElementById('scaleVal');
    const generateBtn = document.getElementById('generateBtn');
    const canvas = document.getElementById('pixelitcanvas');
    const paletteSelect = document.getElementById('paletteSelect');
    const paletteFile = document.getElementById('paletteFile');
    const statsTableBody = document.querySelector('#statsTable tbody');
    const completeBtn = document.getElementById('completeBtn');
    
    // Elements - Inventory
    const inventoryTableBody = document.querySelector('#inventoryTable tbody');
    const addBeadBtn = document.getElementById('addBeadBtn');
    const saveNewBeadBtn = document.getElementById('saveNewBeadBtn');
    const addBeadForm = document.getElementById('addBeadForm');
    const addBeadFn = new bootstrap.Modal(document.getElementById('addBeadModal'));

    // Elements - History
    const historyList = document.getElementById('historyList');

    // Export Buttons
    const btnPng = document.getElementById('downloadPng');
    const btnCsv = document.getElementById('downloadCsv');
    const btnStats = document.getElementById('downloadStats');
    const chkNumbers = document.getElementById('showNumbers');

    // State
    let px = new pixelit({
        to: canvas,
        from: sourceImage,
        scale: 8,
        maxWidth: 2000,
        maxHeight: 2000
    });
    let currentGridResponse = null;
    let currentCounts = null; // Store count result

    // Default Palettes
    const Palettes = {
        default: [
            [255,0,0], [255,127,0], [255,255,0], [0,255,0], [0,0,255], [75,0,130], [148,0,211],
            [255,255,255], [0,0,0], [128,128,128], [139,69,19]
        ],
        grayscale: [
            [0,0,0], [50,50,50], [100,100,100], [150,150,150], [200,200,200], [250,250,250], [255,255,255]
        ],
        perler: [
            [255,255,255], [0,0,0], [169,169,169], [139,69,19], [210,180,140],
            [255,0,0], [255,165,0], [255,255,0], [0,128,0], [0,0,255], [128,0,128],
            [255,192,203], [64,224,208], [255,215,0], [192,192,192]
        ],
        hama: [
            [255,255,255], [0,0,0], [255,0,0], [255,255,0], [0,0,255], [0,128,0]
        ]
    };

    // --- Logic ---

    // 1. Initialize
    const init = () => {
        renderInventoryTable();
        renderHistoryList();
        updatePalette();
    };

    // Helper: Update Palette
    const updatePalette = () => {
        const val = paletteSelect.value;
        if (val === 'my_inventory') {
            const inventoryPalette = StorageService.getPaletteForPixelIt();
            if (inventoryPalette.length > 0) {
                px.setPalette(inventoryPalette);
            } else {
                alert('库存为空！请在“我的豆子仓库”中添加颜色，或者选择其他色板。');
                paletteSelect.value = 'default';
                updatePalette();
            }
        } else if (Palettes[val]) {
            px.setPalette(Palettes[val]);
        }
    };

    // --- Inventory Management ---
    
    function renderInventoryTable() {
        const inventory = StorageService.getInventory();
        inventoryTableBody.innerHTML = '';
        
        inventory.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="align-middle"><span class="color-box" style="background-color: ${item.hex};"></span></td>
                <td class="align-middle">${item.name}</td>
                <td class="align-middle">${item.hex}</td>
                <td class="align-middle">${item.id}</td>
                <td class="align-middle" title="双击修改" style="cursor: pointer;">
                    <span class="stock-val text-primary fw-bold" data-id="${item.id}">${item.count}</span>
                    <input type="number" class="form-control form-control-sm d-none stock-input" value="${item.count}" style="width: 100px;">
                </td>
                <td class="align-middle">
                    <button class="btn btn-sm btn-outline-danger delete-bead" data-id="${item.id}">删除</button>
                    <button class="btn btn-sm btn-success d-none save-stock" data-id="${item.id}">保存</button>
                </td>
            `;
            inventoryTableBody.appendChild(tr);

            // Bind Edit Event
            const valSpan = tr.querySelector('.stock-val');
            const input = tr.querySelector('.stock-input');
            const saveBtn = tr.querySelector('.save-stock');
            const deleteBtn = tr.querySelector('.delete-bead');

            // Toggle Edit
            tr.cells[4].addEventListener('dblclick', () => {
                valSpan.classList.add('d-none');
                input.classList.remove('d-none');
                input.focus();
                saveBtn.classList.remove('d-none');
                deleteBtn.classList.add('d-none');
            });

            // Save Logic
            const saveStock = () => {
                const newCount = parseInt(input.value);
                if (!isNaN(newCount) && newCount >= 0) {
                    item.count = newCount;
                    StorageService.saveInventory(inventory);
                    valSpan.innerText = newCount;
                }
                valSpan.classList.remove('d-none');
                input.classList.add('d-none');
                saveBtn.classList.add('d-none');
                deleteBtn.classList.remove('d-none');
                
                // If Palette is My Inventory, refresh pixelit palette
                if (paletteSelect.value === 'my_inventory') updatePalette();
            };

            saveBtn.addEventListener('click', saveStock);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') saveStock();
            });

            deleteBtn.addEventListener('click', () => {
                if(confirm(`确定删除 ${item.name} 吗？`)) {
                    const newInv = inventory.filter(x => x.id !== item.id);
                    StorageService.saveInventory(newInv);
                    renderInventoryTable();
                    if (paletteSelect.value === 'my_inventory') updatePalette();
                }
            });
        });
    }

    addBeadBtn.addEventListener('click', () => {
        addBeadForm.reset();
        addBeadFn.show();
    });

    saveNewBeadBtn.addEventListener('click', () => {
        const formData = new FormData(addBeadForm);
        const newItem = {
            id: parseInt(formData.get('id')),
            name: formData.get('name'),
            hex: formData.get('hex'),
            count: parseInt(formData.get('count'))
        };
        
        if (!newItem.name || !newItem.hex || isNaN(newItem.id)) {
            alert('请完整填写信息');
            return;
        }

        const inv = StorageService.getInventory();
        inv.push(newItem);
        StorageService.saveInventory(inv);
        
        addBeadFn.hide();
        renderInventoryTable();
        if (paletteSelect.value === 'my_inventory') updatePalette();
    });

    // --- Studio Interactions ---

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            sourceImage.src = event.target.result;
            sourceImage.onload = () => {
                sourceImage.style.display = 'block';
            };
        };
        reader.readAsDataURL(file);
    });

    scaleInput.addEventListener('input', (e) => {
        scaleVal.innerText = e.target.value;
        px.setScale(parseInt(e.target.value));
    });

    paletteSelect.addEventListener('change', updatePalette);

    generateBtn.addEventListener('click', () => {
        if (!sourceImage.src) {
            alert('请先上传图片');
            return;
        }

        px.setScale(parseInt(scaleInput.value));
        px.pixelate({ returnGrid: true });
        currentGridResponse = px.getGrid();
        
        updateStats(currentGridResponse);
    });

    // --- Stats & Completion ---

    function updateStats(grid) {
        if (!grid) return;
        currentCounts = Exporter.countColors(grid);
        statsTableBody.innerHTML = '';
        
        // Validation against inventory
        let hasEnoughStock = true;
        const inventory = StorageService.getInventory();
        const invMap = {};
        inventory.forEach(i => invMap[i.hex.toUpperCase()] = i);

        // Filter valid counts for display
        currentCounts.forEach(c => {
            // Find in inventory if possible, even if map was generic
            const hexUpper = c.hex.toUpperCase();
            let invItem = invMap[hexUpper];
            let stockStatus = '';
            
            // Try to find nearest if not exact? (Currently pixelit maps exact from passed palette)
            
            if (invItem) {
                const diff = invItem.count - c.count;
                if (diff < 0) {
                    stockStatus = `<span class="badge bg-danger">缺 ${Math.abs(diff)}</span>`;
                    hasEnoughStock = false;
                } else {
                    stockStatus = `<span class="badge bg-success">充足 (${invItem.count})</span>`;
                }
                c.beadId = invItem.id; // Augment bead ID
                c.beadName = invItem.name;
            } else {
                stockStatus = `<span class="badge bg-secondary">未知/非库存色</span>`;
                c.beadId = '-';
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="color-box" style="background-color: ${c.hex};"></span> ${c.beadName || ''}</td>
                <td>${c.hex}</td>
                <td>${c.beadId}</td>
                <td>${c.count}</td>
                <td>${invItem ? invItem.count : '-'}</td>
                <td>${stockStatus}</td>
            `;
            statsTableBody.appendChild(tr);
        });

        // Enable/Disable Complete Button
        completeBtn.disabled = !hasEnoughStock;
        if (!hasEnoughStock) {
            completeBtn.title = "库存不足，无法完成";
        } else {
            completeBtn.title = "点击消耗库存并保存记录";
        }
    }

    completeBtn.addEventListener('click', () => {
        if (!currentCounts || !currentGridResponse) return;
        if (!confirm("确定要“拼他”吗？这将扣除对应的库存数量并保存到历史记录。")) return;

        const check = StorageService.checkStock(currentCounts);
        if (!check.valid) {
            alert("库存不足，无法完成操作！请检查库存。");
            return;
        }

        // Deduct
        StorageService.deductStock(currentCounts);
        
        // Save History
        const record = {
            title: "拼豆作品 " + new Date().toLocaleString(),
            imgSrc: canvas.toDataURL(), // Save thumbnail
            beadCount: currentCounts.reduce((sum, c) => sum + c.count, 0),
            colorsUsed: currentCounts.length
        };
        StorageService.addHistory(record);

        // Update UI
        renderInventoryTable(); // Refresh numbers
        renderHistoryList();
        updateStats(currentGridResponse); // Refresh table status
        alert("🎉 恭喜！作品已保存，库存已更新。");
    });

    // --- History ---

    function renderHistoryList() {
        const history = StorageService.getHistory();
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<div class="col-12 text-center text-muted">暂无历史记录</div>';
            return;
        }

        history.forEach(rec => {
            const div = document.createElement('div');
            div.className = 'col-md-4 col-sm-6';
            div.innerHTML = `
                <div class="card h-100">
                    <img src="${rec.imgSrc}" class="card-img-top" alt="Thumb" style="image-rendering: pixelated; max-height: 200px; object-fit: contain; background: #eee;">
                    <div class="card-body">
                        <h6 class="card-title">${rec.title || '未命名作品'}</h6>
                        <small class="text-muted">${new Date(rec.timestamp).toLocaleString()}</small>
                        <ul class="list-unstyled mt-2 small">
                            <li>消耗豆子: <strong>${rec.beadCount}</strong> 颗</li>
                            <li>使用颜色: ${rec.colorsUsed} 种</li>
                        </ul>
                    </div>
                </div>
            `;
            historyList.appendChild(div);
        });
    }

    // --- Exports ---
    
    btnPng.addEventListener('click', () => {
        if (!currentGridResponse) return alert('请先生成图纸');
        
        const opts = {
            showNumbers: chkNumbers.checked,
            cellSize: 20
        };
        const printCanvas = Exporter.generatePrintableCanvas(currentGridResponse, opts);
        
        printCanvas.toBlob(blob => {
            const link = document.createElement('a');
            link.download = `pixelbeads_design_${Date.now()}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
        });
    });

    btnCsv.addEventListener('click', () => {
        if (!currentGridResponse) return alert('请先生成图纸');
        Exporter.exportGridCSV(currentGridResponse);
    });

    btnStats.addEventListener('click', () => {
        if (!currentCounts) return alert('请先生成图纸');
        Exporter.exportColorUsageCSV(currentCounts);
    });

    // Boot
    init();
});
